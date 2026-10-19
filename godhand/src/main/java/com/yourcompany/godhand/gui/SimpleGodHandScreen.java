package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Der Hauptbildschirm der GodHand Mod, der Zugriff auf God Mode, Begleiter und Einstellungen bietet.
 */
public class SimpleGodHandScreen extends Screen {

    /**
     * Erstellt einen neuen SimpleGodHandScreen.
     */
    public SimpleGodHandScreen() {
        super(Text.translatable("text.godhand.title"));
    }

    @Override
    protected void init() {
        super.init();

        // Dynamische Button-Größen basierend auf Bildschirmgröße
        int buttonWidth = Math.min(200, this.width / 3);
        int buttonHeight = 20;
        int buttonSpacing = 8;
        int numberOfButtons = 6;
        int totalHeight = (buttonHeight * numberOfButtons) + (buttonSpacing * (numberOfButtons - 1));

        // Intelligent berechneter startY, so dass das gesamte Menü vertikal zentriert wird
        int startY = Math.max(30, this.height / 2 - totalHeight / 2);
        int x = this.width / 2 - buttonWidth / 2;

        // God Mode Button
        this.addDrawableChild(ButtonWidget.builder(getGodModeStatusText(), (button) -> {
            this.client.setScreen(new SimpleGodModeScreen(this));
        })
        .dimensions(x, startY, buttonWidth, buttonHeight)
        .build());

        // Companion Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("text.godhand.companion"), (button) -> {
            this.client.setScreen(new SimpleCompanionScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing), buttonWidth, buttonHeight)
        .build());

        // Player Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("text.godhand.player"), (button) -> {
            this.client.setScreen(new SimplePlayerScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 2, buttonWidth, buttonHeight)
        .build());

        // Settings Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("text.godhand.settings"), (button) -> {
            this.client.setScreen(new SimpleSettingsScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 3, buttonWidth, buttonHeight)
        .build());

        // Magic Bow Settings Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("Magic Bow Settings"), (button) -> {
            this.client.setScreen(new com.yourcompany.godhand.gui.MagicArrowSettingsScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 4, buttonWidth, buttonHeight)
        .build());

        // Close Button - intelligent unten angereiht!
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("godhand.gui.button.close"), (button) -> {
            this.close();
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 5, buttonWidth, buttonHeight)
        .build());
    }

    /**
     * Erstellt den Text für den God Mode Status-Button, der den aktuellen God Mode und Flugmodus anzeigt.
     * @return Der Text für den God Mode Status-Button.
     */
    private Text getGodModeStatusText() {
        boolean godModeEnabled = GodHandConfig.getInstance().godMode.enabled;
        boolean flightEnabled = GodHandConfig.getInstance().godMode.flightEnabled;
        Text godModeStatus = godModeEnabled ? Text.translatable("options.on") : Text.translatable("options.off");
        Text flightStatus = flightEnabled ? Text.translatable("options.on") : Text.translatable("options.off");
        return Text.translatable("text.godhand.status_combined", godModeStatus, flightStatus);
    }

    /**
     * Rendert den Bildschirm.
     */
    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);
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
