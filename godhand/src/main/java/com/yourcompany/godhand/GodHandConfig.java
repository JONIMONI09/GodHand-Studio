package com.yourcompany.godhand;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Repräsentiert die Konfiguration der GodHand Mod.
 * Lädt und speichert die Konfiguration aus einer JSON-Datei.
 */
public class GodHandConfig {
    /**
     * Default constructor for GodHandConfig.
     */
    public GodHandConfig() {
        super();
    }


    /** Der Gson-Objekt für die Serialisierung und Deserialisierung der Konfiguration. */
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    /** Der Pfad zur Konfigurationsdatei. */
    private static final Path CONFIG_PATH = getConfigPath();

    private static Path getConfigPath() {
        try {
            return FabricLoader.getInstance().getConfigDir().resolve("godhand.json");
        } catch (Exception | Error e) {
            // Fallback für Tests, wenn FabricLoader nicht initialisiert ist
            return Path.of("godhand.json");
        }
    }

    /** Konfiguration für den God Mode. */
    public GodModeConfig godMode = new GodModeConfig();

    /**
     * Konfigurationseinstellungen für den God Mode.
     */
    public static class GodModeConfig {
    /**
     * Default constructor for GodModeConfig.
     */
    public GodModeConfig() {
        super();
    }

        /** Gibt an, ob der God Mode aktiviert ist. */
        public boolean enabled = false;
        /** Gibt an, ob die Unverwundbarkeit nach dem Respawn aktiviert ist. */
        public boolean respawnInvulnerability = true;
        /** Gibt an, ob Explosionen blockiert werden sollen. */
        public boolean blockExplosions = true;
        /** Gibt an, ob Feuerschaden blockiert werden soll. */
        public boolean blockFire = true;
        /** Gibt an, ob der Flugmodus aktiviert ist. */
        public boolean flightEnabled = false;
        /** Gibt an, ob die God Mode Einstellungen gesperrt sind. */
        public boolean godModeSettingsLocked = false;
        /** Gibt an, ob der Smart Mode aktiviert ist. */
        public boolean smartModeEnabled = false;
        /** Gibt an, ob der Diagnostic Mode aktiviert ist. */
        public boolean diagnosticModeEnabled = false;
    }

    /** Konfiguration für Begleiter. */
    public CompanionConfig companion = new CompanionConfig();

    /** Konfiguration für Spieler-Features. */
    public PlayerConfig player = new PlayerConfig();

    /**
     * Konfigurationseinstellungen für Begleiter.
     */
    public static class CompanionConfig {
    /**
     * Default constructor for CompanionConfig.
     */
    public CompanionConfig() {
        super();
    }

        /** Die maximale Anzahl an Begleitern, die ein Spieler haben kann. */
        public int maxCompanions = 1;
        /** Die Distanz, in der Begleiter dem Spieler folgen. */
        public double followDistance = 3.0;
        /** Der Radius, in dem Begleiter den Spieler verteidigen. */
        public double defendRadius = 10.0;
        /** Der Radius, in dem Begleiter rekrutiert werden können. */
        public double recruitRadius = 10.0;
        /** Gibt an, ob Begleiter zusätzliche Gesundheit erhalten sollen. */
        public boolean giveExtraHealth = true;
        /** Die Menge an zusätzlicher Gesundheit, die Begleiter erhalten. */
        public int extraHealthAmount = 100;
        /** Gibt an, ob Begleiter den Regenerationseffekt erhalten sollen. */
        public boolean giveRegenerationEffect = false;
        /** Gibt an, ob Begleiter den Stärkeeffekt erhalten sollen. */
        public boolean giveStrengthEffect = false;
        /** Gibt an, ob Begleiter den Geschwindigkeitseffekt erhalten sollen. */
        public boolean giveSpeedEffect = false;
        /** Gibt an, ob Begleiter den Widerstandseffekt erhalten sollen. */
        public boolean giveResistanceEffect = false;
    }

    /**
     * Konfigurationseinstellungen für Spieler-Features.
     */
    public static class PlayerConfig {
    /**
     * Default constructor for PlayerConfig.
     */
    public PlayerConfig() {
        super();
    }

