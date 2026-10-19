package com.yourcompany.godhand;


import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Verwaltet die Whitelist für Bogen-Funktionen.
 */
public class BowWhitelistManager {
    /**
     * Cache für bereits aufgelöste Spielernamen, um N+1 Lookups im UserCache zu vermeiden.
     */
    private static final Map<String, Text> RESOLVED_NAME_CACHE = new ConcurrentHashMap<>();

    /**
     * Default constructor for BowWhitelistManager.
     */
    public static java.util.List<String> localClientWhitelist = new java.util.ArrayList<>();
    public static void updateLocalWhitelist(java.util.List<String> list) { localClientWhitelist.clear(); localClientWhitelist.addAll(list); }
    public BowWhitelistManager() {
        super();
    }


    /**
     * Updates the whitelist for a player name or UUID and syncs with clients.
     * @param server The MinecraftServer.
     * @param input The player name or UUID string.
     * @param add True to add, false to remove.
     */
    public static void updatePlayerWhitelist(MinecraftServer server, String input, boolean add) {
        if (server == null) return;
        UUID uuid;
        try {
            uuid = UUID.fromString(input);
        } catch (IllegalArgumentException e) {
            uuid = getPlayerUuidByName(server, input);
        }

        if (uuid != null) {
            boolean changed = add ? addPlayer(uuid) : removePlayer(uuid);
            if (changed) {
                server.getPlayerManager().getPlayerList().forEach(p -> net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking.send(p, new com.yourcompany.godhand.network.SyncBowWhitelistPacket(new java.util.ArrayList<>(GodHandConfig.getInstance().player.bowWhitelistConfig.whitelistedPlayers))));
            }
        }
    }

    /**
     * Fügt einen Spieler zur Whitelist hinzu.
     * @param playerUuid Die UUID des Spielers.
     * @return True, wenn der Spieler hinzugefügt wurde, false, wenn er bereits auf der Whitelist war.
     */
    public static boolean addPlayer(UUID playerUuid) {
        GodHandConfig config = GodHandConfig.getInstance();
        Set<String> whitelistedPlayers = config.player.bowWhitelistConfig.whitelistedPlayers;
        String uuidString = playerUuid.toString();

        // Konsistente Sperrreihenfolge: Immer zuerst GodHandConfig synchronisieren.
        // whitelistedPlayers ist ein ConcurrentHashMap Set, daher ist .add() thread-sicher.
        // Die Synchronisation auf config stellt sicher, dass add und saveAsync atomar aus Sicht der Speicherung sind.
        synchronized (config) {
            if (!whitelistedPlayers.contains(uuidString)) {
                whitelistedPlayers.add(uuidString);
                RESOLVED_NAME_CACHE.clear(); // Cache invalidieren bei Änderungen
                GodHandConfig.saveAsync(config);
                DiagnosticManager.log("Player " + playerUuid + " added to bow whitelist.");
                return true;
            }
        }
        return false;
    }

    /**
     * Entfernt einen Spieler von der Whitelist.
     * @param playerUuid Die UUID des Spielers.
     * @return True, wenn der Spieler entfernt wurde, false, wenn er nicht auf der Whitelist war.
     */
    public static boolean removePlayer(UUID playerUuid) {
        GodHandConfig config = GodHandConfig.getInstance();
        Set<String> whitelistedPlayers = config.player.bowWhitelistConfig.whitelistedPlayers;
        String uuidString = playerUuid.toString();

        synchronized (config) {
            if (whitelistedPlayers.remove(uuidString)) {
                RESOLVED_NAME_CACHE.clear(); // Cache invalidieren bei Änderungen
                GodHandConfig.saveAsync(config);
                DiagnosticManager.log("Player " + playerUuid + " removed from bow whitelist.");
                return true;
            }
        }
        return false;
    }

    /**
     * Überprüft, ob ein Spieler auf der Whitelist steht.
     * @param playerUuid Die UUID des Spielers.
     * @return True, wenn der Spieler auf der Whitelist steht, sonst false.
     */
    public static boolean isWhitelisted(UUID playerUuid) {
        // Dank ConcurrentHashMap Set ist kein Lock für die Überprüfung notwendig.
        return GodHandConfig.getInstance().player.bowWhitelistConfig.whitelistedPlayers.contains(playerUuid.toString());
    }

    /**
     * Überprüft, ob ein Spieler auf der Whitelist steht, oder ob er Operator-Rechte hat/Owner ist.
     * @param server Der MinecraftServer, um OP-Rechte zu prüfen.
     * @param playerUuid Die UUID des Spielers.
     * @return True, wenn der Spieler sicher gewhitelisted oder OP ist.
     */
    public static boolean isWhitelistedSafe(MinecraftServer server, UUID playerUuid) {
        if (isWhitelisted(playerUuid)) return true;
        if (server != null) {
            ServerPlayerEntity player = server.getPlayerManager().getPlayer(playerUuid);
            if (player != null && server.getPlayerManager().isOperator(player.getGameProfile())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gibt eine Liste der Namen aller gewhitelisteten Spieler zurück.
     * Nutzt einen Cache, um redundante UserCache-Lookups zu vermeiden.
     * @param server Der MinecraftServer, um Spielernamen aufzulösen.
     * @return Eine Liste von Spielernamen.
     */
    public static List<Text> getWhitelistedPlayerNames(MinecraftServer server) {
        return GodHandConfig.getInstance().player.bowWhitelistConfig.whitelistedPlayers.stream()
                .map(uuidString -> RESOLVED_NAME_CACHE.computeIfAbsent(uuidString, key -> {
                    try {
                        UUID uuid = UUID.fromString(key);
                        return server.getUserCache().getByUuid(uuid)
                                .map(profile -> (Text) Text.literal(profile.getName()))
                                .orElse(Text.translatable("text.godhand.bow_whitelist.unknown_player", key.substring(0, 8)));
                    } catch (IllegalArgumentException e) {
                        return Text.literal("Invalid UUID: " + key);
                    }
                }))
                .collect(Collectors.toList());
    }

    /**
     * Versucht, einen Spielernamen in eine UUID aufzulösen.
     * @param server Der MinecraftServer.
     * @param playerName Der Name des Spielers.
     * @return Die UUID des Spielers, falls gefunden, sonst null.
     */
    public static UUID getPlayerUuidByName(MinecraftServer server, String playerName) {
        if (server == null) return null;
        return server.getUserCache().findByName(playerName)
                .map(com.mojang.authlib.GameProfile::getId)
                .orElse(null);
    }

    /**
     * Gibt eine Liste aller bekannten Spieler (online und offline) zurück.
     * @param server Der MinecraftServer.
     * @return Eine Liste von GameProfiles.
     */
    public static List<com.mojang.authlib.GameProfile> getAllPlayers(MinecraftServer server) {
        return server.getPlayerManager().getPlayerList().stream()
                .map(ServerPlayerEntity::getGameProfile)
                .collect(Collectors.toList());
    }
}
