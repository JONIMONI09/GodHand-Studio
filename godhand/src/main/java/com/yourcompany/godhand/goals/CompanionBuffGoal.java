package com.yourcompany.godhand.goals;

import com.yourcompany.godhand.GodHand;
import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.ai.goal.Goal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.nbt.NbtCompound;

import java.util.EnumSet;

/**
 * Ein Ziel für Begleiter, das ihnen passive Buffs basierend auf ihren NBT-Daten verleiht.
 * Dieses Ziel ist immer aktiv und unterbricht andere Ziele nicht.
 */
public class CompanionBuffGoal extends Goal {
    private static final Logger LOGGER = LoggerFactory.getLogger(GodHand.MOD_ID);
    private final LivingEntity companion;

    /**
     * Erstellt ein neues CompanionBuffGoal.
     * @param companion Der Begleiter, der gebufft werden soll.
     */
    public CompanionBuffGoal(LivingEntity companion) {
        this.companion = companion;
        this.setControls(EnumSet.of(Goal.Control.LOOK)); // Doesn't interrupt other goals
    }

    @Override
    public boolean canStart() {
        // This goal should always be active for a companion.
        return true;
    }


    private void applyEffectIfNeeded(net.minecraft.registry.entry.RegistryEntry<net.minecraft.entity.effect.StatusEffect> effect) {
        StatusEffectInstance current = companion.getStatusEffect(effect);
        if (current == null || current.getDuration() <= 20) {
            companion.addStatusEffect(new StatusEffectInstance(effect, 210, 0, false, false, true));
        }
    }

    @Override
    public void tick() {
        try {
            // Verwende persistentData statt writeNbt für bessere Performance und Zuverlässigkeit
            IEntityDataSaver dataSaver = (IEntityDataSaver) companion;
            NbtCompound nbt = dataSaver.getPersistentData();

            if (!nbt.getBoolean("godhand_is_companion")) {
                return; // Not a companion, do nothing.
            }

            // Apply effects based on persistent data
            if (nbt.getBoolean("godhand_effect_regen")) {
                applyEffectIfNeeded(StatusEffects.REGENERATION);
            }
            if (nbt.getBoolean("godhand_effect_strength")) {
                applyEffectIfNeeded(StatusEffects.STRENGTH);
            }
            if (nbt.getBoolean("godhand_effect_speed")) {
                applyEffectIfNeeded(StatusEffects.SPEED);
            }
            if (nbt.getBoolean("godhand_effect_resistance")) {
                applyEffectIfNeeded(StatusEffects.RESISTANCE);
            }
        } catch (Exception e) {
            // Logge Fehler, aber lasse das Goal weiterlaufen
            LOGGER.error("Error in CompanionBuffGoal.tick()", e);
        }
    }

}
