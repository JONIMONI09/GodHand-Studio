package com.yourcompany.godhand.goals;

import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffect;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.nbt.NbtCompound;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import java.util.HashMap;
import java.util.Map;
import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class CompanionBuffGoalTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Exception | Error e) {}
    }

    private LivingEntity mockCompanion;
    private NbtCompound mockNbt;
    private CompanionBuffGoal goal;
    private Map<net.minecraft.registry.entry.RegistryEntry<StatusEffect>, StatusEffectInstance> activeEffectsMap;

    @BeforeEach
    public void setup() {
        // mock completely by disabling deep stubbing but with default answer to allow methods like getStatusEffect to work
        mockCompanion = mock(LivingEntity.class, withSettings().extraInterfaces(IEntityDataSaver.class).defaultAnswer(CALLS_REAL_METHODS));
        mockNbt = new NbtCompound();
        goal = new CompanionBuffGoal(mockCompanion);

        doReturn(mockNbt).when((IEntityDataSaver) mockCompanion).getPersistentData();
        activeEffectsMap = new HashMap<>();

        try {
            for (Field f : LivingEntity.class.getDeclaredFields()) {
                if (Map.class.isAssignableFrom(f.getType())) {
                    f.setAccessible(true);
                    f.set(mockCompanion, activeEffectsMap);
                    break;
                }
            }
        } catch (Exception e) {}
    }

    @Test
    public void testTick_AddsEffectsWhenMissing() {
        mockNbt.putBoolean("godhand_is_companion", true);
        mockNbt.putBoolean("godhand_effect_regen", true);

        org.junit.jupiter.api.Assumptions.assumeTrue(StatusEffects.REGENERATION != null, "Minecraft registry not initialized");

        goal.tick();

        StatusEffectInstance appliedEffect = activeEffectsMap.get(StatusEffects.REGENERATION);
        assertNotNull(appliedEffect, "Effect should have been added to activeEffectsMap");
        assertEquals(StatusEffects.REGENERATION, appliedEffect.getEffectType());
        assertEquals(210, appliedEffect.getDuration());
    }

    @Test
    public void testTick_DoesNotAddEffectWhenAlreadyPresentAndDurationHigh() {
        StatusEffectInstance currentEffect = new StatusEffectInstance(StatusEffects.REGENERATION, 100, 0);
        activeEffectsMap.put(StatusEffects.REGENERATION, currentEffect);

        mockNbt.putBoolean("godhand_is_companion", true);
        mockNbt.putBoolean("godhand_effect_regen", true);

        org.junit.jupiter.api.Assumptions.assumeTrue(StatusEffects.REGENERATION != null, "Minecraft registry not initialized");

        goal.tick();

        assertEquals(100, activeEffectsMap.get(StatusEffects.REGENERATION).getDuration());
    }

    @Test
    public void testTick_AddsEffectWhenAlreadyPresentButDurationLow() {
        StatusEffectInstance currentEffect = new StatusEffectInstance(StatusEffects.REGENERATION, 15, 0);
        activeEffectsMap.put(StatusEffects.REGENERATION, currentEffect);

        mockNbt.putBoolean("godhand_is_companion", true);
        mockNbt.putBoolean("godhand_effect_regen", true);

        org.junit.jupiter.api.Assumptions.assumeTrue(StatusEffects.REGENERATION != null, "Minecraft registry not initialized");

        goal.tick();

        StatusEffectInstance appliedEffect = activeEffectsMap.get(StatusEffects.REGENERATION);
        assertNotNull(appliedEffect, "Effect should have been added to activeEffectsMap");
        assertEquals(StatusEffects.REGENERATION, appliedEffect.getEffectType());
        assertEquals(210, appliedEffect.getDuration());
    }
}
