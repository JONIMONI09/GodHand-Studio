package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Ein Bildschirm für die allgemeinen Einstellungen der GodHand Mod.
 */
public class SimpleSettingsScreen extends Screen {

    private final Screen parent;

    /**
     * Erstellt einen neuen SimpleSettingsScreen.
     * @param parent Der übergeordnete Bildschirm, zu dem man zurückkehren kann.
     */
    public SimpleSettingsScreen(Screen parent) {
        super(Text.translatable("text.godhand.settings.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        // Initialisiert die Schaltflächen für die Einstellungen.
        int buttonWidth = 200;
        int buttonHeight = 20;
        int x = this.width / 2 - buttonWidth / 2;
        int buttonSpacing = buttonHeight + 5;
        int startY = this.height / 2 - (buttonHeight + 5); // Angepasster startY

        // Companion Settings Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("text.godhand.companion.title"), (button) -> {
            this.client.setScreen(new SimpleCompanionSettingsScreen(this));
        })
        .dimensions(x, startY, buttonWidth, buttonHeight)
        .build());

        // Player Settings Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("text.godhand.player_settings"), (button) -> {
            this.client.setScreen(new SimplePlayerSettingsScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + 5) * 2, buttonWidth, buttonHeight)
        .build());

        // Diagnostic Mode Button
        ButtonWidget diagnosticModeButton = ButtonWidget.builder(getDiagnosticModeText(), (button) -> {
            GodHandConfig.getInstance().godMode.diagnosticModeEnabled = !GodHandConfig.getInstance().godMode.diagnosticModeEnabled;
            GodHandConfig.saveAsync(GodHandConfig.getInstance());
            button.setMessage(getDiagnosticModeText());
            if (this.client.player != null) {
                this.client.player.sendMessage(Text.translatable("text.godhand.chat.godmode.diagnostic_mode.updated", GodHandConfig.getInstance().godMode.diagnosticModeEnabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
            }
        })
        .dimensions(x, startY + buttonSpacing, buttonWidth, buttonHeight)
        .build();
        this.addDrawableChild(diagnosticModeButton);


        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
    }

    /**
     * Erstellt den Text für den Diagnostic Mode-Button.
     * @return Der Text für den Diagnostic Mode-Button.
     */
    private Text getDiagnosticModeText() {
        boolean enabled = GodHandConfig.getInstance().godMode.diagnosticModeEnabled;
        Text statusText = enabled ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off");
        return Text.translatable("text.godhand.godmode.diagnostic_mode").append(": ").append(statusText);
    }

    /**
     * Rendert den Bildschirm.
     */
    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);

        // Tooltip für Diagnostic Mode Button
        for (var child : children()) {
            if (child instanceof ButtonWidget button && button.getMessage().getString().contains(Text.translatable("text.godhand.godmode.diagnostic_mode").getString())) {
                if (button.isHovered()) {
                    context.drawTooltip(this.textRenderer, Text.translatable("text.godhand.godmode.diagnostic_mode.tooltip"), mouseX, mouseY);
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