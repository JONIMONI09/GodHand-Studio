package com.yourcompany.godhand;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import java.io.File;

public class SavePerformanceBenchmark {

    @Test
    void benchmarkAddPlayerPerformance() {
        // Setup
        GodHandConfig config = GodHandConfig.getInstance();
        UUID randomUuid = UUID.randomUUID();

        // Warmup
        for (int i = 0; i < 5; i++) {
            BowWhitelistManager.addPlayer(UUID.randomUUID());
        }

        // Measure
        int iterations = 20;
        long totalTime = 0;

        for (int i = 0; i < iterations; i++) {
            UUID uuid = UUID.randomUUID();
            long start = System.nanoTime();
            BowWhitelistManager.addPlayer(uuid);
            long end = System.nanoTime();
            totalTime += (end - start);
        }

        double averageMs = (totalTime / (double)iterations) / 1_000_000.0;
        System.out.println("Average time for addPlayer (blocking): " + averageMs + " ms");

        // Clean up
        new File("godhand.json").delete();
    }
}
