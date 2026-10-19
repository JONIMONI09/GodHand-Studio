package com.yourcompany.godhand.gui;

import com.yourcompany.godhand.CompanionManager;
import com.yourcompany.godhand.GodHand;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PacketByteBufs;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import com.yourcompany.godhand.network.ToggleMagicBowPacket;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.ElementListWidget;
import net.minecraft.entity.LivingEntity;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.text.Text;

import net.minecraft.client.gui.Element;

import java.util.List;

/**
 * Ein Bildschirm zur Verwaltung von Begleitern, der eine Liste der rekrutierten Begleiter anzeigt
 * und Optionen wie Teleportation bietet.
 */
public class CompanionManagementScreen extends Screen {

    private final Screen parent;
    private CompanionListWidget companionList;

    /**
     * Erstellt einen neuen CompanionManagementScreen.
     * @param parent Der übergeordnete Bildschirm, zu dem man zurückkehren kann.
     */
    public CompanionManagementScreen(Screen parent) {
        super(Text.translatable("text.godhand.companion_manage.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        super.init();

        // Initialisiert die Liste der Begleiter und fügt sie dem Bildschirm hinzu.
        this.companionList = new CompanionListWidget(this.client, this.width, this.height, 32, this.height - 64, 24);
        List<LivingEntity> companions = CompanionManager.getCompanionsOfPlayer(this.client.player);
        if (!companions.isEmpty()) {
            for (LivingEntity companion : companions) {
                this.companionList.addCompanionEntry(companion);
            }
        }

        this.addSelectableChild(this.companionList);

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
        this.companionList.render(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        // Zeigt eine Nachricht an, wenn keine Begleiter vorhanden sind.
        if (this.companionList.getCompanionEntryCount() == 0) {
            context.drawCenteredTextWithShadow(this.textRenderer, Text.translatable("text.godhand.companion_manage.no_companions"), this.width / 2, this.height / 2, 0xFFFFFF);
        }
        super.render(context, mouseX, mouseY, delta);
    }

    /**
     * Eine benutzerdefinierte Widget-Liste zur Anzeige von Begleitern.
     */
    private class CompanionListWidget extends ElementListWidget<CompanionListWidget.CompanionEntry> {

        /**
         * Erstellt eine neue CompanionListWidget Instanz.
         * @param client Der MinecraftClient.
         * @param width Die Breite des Widgets.
         * @param height Die Höhe des Widgets.
         * @param top Der obere Rand des Widgets.
         * @param bottom Der untere Rand des Widgets.
         * @param itemHeight Die Höhe jedes Elements in der Liste.
         */
        public CompanionListWidget(MinecraftClient client, int width, int height, int top, int bottom, int itemHeight) {
            super(client, width, height, top, itemHeight);
        }

        /**
         * Fügt einen Begleiter zur Liste hinzu.
         * @param companion Der hinzuzufügende Begleiter.
         */
        public void addCompanionEntry(LivingEntity companion) {
            this.addEntry(new CompanionEntry(companion, textRenderer));
        }

        /**
         * Gibt die Anzahl der Begleiter-Einträge in der Liste zurück.
         * @return Die Anzahl der Begleiter-Einträge.
         */
        public int getCompanionEntryCount() {
            return this.getEntryCount();
        }

        /**
         * Gibt die Breite einer Zeile in der Liste zurück.
         * @return Die Breite einer Zeile.
         */
        @Override
        public int getRowWidth() {
            return super.getRowWidth() + 50;
        }

        /**
         * Repräsentiert einen einzelnen Eintrag in der Begleiterliste.
         */
        public class CompanionEntry extends ElementListWidget.Entry<CompanionEntry> {

            private final LivingEntity companion;
            private final ButtonWidget teleportButton;
            private final net.minecraft.client.font.TextRenderer textRenderer;

            /**
             * Erstellt einen neuen CompanionEntry.
             * @param companion Der Begleiter, der in diesem Eintrag dargestellt wird.
             * @param textRenderer Der TextRenderer zum Zeichnen von Text.
             */
            public CompanionEntry(LivingEntity companion, net.minecraft.client.font.TextRenderer textRenderer) {
                this.companion = companion;
                this.textRenderer = textRenderer;
                this.teleportButton = ButtonWidget.builder(Text.translatable("text.godhand.companion_manage.teleport"), (button) -> {
                    PacketByteBuf buf = PacketByteBufs.create();
                    buf.writeUuid(companion.getUuid());
                    net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.send(new ToggleMagicBowPacket());
                }).dimensions(0, 0, 75, 20).build();
            }

            /**
             * Rendert den Begleiter-Eintrag auf dem Bildschirm.
             */
            @Override
            public void render(DrawContext context, int index, int y, int x, int entryWidth, int entryHeight, int mouseX, int mouseY, boolean hovered, float tickDelta) {
                context.drawTextWithShadow(this.textRenderer, this.companion.getName(), x, y + 1, 0xFFFFFF);
                context.drawTextWithShadow(this.textRenderer, Text.translatable("text.godhand.companion.hp_status", companion.getHealth(), companion.getMaxHealth()), x, y + 12, 0xAAAAAA);
                this.teleportButton.setX(x + entryWidth - 80);
                this.teleportButton.setY(y);
                this.teleportButton.render(context, mouseX, mouseY, tickDelta);
            }

            /**
             * Gibt eine Liste der Kind-Elemente dieses Eintrags zurück.
             * @return Eine Liste der Kind-Elemente.
             */
            @SuppressWarnings("unchecked")
            @Override
            public List<? extends Element> children() {
                return (List<? extends Element>) selectableChildren();
            }

            /**
             * Gibt eine Liste der auswählbaren Kind-Elemente dieses Eintrags zurück.
             * @return Eine Liste der auswählbaren Kind-Elemente.
             */
            @Override
            public List<? extends net.minecraft.client.gui.Selectable> selectableChildren() {
                return List.of(this.teleportButton);
            }
        }
    }
}
