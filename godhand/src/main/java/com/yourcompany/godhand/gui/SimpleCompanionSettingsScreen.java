package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.CompanionManager;
import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;

/**
 * Ein Bildschirm zur Konfiguration der Begleiter-Einstellungen.
 */
public class SimpleCompanionSettingsScreen extends Screen {

    private final Screen parent;
    private SliderWidget maxCompanionsSlider;
    private SliderWidget followDistanceSlider;
    private SliderWidget defendRadiusSlider;

    /**
     * Erstellt einen neuen SimpleCompanionSettingsScreen.
     * @param parent Der übergeordnete Bildschirm, zu dem man zurückkehren kann.
     */
    public SimpleCompanionSettingsScreen(Screen parent) {
        super(Text.translatable("text.godhand.companion.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        int buttonWidth = 200;
        int buttonHeight = 20;
        int x = this.width / 2 - buttonWidth / 2;
        int y = this.height / 2 - (buttonHeight * 2) - 10;

        // Max Companions Slider
        GodHandConfig config = GodHandConfig.getInstance();
        this.maxCompanionsSlider = new SliderWidget(x, y, buttonWidth, buttonHeight, 
                Text.translatable("text.godhand.companion.max_companions", config.companion.maxCompanions),
                (config.companion.maxCompanions - 1) / 99.0) {
            @Override
            protected void updateMessage() {
                this.setMessage(Text.translatable("text.godhand.companion.max_companions", (int) (this.value * 99) + 1));
            }

            @Override
            protected void applyValue() {
                int newValue = (int) (this.value * 99) + 1;
                GodHandConfig.getInstance().companion.maxCompanions = newValue;
                GodHandConfig.saveAsync(GodHandConfig.getInstance());
                client.player.sendMessage(Text.translatable("godhand.chat.companion_settings.max_companions_updated", newValue), false);
                CompanionManager.updateAllCompanionGoals(client.player);
            }
        };
        this.addDrawableChild(this.maxCompanionsSlider);

        // Follow Distance Slider
        this.followDistanceSlider = new SliderWidget(x, y + buttonHeight + 5, buttonWidth, buttonHeight, 
                Text.translatable("text.godhand.companion.follow_distance", String.format("%.1f", config.companion.followDistance)),
                (config.companion.followDistance - 1.0) / 127.0) {
            @Override
            protected void updateMessage() {
                double value = (this.value * 127.0) + 1.0;
                if (value > 127) {
                    this.setMessage(Text.translatable("text.godhand.companion.follow_distance.infinite"));
                } else {
                    this.setMessage(Text.translatable("text.godhand.companion.follow_distance", String.format("%.1f", value)));
                }
            }

            @Override
            protected void applyValue() {
                double newValue = (this.value * 127.0) + 1.0;
                GodHandConfig.getInstance().companion.followDistance = newValue;
                GodHandConfig.saveAsync(GodHandConfig.getInstance());
                if (newValue > 127) {
                    client.player.sendMessage(Text.translatable("godhand.chat.companion_settings.follow_distance_updated.infinite"), false);
                } else {
                    client.player.sendMessage(Text.translatable("godhand.chat.companion_settings.follow_distance_updated", String.format("%.1f", newValue)), false);
                }
                CompanionManager.updateAllCompanionGoals(client.player);
            }
        };
        this.addDrawableChild(this.followDistanceSlider);

        // Defend Radius Slider
        this.defendRadiusSlider = new SliderWidget(x, y + (buttonHeight + 5) * 2, buttonWidth, buttonHeight, 
                Text.translatable("text.godhand.companion.defend_radius", String.format("%.1f", config.companion.defendRadius)),
                (config.companion.defendRadius - 5.0) / 25.0) {
            @Override
            protected void updateMessage() {
                this.setMessage(Text.translatable("text.godhand.companion.defend_radius", String.format("%.1f", (this.value * 25) + 5.0)));
            }

            @Override
            protected void applyValue() {
                double newValue = (this.value * 25) + 5.0;
                GodHandConfig.getInstance().companion.defendRadius = newValue;
                GodHandConfig.saveAsync(GodHandConfig.getInstance());
                client.player.sendMessage(Text.translatable("godhand.chat.companion_settings.defend_radius_updated", String.format("%.1f", newValue)), false);
                CompanionManager.updateAllCompanionGoals(client.player);
            }
        };
        this.addDrawableChild(this.defendRadiusSlider);

        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
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
