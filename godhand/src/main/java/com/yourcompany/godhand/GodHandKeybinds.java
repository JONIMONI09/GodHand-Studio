package com.yourcompany.godhand;

import com.yourcompany.godhand.gui.SimpleGodHandScreen;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/**
 * Verwaltet die Tastenkombinationen (Keybinds) für die GodHand Mod.
 */
public class GodHandKeybinds {
    /**
     * Default constructor for GodHandKeybinds.
     */
    public GodHandKeybinds() {
        super();
    }


    /** Die Übersetzungskategorie für die GodHand Keybinds. */
    public static final String KEY_CATEGORY_GODHAND = "key.category.godhand";
    /** Der Keybinding zum Öffnen des GodHand Menüs. */
    public static KeyBinding openMenuKeybind;

    /**
     * Registriert die Keybinds für die GodHand Mod.
     */
    public static void register() {
        openMenuKeybind = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.godhand.open_menu", // The translation key of the keybinding's name
                InputUtil.Type.KEYSYM, // The type of the keybinding, KEYSYM for keyboard, MOUSE for mouse.
                GLFW.GLFW_KEY_G, // The keycode of the key
                KEY_CATEGORY_GODHAND // The translation key of the keybinding's category
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (openMenuKeybind.wasPressed()) {
                if (client.currentScreen instanceof SimpleGodHandScreen) {
                    client.player.closeScreen();
                } else if (client.currentScreen == null) {
                    client.setScreen(new SimpleGodHandScreen());
                }
            }
        });
    }
}
