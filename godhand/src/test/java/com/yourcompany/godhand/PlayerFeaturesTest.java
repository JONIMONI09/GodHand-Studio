package com.yourcompany.godhand;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Assumptions;




import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.text.Text;
import net.minecraft.item.ItemStack;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Optional;
import java.util.Collections;
import java.util.UUID;
import java.util.Arrays;

public class PlayerFeaturesTest {

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
    private ServerWorld mockWorld;
    private ArrowEntity mockArrow;
    private PlayerEntity mockPlayer;
    private NbtCompound mockNbt;

    @BeforeEach
    void setUp() {
        ArrowManager.clear();
        config = GodHandConfig.getInstance();
        mockWorld = mock(ServerWorld.class);
        mockArrow = mock(ArrowEntity.class, withSettings().extraInterfaces(IEntityDataSaver.class));
        mockPlayer = mock(PlayerEntity.class);
        mockNbt = mock(NbtCompound.class);

        when(((IEntityDataSaver) mockArrow).getPersistentData()).thenReturn(mockNbt);

        // Default configuration
        config.player.superBowEnabled = true;
        config.player.bowWhitelistConfig.whitelistedPlayers.clear();

        // Mock Entity UUIDs for stable equals
        UUID playerUuid = UUID.randomUUID();
        when(mockPlayer.getUuid()).thenReturn(playerUuid);

        // Default arrow properties
        when(mockArrow.getVelocity()).thenReturn(Vec3d.ZERO);
        when(mockArrow.getPos()).thenReturn(Vec3d.ZERO);
    }

