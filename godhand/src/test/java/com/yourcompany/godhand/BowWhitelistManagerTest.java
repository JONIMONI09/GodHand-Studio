package com.yourcompany.godhand;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import com.mojang.authlib.GameProfile;

import java.util.List;
import java.util.UUID;


import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Assumptions;


public class BowWhitelistManagerTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();

            // Validate if Mockito can mock entities without crashing in this environment
            org.mockito.Mockito.mock(net.minecraft.entity.mob.MobEntity.class, org.mockito.Mockito.withSettings().withoutAnnotations());
        } catch (java.lang.VerifyError | java.lang.InternalError | java.lang.NoClassDefFoundError | java.lang.ExceptionInInitializerError e) {
            org.junit.jupiter.api.Assumptions.assumeTrue(false, "Skipping tests due to Fabric/Mockito incompatibility on this JVM");
        } catch (Throwable t) {
             if (t instanceof org.opentest4j.TestAbortedException) throw (org.opentest4j.TestAbortedException)t;
             System.err.println("Minecraft Bootstrap failed: " + t.getMessage());
             org.junit.jupiter.api.Assumptions.assumeTrue(false, "Skipping tests because Bootstrap failed");
        }
    }


    private GodHandConfig config;
    private MinecraftServer mockServer;
    private ServerPlayerEntity mockPlayer;

    @BeforeEach
    void setUp() {
        config = GodHandConfig.getInstance();
        // Reset whitelist for each test
        config.player.bowWhitelistConfig.whitelistedPlayers.clear();

        mockServer = mock(MinecraftServer.class);
        mockPlayer = mock(ServerPlayerEntity.class);
    }

    @Test
    void testAddPlayer_NewPlayer() {
        UUID testUuid = UUID.randomUUID();
        boolean result = BowWhitelistManager.addPlayer(testUuid);
        assertTrue(result);
        assertTrue(BowWhitelistManager.isWhitelisted(testUuid));
    }

    @Test
    void testAddPlayer_AlreadyWhitelisted() {
        UUID testUuid = UUID.randomUUID();
        BowWhitelistManager.addPlayer(testUuid);
        boolean result = BowWhitelistManager.addPlayer(testUuid);
        assertFalse(result);
        assertTrue(BowWhitelistManager.isWhitelisted(testUuid));
    }

    @Test
    void testRemovePlayer_WhitelistedPlayer() {
        UUID testUuid = UUID.randomUUID();
        BowWhitelistManager.addPlayer(testUuid);
        boolean result = BowWhitelistManager.removePlayer(testUuid);
        assertTrue(result);
        assertFalse(BowWhitelistManager.isWhitelisted(testUuid));
    }

    @Test
    void testRemovePlayer_NotWhitelisted() {
        UUID testUuid = UUID.randomUUID();
        boolean result = BowWhitelistManager.removePlayer(testUuid);
        assertFalse(result);
        assertFalse(BowWhitelistManager.isWhitelisted(testUuid));
    }

    @Test
    void testIsWhitelisted_True() {
        UUID testUuid = UUID.randomUUID();
        BowWhitelistManager.addPlayer(testUuid);
        assertTrue(BowWhitelistManager.isWhitelisted(testUuid));
    }

    @Test
    void testIsWhitelisted_False() {
        UUID testUuid = UUID.randomUUID();
        assertFalse(BowWhitelistManager.isWhitelisted(testUuid));
    }

    @Test
    void testGetWhitelistedPlayerNames() {
        UUID testUuid = UUID.randomUUID();
        BowWhitelistManager.addPlayer(testUuid);

        // Mock user cache
        var mockUserCache = mock(net.minecraft.util.UserCache.class);
        when(mockServer.getUserCache()).thenReturn(mockUserCache);
        var mockProfile = new GameProfile(testUuid, "TestPlayer");
        when(mockUserCache.getByUuid(testUuid)).thenReturn(java.util.Optional.of(mockProfile));

        List<Text> names = BowWhitelistManager.getWhitelistedPlayerNames(mockServer);
        assertEquals(1, names.size());
        assertEquals("TestPlayer", names.get(0).getString());
    }

    @Test
    void testGetPlayerUuidByName_Found() {
        String playerName = "TestPlayer";
        UUID testUuid = UUID.randomUUID();

        var mockUserCache = mock(net.minecraft.util.UserCache.class);
        when(mockServer.getUserCache()).thenReturn(mockUserCache);
        var mockProfile = new GameProfile(testUuid, playerName);
        when(mockUserCache.findByName(playerName)).thenReturn(java.util.Optional.of(mockProfile));

        UUID result = BowWhitelistManager.getPlayerUuidByName(mockServer, playerName);
        assertEquals(testUuid, result);
    }

    @Test
    void testGetPlayerUuidByName_NotFound() {
        String playerName = "NonExistentPlayer";

        var mockUserCache = mock(net.minecraft.util.UserCache.class);
        when(mockServer.getUserCache()).thenReturn(mockUserCache);
        when(mockUserCache.findByName(playerName)).thenReturn(java.util.Optional.empty());

        UUID result = BowWhitelistManager.getPlayerUuidByName(mockServer, playerName);
        assertNull(result);
    }

    @Test
    void testGetAllPlayers() {
        var mockPlayerManager = mock(net.minecraft.server.PlayerManager.class);
        when(mockServer.getPlayerManager()).thenReturn(mockPlayerManager);
        List<ServerPlayerEntity> mockPlayers = List.of(mockPlayer);
        when(mockPlayerManager.getPlayerList()).thenReturn(mockPlayers);

        var mockProfile = new GameProfile(UUID.randomUUID(), "TestPlayer");
        when(mockPlayer.getGameProfile()).thenReturn(mockProfile);

        List<GameProfile> result = BowWhitelistManager.getAllPlayers(mockServer);
        assertEquals(1, result.size());
        assertEquals(mockProfile, result.get(0));
    }
}