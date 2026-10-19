package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.CompanionManager;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PacketByteBufs;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import com.yourcompany.godhand.network.ToggleMagicBowPacket;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.entity.player.PlayerEntity;
import com.yourcompany.godhand.GodHand;

/**
 * Screen.
 */
public class SimpleCompanionScreen extends Screen {

    private final Screen parent;

    /**
     * Bool.
     */
    public static boolean serverConfirmedHasCompanions = false;
    /**
     * Bool.
     */
    public static boolean waitingForServerResponse = true;
    private boolean statusRequested = false;

    private ButtonWidget releaseButton;
    private ButtonWidget manageButton;
    private ButtonWidget effectsButton;

    /**
     * Init.
     * @param parent Parent screen.
     */
    public SimpleCompanionScreen(Screen parent) {
        super(Text.translatable("text.godhand.companion.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        if (!statusRequested) {
            waitingForServerResponse = true;
            statusRequested = true;
            net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new ToggleMagicBowPacket());
        }

        int buttonWidth = Math.min(200, this.width / 3);
        int buttonHeight = 20;
        int buttonSpacing = 8;
        int startY = Math.max(40, this.height / 2 - (buttonHeight * 3) - 20);
        int x = this.width / 2 - buttonWidth / 2;

        int totalHeight = (buttonHeight * 5) + (buttonSpacing * 4) + 20;
        if (startY + totalHeight > this.height - 40) {
            startY = this.height - totalHeight - 40;
        }

        PlayerEntity player = this.client.player;
        boolean buttonsActive = serverConfirmedHasCompanions && !waitingForServerResponse;

        ButtonWidget recruitButton = ButtonWidget.builder(Text.translatable("text.godhand.companion.recruit"), (button) -> {
            if (player != null) {
                CompanionManager.recruitNearestCompanion(player);
                waitingForServerResponse = true;
                net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new ToggleMagicBowPacket());
            }
        })
        .dimensions(x, startY, buttonWidth, buttonHeight)
        .build();
        this.addDrawableChild(recruitButton);

        releaseButton = ButtonWidget.builder(Text.translatable("text.godhand.companion.release"), (button) -> {
            if (player != null) {
                net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new ToggleMagicBowPacket());
                waitingForServerResponse = true;
                net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new ToggleMagicBowPacket());
            }
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing), buttonWidth, buttonHeight)
        .build();
        releaseButton.active = buttonsActive;
        this.addDrawableChild(releaseButton);

        manageButton = ButtonWidget.builder(Text.translatable("text.godhand.companion.manage"), (button) -> {
            this.client.setScreen(new CompanionManagementScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 2, buttonWidth, buttonHeight)
        .build();
        manageButton.active = buttonsActive;
        this.addDrawableChild(manageButton);

        effectsButton = ButtonWidget.builder(Text.translatable("text.godhand.companion.effects"), (button) -> {
            this.client.setScreen(new CompanionEffectsScreen(this));
        })
        .dimensions(x, startY + (buttonHeight + buttonSpacing) * 3, buttonWidth, buttonHeight)
        .build();
        effectsButton.active = buttonsActive;
        this.addDrawableChild(effectsButton);

        this.addDrawableChild(ButtonWidget.builder(Text.translatable("gui.back"), (button) -> {
            this.client.setScreen(this.parent);
        })
        .dimensions(this.width / 2 - 100, this.height - 30, 200, 20)
        .build());
    }

    @Override
    public void tick() {
        super.tick();
        boolean buttonsActive = serverConfirmedHasCompanions && !waitingForServerResponse;
        if (releaseButton != null) releaseButton.active = buttonsActive;
        if (manageButton != null) manageButton.active = buttonsActive;
        if (effectsButton != null) effectsButton.active = buttonsActive;
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
