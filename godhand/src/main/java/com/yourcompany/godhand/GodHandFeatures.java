package com.yourcompany.godhand;


import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.damage.DamageTypes;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;

import net.minecraft.text.Text;
import net.minecraft.entity.mob.PathAwareEntity;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verwaltet die Kernfunktionen der GodHand Mod, wie God Mode und Flugmodus.
 */
public class GodHandFeatures {
    /**
     * Default constructor for GodHandFeatures.
     */
    public GodHandFeatures() {
        super();
    }


    /** Speichert die UUIDs von Spielern und den Zeitpunkt, zu dem ihr Flugmodus deaktiviert wurde, um eine kurze Fallschaden-Gnadenfrist zu gewähren. */
    private static final Map<UUID, Long> RECENTLY_DISABLED_FLIGHT = new ConcurrentHashMap<>();

    /**
     * Überprüft, ob der God Mode für die gegebene Entität aktiviert ist.
     * @param entity Die Entität, für die der God Mode überprüft werden soll.
     * @return True, wenn der God Mode für die Entität aktiviert ist, sonst false.
     */
    public static boolean isGodModeEnabled(LivingEntity entity) {
        if (GodHandConfig.getInstance().godMode.enabled) {
            PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
            if (player == null) { return false; }
            return entity.getUuid().equals(player.getUuid());
        }
        return false;
    }

