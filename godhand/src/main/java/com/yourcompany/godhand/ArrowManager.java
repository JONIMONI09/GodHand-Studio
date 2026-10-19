package com.yourcompany.godhand;

import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages efficient tracking and initialization of GodHand-related arrows.
 */
public class ArrowManager {
    private static final Set<ArrowEntity> trackedArrows = ConcurrentHashMap.newKeySet();

    private static final String NBT_SUPER_BOW_ARROW = "godhand_super_bow_arrow";
    private static final String NBT_MAGIC_ARROW = "godhand_magic_arrow";
    private static final String NBT_ARROW_STATE = "godhand_arrow_state";
    private static final int STATE_ASCENDING = 1;

    /**
     * Default constructor for ArrowManager.
     */
    public ArrowManager() {
        super();
    }

    /**
     * Registers an arrow for tracking if it's a special GodHand arrow.
     * @param arrow The arrow to register.
     */
    public static void registerArrow(ArrowEntity arrow) {
        trackedArrows.add(arrow);
    }

    /**
     * Unregisters an arrow from tracking.
     * @param arrow The arrow to unregister.
     */
    public static void unregisterArrow(ArrowEntity arrow) {
        trackedArrows.remove(arrow);
    }

    /**
     * Returns a set of all currently tracked special arrows.
     * @return An unmodifiable set of tracked arrows.
     */
    public static Set<ArrowEntity> getTrackedArrows() {
        return Collections.unmodifiableSet(trackedArrows);
    }

    /**
     * Clears all tracked arrows. Primarily for testing.
     */
    public static void clear() {
        trackedArrows.clear();
    }

    /**
     * Handles arrow loading logic, including conversion to super arrows and registration.
     * @param arrow The arrow being loaded.
     * @param world The world it's loading into.
     */
    public static void onArrowLoad(ArrowEntity arrow, ServerWorld world) {
        IEntityDataSaver dataSaver = (IEntityDataSaver) arrow;
        NbtCompound nbt = dataSaver.getPersistentData();

        boolean isSuperBowArrow = nbt.contains(NBT_SUPER_BOW_ARROW);
        boolean isMagicArrow = nbt.contains(NBT_MAGIC_ARROW);

        if (isSuperBowArrow || isMagicArrow) {
            registerArrow(arrow);
            return;
        }

        // Initial processing for new super bow arrows (conversion from normal bows)
        GodHandConfig.PlayerConfig config = GodHandConfig.getInstance().player;
        if (config.superBowEnabled && arrow.getOwner() instanceof PlayerEntity player) {
            if (!BowWhitelistManager.isWhitelistedSafe(player.getServer(), player.getUuid())) {
                player.sendMessage(Text.translatable("godhand.chat.bow_whitelist.not_whitelisted"), false);
                return;
            }

            nbt.putBoolean(NBT_SUPER_BOW_ARROW, true);
            nbt.putInt(NBT_ARROW_STATE, STATE_ASCENDING);
            arrow.setVelocity(arrow.getVelocity().multiply(0.5, 0.5, 0.5).add(0, 2.5, 0));
            registerArrow(arrow);

            // Arrow Duplication
            if (config.arrowDuplicationEnabled) {
                String swarmId = UUID.randomUUID().toString();
                nbt.putString("godhand_swarm_id", swarmId);

                for (int i = 0; i < config.arrowDuplicationAmount; i++) {
                    ArrowEntity newArrow = new ArrowEntity(net.minecraft.entity.EntityType.ARROW, world); newArrow.setPosition(player.getX(), player.getEyeY() - 0.1, player.getZ()); newArrow.setOwner(player);
                    newArrow.setPos(arrow.getX(), arrow.getY(), arrow.getZ());

                    Vec3d vel = arrow.getVelocity();
                    newArrow.setVelocity(
                        vel.x + (world.random.nextDouble() - 0.5) * 0.5,
                        vel.y + (world.random.nextDouble() - 0.5) * 0.5,
                        vel.z + (world.random.nextDouble() - 0.5) * 0.5
                    );

                    newArrow.setOwner(player);
                    newArrow.pickupType = net.minecraft.entity.projectile.PersistentProjectileEntity.PickupPermission.CREATIVE_ONLY;

                    IEntityDataSaver newDataSaver = (IEntityDataSaver) newArrow;
                    NbtCompound newNbt = newDataSaver.getPersistentData();
                    newNbt.putBoolean(NBT_SUPER_BOW_ARROW, true);
                    newNbt.putInt(NBT_ARROW_STATE, STATE_ASCENDING);
                    newNbt.putString("godhand_swarm_id", swarmId);

                    world.spawnEntity(newArrow);
                    // Registration for newArrow will happen when it triggers ENTITY_LOAD
                }
            }
        }
    }
}
