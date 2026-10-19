package com.yourcompany.godhand;

import org.junit.jupiter.api.Test;
import java.util.*;

public class WhitelistBenchmark {

    @Test
    void runBenchmark() {
        int playerCount = 10000;
        int lookupCount = 100000;

        List<String> whitelistList = new ArrayList<>();
        Set<String> whitelistSet = new HashSet<>();
        List<String> lookups = new ArrayList<>();

        Random random = new Random(42);
        for (int i = 0; i < playerCount; i++) {
            String uuid = UUID.randomUUID().toString();
            whitelistList.add(uuid);
            whitelistSet.add(uuid);
            if (i % 10 == 0) { // Add 10% of them to lookups
                lookups.add(uuid);
            }
        }

        // Add some random lookups that are NOT in the whitelist
        for (int i = 0; i < lookupCount - lookups.size(); i++) {
            lookups.add(UUID.randomUUID().toString());
        }

        Collections.shuffle(lookups, random);

        System.out.println("Starting Benchmark with " + playerCount + " players and " + lookupCount + " lookups.");

        // Benchmark List
        long startTime = System.nanoTime();
        int foundCount = 0;
        for (String uuid : lookups) {
            if (whitelistList.contains(uuid)) {
                foundCount++;
            }
        }
        long endTime = System.nanoTime();
        double listTimeMs = (endTime - startTime) / 1000000.0;
        System.out.println("List.contains: " + listTimeMs + " ms (Found: " + foundCount + ")");

        // Benchmark Set
        startTime = System.nanoTime();
        foundCount = 0;
        for (String uuid : lookups) {
            if (whitelistSet.contains(uuid)) {
                foundCount++;
            }
        }
        endTime = System.nanoTime();
        double setTimeMs = (endTime - startTime) / 1000000.0;
        System.out.println("Set.contains: " + setTimeMs + " ms (Found: " + foundCount + ")");

        if (setTimeMs > 0) {
            System.out.println("Speedup: " + (listTimeMs / setTimeMs) + "x");
        }
    }
}
