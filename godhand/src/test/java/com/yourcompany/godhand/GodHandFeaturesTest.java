package com.yourcompany.godhand;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Assumptions;




import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.player.PlayerAbilities;
import net.minecraft.text.Text;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.util.UUID;

import static org.mockito.Mockito.*;

public class GodHandFeaturesTest {

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

    @BeforeEach
    void setUp() {
        config = GodHandConfig.getInstance(); // We get a real instance but will modify it
    }

    @Test
    void testToggleGodMode_EnablesGodModeAndDisablesSmartMode() {
        // Arrange
        config.godMode.enabled = false;
        config.godMode.smartModeEnabled = true;

        try (MockedStatic<MinecraftClient> mockedClient = mockStatic(MinecraftClient.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            mockedConfig.when(GodHandConfig::getInstance).thenReturn(config);
            mockedConfig.when(() -> GodHandConfig.save(any())).thenAnswer(i -> null);

            MinecraftClient client = mock(MinecraftClient.class);
            client.player = null;
            mockedClient.when(MinecraftClient::getInstance).thenReturn(client);

            // Act
            GodHandFeatures.toggleGodMode();

            // Assert
            Assertions.assertTrue(config.godMode.enabled, "God Mode should be enabled");
            Assertions.assertFalse(config.godMode.smartModeEnabled, "Smart Mode should be disabled when God Mode is enabled");
        }
    }

    @Test
    void testToggleGodMode_DisablesGodMode() {
        // Arrange
        config.godMode.enabled = true;
        config.godMode.smartModeEnabled = false;

        try (MockedStatic<MinecraftClient> mockedClient = mockStatic(MinecraftClient.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            mockedConfig.when(GodHandConfig::getInstance).thenReturn(config);
            mockedConfig.when(() -> GodHandConfig.save(any())).thenAnswer(i -> null);

            MinecraftClient client = mock(MinecraftClient.class);
            client.player = null;
            mockedClient.when(MinecraftClient::getInstance).thenReturn(client);

            // Act
            GodHandFeatures.toggleGodMode();

            // Assert
            Assertions.assertFalse(config.godMode.enabled, "God Mode should be disabled");
            Assertions.assertFalse(config.godMode.smartModeEnabled, "Smart Mode should remain disabled");
        }
    }

    @Test
    void testToggleFlight_EnablesFlight() {
        // Arrange
        config.godMode.flightEnabled = false;

        try (MockedStatic<MinecraftClient> mockedClient = mockStatic(MinecraftClient.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            mockedConfig.when(GodHandConfig::getInstance).thenReturn(config);
            mockedConfig.when(() -> GodHandConfig.save(any())).thenAnswer(i -> null);

            MinecraftClient client = mock(MinecraftClient.class);
            ClientPlayerEntity player = mock(ClientPlayerEntity.class);
            PlayerAbilities abilities = new PlayerAbilities();
            abilities.allowFlying = false;

            when(player.getAbilities()).thenReturn(abilities);
            when(player.getUuid()).thenReturn(UUID.randomUUID());
            client.player = player;
            mockedClient.when(MinecraftClient::getInstance).thenReturn(client);

            // Act
            GodHandFeatures.toggleFlight();

            // Assert
            Assertions.assertTrue(config.godMode.flightEnabled, "Flight should be enabled in config");
            Assertions.assertTrue(abilities.allowFlying, "Player should be allowed to fly");
            verify(player, atLeastOnce()).sendAbilitiesUpdate();
            verify(player, atLeastOnce()).sendMessage(any(Text.class), eq(false));
        }
    }

    @Test
    void testToggleFlight_DisablesFlight() {
        // Arrange
        config.godMode.flightEnabled = true;

        try (MockedStatic<MinecraftClient> mockedClient = mockStatic(MinecraftClient.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            mockedConfig.when(GodHandConfig::getInstance).thenReturn(config);
            mockedConfig.when(() -> GodHandConfig.save(any())).thenAnswer(i -> null);

            MinecraftClient client = mock(MinecraftClient.class);
            ClientPlayerEntity player = mock(ClientPlayerEntity.class);
            PlayerAbilities abilities = new PlayerAbilities();
            abilities.allowFlying = true;
            abilities.flying = true;

            when(player.getAbilities()).thenReturn(abilities);
            when(player.getUuid()).thenReturn(UUID.randomUUID());
            client.player = player;
            mockedClient.when(MinecraftClient::getInstance).thenReturn(client);

            // Act
            GodHandFeatures.toggleFlight();

            // Assert
            Assertions.assertFalse(config.godMode.flightEnabled, "Flight should be disabled in config");
            Assertions.assertFalse(abilities.allowFlying, "Player should not be allowed to fly");
            Assertions.assertFalse(abilities.flying, "Player should stop flying");
            verify(player, atLeastOnce()).sendAbilitiesUpdate();
            verify(player, atLeastOnce()).sendMessage(any(Text.class), eq(false));
        }
    }

    @Test
    void testToggleFlight_NoPlayer() {
        // Arrange
        config.godMode.flightEnabled = false;

        try (MockedStatic<MinecraftClient> mockedClient = mockStatic(MinecraftClient.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            mockedConfig.when(GodHandConfig::getInstance).thenReturn(config);
            mockedConfig.when(() -> GodHandConfig.save(any())).thenAnswer(i -> null);

            MinecraftClient client = mock(MinecraftClient.class);
            client.player = null;
            mockedClient.when(MinecraftClient::getInstance).thenReturn(client);

            // Act
            GodHandFeatures.toggleFlight();

            // Assert
            Assertions.assertTrue(config.godMode.flightEnabled, "Flight should still be enabled in config even if no player is present");
        }
    }
}