        /** Gibt an, ob der Super-Bogen aktiviert ist. */
        public boolean superBowEnabled = false;
        /** Gibt an, ob der Magische Bogen aktiviert ist. */
        public boolean magicBowEnabled = false;
        /** Gibt an, ob die Pfeil-Duplizierung aktiviert ist. */
        public boolean arrowDuplicationEnabled = false;
        /** Die Anzahl der duplizierten Pfeile. */
        public int arrowDuplicationAmount = 5;
        /** Der Radius, in dem Pfeile nach Feinden suchen. */
        public double arrowSeekRadius = 20.0;
        /** Gibt an, ob der Super-Bogen alle Mobs angreift. */
        public boolean superBowTargetsAllMobs = false;
        /** Konfigurationseinstellungen für den Explosionsbogen. */
        public ExplosiveBowConfig explosiveBowConfig = new ExplosiveBowConfig();
        /** Konfigurationseinstellungen für die Bogen-Whitelist. */
        public BowWhitelistConfig bowWhitelistConfig = new BowWhitelistConfig();
    }

    /**
     * Konfigurationseinstellungen für die Bogen-Whitelist.
     */
    public static class BowWhitelistConfig {
    /**
     * Default constructor for BowWhitelistConfig.
     */
    public BowWhitelistConfig() {
        super();
    }

        /** Ein Set von UUIDs der Spieler, die Bogen-Funktionen nutzen dürfen. */
        public Set<String> whitelistedPlayers = ConcurrentHashMap.newKeySet();
    }

    /**
     * Konfigurationseinstellungen für den Explosionsbogen.
     */
    public static class ExplosiveBowConfig {
    /**
     * Default constructor for ExplosiveBowConfig.
     */
    public ExplosiveBowConfig() {
        super();
    }

        /** Gibt an, ob der Explosionsbogen aktiviert ist. */
        public boolean enabled = false;
        /** Der Radius der Explosion. */
        public double explosionRadius = 3.0; // Default radius
        /** Der Modus der Explosion (0 für nur Schaden, 1 für Schaden + Blockzerstörung). */
        public int explosionMode = 0; // 0 for damage only, 1 for damage + block destruction
    }

