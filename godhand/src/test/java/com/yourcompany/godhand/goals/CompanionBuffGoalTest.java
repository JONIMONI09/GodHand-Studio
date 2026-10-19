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

    @BeforeEach
    public void setup() {
        mockCompanion = mock(LivingEntity.class, withSettings().extraInterfaces(IEntityDataSaver.class));
        mockNbt = new NbtCompound();
        goal = new CompanionBuffGoal(mockCompanion);

        doReturn(mockNbt).when((IEntityDataSaver) mockCompanion).getPersistentData();
    }

    @Test
    public void testTick_AddsEffectsWhenMissing() {
        mockNbt.putBoolean("godhand_is_companion", true);
        mockNbt.putBoolean("godhand_effect_regen", true);

        org.junit.jupiter.api.Assumptions.assumeTrue(StatusEffects.REGENERATION != null, "Minecraft registry not initialized");

        when(mockCompanion.getStatusEffect(StatusEffects.REGENERATION)).thenReturn(null);

        goal.tick();

        verify(mockCompanion).addStatusEffect(argThat(inst -> 
            inst != null && 
            StatusEffects.REGENERATION.equals(inst.getEffectType()) && 
            inst.getDuration() == 210
        ));
    }

    @Test
    public void testTick_DoesNotAddEffectWhenAlreadyPresentAndDurationHigh() {
        StatusEffectInstance currentEffect = new StatusEffectInstance(StatusEffects.REGENERATION, 100, 0);

        mockNbt.putBoolean("godhand_is_companion", true);
        mockNbt.putBoolean("godhand_effect_regen", true);

        org.junit.jupiter.api.Assumptions.assumeTrue(StatusEffects.REGENERATION != null, "Minecraft registry not initialized");

        when(mockCompanion.getStatusEffect(StatusEffects.REGENERATION)).thenReturn(currentEffect);

        goal.tick();

        verify(mockCompanion, never()).addStatusEffect(any());
    }

    @Test
    public void testTick_AddsEffectWhenAlreadyPresentButDurationLow() {
        StatusEffectInstance currentEffect = new StatusEffectInstance(StatusEffects.REGENERATION, 15, 0);

        mockNbt.putBoolean("godhand_is_companion", true);
        mockNbt.putBoolean("godhand_effect_regen", true);

        org.junit.jupiter.api.Assumptions.assumeTrue(StatusEffects.REGENERATION != null, "Minecraft registry not initialized");

        when(mockCompanion.getStatusEffect(StatusEffects.REGENERATION)).thenReturn(currentEffect);

        goal.tick();

        verify(mockCompanion).addStatusEffect(argThat(inst -> 
            inst != null && 
            StatusEffects.REGENERATION.equals(inst.getEffectType()) && 
            inst.getDuration() == 210
        ));
    }
}
