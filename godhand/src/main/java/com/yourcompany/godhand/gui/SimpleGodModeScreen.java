package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import com.yourcompany.godhand.GodHandFeatures;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Ein Bildschirm zur Konfiguration der God Mode-Einstellungen.
 */
public class SimpleGodModeScreen extends Screen {

    private final Screen parent;

    /**
     * Erstellt einen neuen SimpleGodModeScreen.
     * @param parent Der übergeordnete Bildschirm, zu dem man zurückkehren kann.
     */
    public SimpleGodModeScreen(Screen parent) {
        super(Text.translatable("text.godhand.godmode.title"));
        this.parent = parent;
    }

    /**
     * Überprüft, ob die God Mode-Einstellungen gesperrt sind.
     * @return True, wenn die Einstellungen gesperrt sind, sonst false.
     */
    private boolean areSettingsLocked() {
        return GodHandConfig.getInstance().godMode.godModeSettingsLocked;
    }

    @Override
    protected void init() {
        super.init();

        // Initialisiert die Schaltflächen für die God Mode-Einstellungen.
        int buttonWidth = 200;
        int buttonHeight = 20;
        int x = this.width / 2 - buttonWidth / 2;
        int y = this.height / 2 - (buttonHeight * 3) - 15; // Adjusted startY for the new button

        GodHandConfig.GodModeConfig config = GodHandConfig.getInstance().godMode;

        // --- Settings Lock Button ---
        this.addDrawableChild(ButtonWidget.builder(getLockText(), (button) -> {
            config.godModeSettingsLocked = !config.godModeSettingsLocked;
            GodHandConfig.saveAsync(GodHandConfig.getInstance());
            if (this.client != null && this.client.player != null) {
                this.client.player.sendMessage(config.godModeSettingsLocked ? Text.translatable("godhand.chat.godmode.settings_locked") : Text.translatable("godhand.chat.godmode.settings_unlocked"), false);
            }
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload screen
        })
        .dimensions(x, y, buttonWidth, buttonHeight)
        .build());

        // --- Feature Buttons ---
        boolean settingsLocked = areSettingsLocked();

        int buttonSpacing = buttonHeight + 5;

        // God Mode Status Button
        ButtonWidget godModeButton = ButtonWidget.builder(getGodModeStatusText(), (button) -> {
            GodHandFeatures.toggleGodMode();
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload to update dependent buttons
        })
        .dimensions(x, y + buttonSpacing, buttonWidth, buttonHeight)
        .build();
        godModeButton.active = !settingsLocked;
        this.addDrawableChild(godModeButton);

        // Block Explosions Button
        ButtonWidget blockExplosionsButton = ButtonWidget.builder(getBlockExplosionsText(), (button) -> {
            GodHandFeatures.toggleBlockExplosions();
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload to update button text
        })
        .dimensions(x, y + buttonSpacing * 2, buttonWidth, buttonHeight)
        .build();
        blockExplosionsButton.active = !settingsLocked;
        this.addDrawableChild(blockExplosionsButton);

        // Block Fire Button
        ButtonWidget blockFireButton = ButtonWidget.builder(getBlockFireText(), (button) -> {
            GodHandFeatures.toggleBlockFire();
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload to update button text
        })
        .dimensions(x, y + buttonSpacing * 3, buttonWidth, buttonHeight)
        .build();
        blockFireButton.active = !settingsLocked;
        this.addDrawableChild(blockFireButton);

        // Respawn Invulnerability Button
        ButtonWidget respawnInvulnerabilityButton = ButtonWidget.builder(getRespawnInvulnerabilityText(), (button) -> {
            GodHandFeatures.toggleRespawnInvulnerability();
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload to update button text
        })
        .dimensions(x, y + buttonSpacing * 4, buttonWidth, buttonHeight)
        .build();
        respawnInvulnerabilityButton.active = !settingsLocked;
        this.addDrawableChild(respawnInvulnerabilityButton);

        // Flight Status Button
        ButtonWidget flightButton = ButtonWidget.builder(getFlightStatusText(), (button) -> {
            GodHandFeatures.toggleFlight();
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload to update button text
        })
        .dimensions(x, y + buttonSpacing * 5, buttonWidth, buttonHeight)
        .build();
        flightButton.active = !settingsLocked;
        this.addDrawableChild(flightButton);

        // Smart-Kombat Button
        ButtonWidget smartKombatButton = ButtonWidget.builder(getSmartKombatText(), (button) -> {
            GodHandFeatures.toggleSmartMode();
            this.client.setScreen(new SimpleGodModeScreen(this.parent)); // Reload to update button text
        })
        .dimensions(x, y + buttonSpacing * 6, buttonWidth, buttonHeight)
        .build();
        smartKombatButton.active = !settingsLocked;
        this.addDrawableChild(smartKombatButton);



        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
    }

