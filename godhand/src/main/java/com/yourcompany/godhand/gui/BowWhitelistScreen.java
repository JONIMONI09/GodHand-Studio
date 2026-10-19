package com.yourcompany.godhand.gui;

import com.mojang.authlib.GameProfile;
import com.yourcompany.godhand.BowWhitelistManager;
import com.yourcompany.godhand.DiagnosticManager;
import com.yourcompany.godhand.GodHand;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.server.MinecraftServer;
import net.minecraft.text.Text;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Screen for managing the Bow Whitelist.
 */
public class BowWhitelistScreen extends Screen {

    private final Screen parent;
    private List<GameProfile> players;
    private boolean loading;
    private String errorMessage;
    private boolean hasTriedLoading = false;

    /**
     * Constructor.
     * @param parent The parent screen.
     */
    public BowWhitelistScreen(Screen parent) {
        super(Text.translatable("text.godhand.bow_whitelist.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        GodHand.LOGGER.info("BowWhitelistScreen: Initializing screen.");

        // Add back button immediately
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());

        if (hasTriedLoading) {
            createPlayerButtons();
            return;
        }

        // Reset state
        this.loading = true;
        this.errorMessage = null;
        this.players = null;

        // Ensure client is not null before proceeding
        if (this.client == null) {
            this.errorMessage = "Client is null";
            return;
        }

        if (this.client.getNetworkHandler() == null || this.client.getNetworkHandler().getConnection() == null) {
            this.errorMessage = "Not connected to server";
            return;
        }

        loadPlayersAsync();
    }

    private void loadPlayersAsync() {
        hasTriedLoading = true;
        CompletableFuture.supplyAsync(() -> {
            try {
                // Try to get server instance
                MinecraftServer serverInstance = this.client.getServer();
                if (serverInstance == null) {
                    if (this.client.getNetworkHandler() != null) {
                        return this.client.getNetworkHandler().getPlayerList().stream()
                            .map(net.minecraft.client.network.PlayerListEntry::getProfile)
                            .collect(Collectors.toList());
                    }
                    throw new RuntimeException("Server instance and NetworkHandler not available");
                }

                GodHand.LOGGER.info("BowWhitelistScreen: Server instance obtained.");
                return BowWhitelistManager.getAllPlayers(serverInstance);
            } catch (Exception e) {
                GodHand.LOGGER.error("BowWhitelistScreen: Failed to load players", e);
                DiagnosticManager.log(DiagnosticManager.LogLevel.CRITICAL, "BowWhitelistScreen: Failed to load players - " + e.getMessage());
                throw new java.util.concurrent.CompletionException(e);
            }
        }).thenAcceptAsync(loadedPlayers -> {
            this.players = loadedPlayers;
            this.loading = false;
            this.errorMessage = null;
            GodHand.LOGGER.info("BowWhitelistScreen: Players loaded successfully. Count: " + loadedPlayers.size());
            // Re-init to show player buttons
            this.clearAndInit();
        }, this.client).exceptionally(throwable -> {
            this.loading = false;
            this.errorMessage = "Failed to load players: " + throwable.getMessage();
            GodHand.LOGGER.error("BowWhitelistScreen: Exception while loading players", throwable);
            // Re-init to show error without triggering load again
            this.client.execute(this::clearAndInit);
            return null;
        });
    }

    protected void clearAndInit() {
        this.clearChildren();
        super.init();
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
        this.createPlayerButtons();
    }

    private void createPlayerButtons() {
        if (this.players == null || this.loading) {
            return;
        }

        int buttonWidth = 200;
        int buttonHeight = 20;
        int startY = 40;
        int x = this.width / 2 - buttonWidth / 2;

        MinecraftServer server = this.client.getServer();

        for (int i = 0; i < this.players.size(); i++) {
            GameProfile player = this.players.get(i);

            boolean isSelf = this.client.player != null && java.util.Objects.equals(player.getId(), this.client.player.getUuid());
            boolean isOp = server != null && server.getPlayerManager().isOperator(player);
            boolean isSafe = isSelf || isOp;
            boolean isWhitelisted = isSafe || BowWhitelistManager.isWhitelisted(player.getId());

            Text buttonText = Text.translatable("text.godhand.bow_whitelist.player_status",
                player.getName() != null ? player.getName() : "Unknown",
                (isWhitelisted ? Text.translatable("text.godhand.bow_whitelist.whitelisted") : Text.translatable("text.godhand.bow_whitelist.not_whitelisted")));

            ButtonWidget btn = ButtonWidget.builder(buttonText, (button) -> {
                if (isSafe && !BowWhitelistManager.isWhitelisted(player.getId())) {
                    if (this.client.player != null) {
                        this.client.player.sendMessage(Text.literal("§cDieser Spieler ist als OP/Owner bereits sicher und kann nicht entfernt werden!"), false);
                    }
                    return;
                }
                String playerName = player.getName() != null ? player.getName() : "Unknown";
                try {
                    boolean currentlyWhitelisted = BowWhitelistManager.isWhitelisted(player.getId());
                    net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new com.yourcompany.godhand.network.UpdateBowWhitelistPacket(playerName, true));

                    // Refresh screen after a short delay or when sync arrives
                    this.client.execute(() -> {
                        this.client.setScreen(new BowWhitelistScreen(this.parent));
                    });
                } catch (Exception e) {
                    GodHand.LOGGER.error("BowWhitelistScreen: Error toggling whitelist for player " + playerName, e);
                }
            })
            .dimensions(x, startY + i * (buttonHeight + 5), buttonWidth, buttonHeight)
            .build();

            if (isSafe) {
                btn.active = false;
            }
            this.addDrawableChild(btn);
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);

        if (this.loading) {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("text.godhand.loading"), this.width / 2, this.height / 2, 0xFFFFFF);
        } else if (this.errorMessage != null) {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("text.godhand.error", this.errorMessage), this.width / 2, this.height / 2, 0xFF5555);
        } else {
            if (this.players != null && this.children().stream().noneMatch(child -> child instanceof ButtonWidget && ((ButtonWidget) child).getMessage().getString().length() > 0)) {
                createPlayerButtons();
            }
        }

        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
