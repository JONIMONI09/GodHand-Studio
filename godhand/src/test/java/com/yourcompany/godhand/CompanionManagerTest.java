package com.yourcompany.godhand;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Assumptions;




import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.world.World;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.mockito.MockedStatic;
import com.yourcompany.godhand.mixin.MobEntityAccessor;
import com.yourcompany.godhand.mixin.MobEntityInvoker;
import net.minecraft.entity.ai.goal.GoalSelector;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class CompanionManagerTest {

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


    private PlayerEntity mockPlayer;
    private PathAwareEntity mockCompanion;
    private NbtCompound mockNbt;
    private UUID playerUuid;

    @BeforeEach
    void setUp() {
        CompanionManager.clear();
        mockPlayer = mock(PlayerEntity.class);
        mockCompanion = mock(DummyPathAwareEntity.class);
        mockNbt = mock(NbtCompound.class);
        playerUuid = UUID.randomUUID();

        when(mockPlayer.getUuid()).thenReturn(playerUuid);
        when(((IEntityDataSaver) mockCompanion).getPersistentData()).thenReturn(mockNbt);

        World mockWorld = mock(World.class);
        when(mockPlayer.getWorld()).thenReturn(mockWorld);
        when(mockCompanion.getWorld()).thenReturn(mockWorld);
    }

    @Test
    void testRegisterCompanion_Success() {
        // Arrange
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(true);
        net.minecraft.text.Text mockName = mock(net.minecraft.text.Text.class);
        when(mockName.getString()).thenReturn("TestCompanion");
        when(mockCompanion.getName()).thenReturn(mockName);

        // Act
        CompanionManager.registerCompanion(mockCompanion);

        // Assert
        assertTrue(CompanionManager.getActiveCompanions().contains(mockCompanion));
    }

    @Test
    void testRegisterCompanion_NotACompanion() {
        // Arrange
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(false);

        // Act
        CompanionManager.registerCompanion(mockCompanion);

        // Assert
        assertFalse(CompanionManager.getActiveCompanions().contains(mockCompanion));
    }

    @Test
    void testRegisterCompanion_Null_DoesNotThrow() {
        // Act & Assert
        assertDoesNotThrow(() -> CompanionManager.registerCompanion(null));
    }

    @Test
    void testReleaseCompanion_NullOwnerUuid_DoesNotThrow() {
        // Arrange: Mark as companion but return empty owner UUID string (results in null owner UUID)
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(true);
        when(mockNbt.getString("godhand_owner_uuid")).thenReturn("");

        // Act & Assert: This should NOT throw NPE anymore
        assertDoesNotThrow(() -> {
            CompanionManager.releaseCompanion(mockPlayer, mockCompanion);
        });
    }

    @Test
    void testTeleportCompanion_NullOwnerUuid_DoesNotThrow() {
        // Arrange: Mark as companion but return empty owner UUID string
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(true);
        when(mockNbt.getString("godhand_owner_uuid")).thenReturn("");

        // Act & Assert: This should NOT throw NPE anymore
        assertDoesNotThrow(() -> {
            CompanionManager.teleportCompanion(mockPlayer, mockCompanion);
        });
    }


    @Test
    void testGetCompanionsOfPlayer_NullOwnerUuid_DoesNotThrow() {
        // Arrange: Mark as companion but return empty owner UUID string
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(true);
        when(mockNbt.getString("godhand_owner_uuid")).thenReturn("");

        java.util.List<net.minecraft.entity.Entity> entities = new java.util.ArrayList<>();
        entities.add(mockCompanion);
        when(mockPlayer.getWorld().getOtherEntities(any(), any())).thenReturn(entities);

        // Act & Assert
        assertDoesNotThrow(() -> {
            CompanionManager.getCompanionsOfPlayer(mockPlayer);
        });
    }

    @Test
    void testHasCompanionsServer_NullOwnerUuid_DoesNotThrow() {
        // Arrange
        net.minecraft.server.network.ServerPlayerEntity serverPlayer = mock(net.minecraft.server.network.ServerPlayerEntity.class);
        net.minecraft.server.MinecraftServer server = mock(net.minecraft.server.MinecraftServer.class);
        net.minecraft.server.world.ServerWorld serverWorld = mock(net.minecraft.server.world.ServerWorld.class);

        when(serverPlayer.getUuid()).thenReturn(playerUuid);
        when(serverPlayer.getServer()).thenReturn(server);

        // This makes sure worlds iterable works
        when(server.getWorlds()).thenReturn(java.util.Collections.singletonList(serverWorld));

        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(true);
        when(mockNbt.getString("godhand_owner_uuid")).thenReturn("");

        java.util.List<net.minecraft.entity.Entity> entities = new java.util.ArrayList<>();
        entities.add(mockCompanion);
        when(serverWorld.getOtherEntities(any(), any())).thenReturn(entities);

        // Act & Assert
        assertDoesNotThrow(() -> {
            CompanionManager.hasCompanionsServer(serverPlayer);
        });
    }

    @Test
    void testReleaseCompanion_RemovesGoalsAndInvokesInitGoals() {
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(true);
        when(mockNbt.getString("godhand_owner_uuid")).thenReturn(playerUuid.toString());

        GoalSelector mockGoalSelector = mock(GoalSelector.class);
        GoalSelector mockTargetSelector = mock(GoalSelector.class);

        when(((MobEntityAccessor) mockCompanion).getGoalSelector()).thenReturn(mockGoalSelector);
        when(((MobEntityAccessor) mockCompanion).getTargetSelector()).thenReturn(mockTargetSelector);

        when(mockCompanion.getAttributeInstance(EntityAttributes.GENERIC_MAX_HEALTH)).thenReturn(null);

        CompanionManager.releaseCompanion(mockPlayer, mockCompanion);

        verify(mockGoalSelector).clear(any());
        verify(mockTargetSelector).clear(any());
        verify((MobEntityInvoker) mockCompanion).invokeInitGoals();

    }


    // We create a dummy class to mock, because mocking PathAwareEntity directly causes a VerifyError in this environment.
    public static abstract class DummyPathAwareEntity extends PathAwareEntity implements IEntityDataSaver, MobEntityAccessor, MobEntityInvoker {
        protected DummyPathAwareEntity(net.minecraft.entity.EntityType<? extends PathAwareEntity> entityType, World world) {
            super(entityType, world);
        }
    }

    @Test
    void testReleaseAllCompanions_EmptyList() {
        // Arrange
        java.util.List<net.minecraft.entity.Entity> entities = new java.util.ArrayList<>();
        when(mockPlayer.getWorld().getOtherEntities(any(), any())).thenReturn(entities);

        // Act
        CompanionManager.releaseAllCompanions(mockPlayer);

        // Assert
        verify(mockPlayer, times(1)).sendMessage(any(net.minecraft.text.Text.class), eq(false));
        // Verify nbt remove was never called on our class-level mockCompanion
        verify(mockNbt, never()).remove(anyString());
    }

    @Test
    void testReleaseAllCompanions_MultipleCompanions() {
        // Arrange
        DummyPathAwareEntity companion1 = mock(DummyPathAwareEntity.class);
        DummyPathAwareEntity companion2 = mock(DummyPathAwareEntity.class);
        net.minecraft.entity.mob.MobEntity nonCompanion = mock(net.minecraft.entity.mob.MobEntity.class, withSettings().extraInterfaces(IEntityDataSaver.class));

        NbtCompound nbt1 = mock(NbtCompound.class);
        NbtCompound nbt2 = mock(NbtCompound.class);
        NbtCompound nbt3 = mock(NbtCompound.class);

        when(((IEntityDataSaver) companion1).getPersistentData()).thenReturn(nbt1);
        when(((IEntityDataSaver) companion2).getPersistentData()).thenReturn(nbt2);
        when(((IEntityDataSaver) nonCompanion).getPersistentData()).thenReturn(nbt3);

        when(nbt1.getBoolean("godhand_is_companion")).thenReturn(true);
        when(nbt1.getString("godhand_owner_uuid")).thenReturn(playerUuid.toString());

        when(nbt2.getBoolean("godhand_is_companion")).thenReturn(true);
        when(nbt2.getString("godhand_owner_uuid")).thenReturn(playerUuid.toString());

        when(nbt3.getBoolean("godhand_is_companion")).thenReturn(false);
        when(nbt3.getString("godhand_owner_uuid")).thenReturn("");

        GoalSelector gs1 = mock(GoalSelector.class);
        GoalSelector ts1 = mock(GoalSelector.class);
        when(((MobEntityAccessor) companion1).getGoalSelector()).thenReturn(gs1);
        when(((MobEntityAccessor) companion1).getTargetSelector()).thenReturn(ts1);

        GoalSelector gs2 = mock(GoalSelector.class);
        GoalSelector ts2 = mock(GoalSelector.class);
        when(((MobEntityAccessor) companion2).getGoalSelector()).thenReturn(gs2);
        when(((MobEntityAccessor) companion2).getTargetSelector()).thenReturn(ts2);

        java.util.List<net.minecraft.entity.Entity> entities = new java.util.ArrayList<>();
        entities.add(companion1);
        entities.add(companion2);
        entities.add(nonCompanion);

        when(mockPlayer.getWorld().getOtherEntities(any(), any())).thenReturn(entities);

        // Act
        CompanionManager.releaseAllCompanions(mockPlayer);

        // Assert
        verify(nbt1, atLeastOnce()).remove("godhand_is_companion");
        verify(nbt2, atLeastOnce()).remove("godhand_is_companion");
        verify(nbt3, never()).remove("godhand_is_companion");

        verify(mockPlayer, times(1)).sendMessage(any(net.minecraft.text.Text.class), eq(false));
    }

    @Test
    void testRecruitCompanion_UpdateGoalsThrows_LogsWarning() {
        // Arrange
        when(mockNbt.getBoolean("godhand_is_companion")).thenReturn(false);

        GodHandConfig mockConfig = mock(GodHandConfig.class);
        mockConfig.companion = new GodHandConfig.CompanionConfig();
        mockConfig.companion.maxCompanions = 10;
        mockConfig.companion.giveExtraHealth = false;

        try (MockedStatic<GodHandConfig> mockedConfig = mockStatic(GodHandConfig.class);
             MockedStatic<CompanionManager> mockedManager = mockStatic(CompanionManager.class, CALLS_REAL_METHODS);
             MockedStatic<DiagnosticManager> mockedDiag = mockStatic(DiagnosticManager.class)) {

            mockedConfig.when(GodHandConfig::getInstance).thenReturn(mockConfig);
            mockedManager.when(() -> CompanionManager.getCompanionsOfPlayer(any())).thenReturn(new java.util.ArrayList<>());
            mockedManager.when(() -> CompanionManager.updateAllCompanionGoals(any())).thenThrow(new RuntimeException("Test Exception"));

            // Act
            CompanionManager.recruitCompanion(mockPlayer, mockCompanion);

            // Assert
            mockedDiag.verify(() -> DiagnosticManager.log(
                eq(DiagnosticManager.LogLevel.WARN),
                contains("Failed to update companion goals: Test Exception")
            ));
        }
    }
}