    /**
     * Erstellt den Text für den Sperr-Button der God Mode-Einstellungen.
     * @return Der Text für den Sperr-Button.
     */
    private Text getLockText() {
        return areSettingsLocked() ? Text.translatable("godhand.settings.godmode.lock_button.on") : Text.translatable("godhand.settings.godmode.lock_button.off");
    }

    /**
     * Erstellt den Text für den God Mode Status-Button.
     * @return Der Text für den God Mode Status-Button.
     */
    private Text getGodModeStatusText() {
        return Text.translatable("text.godhand.godmode.status", GodHandConfig.getInstance().godMode.enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off"));
    }

    /**
     * Erstellt den Text für den Block Explosions-Button.
     * @return Der Text für den Block Explosions-Button.
     */
    private Text getBlockExplosionsText() {
        boolean enabled = GodHandConfig.getInstance().godMode.blockExplosions;
        Text statusText = enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
        return Text.translatable("text.godhand.godmode.block_explosions.status", statusText);
    }

    /**
     * Erstellt den Text für den Block Fire-Button.
     * @return Der Text für den Block Fire-Button.
     */
    private Text getBlockFireText() {
        boolean enabled = GodHandConfig.getInstance().godMode.blockFire;
        Text statusText = enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
        return Text.translatable("text.godhand.godmode.block_fire.status", statusText);
    }

    /**
     * Erstellt den Text für den Respawn Invulnerability-Button.
     * @return Der Text für den Respawn Invulnerability-Button.
     */
    private Text getRespawnInvulnerabilityText() {
        boolean enabled = GodHandConfig.getInstance().godMode.respawnInvulnerability;
        Text statusText = enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
        return Text.translatable("text.godhand.godmode.respawn_invulnerability.status", statusText);
    }

    /**
     * Erstellt den Text für den Flight Status-Button.
     * @return Der Text für den Flight Status-Button.
     */
    private Text getFlightStatusText() {
        boolean enabled = GodHandConfig.getInstance().godMode.flightEnabled;
        Text statusText = enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
        return Text.translatable("text.godhand.godmode.flight.status_combined", statusText);
    }

    /**
     * Erstellt den Text für den Smart-Kombat-Button.
     * @return Der Text für den Smart-Kombat-Button.
     */
    private Text getSmartKombatText() {
        boolean enabled = GodHandConfig.getInstance().godMode.smartModeEnabled;
        Text statusText = enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
        return Text.translatable("text.godhand.godmode.smart_kombat.status", statusText);
    }

    /**
     * Rendert den Bildschirm.
     */
    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);

        // Tooltip für Smart-Kombat Button
        for (var child : children()) {
            if (child instanceof ButtonWidget button && button.getMessage().getString().contains(Text.translatable("text.godhand.godmode.smart_kombat").getString())) {
                if (button.isHovered()) {
                    context.drawTooltip(this.textRenderer, Text.translatable("text.godhand.godmode.smart_kombat.tooltip"), mouseX, mouseY);
                }
            }
        }
    }

    /**
     * Gibt an, ob das Spiel pausiert werden soll, wenn dieser Bildschirm geöffnet ist.
     * @return false, da das Spiel nicht pausiert werden soll.
     */
    @Override
    public boolean shouldPause() {
        return false;
    }
}
