package com.yourcompany.godhand.mixin;

import net.minecraft.item.ArrowItem;
import org.spongepowered.asm.mixin.Mixin;

/**
 * This mixin is now empty as the logic has been moved to PlayerFeatures.java
 */
@Mixin(ArrowItem.class)
public class ArrowItemMixin {
    /**
     * Default constructor for ArrowItemMixin.
     */
    public ArrowItemMixin() {
        super();
    }

    // This mixin is intentionally empty as the logic has been moved to PlayerFeatures.java for better separation of concerns.
}