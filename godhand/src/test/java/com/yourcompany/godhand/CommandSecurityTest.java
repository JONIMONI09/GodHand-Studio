package com.yourcompany.godhand;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.ParseResults;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.command.CommandRegistryAccess;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

public class CommandSecurityTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable t) {
            // In some environments, Bootstrap might fail but we might still be able to run some tests
        }
    }

    private GodHand godHand;
    private CommandDispatcher<ServerCommandSource> dispatcher;
    private CommandRegistryAccess registryAccess;

    @BeforeEach
    void setUp() {
        godHand = new GodHand();
        dispatcher = new CommandDispatcher<>();
        registryAccess = mock(CommandRegistryAccess.class);
    }

    @Test
    void testBowWhitelistCommandRequiresPermission() {
        godHand.registerCommands(dispatcher, registryAccess, CommandManager.RegistrationEnvironment.DEDICATED);

        ServerCommandSource mockSource = mock(ServerCommandSource.class);
        // Player has permission level 0 (not an OP)
        when(mockSource.hasPermissionLevel(2)).thenReturn(false);

        ParseResults<ServerCommandSource> parseResults = dispatcher.parse("godhand bowwhitelist", mockSource);

        // If the requirement is correctly set, this should throw a CommandSyntaxException
        // because the "godhand" node itself requires level 2.
        assertThrows(CommandSyntaxException.class, () -> {
            dispatcher.execute(parseResults);
        }, "The command should not be executable by a player without permission level 2");
    }
}
