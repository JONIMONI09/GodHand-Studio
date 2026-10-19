package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.GodHand;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

/**
 * Ein benutzerdefinierter Absturzbildschirm für die GodHand Mod, der bei unbehandelten Ausnahmen angezeigt wird.
 */
public class GodHandCrashScreen extends Screen {
 // Nicht mehr final
    private final String errorMessage;
    private final boolean canContinue;

    /**
     * Erstellt einen neuen GodHandCrashScreen mit einer gegebenen Ursache.
     * @param cause Die Ursache des Absturzes.
     */
    public GodHandCrashScreen(Throwable cause) {
        this(cause, Text.translatable("godhand.crashscreen.title"), false);
    }

    /**
     * Erstellt einen neuen GodHandCrashScreen mit einer gegebenen Ursache, einem Titel und der Option, ob das Spiel fortgesetzt werden kann.
     * @param cause Die Ursache des Absturzes.
     * @param title Der Titel des Absturzbildschirms.
     * @param canContinue Gibt an, ob das Spiel nach dem Absturz fortgesetzt werden kann.
     */
    public GodHandCrashScreen(Throwable cause, Text title, boolean canContinue) {
        super(title);
        this.errorMessage = cause.getMessage() != null ? cause.getMessage() : cause.getClass().getSimpleName();
        this.canContinue = canContinue;

        GodHand.LOGGER.error("GodHand Mod crashed!", cause);
    }

    @Override
    protected void init() {
        super.init();
        this.addDrawableChild(ButtonWidget.builder(Text.translatable("godhand.crashscreen.exit"), (button) -> {
            this.client.scheduleStop();
        }).dimensions(this.width / 2 - 100, this.height - 40, 200, 20).build());

        if (canContinue) {
            this.addDrawableChild(ButtonWidget.builder(Text.translatable("godhand.crashscreen.continue"), (button) -> {
                this.client.setScreen(null);
                this.client.mouse.lockCursor();
            }).dimensions(this.width / 2 - 100, this.height - 65, 200, 20).build());
        }
    }

    @Override
    public void render(net.minecraft.client.gui.DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 20, 0xFFFFFF);
        context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("godhand.crashscreen.message", errorMessage), this.width / 2, 40, 0xFF0000);

        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean shouldPause() {
        return true;
    }
}
