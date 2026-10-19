package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.client.gui.DrawContext;

/**
 * Ein Bildschirm zur Konfiguration der Effekte, die Begleiter erhalten können.
 */
public class CompanionEffectsScreen extends Screen {

    private final Screen parent;

    /**
     * Erstellt einen neuen CompanionEffectsScreen.
     * @param parent Der übergeordnete Bildschirm, zu dem man zurückkehren kann.
     */
    public CompanionEffectsScreen(Screen parent) {
        super(Text.translatable("text.godhand.companion_effects.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        int buttonWidth = 200;
        int buttonHeight = 20;
        int x = this.width / 2 - buttonWidth / 2;
        int y = this.height / 2 - (buttonHeight * 3) - 5; // Center vertically
        int spacing = buttonHeight + 5;

        GodHandConfig.CompanionConfig config = GodHandConfig.getInstance().companion;

        // Fügt Buttons für verschiedene Begleiter-Effekte hinzu.
        // Give Extra Health
        addEffectButton(x, y, "text.godhand.companion_effects.give_extra_health", config.giveExtraHealth, () -> config.giveExtraHealth = !config.giveExtraHealth);
        
        // Give Regeneration
        addEffectButton(x, y + spacing, "text.godhand.companion_effects.give_regeneration", config.giveRegenerationEffect, () -> config.giveRegenerationEffect = !config.giveRegenerationEffect);

        // Give Strength
        addEffectButton(x, y + spacing * 2, "text.godhand.companion_effects.give_strength", config.giveStrengthEffect, () -> config.giveStrengthEffect = !config.giveStrengthEffect);

        // Give Speed
        addEffectButton(x, y + spacing * 3, "text.godhand.companion_effects.give_speed", config.giveSpeedEffect, () -> config.giveSpeedEffect = !config.giveSpeedEffect);

        // Give Resistance
        addEffectButton(x, y + spacing * 4, "text.godhand.companion_effects.give_resistance", config.giveResistanceEffect, () -> config.giveResistanceEffect = !config.giveResistanceEffect);

        // Back Button
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
    }

    /**
     * Fügt einen Button für einen Begleiter-Effekt hinzu.
     * @param x Die X-Koordinate des Buttons.
     * @param y Die Y-Koordinate des Buttons.
     * @param translationKey Der Übersetzungsschlüssel für den Button-Text.
     * @param currentValue Der aktuelle Wert des Effekts (true/false).
     * @param toggleAction Die Aktion, die beim Klicken auf den Button ausgeführt wird.
     */
    private void addEffectButton(int x, int y, String translationKey, boolean initialValue, Runnable toggleAction) {
        // Erstelle den Status-Schlüssel basierend auf dem übergebenen translationKey
        String statusTranslationKey = translationKey + ".status";

        // Initialer Text
        Text buttonText = Text.translatable(statusTranslationKey, initialValue ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off"));

        this.addDrawableChild(ButtonWidget.builder(buttonText, (button) -> {
            toggleAction.run(); // Ändert den Wert in der Konfiguration
            GodHandConfig.saveAsync(GodHandConfig.getInstance());

            // Den aktualisierten Wert aus der Konfiguration lesen
            boolean updatedValue = getEffectValue(translationKey); // Neue Hilfsmethode

            // Button-Nachricht aktualisieren
            button.setMessage(Text.translatable(statusTranslationKey, updatedValue ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")));

            if (this.client != null && this.client.player != null) {
                this.client.player.sendMessage(Text.translatable("text.godhand.chat.companion_effects.updated", Text.translatable(translationKey), updatedValue ? Text.translatable("text.godhand.godmode.on") : Text.translatable("text.godhand.godmode.off")), false);
            }
        })
        .dimensions(x, y, 200, 20)
        .build());
    }

    // Neue Hilfsmethode, um den aktuellen Wert eines Effekts aus der Konfiguration zu holen
    private boolean getEffectValue(String translationKey) {
        GodHandConfig.CompanionConfig config = GodHandConfig.getInstance().companion;
        switch (translationKey) {
            case "text.godhand.companion_effects.give_extra_health": return config.giveExtraHealth;
            case "text.godhand.companion_effects.give_regeneration": return config.giveRegenerationEffect;
            case "text.godhand.companion_effects.give_strength": return config.giveStrengthEffect;
            case "text.godhand.companion_effects.give_speed": return config.giveSpeedEffect;
            case "text.godhand.companion_effects.give_resistance": return config.giveResistanceEffect;
            default: return false; // Sollte nicht passieren
        }
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
