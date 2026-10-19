package com.yourcompany.godhand;

import com.mojang.brigadier.context.CommandContext;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.text.TranslatableTextContent;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

public class GodHandSecurityTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable t) {
            org.junit.jupiter.api.Assumptions.assumeTrue(false, "Skipping tests because Bootstrap failed");
        }
    }

    private GodHand godHand;
    private CommandContext<ServerCommandSource> mockContext;
    private ServerCommandSource mockSource;
    private ServerPlayerEntity mockPlayer;

    @BeforeEach
    void setUp() {
        godHand = new GodHand();
        mockContext = mock(CommandContext.class);
        mockSource = mock(ServerCommandSource.class);
        mockPlayer = mock(ServerPlayerEntity.class);

        when(mockContext.getSource()).thenReturn(mockSource);
        when(mockSource.getPlayer()).thenReturn(mockPlayer);
    }

    @Test
    void testRecruitCompanionCommand_SecurityFix_NoExceptionMessageExposure() throws Exception {
        // Arrange
        // Mocking EntityArgumentType.getEntity to throw an exception
        try (MockedStatic<net.minecraft.command.argument.EntityArgumentType> mockedEntityArg = mockStatic(net.minecraft.command.argument.EntityArgumentType.class)) {
            String secretErrorMessage = "SECRET_EXCEPTION_MESSAGE_THAT_SHOULD_NOT_BE_EXPOSED";
            mockedEntityArg.when(() -> net.minecraft.command.argument.EntityArgumentType.getEntity(any(), anyString()))
                    .thenThrow(new RuntimeException(secretErrorMessage));

            // Act
            // We need to use reflection to call the private method or just test the logic if it was public.
            // Since it's private, we'll use reflection for a robust test.
            java.lang.reflect.Method method = GodHand.class.getDeclaredMethod("recruitCompanionCommand", CommandContext.class);
            method.setAccessible(true);
            method.invoke(godHand, mockContext);

            // Assert
            ArgumentCaptor<Text> textCaptor = ArgumentCaptor.forClass(Text.class);
            verify(mockSource).sendError(textCaptor.capture());

            Text sentError = textCaptor.getValue();
            assertTrue(sentError.getContent() instanceof TranslatableTextContent, "Error should be translatable");
            TranslatableTextContent content = (TranslatableTextContent) sentError.getContent();
            assertEquals("godhand.command.companion.recruit_failed", content.getKey());

            // Check that the secret message is NOT in the arguments
            Object[] args = content.getArgs();
            for (Object arg : args) {
                if (arg instanceof String s) {
                    assertTrue(!s.contains(secretErrorMessage), "Exception message should not be exposed in arguments");
                }
            }
            assertEquals(0, args.length, "Should have no arguments");
        }
    }

    @Test
    void testReleaseCompanionCommand_SecurityFix_NoExceptionMessageExposure() throws Exception {
        // Arrange
        try (MockedStatic<net.minecraft.command.argument.EntityArgumentType> mockedEntityArg = mockStatic(net.minecraft.command.argument.EntityArgumentType.class)) {
            String secretErrorMessage = "SECRET_RELEASE_ERROR";
            mockedEntityArg.when(() -> net.minecraft.command.argument.EntityArgumentType.getEntity(any(), anyString()))
                    .thenThrow(new RuntimeException(secretErrorMessage));

            // Act
            java.lang.reflect.Method method = GodHand.class.getDeclaredMethod("releaseCompanionCommand", CommandContext.class);
            method.setAccessible(true);
            method.invoke(godHand, mockContext);

            // Assert
            ArgumentCaptor<Text> textCaptor = ArgumentCaptor.forClass(Text.class);
            verify(mockSource).sendError(textCaptor.capture());

            Text sentError = textCaptor.getValue();
            TranslatableTextContent content = (TranslatableTextContent) sentError.getContent();
            assertEquals("godhand.command.companion.release_failed", content.getKey());
            assertEquals(0, content.getArgs().length, "Should have no arguments");
        }
    }

    @Test
    void testTeleportCompanionCommand_SecurityFix_NoExceptionMessageExposure() throws Exception {
        // Arrange
        try (MockedStatic<net.minecraft.command.argument.EntityArgumentType> mockedEntityArg = mockStatic(net.minecraft.command.argument.EntityArgumentType.class)) {
            String secretErrorMessage = "SECRET_TELEPORT_ERROR";
            mockedEntityArg.when(() -> net.minecraft.command.argument.EntityArgumentType.getEntity(any(), anyString()))
                    .thenThrow(new RuntimeException(secretErrorMessage));

            // Act
            java.lang.reflect.Method method = GodHand.class.getDeclaredMethod("teleportCompanionCommand", CommandContext.class);
            method.setAccessible(true);
            method.invoke(godHand, mockContext);

            // Assert
            ArgumentCaptor<Text> textCaptor = ArgumentCaptor.forClass(Text.class);
            verify(mockSource).sendError(textCaptor.capture());

            Text sentError = textCaptor.getValue();
            TranslatableTextContent content = (TranslatableTextContent) sentError.getContent();
            assertEquals("godhand.command.companion.teleport_failed", content.getKey());
            assertEquals(0, content.getArgs().length, "Should have no arguments");
        }
    }
}