    @Test
    void testHandleSuperBow_Disabled() {
        // Arrange
        config.player.superBowEnabled = false;
        ArrowManager.registerArrow(mockArrow);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockNbt.contains("godhand_super_bow_arrow")).thenReturn(true);

        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        verify(mockArrow).discard();
    }

    @Test
    void testHandleSuperBow_EmptyEntityList() {
        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        verify(mockNbt, never()).putBoolean(anyString(), anyBoolean());
    }

    @Test
    void testHandleSuperBow_NotSuperBowArrow() {
        // Arrange
        ArrowManager.registerArrow(mockArrow);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockNbt.contains("godhand_super_bow_arrow")).thenReturn(false);
        when(mockNbt.contains("godhand_magic_arrow")).thenReturn(false);

        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        verify(mockNbt, never()).putBoolean(anyString(), anyBoolean());
    }

    @Test
    void testHandleSuperBow_InitializeSuperBowArrow_Whitelisted() {
        // Arrange
        when(mockArrow.getOwner()).thenReturn(mockPlayer);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockPlayer.getServer()).thenReturn(mock(net.minecraft.server.MinecraftServer.class));

        config.player.bowWhitelistConfig.whitelistedPlayers.add(mockPlayer.getUuid().toString());
        when(mockArrow.getVelocity()).thenReturn(new Vec3d(1, 0, 1));

        // Act
        ArrowManager.onArrowLoad(mockArrow, mockWorld);

        // Assert
        verify(mockNbt).putBoolean("godhand_super_bow_arrow", true);
        verify(mockNbt).putInt("godhand_arrow_state", 1); // STATE_ASCENDING
        verify(mockArrow).setVelocity(new Vec3d(0.5, 2.5, 0.5));
        assertTrue(ArrowManager.getTrackedArrows().contains(mockArrow));
    }

    @Test
    void testHandleSuperBow_InitializeSuperBowArrow_NotWhitelisted() {
        // Arrange
        when(mockArrow.getOwner()).thenReturn(mockPlayer);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockPlayer.getServer()).thenReturn(mock(net.minecraft.server.MinecraftServer.class));

        // Not whitelisted initially

        // Act
        ArrowManager.onArrowLoad(mockArrow, mockWorld);

        // Assert
        verify(mockPlayer).sendMessage(any(Text.class), eq(false));
        verify(mockNbt, never()).putBoolean(anyString(), anyBoolean());
        assertFalse(ArrowManager.getTrackedArrows().contains(mockArrow));
    }

    @Test
    void testHandleSuperBow_AscendingToSeeking() {
        // Arrange
        ArrowManager.registerArrow(mockArrow);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockNbt.contains("godhand_super_bow_arrow")).thenReturn(true);
        when(mockNbt.getInt("godhand_arrow_state")).thenReturn(1); // STATE_ASCENDING
        when(mockArrow.getVelocity()).thenReturn(new Vec3d(1, 0.05, 1)); // Apex reached (y <= 0.1)

        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        verify(mockNbt).putInt("godhand_arrow_state", 2); // Transition to SEEKING
    }

    @Test
    void testHandleSuperBow_AscendingContinues() {
        // Arrange
        ArrowManager.registerArrow(mockArrow);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockNbt.contains("godhand_super_bow_arrow")).thenReturn(true);
        when(mockNbt.getInt("godhand_arrow_state")).thenReturn(1); // STATE_ASCENDING
        when(mockArrow.getVelocity()).thenReturn(new Vec3d(1, 0.5, 1)); // Still ascending

        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        verify(mockNbt, never()).putInt(eq("godhand_arrow_state"), anyInt()); // No state change
    }

    @Test
    void testHandleSuperBow_SeekingTarget_ValidTargetFound() {
        // Arrange
        ArrowManager.registerArrow(mockArrow);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockNbt.contains("godhand_super_bow_arrow")).thenReturn(true);
        when(mockNbt.getInt("godhand_arrow_state")).thenReturn(2); // STATE_SEEKING
        when(mockArrow.getOwner()).thenReturn(mockPlayer);
        when(mockArrow.getPos()).thenReturn(new Vec3d(0, 10, 0));
        when(mockArrow.getVelocity()).thenReturn(new Vec3d(1, -1, 0)); // length ~ 1.41

        // Create a target entity (e.g., a HostileEntity)
        HostileEntity targetEntity = mock(HostileEntity.class);
        when(targetEntity.getEyePos()).thenReturn(new Vec3d(10, 10, 0));
        when(targetEntity.squaredDistanceTo(mockArrow)).thenReturn(100.0);

        // Mock name for logging
        Text mockName = mock(Text.class);
        when(mockName.getString()).thenReturn("Zombie");
        when(targetEntity.getName()).thenReturn(mockName);

        when(mockWorld.getEntitiesByClass(eq(LivingEntity.class), any(Box.class), any()))
            .thenReturn(Collections.singletonList(targetEntity));

        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        // Expected direction from (0,10,0) to (10,10,0) is (1,0,0)
        // Current velocity length is sqrt(2) ~ 1.41
        // New velocity should be direction * length * 1.1 = (1,0,0) * 1.414 * 1.1 = (1.55, 0, 0)
        verify(mockArrow).setVelocity(argThat(v ->
            Math.abs(v.x - 1.555) < 0.01 &&
            Math.abs(v.y) < 0.01 &&
            Math.abs(v.z) < 0.01
        ));
    }

    @Test
    void testHandleSuperBow_SeekingTarget_VelocityCapped() {
        // Arrange
        ArrowManager.registerArrow(mockArrow);
        when(mockArrow.getWorld()).thenReturn(mockWorld);
        when(mockNbt.contains("godhand_super_bow_arrow")).thenReturn(true);
        when(mockNbt.getInt("godhand_arrow_state")).thenReturn(2); // STATE_SEEKING
        when(mockArrow.getOwner()).thenReturn(mockPlayer);
        when(mockArrow.getPos()).thenReturn(new Vec3d(0, 10, 0));
        when(mockArrow.getVelocity()).thenReturn(new Vec3d(10, -10, 0)); // length is high (> 10)

        // Create a target entity (e.g., a HostileEntity)
        HostileEntity targetEntity = mock(HostileEntity.class);
        when(targetEntity.getEyePos()).thenReturn(new Vec3d(10, 10, 0));
        when(targetEntity.squaredDistanceTo(mockArrow)).thenReturn(100.0);

        // Mock name for logging
        Text mockName = mock(Text.class);
        when(mockName.getString()).thenReturn("Zombie");
        when(targetEntity.getName()).thenReturn(mockName);

        when(mockWorld.getEntitiesByClass(eq(LivingEntity.class), any(Box.class), any()))
            .thenReturn(Collections.singletonList(targetEntity));

        // Act
        PlayerFeatures.handleSuperBow(mockWorld);

        // Assert
        // Velocity should be capped at length 5.0 in the direction of the target (1,0,0)
        verify(mockArrow).setVelocity(argThat(v -> v.length() <= 5.001 && Math.abs(v.x - 5.0) < 0.01));
    }

    @Test
    void testHandleExplosiveArrow_OwnerNotPlayer() {
        // Arrange
        LivingEntity notPlayer = mock(LivingEntity.class);

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, notPlayer);

        // Assert
        verify(mockArrow, never()).discard();
    }

    @Test
    void testHandleExplosiveArrow_NotWhitelisted() {
        // Arrange
        config.player.bowWhitelistConfig.whitelistedPlayers.clear();

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, mockPlayer);

        // Assert
        verify(mockPlayer).sendMessage(any(Text.class), eq(false));
        verify(mockArrow, never()).discard();
    }

    @Test
    void testHandleExplosiveArrow_ExplosiveBowDisabled() {
        // Arrange
        config.player.bowWhitelistConfig.whitelistedPlayers.add(mockPlayer.getUuid().toString());
        config.player.explosiveBowConfig.enabled = false;
        config.player.superBowEnabled = true;

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, mockPlayer);

        // Assert
        verify(mockArrow, never()).discard();
    }

    @Test
    void testHandleExplosiveArrow_SuperBowDisabled() {
        // Arrange
        config.player.bowWhitelistConfig.whitelistedPlayers.add(mockPlayer.getUuid().toString());
        config.player.explosiveBowConfig.enabled = true;
        config.player.superBowEnabled = false;

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, mockPlayer);

        // Assert
        verify(mockArrow, never()).discard();
    }


    @Test
    void testHandleExplosiveArrow_ExplosionMode1() {
        // Arrange
        config.player.bowWhitelistConfig.whitelistedPlayers.add(mockPlayer.getUuid().toString());
        config.player.explosiveBowConfig.enabled = true;
        config.player.superBowEnabled = true;
        config.player.explosiveBowConfig.explosionMode = 1;
        config.player.explosiveBowConfig.explosionRadius = 3.0;

        net.minecraft.world.World mockWorldInterface = mock(net.minecraft.world.World.class, withSettings().defaultAnswer(RETURNS_DEEP_STUBS));
        when(mockArrow.getWorld()).thenReturn(mockWorldInterface);
        when(mockArrow.getPos()).thenReturn(new Vec3d(10, 20, 30));

        net.minecraft.entity.damage.DamageSources mockDamageSources = mock(net.minecraft.entity.damage.DamageSources.class);
        when(mockWorldInterface.getDamageSources()).thenReturn(mockDamageSources);
        net.minecraft.entity.damage.DamageSource mockDamageSource = mock(net.minecraft.entity.damage.DamageSource.class);
        when(mockDamageSources.explosion(mockArrow, mockPlayer)).thenReturn(mockDamageSource);

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, mockPlayer);

        // Assert
        verify(mockArrow).discard();
    }

    @Test
    void testHandleExplosiveArrow_ExplosionModeNot1() {
        // Arrange
        config.player.bowWhitelistConfig.whitelistedPlayers.add(mockPlayer.getUuid().toString());
        config.player.explosiveBowConfig.enabled = true;
        config.player.superBowEnabled = true;
        config.player.explosiveBowConfig.explosionMode = 2; // Not 1
        config.player.explosiveBowConfig.explosionRadius = 4.0;

        net.minecraft.world.World mockWorldInterface = mock(net.minecraft.world.World.class, withSettings().defaultAnswer(RETURNS_DEEP_STUBS));
        when(mockArrow.getWorld()).thenReturn(mockWorldInterface);
        when(mockArrow.getPos()).thenReturn(new Vec3d(5, 10, 15));

        net.minecraft.entity.damage.DamageSources mockDamageSources = mock(net.minecraft.entity.damage.DamageSources.class);
        when(mockWorldInterface.getDamageSources()).thenReturn(mockDamageSources);
        net.minecraft.entity.damage.DamageSource mockDamageSource = mock(net.minecraft.entity.damage.DamageSource.class);
        when(mockDamageSources.explosion(mockArrow, mockPlayer)).thenReturn(mockDamageSource);

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, mockPlayer);

        // Assert
        verify(mockArrow).discard();
    }

    @Test
    void testHandleExplosiveArrow_ExplosionBehavior() {
        // Arrange
        config.player.bowWhitelistConfig.whitelistedPlayers.add(mockPlayer.getUuid().toString());
        config.player.explosiveBowConfig.enabled = true;
        config.player.superBowEnabled = true;

        net.minecraft.world.World mockWorldInterface = mock(net.minecraft.world.World.class, withSettings().defaultAnswer(RETURNS_DEEP_STUBS));
        when(mockArrow.getWorld()).thenReturn(mockWorldInterface);
        when(mockArrow.getPos()).thenReturn(new Vec3d(0, 0, 0));

        net.minecraft.entity.damage.DamageSource mockDamageSource = mockWorldInterface.getDamageSources().explosion(mockArrow, mockPlayer);

        // Capture the ExplosionBehavior
        ArgumentCaptor<net.minecraft.world.explosion.ExplosionBehavior> behaviorCaptor = ArgumentCaptor.forClass(net.minecraft.world.explosion.ExplosionBehavior.class);

        // Act
        PlayerFeatures.handleExplosiveArrow(mockArrow, mockPlayer);

        // Assert
        verify(mockWorldInterface).createExplosion(
            eq(mockArrow),
            eq(mockDamageSource),
            behaviorCaptor.capture(),
            eq(0.0), eq(0.0), eq(0.0),
            eq(3.0f),
            eq(false),
            eq(net.minecraft.world.World.ExplosionSourceType.NONE)
        );

        net.minecraft.world.explosion.ExplosionBehavior behavior = behaviorCaptor.getValue();
        assertNotNull(behavior);

        // Test getBlastResistance for unbreakable block
        net.minecraft.block.BlockState mockUnbreakableState = mock(net.minecraft.block.BlockState.class);
        net.minecraft.block.Block mockUnbreakableBlock = mock(net.minecraft.block.Block.class);
        when(mockUnbreakableState.getBlock()).thenReturn(mockUnbreakableBlock);
        when(mockUnbreakableBlock.getHardness()).thenReturn(-1.0F);

        Optional<Float> resistance = behavior.getBlastResistance(null, null, null, mockUnbreakableState, null);
        assertTrue(resistance.isPresent());
        assertEquals(3600000.0F, resistance.get());

        // Test canDestroyBlock for unbreakable block
        assertFalse(behavior.canDestroyBlock(null, null, null, mockUnbreakableState, 1.0F));

        // Test canDestroyBlock handles normal blocks correctly (no artificial limit)
        net.minecraft.block.BlockState mockNormalState = mock(net.minecraft.block.BlockState.class);
        net.minecraft.block.Block mockNormalBlock = mock(net.minecraft.block.Block.class);
        when(mockNormalState.getBlock()).thenReturn(mockNormalBlock);
        when(mockNormalBlock.getHardness()).thenReturn(1.0F);

        for (int i = 0; i < 15; i++) {
            assertTrue(behavior.canDestroyBlock(null, null, null, mockNormalState, 1.0F), "Should destroy block " + (i + 1));
        }
    }
}
