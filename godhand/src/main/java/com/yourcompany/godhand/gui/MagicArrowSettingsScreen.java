package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import com.yourcompany.godhand.network.ToggleMagicBowPacket;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;

/**
 * Konfigurationsbildschirm für den Magischen Bogen.
 */
public class MagicArrowSettingsScreen extends Screen {

    private final Screen parent;
    private SliderWidget searchRadiusSlider;
    private SliderWidget megaSpeedSlider;
    private ButtonWidget toggleButton;

    /**
     * Konstruktor.
     * @param parent Der uebergeordnete Bildschirm.
     */
    public MagicArrowSettingsScreen(Screen parent) {
        super(Text.translatable("text.godhand.magic_arrow.title", "Magic Arrow Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        int buttonWidth = 200;
        int buttonHeight = 20;
        int buttonSpacing = 8;
        int numberOfButtons = 4;
        int totalHeight = (buttonHeight * numberOfButtons) + (buttonSpacing * (numberOfButtons - 1));

        int startY = Math.max(30, this.height / 2 - totalHeight / 2);
        int x = this.width / 2 - buttonWidth / 2;

        GodHandConfig config = GodHandConfig.getInstance();

        // Magic Bow Toggle
        this.toggleButton = ButtonWidget.builder(
            Text.translatable("text.godhand.player.magic_bow.status_combined", getStatusText(config.player.magicBowEnabled)),
            (button) -> {
                config.player.magicBowEnabled = !config.player.magicBowEnabled;
                if (config.player.magicBowEnabled) {
                    config.player.superBowEnabled = false; // Disable Super Bow
                }
                GodHandConfig.saveAsync(config);
                net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new com.yourcompany.godhand.network.ToggleMagicBowPacket());
                button.setMessage(Text.translatable("text.godhand.player.magic_bow.status_combined", getStatusText(config.player.magicBowEnabled)));
                updateSliderStates();
            }
        ).dimensions(x, startY, buttonWidth, buttonHeight).build();
        this.addDrawableChild(this.toggleButton);

        // Search Radius Slider
        this.searchRadiusSlider = new SliderWidget(x, startY + (buttonHeight + buttonSpacing), buttonWidth, buttonHeight,
                Text.translatable("text.godhand.player_settings.seek_radius", String.format("%.1f", config.player.arrowSeekRadius)),
                (config.player.arrowSeekRadius - 5.0) / 95.0) {
            @Override
            protected void updateMessage() {
                this.setMessage(Text.translatable("text.godhand.player_settings.seek_radius", String.format("%.1f", getValue())));
            }

            @Override
            protected void applyValue() {
                config.player.arrowSeekRadius = getValue();
                GodHandConfig.saveAsync(config);
            }

            private double getValue() {
                return (this.value * 95.0) + 5.0;
            }
        };
        this.addDrawableChild(this.searchRadiusSlider);

        // Mega Speed Multiplier Slider
        this.megaSpeedSlider = new SliderWidget(x, startY + (buttonHeight + buttonSpacing) * 2, buttonWidth, buttonHeight,
                Text.translatable("text.godhand.magic_arrow.mega_speed", "Mega Speed: 1.0x"),
                0.1) {
            @Override
            protected void updateMessage() {
                this.setMessage(Text.translatable("text.godhand.magic_arrow.mega_speed", "Mega Speed: " + String.format("%.1fx", this.value * 10 + 1)));
            }

            @Override
            protected void applyValue() {
                // Future Implementation: Sync to Config
            }
        };
        this.addDrawableChild(this.megaSpeedSlider);

        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 3, buttonWidth, buttonHeight)
        .build());

        updateSliderStates();
    }

    private void updateSliderStates() {
        GodHandConfig config = GodHandConfig.getInstance();
        this.searchRadiusSlider.active = config.player.magicBowEnabled;
        this.megaSpeedSlider.active = config.player.magicBowEnabled;
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
}
