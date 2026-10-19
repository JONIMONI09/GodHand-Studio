package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.BowWhitelistManager;
import com.yourcompany.godhand.DiagnosticManager;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import com.yourcompany.godhand.GodHand;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Ein Bildschirm zur Verwaltung der Bogen-Whitelist mit verbesserter Fehlerbehandlung und modularer Struktur.
 */
public class SimpleBowWhitelistScreen extends Screen {

    private final Screen parent;
    private TextFieldWidget playerUuidField;
    private ButtonWidget addPlayerButton;
    private ButtonWidget removePlayerButton;
    private List<Text> whitelistedNames;
    private boolean loadingWhitelist = true;
    private String whitelistError = null;

    /**
     * Erstellt einen neuen SimpleBowWhitelistScreen.
     * @param parent Der übergeordnete Bildschirm.
     */
    public SimpleBowWhitelistScreen(Screen parent) {
        super(Text.translatable("godhand.gui.bow_whitelist.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();
        GodHand.LOGGER.info("SimpleBowWhitelistScreen: Initializing screen.");

        // Reset state
        this.loadingWhitelist = true;
        this.whitelistError = null;
        this.whitelistedNames = null;

        int widgetWidth = 200;
        int widgetHeight = 20;
        int x = this.width / 2 - widgetWidth / 2;
        int startY = this.height / 2 - (widgetHeight * 3) - 10;

        // Player UUID/Name Field
        playerUuidField = new TextFieldWidget(this.textRenderer, x, startY, widgetWidth, widgetHeight, Text.translatable("godhand.gui.bow_whitelist.player_field"));
        playerUuidField.setMaxLength(36); // UUID length
        this.addDrawableChild(playerUuidField);

        // Add Player Button
        addPlayerButton = ButtonWidget.builder(
            Text.translatable("godhand.gui.bow_whitelist.add_player"),
            (button) -> {
                handleAddPlayer();
            }
        ).dimensions(x, startY + widgetHeight + 5, widgetWidth / 2 - 2, widgetHeight).build();
        this.addDrawableChild(addPlayerButton);

        // Remove Player Button
        removePlayerButton = ButtonWidget.builder(
            Text.translatable("godhand.gui.bow_whitelist.remove_player"),
            (button) -> {
                handleRemovePlayer();
            }
        ).dimensions(x + widgetWidth / 2 + 2, startY + widgetHeight + 5, widgetWidth / 2 - 2, widgetHeight).build();
        this.addDrawableChild(removePlayerButton);

        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());

        // Load whitelist asynchronously
        loadWhitelistAsync();
    }

    private void handleAddPlayer() {
        String input = playerUuidField.getText().trim();
        GodHand.LOGGER.info("SimpleBowWhitelistScreen: Add Player button clicked with input: " + input);
        if (!input.isEmpty()) {
            net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new com.yourcompany.godhand.network.UpdateBowWhitelistPacket(input, true));
            this.client.player.sendMessage(Text.translatable("godhand.chat.bow_whitelist.update_requested", input).formatted(Formatting.YELLOW), false);
            playerUuidField.setText("");
            // Refresh will happen via Sync packet from server
            loadWhitelistAsync();
        } else {
            GodHand.LOGGER.warn("SimpleBowWhitelistScreen: Add Player button clicked with empty input.");
        }
    }

    private void handleRemovePlayer() {
        String input = playerUuidField.getText().trim();
        GodHand.LOGGER.info("SimpleBowWhitelistScreen: Remove Player button clicked with input: " + input);
        if (!input.isEmpty()) {
            net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new com.yourcompany.godhand.network.UpdateBowWhitelistPacket(input, false));
            this.client.player.sendMessage(Text.translatable("godhand.chat.bow_whitelist.update_requested", input).formatted(Formatting.YELLOW), false);
            playerUuidField.setText("");
            // Refresh will happen via Sync packet from server
            loadWhitelistAsync();
        } else {
            GodHand.LOGGER.warn("SimpleBowWhitelistScreen: Remove Player button clicked with empty input.");
        }
    }

    private void loadWhitelistAsync() {
        this.loadingWhitelist = true;
        CompletableFuture.supplyAsync(() -> {
            try {
                return BowWhitelistManager.getWhitelistedPlayerNames(this.client.getServer());
            } catch (Exception e) {
                GodHand.LOGGER.error("SimpleBowWhitelistScreen: Failed to load whitelist", e);
                DiagnosticManager.log(DiagnosticManager.LogLevel.CRITICAL, "Failed to load bow whitelist - " + e.getMessage());
                throw e;
            }
        }).thenAccept(names -> {
            this.whitelistedNames = names;
            this.loadingWhitelist = false;
            this.whitelistError = null;
            GodHand.LOGGER.debug("SimpleBowWhitelistScreen: Whitelist loaded successfully. Count: " + names.size());
        }).exceptionally(throwable -> {
            this.loadingWhitelist = false;
            this.whitelistError = "Failed to load whitelist: " + throwable.getMessage();
            GodHand.LOGGER.error("SimpleBowWhitelistScreen: Exception while loading whitelist", throwable);
            return null;
        });
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        GodHand.LOGGER.debug("SimpleBowWhitelistScreen: Rendering screen.");

        // Display Whitelisted Players
        int currentY = this.height / 2 - (this.textRenderer.fontHeight * 5 / 2) + (this.height / 2 - (20 * 3) - 10) + (20 + 5) * 2 + 10;

        if (this.loadingWhitelist) {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("text.godhand.loading"), this.width / 2, currentY, 0xFFFFFF);
        } else if (this.whitelistError != null) {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("text.godhand.error", this.whitelistError), this.width / 2, currentY, 0xFF5555);
        } else if (this.whitelistedNames != null) {
            if (this.whitelistedNames.isEmpty()) {
                context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("godhand.gui.bow_whitelist.no_players"), this.width / 2, currentY, 0xFFFFFF);
                GodHand.LOGGER.debug("SimpleBowWhitelistScreen: No whitelisted players to display.");
            } else {
                context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("godhand.gui.bow_whitelist.current_players"), this.width / 2, currentY, 0xFFFFFF);
                currentY += this.textRenderer.fontHeight + 5;
                for (Text name : this.whitelistedNames) {
                    context.drawCenteredTextWithShadow(this.textRenderer, name, this.width / 2, currentY, 0xFFFFFF);
                    currentY += this.textRenderer.fontHeight + 2;
                    GodHand.LOGGER.debug("SimpleBowWhitelistScreen: Displaying whitelisted player: " + name.getString());
                }
            }
        }

        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
