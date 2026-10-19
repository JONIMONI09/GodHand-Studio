package com.yourcompany.godhand.mixin;

import net.minecraft.item.BowItem;
import org.spongepowered.asm.mixin.Mixin;

/**
 * Mixin for the BowItem class to add custom behavior for despawning bows.
 */
@Mixin(BowItem.class)
public abstract class BowItemMixin {
    /**
     * Default constructor for BowItemMixin.
     */
    public BowItemMixin() {
        super();
    }


}