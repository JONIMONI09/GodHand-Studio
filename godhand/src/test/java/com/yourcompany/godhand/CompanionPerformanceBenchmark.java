package com.yourcompany.godhand;

import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Box;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class CompanionPerformanceBenchmark {

    @BeforeAll
    public static void setup() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable ignored) {
            // Might fail in headless environment, but we mainly need the logic test
        }
    }

    @Test
    public void benchmarkInfiniteBoxQuery() {
        ServerWorld mockWorld = mock(ServerWorld.class);
        List<Entity> entities = new ArrayList<>();

        // Simulate 1000 entities in the world
        for (int i = 0; i < 1000; i++) {
            LivingEntity entity = mock(LivingEntity.class);
            entities.add(entity);
        }

        when(mockWorld.getOtherEntities(isNull(), any(Box.class))).thenReturn(entities);

        long startTime = System.nanoTime();

        // Current inefficient way
        List<LivingEntity> companionsInWorld = mockWorld.getOtherEntities(null, new Box(Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY))
                .stream()
                .filter(LivingEntity.class::isInstance)
                .map(e -> (LivingEntity) e)
                .filter(e -> { try { return CompanionManager.isCompanion(e); } catch (Exception ex) { return false; } })
                .collect(Collectors.toList());

        long endTime = System.nanoTime();
        long durationMs = (endTime - startTime) / 1000000;

        System.out.println("Time taken for 1000 entities query (Inefficient): " + durationMs + "ms");

        // New efficient way
        startTime = System.nanoTime();
        List<LivingEntity> efficientCompanions = List.copyOf(CompanionManager.getActiveCompanions());
        endTime = System.nanoTime();
        durationMs = (endTime - startTime) / 1000; // Microseconds for the efficient one

        System.out.println("Time taken for efficient query: " + durationMs + "μs");

        // This is just to establish a baseline. In a real environment with thousands of entities,
        // the overhead of world.getOtherEntities(null, INFINITE_BOX) is significant.
    }
}
