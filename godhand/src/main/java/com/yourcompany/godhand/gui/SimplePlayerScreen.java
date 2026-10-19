package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Ein Bildschirm für spielerbezogene Funktionen wie den Super-Bogen.
 */
public class SimplePlayerScreen extends Screen {

    private final Screen parent;
    private ButtonWidget superBowToggleButton;

    /**
     * Erstellt einen neuen SimplePlayerScreen.
     * @param parent Der übergeordnete Bildschirm.
     */
    public SimplePlayerScreen(Screen parent) {
        super(Text.translatable("text.godhand.player.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        int buttonWidth = Math.min(200, this.width / 3);
        int buttonHeight = 20;
        int buttonSpacing = 8;
        int x = this.width / 2 - buttonWidth / 2;
        int startY = Math.max(40, this.height / 2 - (buttonHeight * 2) - 20);

        int totalHeight = (buttonHeight * 3) + (buttonSpacing * 2) + 40;
        if (startY + totalHeight > this.height - 40) {
            startY = this.height - totalHeight - 40;
        }

        GodHandConfig config = GodHandConfig.getInstance();

        // Super Bow Toggle Button
        this.superBowToggleButton = ButtonWidget.builder(
            Text.translatable("text.godhand.player.super_bow.status_combined", getStatusText(config.player.superBowEnabled)),
            (button) -> {
                config.player.superBowEnabled = !config.player.superBowEnabled;
                if (config.player.superBowEnabled) {
                    config.player.magicBowEnabled = false;
                    net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new com.yourcompany.godhand.network.ToggleMagicBowPacket());
                }
                GodHandConfig.saveAsync(config);
                button.setMessage(Text.translatable("text.godhand.player.super_bow.status_combined", getStatusText(config.player.superBowEnabled)));
                this.client.player.sendMessage(Text.translatable("godhand.chat.player.super_bow_updated", getStatusText(config.player.superBowEnabled)), false);
            }
        ).dimensions(x, startY, buttonWidth, buttonHeight).build();
        this.superBowToggleButton.active = !config.player.magicBowEnabled;
        this.addDrawableChild(this.superBowToggleButton);

        // Bow Whitelist Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("godhand.gui.bow_whitelist.button"), (button) -> {
            net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new com.yourcompany.godhand.network.OpenBowWhitelistScreenPacket());
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing), buttonWidth, buttonHeight)
        .build());

        // Player Settings Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("text.godhand.player_settings"), (button) -> {
            this.client.setScreen(new SimplePlayerSettingsScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 2, buttonWidth, buttonHeight)
        .build());

        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
    }

    private Text getStatusText(boolean enabled) {
        return enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
