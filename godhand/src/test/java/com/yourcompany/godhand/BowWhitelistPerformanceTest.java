package com.yourcompany.godhand;

import net.minecraft.server.MinecraftServer;
import net.minecraft.text.Text;
import net.minecraft.util.UserCache;
import com.mojang.authlib.GameProfile;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

import static org.mockito.Mockito.*;

public class BowWhitelistPerformanceTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable t) {
            System.err.println("Minecraft Bootstrap failed: " + t.getMessage());
        }
    }

    private MinecraftServer mockServer;
    private UserCache mockUserCache;

    @BeforeEach
    void setUp() {
        mockServer = mock(MinecraftServer.class);
        mockUserCache = mock(UserCache.class);
        when(mockServer.getUserCache()).thenReturn(mockUserCache);

        GodHandConfig config = GodHandConfig.getInstance();
        config.player.bowWhitelistConfig.whitelistedPlayers.clear();

        // Add 500 whitelisted players
        for (int i = 0; i < 500; i++) {
            UUID uuid = UUID.randomUUID();
            BowWhitelistManager.addPlayer(uuid);
            GameProfile profile = new GameProfile(uuid, "Player" + i);
            when(mockUserCache.getByUuid(uuid)).thenReturn(Optional.of(profile));
        }
    }

    @Test
    void runBenchmark() {
        int iterations = 100;

        // Warmup
        for (int i = 0; i < 10; i++) {
            BowWhitelistManager.getWhitelistedPlayerNames(mockServer);
        }

        long startTime = System.nanoTime();
        for (int i = 0; i < iterations; i++) {
            BowWhitelistManager.getWhitelistedPlayerNames(mockServer);
        }
        long endTime = System.nanoTime();

        double avgTimeMs = (endTime - startTime) / 1000000.0 / iterations;
        System.out.println("Average time for getWhitelistedPlayerNames (500 players): " + avgTimeMs + " ms");
    }
}
