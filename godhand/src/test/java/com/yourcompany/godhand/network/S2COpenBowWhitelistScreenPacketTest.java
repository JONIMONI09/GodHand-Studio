package com.yourcompany.godhand.network;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.network.PacketByteBuf;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class S2COpenBowWhitelistScreenPacketTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable t) {
            // Ignore bootstrap errors in headless environment
        }
    }

    @Test
    void testRegister() {
        try (MockedStatic<ClientPlayNetworking> mockedNetworking = mockStatic(ClientPlayNetworking.class)) {
            // Capture the receiver lambda
            ArgumentCaptor<ClientPlayNetworking.PlayChannelHandler> handlerCaptor = ArgumentCaptor.forClass(ClientPlayNetworking.PlayChannelHandler.class);

            S2COpenBowWhitelistScreenPacket.register();

            // Verify registration and capture the lambda
            mockedNetworking.verify(() -> ClientPlayNetworking.registerGlobalReceiver(eq(S2COpenBowWhitelistScreenPacket.ID), handlerCaptor.capture()));

            ClientPlayNetworking.PlayChannelHandler handler = handlerCaptor.getValue();

            // Setup mocks for execution
            MinecraftClient mockClient = mock(MinecraftClient.class);
            ClientPlayerEntity mockPlayer = mock(ClientPlayerEntity.class);
            PacketByteBuf mockBuf = mock(PacketByteBuf.class);

            // Mock client.execute to run the task immediately
            doAnswer(invocation -> {
                ((Runnable) invocation.getArgument(0)).run();
                return null;
            }).when(mockClient).execute(any(Runnable.class));

            // Execute the handler
            handler.receive(mockClient, null, mockBuf, null);

            // Verify that setScreen was called. We can't verify the exact instance easily,
            // but we can verify it was called with some Screen.
            verify(mockClient, times(1)).setScreen(any(net.minecraft.client.gui.screen.Screen.class));
        }
    }
}
