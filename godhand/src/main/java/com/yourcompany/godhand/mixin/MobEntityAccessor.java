package com.yourcompany.godhand.mixin;

import net.minecraft.entity.ai.goal.GoalSelector;
import net.minecraft.entity.mob.MobEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/**
 * Accessor Mixin für MobEntity, um auf geschützte Felder zuzugreifen.
 */
@Mixin(MobEntity.class)
public interface MobEntityAccessor {

    /**
     * Gibt den GoalSelector der MobEntity zurück.
     * @return Der GoalSelector.
     */
    @Accessor("goalSelector")
    GoalSelector getGoalSelector();

    /**
     * Gibt den TargetSelector der MobEntity zurück.
     * @return Der TargetSelector.
     */
    @Accessor("targetSelector")
    GoalSelector getTargetSelector();
}
