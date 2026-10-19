package com.yourcompany.godhand.item;

import com.yourcompany.godhand.GodHand;

import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.util.Identifier;

/**
 * Klasse fuer Mod Items.
 */
public class ModItems {

    /** Das Magische Bogen Item. */
    public static final Item MAGIC_BOW = registerItem("magic_bow", new MagicBowItem(new Item.Settings().maxCount(1)));

    /**
     * Constructor
     */
    public ModItems() {
        super();
    }

    private static Item registerItem(String name, Item item) {
        return Registry.register(Registries.ITEM, Identifier.of(GodHand.MOD_ID, name), item);
    }

    /**
     * Registriert
     */
    public static void registerModItems() {
        GodHand.LOGGER.info("Registering Mod Items for " + GodHand.MOD_ID);
    }
}