    /**
     * Behandelt eingehenden Schaden für eine Entität basierend auf den God Mode-Einstellungen.
     * @param entity Die Entität, die Schaden erleidet.
     * @param source Die Schadensquelle.
     * @param amount Die Höhe des Schadens.
     * @return True, wenn der Schaden angewendet werden soll, false, wenn er abgebrochen werden soll.
     */
    public static boolean handleDamage(LivingEntity entity, DamageSource source, float amount) {
        // Friendly Fire Prevention (Companions) - Independent of player checks!
        if (source.getAttacker() instanceof net.minecraft.entity.player.PlayerEntity attackerPlayer && entity instanceof PathAwareEntity targetEntity) {
            if (CompanionManager.isCompanion(targetEntity) && java.util.Objects.equals(attackerPlayer.getUuid(), CompanionManager.getOwnerUuid(targetEntity))) {
                DiagnosticManager.log("handleDamage: Friendly Fire detected, blocking damage to companion.");
                return false; // Schaden an eigenen Begleitern blockieren
            }
        }

        // Nur God Mode und Player Features auf Spieler anwenden
        if (!(entity instanceof net.minecraft.entity.player.PlayerEntity player)) {
            return true; // Schaden für Nicht-Spieler zulassen
        }

        GodHandConfig.GodModeConfig config = GodHandConfig.getInstance().godMode;

        // Fallschaden-Gnadenfrist für Spieler
        if (source.isOf(DamageTypes.FALL)) {
            Long disabledTime = RECENTLY_DISABLED_FLIGHT.get(player.getUuid());
            if (disabledTime != null) {
                if (System.currentTimeMillis() - disabledTime < 5000) { // 5 Sekunden Gnadenfrist
                    DiagnosticManager.log("handleDamage: Fallschaden-Gnadenfrist aktiv, Schaden blockiert.");
                    return false; // Fallschaden abbrechen
                } else {
                    RECENTLY_DISABLED_FLIGHT.remove(player.getUuid()); // Alten Eintrag bereinigen
                }
            }
        }

        // Priorität 1: God Mode
        if (config.enabled) {
            if (source.isOf(DamageTypes.OUT_OF_WORLD)) {
                DiagnosticManager.log("handleDamage: God Mode ist aktiviert, aber Schaden ist OUT_OF_WORLD, Schaden zugelassen.");
                return true; // OUT_OF_WORLD Schaden im God Mode zulassen
            }
            DiagnosticManager.log("handleDamage: God Mode ist aktiviert, blockiere allen Schaden.");
            return false; // Allen anderen Schaden im God Mode blockieren
        }

        // Priorität 2: Smart Mode (wird nur ausgeführt, wenn God Mode deaktiviert ist)
        if (config.smartModeEnabled) {
            // Prüfe, ob der Schaden den Spieler töten würde
            if (player.getHealth() - amount <= 0.0F) {
                // Simuliere den Totem-Effekt
                player.setHealth(1.0F); // Setze Gesundheit auf 1.0 (ein halbes Herz)
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, 900, 1)); // Regeneration II für 45 Sekunden
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.FIRE_RESISTANCE, 800, 0)); // Feuerresistenz für 40 Sekunden
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.ABSORPTION, 100, 1)); // Absorption II für 5 Sekunden

                // Wir senden eine Nachricht sicher über die Basisklasse
                player.sendMessage(Text.translatable("godhand.chat.smartmode.totem_simulated"), false);

                DiagnosticManager.log("handleDamage: Smart Mode - Totem-Effekt simuliert. Schaden blockiert.");
                return false; // Schaden blockieren
            }
            // Wenn der Schaden nicht tödlich ist, erlaube ihn.
            DiagnosticManager.log("handleDamage: Smart Mode ist aktiviert, nicht-tödlicher Schaden zugelassen.");
            return true;
        }

        return true; // Standardmäßig Schaden zulassen, wenn keine der obigen Bedingungen zutrifft
    }

    /**
     * Schaltet den God Mode für den Spieler um.
     */
    public static void toggleGodMode() {
        GodHandConfig config = GodHandConfig.getInstance();
        boolean wasSmartModeEnabled = config.godMode.smartModeEnabled;
        config.godMode.enabled = !config.godMode.enabled;

        // Wenn God Mode aktiviert wird, deaktiviere den Smart Mode
        if (config.godMode.enabled && wasSmartModeEnabled) {
            config.godMode.smartModeEnabled = false;
            DiagnosticManager.log("Smart Mode was disabled because God Mode was enabled.");
        }

        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("God Mode toggled to: " + config.godMode.enabled);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        boolean enabled = config.godMode.enabled;
        player.sendMessage(Text.translatable("text.godhand.chat.godmode.updated", enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
        if (config.godMode.enabled && wasSmartModeEnabled) {
            player.sendMessage(Text.translatable("godhand.chat.smartmode.disabled_by_god_mode"), false);
        }
    }

    /**
     * Schaltet die Unverwundbarkeit nach dem Respawn um.
     */
    public static void toggleRespawnInvulnerability() {
        GodHandConfig config = GodHandConfig.getInstance();
        config.godMode.respawnInvulnerability = !config.godMode.respawnInvulnerability;
        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("Respawn Invulnerability toggled to: " + config.godMode.respawnInvulnerability);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        player.sendMessage(Text.translatable("text.godhand.chat.respawn_invulnerability.updated", config.godMode.respawnInvulnerability ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
    }

    /**
     * Schaltet das Blockieren von Explosionen um.
     */
    public static void toggleBlockExplosions() {
        GodHandConfig config = GodHandConfig.getInstance();
        config.godMode.blockExplosions = !config.godMode.blockExplosions;
        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("Block Explosions toggled to: " + config.godMode.blockExplosions);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        player.sendMessage(Text.translatable("text.godhand.chat.block_explosions.updated", config.godMode.blockExplosions ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
    }

    /**
     * Schaltet das Blockieren von Feuerschaden um.
     */
    public static void toggleBlockFire() {
        GodHandConfig config = GodHandConfig.getInstance();
        config.godMode.blockFire = !config.godMode.blockFire;
        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("Block Fire toggled to: " + config.godMode.blockFire);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        player.sendMessage(Text.translatable("text.godhand.chat.block_fire.updated", config.godMode.blockFire ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
    }

    /**
     * Schaltet den Smart Mode um.
     */
    public static void toggleSmartMode() {
        GodHandConfig config = GodHandConfig.getInstance();
        config.godMode.smartModeEnabled = !config.godMode.smartModeEnabled;
        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("Smart Mode toggled to: " + config.godMode.smartModeEnabled);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        player.sendMessage(Text.translatable("text.godhand.chat.smart_mode.updated", config.godMode.smartModeEnabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
    }

    /**
     * Schaltet den Diagnostic Mode um.
     */
    public static void toggleDiagnosticMode() {
        GodHandConfig config = GodHandConfig.getInstance();
        config.godMode.diagnosticModeEnabled = !config.godMode.diagnosticModeEnabled;
        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("Diagnostic Mode toggled to: " + config.godMode.diagnosticModeEnabled);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        player.sendMessage(Text.translatable("text.godhand.chat.diagnostic_mode.updated", config.godMode.diagnosticModeEnabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
    }

    /**
     * Schaltet den Flugmodus für den Spieler um.
     */
    public static void toggleFlight() {
        GodHandConfig config = GodHandConfig.getInstance();
        config.godMode.flightEnabled = !config.godMode.flightEnabled;
        GodHandConfig.saveAsync(config);
        DiagnosticManager.log("Flight toggled to: " + config.godMode.flightEnabled);
        PlayerEntity player = net.minecraft.client.MinecraftClient.getInstance().player;
        if (player == null) { return; }
        boolean enabled = config.godMode.flightEnabled;
        player.getAbilities().allowFlying = enabled;
        if (!enabled) {
            player.getAbilities().flying = false;
            RECENTLY_DISABLED_FLIGHT.put(player.getUuid(), System.currentTimeMillis());
        }
        player.sendAbilitiesUpdate();
        player.sendMessage(Text.translatable("text.godhand.chat.flight.updated", enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);

        // Diagnostic Check
        if (player.getAbilities().allowFlying == enabled) {
            DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Flight ability is correctly set to " + enabled + ".");
        } else {
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Flight ability not correctly set after toggle.");
        }
    }

    /**
     * Wendet die God Mode-Effekte auf den Spieler an (Leben, Hunger, Flug).
     * @param player Der Spieler, auf den die Effekte angewendet werden sollen.
     */
    public static void applyGodModeEffects(PlayerEntity player) {
        GodHandConfig.GodModeConfig config = GodHandConfig.getInstance().godMode;

        // Main God Mode: Absolute Unverwundbarkeit und volle Stats
        if (config.enabled) {
            player.setHealth(player.getMaxHealth());
            player.getHungerManager().setFoodLevel(20);
            player.getHungerManager().setSaturationLevel(20.0F);
            DiagnosticManager.log("applyGodModeEffects: God Mode - Player stats maxed.");
        }
        // Smart Mode: Regeneration und Speed-Boost (nur wenn God Mode aus ist)
        else if (config.smartModeEnabled) {
            // Regeneration
            if (player.getHealth() < player.getMaxHealth()) {
                player.heal(1.0F); // Heilt ein halbes Herz pro Tick
            }
            // Speed-Boost
            player.addStatusEffect(new StatusEffectInstance(StatusEffects.SPEED, 2, 0, true, false)); // Speed I, kurz, um dauerhaft zu sein
            DiagnosticManager.log("applyGodModeEffects: Smart Mode - Applied regeneration and speed boost.");
        }


        // Apply flight abilities based on config.flightEnabled, independent of main God Mode
        player.getAbilities().allowFlying = config.flightEnabled;
        if (!config.flightEnabled && player.getAbilities().flying) {
            player.getAbilities().flying = false;
            RECENTLY_DISABLED_FLIGHT.put(player.getUuid(), System.currentTimeMillis());
        }
        player.sendAbilitiesUpdate();
        DiagnosticManager.log("applyGodModeEffects: Player flight abilities updated. allowFlying=" + config.flightEnabled);
    }
}