    private static GodHandConfig INSTANCE;
    /** Executor für asynchrone Speichervorgänge, um den Hauptthread nicht zu blockieren. */
    private static final ExecutorService SAVE_EXECUTOR = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "GodHand-Config-Save-Thread");
        thread.setDaemon(true);
        return thread;
    });

    /**
     * Gibt die Singleton-Instanz der GodHandConfig zurück.
     * Lädt die Konfiguration, falls sie noch nicht geladen wurde.
     * @return Die Singleton-Instanz der GodHandConfig.
     */
    public static synchronized GodHandConfig getInstance() {
        if (INSTANCE == null) {
            INSTANCE = load();
        }
        return INSTANCE;
    }

    /**
     * Lädt die Konfiguration aus der Konfigurationsdatei.
     * Wenn die Datei nicht existiert oder ungültig ist, wird eine neue Konfiguration erstellt und gespeichert.
     * @return Die geladene oder neu erstellte GodHandConfig-Instanz.
     */
    private static GodHandConfig load() {
        try (FileReader reader = new FileReader(CONFIG_PATH.toFile())) {
            INSTANCE = GSON.fromJson(reader, GodHandConfig.class);
            if (INSTANCE == null) {
                INSTANCE = new GodHandConfig();
            }
            // Validiere und korrigiere die geladene Konfiguration
            validateAndCorrectConfig(INSTANCE);
        } catch (IOException e) {
            GodHand.LOGGER.warn("Failed to load config, creating new one.", e);
            INSTANCE = new GodHandConfig();
        } catch (Exception e) {
            GodHand.LOGGER.error("Error parsing config file, creating new one.", e);
            INSTANCE = new GodHandConfig();
        }
        save(INSTANCE); // Save to ensure default values are written if file was missing or invalid
        return INSTANCE;
    }

    /**
     * Validiert und korrigiert die Konfigurationswerte.
     * @param config Die zu validierende Konfiguration.
     */
    static void validateAndCorrectConfig(GodHandConfig config) {
        if (config == null) return;

        // Sicherstellen, dass die Konfigurationsabschnitte nicht null sind
        if (config.godMode == null) config.godMode = new GodModeConfig();
        if (config.companion == null) config.companion = new CompanionConfig();
        if (config.player == null) config.player = new PlayerConfig();
        if (config.player.explosiveBowConfig == null) config.player.explosiveBowConfig = new ExplosiveBowConfig();
        if (config.player.bowWhitelistConfig == null) config.player.bowWhitelistConfig = new BowWhitelistConfig();

        // Validiere Companion-Konfiguration
        if (config.companion.maxCompanions < 0 || config.companion.maxCompanions > 100) {
            GodHand.LOGGER.warn("Invalid maxCompanions value: {}, setting to 1", config.companion.maxCompanions);
            config.companion.maxCompanions = 1;
        }
        if (config.companion.followDistance <= 0) {
            GodHand.LOGGER.warn("Invalid followDistance value: {}, setting to 3.0", config.companion.followDistance);
            config.companion.followDistance = 3.0;
        }
        if (config.companion.defendRadius <= 0) {
            GodHand.LOGGER.warn("Invalid defendRadius value: {}, setting to 10.0", config.companion.defendRadius);
            config.companion.defendRadius = 10.0;
        }
        if (config.companion.recruitRadius <= 0) {
            GodHand.LOGGER.warn("Invalid recruitRadius value: {}, setting to 10.0", config.companion.recruitRadius);
            config.companion.recruitRadius = 10.0;
        }
        if (config.companion.extraHealthAmount < 0 || config.companion.extraHealthAmount > 1000) {
            GodHand.LOGGER.warn("Invalid extraHealthAmount value: {}, setting to 100", config.companion.extraHealthAmount);
            config.companion.extraHealthAmount = 100;
        }

        // Validiere Player-Konfiguration
        if (config.player.arrowDuplicationAmount < 0 || config.player.arrowDuplicationAmount > 100) {
            GodHand.LOGGER.warn("Invalid arrowDuplicationAmount value: {}, setting to 5", config.player.arrowDuplicationAmount);
            config.player.arrowDuplicationAmount = 5;
        }
        if (config.player.arrowSeekRadius <= 0 || config.player.arrowSeekRadius > 100.0) {
            GodHand.LOGGER.warn("Invalid arrowSeekRadius value: {}, setting to 20.0", config.player.arrowSeekRadius);
            config.player.arrowSeekRadius = 20.0;
        }

        // Validiere Explosive Bow Konfiguration
        if (config.player.explosiveBowConfig.explosionRadius <= 0 || config.player.explosiveBowConfig.explosionRadius > 50.0) {
            GodHand.LOGGER.warn("Invalid explosionRadius value: {}, setting to 3.0", config.player.explosiveBowConfig.explosionRadius);
            config.player.explosiveBowConfig.explosionRadius = 3.0;
        }
        if (config.player.explosiveBowConfig.explosionMode < 0 || config.player.explosiveBowConfig.explosionMode > 1) {
            GodHand.LOGGER.warn("Invalid explosionMode value: {}, setting to 0", config.player.explosiveBowConfig.explosionMode);
            config.player.explosiveBowConfig.explosionMode = 0;
        }

        // Sicherstellen, dass die Whitelist nicht null ist und eine thread-sichere Implementierung verwendet
        if (config.player.bowWhitelistConfig.whitelistedPlayers == null) {
            config.player.bowWhitelistConfig.whitelistedPlayers = ConcurrentHashMap.newKeySet();
        } else if (!(config.player.bowWhitelistConfig.whitelistedPlayers instanceof ConcurrentHashMap.KeySetView)) {
            Set<String> newSet = ConcurrentHashMap.newKeySet();
            newSet.addAll(config.player.bowWhitelistConfig.whitelistedPlayers);
            config.player.bowWhitelistConfig.whitelistedPlayers = newSet;
        }
    }

    /**
     * Speichert die aktuelle Konfiguration in die Konfigurationsdatei.
     * @param config Die zu speichernde GodHandConfig-Instanz.
     */
    public static void save(GodHandConfig config) {
        validateAndCorrectConfig(config);
        String json;
        synchronized (config) {
            json = GSON.toJson(config);
        }

        try (FileWriter writer = new FileWriter(CONFIG_PATH.toFile())) {
            writer.write(json);
        } catch (IOException e) {
            GodHand.LOGGER.error("Failed to save config.", e);
        }
    }

    /**
     * Speichert die aktuelle Konfiguration asynchron in die Konfigurationsdatei.
     * @param config Die zu speichernde GodHandConfig-Instanz.
     */
    public static void saveAsync(GodHandConfig config) {
        validateAndCorrectConfig(config);
        // Die Serialisierung erfolgt hier im aufrufenden Thread, um einen konsistenten Zustand
        // der Konfiguration einzufangen, bevor weitere Änderungen vorgenommen werden können.
        // Dank ConcurrentHashMap.newKeySet() ist whitelistedPlayers während GSON's Iteration sicher.
        String json;
        synchronized (config) {
            json = GSON.toJson(config);
        }

        SAVE_EXECUTOR.submit(() -> {
            try (FileWriter writer = new FileWriter(CONFIG_PATH.toFile())) {
                writer.write(json);
            } catch (IOException e) {
                GodHand.LOGGER.error("Failed to save config asynchronously.", e);
            }
        });
    }
}