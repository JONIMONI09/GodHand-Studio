package com.yourcompany.godhand;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class TargetSeekingBenchmark {

    static class DummyEntity {
        double x, y, z;
        public DummyEntity(double x, double y, double z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        public double squaredDistanceTo(DummyEntity other) {
            double dx = this.x - other.x;
            double dy = this.y - other.y;
            double dz = this.z - other.z;
            return dx * dx + dy * dy + dz * dz;
        }
    }

    @Test
    void runBenchmark() {
        DummyEntity arrow = new DummyEntity(0, 0, 0);
        List<DummyEntity> targets = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            targets.add(new DummyEntity(i + 1, i + 1, i + 1));
        }

        int iterations = 1000000;

        // Warmup
        for (int i = 0; i < 10000; i++) {
            performStream(targets, arrow);
            performLoop(targets, arrow);
        }

        // Baseline: Stream approach
        long startTime = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            performStream(targets, arrow);
        }
        long endTime = System.nanoTime();
        double streamTimeMs = (endTime - startTime) / 1000000.0;
        System.out.println("Stream approach: " + streamTimeMs + " ms");

        // Optimized: For-loop approach
        startTime = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            performLoop(targets, arrow);
        }
        endTime = System.nanoTime();
        double loopTimeMs = (endTime - startTime) / 1000000.0;
        System.out.println("Loop approach: " + loopTimeMs + " ms");

        if (loopTimeMs > 0) {
            System.out.println("Speedup: " + (streamTimeMs / loopTimeMs) + "x");
        }
    }

    private Optional<DummyEntity> performStream(List<DummyEntity> targets, DummyEntity arrow) {
        return targets.stream()
                .min((a, b) -> Double.compare(a.squaredDistanceTo(arrow), b.squaredDistanceTo(arrow)));
    }

    private Optional<DummyEntity> performLoop(List<DummyEntity> targets, DummyEntity arrow) {
        DummyEntity closest = null;
        double minDistanceSq = Double.MAX_VALUE;
        for (int i = 0; i < targets.size(); i++) {
            DummyEntity target = targets.get(i);
            double distSq = target.squaredDistanceTo(arrow);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closest = target;
            }
        }
        return Optional.ofNullable(closest);
    }
}
