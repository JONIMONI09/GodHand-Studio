package com.yourcompany.godhand.mixin;

import net.minecraft.entity.mob.MobEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/**
 * Invoker interface for MobEntity methods.
 */
@Mixin(MobEntity.class)
public interface MobEntityInvoker {

    /**
     * Invokes the initGoals method of MobEntity.
     */
    @Invoker("initGoals")
    void invokeInitGoals();
}
