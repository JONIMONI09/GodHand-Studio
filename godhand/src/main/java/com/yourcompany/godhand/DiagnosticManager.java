package com.yourcompany.godhand;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.nbt.NbtList;
import net.minecraft.nbt.NbtString;
import net.minecraft.client.gui.screen.ingame.BookScreen;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.text.ClickEvent;

import java.util.ArrayList;
import java.util.List;

/**
 * Verwaltet die Diagnose- und Debug-Ausgaben der GodHand Mod mit verschiedenen Protokollstufen.
 */
public class DiagnosticManager {

    /**
     * Verhindert die Instanziierung dieser Utility-Klasse.
     */
    private DiagnosticManager() {
    }

    /**
     * Definiert die verschiedenen Stufen für Protokollnachrichten.
     */
    public enum LogLevel {
        /** Informative Nachrichten. */
        INFO(Formatting.GRAY),
        /** Warnmeldungen. */
        WARN(Formatting.YELLOW),
        /** Kritische Fehlermeldungen. */
        CRITICAL(Formatting.RED, Formatting.BOLD);

        private final Formatting[] formattings;

        LogLevel(Formatting... formattings) {
            this.formattings = formattings;
        }

        /**
         * Erstellt einen formatierten Text mit dem Präfix der Log-Stufe.
         * @param message Die Nachricht, die formatiert werden soll.
         * @return Der formatierte Text.
         */
        public MutableText getPrefixedText(String message) {
            return Text.literal("[" + this.name() + "] ").formatted(this.formattings).append(Text.literal(message).formatted(Formatting.WHITE));
        }
    }

    private static final List<Text> LOG_HISTORY = new ArrayList<>();
    private static final int MAX_LOG_LINES = 255;

    /**
     * Protokolliert eine Nachricht mit einer bestimmten Stufe.
     * Das Verhalten hängt von der Stufe und der Konfiguration ab.
     * @param level Die Stufe der Nachricht (INFO, WARN, CRITICAL).
     * @param message Die zu protokollierende Nachricht.
     */
    public static void log(LogLevel level, String message) {
        boolean diagnosticModeEnabled = GodHandConfig.getInstance().godMode.diagnosticModeEnabled;
        MinecraftClient client = MinecraftClient.getInstance();

        // Protokollierung in der Konsole
        switch (level) {
            case INFO:
                if (diagnosticModeEnabled) GodHand.LOGGER.info("[Diagnostic] " + message);
                break;
            case WARN:
                GodHand.LOGGER.warn("[Diagnostic] " + message);
                break;
            case CRITICAL:
                GodHand.LOGGER.error("[Diagnostic CRITICAL] " + message);
                break;
        }

        // Hinzufügen zum In-Game-Logbuch
        addLogToHistory(level, message);

        // Anzeige im Chat
        if (client != null && client.player != null) {
            switch (level) {
                case INFO:
                    // INFO-Nachrichten werden absichtlich nicht im Chat angezeigt, um Spam zu reduzieren
                    break;
                case WARN:
                    if (diagnosticModeEnabled) {
                        client.player.sendMessage(level.getPrefixedText(message), false);
                    }
                    break;
                case CRITICAL:
                    client.player.sendMessage(level.getPrefixedText(message), false);
                    client.player.sendMessage(Text.translatable("text.godhand.diagnostic.view_logs_prompt").formatted(Formatting.AQUA, Formatting.UNDERLINE)
                        .styled(style -> style.withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/godhand diagnostic_logs"))), false);
                    break;
            }
        }
    }

    /**
     * Vereinfachte Methode für INFO-Logs.
     * @param message Die zu protokollierende Nachricht.
     */
    public static void log(String message) {
        log(LogLevel.INFO, message);
    }

    /**
     * Protokolliert einen kritischen Fehler. Diese Nachrichten werden immer angezeigt.
     * @param message Die Fehlermeldung.
     * @param e Die zugehörige Exception (optional).
     */
    public static void critical(String message, Throwable e) {
        String fullMessage = message + (e != null ? ": " + e.getMessage() : "");
        log(LogLevel.CRITICAL, fullMessage);
        if (e != null) {
            GodHand.LOGGER.error("Stack trace for critical error:", e);
        }
    }

    /**
     * Überprüft eine Bedingung und protokolliert entsprechend mit INFO oder WARN.
     * @param condition Die zu überprüfende Bedingung.
     * @param successMessage Die Nachricht, die bei Erfolg protokolliert wird.
     * @param errorMessage Die Nachricht, die bei Misserfolg protokolliert wird.
     * @deprecated Bevorzugen Sie explizite `log(LogLevel, ...)` Aufrufe für mehr Klarheit.
     */
    @Deprecated
    public static void check(boolean condition, String successMessage, String errorMessage) {
        if (condition) {
            log(LogLevel.INFO, successMessage);
        } else {
            log(LogLevel.WARN, errorMessage);
        }
    }

    /**
     * Fügt eine Nachricht zur Log-Historie hinzu und begrenzt die Größe.
     */
    private static void addLogToHistory(LogLevel level, String logMessage) {
        LOG_HISTORY.add(level.getPrefixedText(logMessage));
        if (LOG_HISTORY.size() > MAX_LOG_LINES) {
            LOG_HISTORY.remove(0);
        }
    }

    /**
     * Öffnet einen Screen mit dem Log-Buch für den Spieler.
     * @param player Der Spieler, für den das Log-Buch geöffnet werden soll.
     */
    
        public static void openLogBookScreen(PlayerEntity player) {
        if (player.getWorld().isClient) {
            net.minecraft.client.MinecraftClient.getInstance().execute(() -> {
                if (net.minecraft.client.MinecraftClient.getInstance().player != null) {
                    
                    List<net.minecraft.text.RawFilteredPair<Text>> pagesFilter = new ArrayList<>();
                    List<Text> rawPages = new ArrayList<>();
                    StringBuilder currentPage = new StringBuilder();
                    int lines = 0;
                    
                    for (Text logLine : LOG_HISTORY) {
                        String line = logLine.getString();
                        currentPage.append(line).append("\n");
                        lines++;
                        if (lines >= 13) {
                            Text t = Text.literal(currentPage.toString());
                            pagesFilter.add(net.minecraft.text.RawFilteredPair.of(t));
                            rawPages.add(t);
                            currentPage.setLength(0);
                            lines = 0;
                        }
                    }
                    if (currentPage.length() > 0) {
                        Text t = Text.literal(currentPage.toString());
                        pagesFilter.add(net.minecraft.text.RawFilteredPair.of(t));
                        rawPages.add(t);
                    }
                    
                    if (pagesFilter.isEmpty()) {
                        Text t = Text.literal("No logs available.");
                        pagesFilter.add(net.minecraft.text.RawFilteredPair.of(t));
                        rawPages.add(t);
                    }

                    net.minecraft.client.gui.screen.ingame.BookScreen.Contents contents = new net.minecraft.client.gui.screen.ingame.BookScreen.Contents(
                        rawPages
                    );

                    net.minecraft.client.MinecraftClient.getInstance().setScreen(new net.minecraft.client.gui.screen.ingame.BookScreen(contents));
                }
            });
        }
    }
}