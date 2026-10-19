package com.yourcompany.godhand;
import com.yourcompany.godhand.network.*;


import com.yourcompany.godhand.gui.SimpleCompanionScreen;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import com.yourcompany.godhand.gui.BowWhitelistScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.player.PlayerEntity;


/**
 * Client-seitige Initialisierung der GodHand Mod.
 */
public class GodHandClient implements ClientModInitializer {
    /**
     * Opens the crash screen.
     * @param e the throwable causing the crash
     */
    public static void showCrashScreen(Throwable e) {
        if (net.minecraft.client.MinecraftClient.getInstance() != null) {
            net.minecraft.client.MinecraftClient.getInstance().execute(() -> {
                net.minecraft.client.MinecraftClient.getInstance().setScreen(new com.yourcompany.godhand.gui.GodHandCrashScreen(e));
            });
        }
    }

    /**
     * Opens a simple informational screen.
     */
    public static void showSimpleScreen() {
        if (net.minecraft.client.MinecraftClient.getInstance() != null) {
            net.minecraft.client.MinecraftClient.getInstance().execute(() -> {
                net.minecraft.client.MinecraftClient.getInstance().setScreen(new com.yourcompany.godhand.gui.SimpleGodHandScreen());
            });
        }
    }

    /**
     * Default constructor for GodHandClient.
     */
    public GodHandClient() {
        super();
    }


    /**
     * Wird beim Initialisieren der Client-Mod aufgerufen. Hier können client-spezifische Logiken, wie z.B. Rendering, eingerichtet werden.
     */
    @Override
    public void onInitializeClient() {
        registerClientReceivers();
        // This entrypoint is suitable for setting up client-specific logic, such as rendering.

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            PlayerEntity player = client.player;
            if (player != null) {
                // Apply God Mode effects continuously if enabled
                if (GodHandConfig.getInstance().godMode.enabled || GodHandConfig.getInstance().godMode.smartModeEnabled) {
                    GodHandFeatures.applyGodModeEffects(player);
                }

                // Continuous logging if diagnostic mode is enabled
                if (GodHandConfig.getInstance().godMode.diagnosticModeEnabled) {
                    GodHandConfig.GodModeConfig godModeConfig = GodHandConfig.getInstance().godMode;
                    DiagnosticManager.log(
                            "[Continuous Diagnostic] God Mode: " + godModeConfig.enabled +
                            ", Health: " + player.getHealth() + "/" + player.getMaxHealth() +
                            ", Hunger: " + player.getHungerManager().getFoodLevel() +
                            ", Smart Mode: " + godModeConfig.smartModeEnabled +
                            ", Allow Flying: " + player.getAbilities().allowFlying
                    );
                }

            }
        });

        // Apply God Hand settings when the player joins the world
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            PlayerEntity player = client.player;
            if (player != null) {
                GodHandConfig.GodModeConfig godModeConfig = GodHandConfig.getInstance().godMode;
                if (godModeConfig.enabled || godModeConfig.smartModeEnabled) {
                    GodHandFeatures.applyGodModeEffects(player);
                    DiagnosticManager.log("God Hand settings applied on world join: God Mode=" + godModeConfig.enabled + ", Smart Mode=" + godModeConfig.smartModeEnabled);
                } else {
                    DiagnosticManager.log("God Hand settings not applied on world join: God Mode and Smart Mode are disabled.");
                }
            } else {
                DiagnosticManager.log("God Hand settings could not be applied on world join: Player is null.");
            }
        });
    }

    /**
     * Öffnet den SimpleCompanionScreen.
     */
    public static void openCompanionScreen() {
        MinecraftClient.getInstance().setScreen(new SimpleCompanionScreen(null));
    }

    /**
     * Registriert die Client-Netzwerk-Receiver für die Mod.
     */
    
    private void registerClientReceivers() {
        ClientPlayNetworking.registerGlobalReceiver(S2COpenBowWhitelistScreenPacket.ID, (payload, context) -> {
            context.client().execute(() -> {
                context.client().setScreen(new BowWhitelistScreen(context.client().currentScreen));
            });
        });

        ClientPlayNetworking.registerGlobalReceiver(SyncBowWhitelistPacket.ID, (payload, context) -> {
            context.client().execute(() -> {
                com.yourcompany.godhand.BowWhitelistManager.updateLocalWhitelist(payload.whitelist());
            });
        });
    }

}