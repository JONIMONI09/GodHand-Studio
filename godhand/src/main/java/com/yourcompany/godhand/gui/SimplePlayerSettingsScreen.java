package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;

/**
 * Ein Bildschirm zur Konfiguration der spielerbezogenen Einstellungen, insbesondere für den Super-Bogen.
 */
public class SimplePlayerSettingsScreen extends Screen {

    private final Screen parent;
    private ButtonWidget arrowDuplicationToggle;
    private SliderWidget arrowDuplicationSlider;
    private SliderWidget arrowSeekRadiusSlider;
    private ButtonWidget explosiveBowToggle;
    private ButtonWidget targetAllMobsToggle;
    private SliderWidget explosionRadiusSlider;
    private SliderWidget explosionModeSlider;

    /**
     * Erstellt einen neuen SimplePlayerSettingsScreen.
     * @param parent Der übergeordnete Bildschirm.
     */
    public SimplePlayerSettingsScreen(Screen parent) {
        super(Text.translatable("text.godhand.player_settings.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        int widgetWidth = 200;
        int widgetHeight = 20;
        int x = this.width / 2 - widgetWidth / 2;
        int startY = this.height / 2 - (widgetHeight * 4) - 10;

        GodHandConfig config = GodHandConfig.getInstance();

        addArrowDuplicationWidgets(config, x, startY, widgetWidth, widgetHeight);
        addSuperBowWidgets(config, x, startY, widgetWidth, widgetHeight);
        addExplosiveBowWidgets(config, x, startY, widgetWidth, widgetHeight);
        addNavigationWidgets();

        updateArrowDuplicationSliderStates(config.player.arrowDuplicationEnabled);
        updateExplosiveBowSliderStates(config.player.explosiveBowConfig.enabled);
        updateSuperBowSliderStates(config.player.superBowEnabled);
    }

    private void addNavigationWidgets() {
        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
    }

    private void addSuperBowWidgets(GodHandConfig config, int x, int startY, int widgetWidth, int widgetHeight) {
        // Target All Mobs Toggle
        targetAllMobsToggle = ButtonWidget.builder(
            Text.translatable("text.godhand.player_settings.target_all_mobs.status", getStatusText(config.player.superBowTargetsAllMobs)),
            (button) -> {
                config.player.superBowTargetsAllMobs = !config.player.superBowTargetsAllMobs;
                GodHandConfig.saveAsync(config);
                button.setMessage(Text.translatable("text.godhand.player_settings.target_all_mobs.status", getStatusText(config.player.superBowTargetsAllMobs)));
                this.client.player.sendMessage(Text.translatable("godhand.chat.player_settings.target_all_mobs_updated", getStatusText(config.player.superBowTargetsAllMobs)), false);
            }
        ).dimensions(x, startY + (widgetHeight + 5) * 3, widgetWidth, widgetHeight).build();
        this.addDrawableChild(targetAllMobsToggle);
    }

    private void addExplosiveBowWidgets(GodHandConfig config, int x, int startY, int widgetWidth, int widgetHeight) {
        // Explosive Bow Toggle
        explosiveBowToggle = ButtonWidget.builder(
            Text.translatable("godhand.gui.button.explosive_bow", getStatusText(config.player.explosiveBowConfig.enabled)),
            (button) -> {
                config.player.explosiveBowConfig.enabled = !config.player.explosiveBowConfig.enabled;
                GodHandConfig.saveAsync(config);
                button.setMessage(Text.translatable("godhand.gui.button.explosive_bow", getStatusText(config.player.explosiveBowConfig.enabled)));
                updateExplosiveBowSliderStates(config.player.explosiveBowConfig.enabled);
                this.client.player.sendMessage(Text.translatable("godhand.chat.player.explosive_bow_updated", getStatusText(config.player.explosiveBowConfig.enabled)), false);
            }
        ).dimensions(x, startY + (widgetHeight + 5) * 4, widgetWidth, widgetHeight).build();
        this.addDrawableChild(explosiveBowToggle);

        // Explosion Radius Slider
        explosionRadiusSlider = new SliderWidget(x, startY + (widgetHeight + 5) * 5, widgetWidth, widgetHeight,
                Text.translatable("godhand.gui.slider.explosion_radius", String.format("%.1f", config.player.explosiveBowConfig.explosionRadius)),
                config.player.explosiveBowConfig.explosionRadius / 50.0) {
            @Override
            protected void updateMessage() {
                setMessage(Text.translatable("godhand.gui.slider.explosion_radius", String.format("%.1f", getValue())));
            }

            @Override
            protected void applyValue() {
                config.player.explosiveBowConfig.explosionRadius = getValue();
                GodHandConfig.saveAsync(config);
                client.player.sendMessage(Text.translatable("godhand.chat.player.explosion_radius_updated", String.format("%.1f", getValue())), false);
            }

            private double getValue() {
                return this.value * 50.0;
            }
        };
        this.addDrawableChild(explosionRadiusSlider);

        // Explosion Mode Slider
        explosionModeSlider = new SliderWidget(x, startY + (widgetHeight + 5) * 6, widgetWidth, widgetHeight,
                getExplosionModeText(config.player.explosiveBowConfig.explosionMode),
                config.player.explosiveBowConfig.explosionMode / 1.0) {
            @Override
            protected void updateMessage() {
                setMessage(getExplosionModeText(getValue()));
            }

            @Override
            protected void applyValue() {
                config.player.explosiveBowConfig.explosionMode = getValue();
                GodHandConfig.saveAsync(config);
                client.player.sendMessage(Text.translatable("godhand.chat.player.explosion_mode_updated", getExplosionModeText(getValue())), false);
            }

            private int getValue() {
                return (int) Math.round(this.value * 1.0);
            }
        };
        this.addDrawableChild(explosionModeSlider);
    }

    private void addArrowDuplicationWidgets(GodHandConfig config, int x, int startY, int widgetWidth, int widgetHeight) {
        // Arrow Duplication Toggle
        arrowDuplicationToggle = ButtonWidget.builder(
            Text.translatable("text.godhand.player_settings.arrow_duplication.status", getStatusText(config.player.arrowDuplicationEnabled)),
            (button) -> {
                config.player.arrowDuplicationEnabled = !config.player.arrowDuplicationEnabled;
                GodHandConfig.saveAsync(config);
                button.setMessage(Text.translatable("text.godhand.player_settings.arrow_duplication.status", getStatusText(config.player.arrowDuplicationEnabled)));
                updateArrowDuplicationSliderStates(config.player.arrowDuplicationEnabled);
                this.client.player.sendMessage(Text.translatable("godhand.chat.player_settings.arrow_duplication_updated", getStatusText(config.player.arrowDuplicationEnabled)), false);
            }
        ).dimensions(x, startY, widgetWidth, widgetHeight).build();
        this.addDrawableChild(arrowDuplicationToggle);

        // Arrow Duplication Amount Slider
        arrowDuplicationSlider = new SliderWidget(x, startY + widgetHeight + 5, widgetWidth, widgetHeight,
                Text.translatable("text.godhand.player_settings.duplication_amount", config.player.arrowDuplicationAmount),
                (config.player.arrowDuplicationAmount - 1) / 29.0) {
            @Override
            protected void updateMessage() {
                setMessage(Text.translatable("text.godhand.player_settings.duplication_amount", getValue()));
            }

            @Override
            protected void applyValue() {
                config.player.arrowDuplicationAmount = getValue();
                GodHandConfig.saveAsync(config);
                client.player.sendMessage(Text.translatable("godhand.chat.player_settings.duplication_amount_updated", getValue()), false);
            }

            private int getValue() {
                return (int) (this.value * 29) + 1;
            }
        };
        this.addDrawableChild(arrowDuplicationSlider);

        // Arrow Seek Radius Slider
        arrowSeekRadiusSlider = new SliderWidget(x, startY + (widgetHeight + 5) * 2, widgetWidth, widgetHeight,
                Text.translatable("text.godhand.player_settings.seek_radius", String.format("%.1f", config.player.arrowSeekRadius)),
                (config.player.arrowSeekRadius - 5.0) / 95.0) {
            @Override
            protected void updateMessage() {
                setMessage(Text.translatable("text.godhand.player_settings.seek_radius", String.format("%.1f", getValue())));
            }

            @Override
            protected void applyValue() {
                config.player.arrowSeekRadius = getValue();
                GodHandConfig.saveAsync(config);
                client.player.sendMessage(Text.translatable("godhand.chat.player_settings.seek_radius_updated", String.format("%.1f", getValue())), false);
            }

            private double getValue() {
                return (this.value * 95.0) + 5.0;
            }
        };
        this.addDrawableChild(arrowSeekRadiusSlider);
    }

    private void updateSuperBowSliderStates(boolean enabled) {
        // This method will now only update the targetAllMobsToggle based on superBowEnabled
        targetAllMobsToggle.active = enabled;
    }

    private void updateArrowDuplicationSliderStates(boolean enabled) {
        GodHandConfig config = GodHandConfig.getInstance();
        arrowDuplicationSlider.active = enabled && (config.player.superBowEnabled || config.player.magicBowEnabled);
        arrowSeekRadiusSlider.active = enabled && (config.player.superBowEnabled || config.player.magicBowEnabled);
    }

    private void updateExplosiveBowSliderStates(boolean enabled) {
        explosionRadiusSlider.active = enabled;
        explosionModeSlider.active = enabled;
    }

    private Text getStatusText(boolean enabled) {
        return enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
    }

    private Text getExplosionModeText(int mode) {
        return mode == 0 ? Text.translatable("godhand.gui.slider.explosion_mode.damage_only") : Text.translatable("godhand.gui.slider.explosion_mode.destruction");
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
