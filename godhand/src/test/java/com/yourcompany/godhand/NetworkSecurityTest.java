package com.yourcompany.godhand;

import com.yourcompany.godhand.network.OpenBowWhitelistScreenPacket;
import com.yourcompany.godhand.network.S2COpenBowWhitelistScreenPacket;
import com.yourcompany.godhand.network.ToggleMagicBowPacket;
import com.yourcompany.godhand.network.UpdateBowWhitelistPacket;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class NetworkSecurityTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable t) {
        }
    }

    @Test
    void testOpenBowWhitelistScreenPacket_NoPermissionCheck() {
        try (MockedStatic<ServerPlayNetworking> mockedNetworking = mockStatic(ServerPlayNetworking.class)) {
            ArgumentCaptor<ServerPlayNetworking.PlayChannelHandler> handlerCaptor = ArgumentCaptor.forClass(ServerPlayNetworking.PlayChannelHandler.class);
            OpenBowWhitelistScreenPacket.register();
            mockedNetworking.verify(() -> ServerPlayNetworking.registerGlobalReceiver(eq(OpenBowWhitelistScreenPacket.ID), handlerCaptor.capture()));
            ServerPlayNetworking.PlayChannelHandler handler = handlerCaptor.getValue();

            MinecraftServer mockServer = mock(MinecraftServer.class);
            ServerPlayerEntity mockPlayer = mock(ServerPlayerEntity.class);
            doReturn(net.minecraft.text.Text.literal("TestPlayer")).when((net.minecraft.entity.Entity)mockPlayer).getName();

            doAnswer(invocation -> {
                ((Runnable) invocation.getArgument(0)).run();
                return null;
            }).when(mockServer).execute(any(Runnable.class));

            // Default mock returns false for booleans, so hasPermissionLevel(2) will return false automatically.
            // We do NOT stub hasPermissionLevel to avoid WrongTypeOfReturnValue and UnfinishedStubbingException.

            try {
                handler.receive(mockServer, mockPlayer, null, null, null);
            } catch (Exception e) {}

            mockedNetworking.verify(() -> ServerPlayNetworking.send(eq(mockPlayer), eq(S2COpenBowWhitelistScreenPacket.ID), any()), times(0));
        }
    }

    @Test
    void testToggleMagicBowPacket_WithPermissionCheck() {
        try (MockedStatic<ServerPlayNetworking> mockedNetworking = mockStatic(ServerPlayNetworking.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            ArgumentCaptor<ServerPlayNetworking.PlayChannelHandler> handlerCaptor = ArgumentCaptor.forClass(ServerPlayNetworking.PlayChannelHandler.class);
            ToggleMagicBowPacket.register();
            mockedNetworking.verify(() -> ServerPlayNetworking.registerGlobalReceiver(eq(ToggleMagicBowPacket.ID), handlerCaptor.capture()));
            ServerPlayNetworking.PlayChannelHandler handler = handlerCaptor.getValue();

            MinecraftServer mockServer = mock(MinecraftServer.class);
            ServerPlayerEntity mockPlayer = mock(ServerPlayerEntity.class);
            PacketByteBuf mockBuf = mock(PacketByteBuf.class);

            doReturn(net.minecraft.text.Text.literal("TestPlayer")).when((net.minecraft.entity.Entity)mockPlayer).getName();
            doReturn(true).when(mockBuf).readBoolean();

            GodHandConfig mockConfigInstance = mock(GodHandConfig.class);
            mockConfigInstance.player = new GodHandConfig.PlayerConfig();
            mockedConfig.when(GodHandConfig::getInstance).thenReturn(mockConfigInstance);

            doAnswer(invocation -> {
                ((Runnable) invocation.getArgument(0)).run();
                return null;
            }).when(mockServer).execute(any(Runnable.class));

            try {
                handler.receive(mockServer, mockPlayer, null, mockBuf, null);
            } catch (Exception e) {}

            assertFalse(mockConfigInstance.player.magicBowEnabled, "Config should not have been modified by unauthorized player");
        }
    }

    @Test
    void testUpdateBowWhitelistPacket_UnauthorizedAccess() {
        try (MockedStatic<ServerPlayNetworking> mockedNetworking = mockStatic(ServerPlayNetworking.class);
             MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class)) {

            ArgumentCaptor<ServerPlayNetworking.PlayChannelHandler> handlerCaptor = ArgumentCaptor.forClass(ServerPlayNetworking.PlayChannelHandler.class);
            UpdateBowWhitelistPacket.register();
            mockedNetworking.verify(() -> ServerPlayNetworking.registerGlobalReceiver(eq(UpdateBowWhitelistPacket.ID), handlerCaptor.capture()));
            ServerPlayNetworking.PlayChannelHandler handler = handlerCaptor.getValue();

            MinecraftServer mockServer = mock(MinecraftServer.class);
            ServerPlayerEntity mockPlayer = mock(ServerPlayerEntity.class);
            PacketByteBuf mockBuf = mock(PacketByteBuf.class);

            doReturn(net.minecraft.text.Text.literal("UnauthorizedPlayer")).when((net.minecraft.entity.Entity)mockPlayer).getName();
            // Mocking packet data: try to add "EvilPlayer"
            doReturn("EvilPlayer").when(mockBuf).readString();
            doReturn(true).when(mockBuf).readBoolean();

            GodHandConfig mockConfigInstance = mock(GodHandConfig.class);
            mockConfigInstance.player = new GodHandConfig.PlayerConfig();
            mockedConfig.when(GodHandConfig::getInstance).thenReturn(mockConfigInstance);

            doAnswer(invocation -> {
                ((Runnable) invocation.getArgument(0)).run();
                return null;
            }).when(mockServer).execute(any(Runnable.class));

            // Execute handler
            try {
                handler.receive(mockServer, mockPlayer, null, mockBuf, null);
            } catch (Exception e) {}

            // Verify whitelist remains empty
            assertTrue(mockConfigInstance.player.bowWhitelistConfig.whitelistedPlayers.isEmpty(),
                "Whitelist should not have been modified by unauthorized player");
        }
    }
}
