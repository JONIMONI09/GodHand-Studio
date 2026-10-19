package com.yourcompany.godhand;

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
import net.minecraft.world.World;
import net.minecraft.text.Text;
import com.yourcompany.godhand.GodHandConfig.ExplosiveBowConfig;

import java.util.List;
import net.minecraft.world.explosion.ExplosionBehavior;
import net.minecraft.world.explosion.Explosion;
import net.minecraft.util.math.BlockPos;
import net.minecraft.block.BlockState;
import net.minecraft.fluid.FluidState;
import net.minecraft.world.BlockView;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;



/**
 * Verwaltet die Logik für spielerbezogene Features wie den Super-Bogen.
 */
public class PlayerFeatures {
    // Map to track swarm targets. Key: Swarm ID. Value: Map of Target Entity UUID -> Arrow UUID
    private static final Map<String, Map<UUID, UUID>> SWARM_TARGETS = new ConcurrentHashMap<>();

    /**
     * Default constructor for PlayerFeatures.
     */
    public PlayerFeatures() {
        super();
    }


    private static final String NBT_SUPER_BOW_ARROW = "godhand_super_bow_arrow";
    private static final String NBT_ARROW_STATE = "godhand_arrow_state";
    private static final int STATE_ASCENDING = 1;
    private static final int STATE_SEEKING = 2;
    /** Magic arrow identifier. */
    public static final String NBT_MAGIC_ARROW = "godhand_magic_arrow";
    private static final int STATE_ORBITING = 3;

    /**
     * Behandelt die Super-Bogen-Logik für jede Server-Tick.
     * @param world Die Server-Welt.
     */
    public static void handleSuperBow(ServerWorld world) {
        GodHandConfig.PlayerConfig config = GodHandConfig.getInstance().player;

        // Periodic cleanup of empty swarm targets
        if (world.getTime() % 100 == 0) {
            SWARM_TARGETS.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        }

        // If Super Bow is disabled, we want to discard all active super arrows to cancel their effects
        if (!config.superBowEnabled) {
            for (ArrowEntity arrow : ArrowManager.getTrackedArrows()) {
                if (arrow.getWorld() != world) continue;
                IEntityDataSaver dataSaver = (IEntityDataSaver) arrow;
                NbtCompound nbt = dataSaver.getPersistentData();
                if (nbt.contains(NBT_SUPER_BOW_ARROW)) {
                    arrow.discard(); // Cancel the arrow
                }
            }
            return;
        }

        for (ArrowEntity arrow : ArrowManager.getTrackedArrows()) {
            if (arrow.getWorld() != world) continue;
            IEntityDataSaver dataSaver = (IEntityDataSaver) arrow;
            NbtCompound nbt = dataSaver.getPersistentData();

            boolean isSuperBowArrow = nbt.contains(NBT_SUPER_BOW_ARROW);

            // Proximity Mine Logic
            if (isSuperBowArrow && arrow.getVelocity().length() < 0.1) {
                int ticksInGround = nbt.getInt("godhand_in_ground_ticks");
                nbt.putInt("godhand_in_ground_ticks", ticksInGround + 1);

                if (ticksInGround > 40 && config.explosiveBowConfig.enabled && config.explosiveBowConfig.explosionMode == 1) { // 2 seconds
                    Box searchBox = new Box(arrow.getPos(), arrow.getPos()).expand(config.explosiveBowConfig.explosionRadius);
                    List<LivingEntity> nearbyMobs = world.getEntitiesByClass(LivingEntity.class, searchBox, e -> {
                        if (e.equals(arrow.getOwner())) return false;
                        if (CompanionManager.isCompanion(e)) return false;
                        if (config.superBowTargetsAllMobs) return e.isAlive();
                        return e instanceof HostileEntity || e instanceof PlayerEntity;
                    });

                    if (!nearbyMobs.isEmpty() && arrow.getOwner() instanceof LivingEntity) {
                        handleExplosiveArrow(arrow, (LivingEntity) arrow.getOwner());
                        arrow.discard();
                        continue;
                    }
                }
                continue; // Stop seeking if stuck in ground
            }

            // --- MAGIC ARROW LOGIC ---
            if (nbt.contains(NBT_MAGIC_ARROW)) {
                if (!(arrow.getOwner() instanceof PlayerEntity player)) continue;

                boolean hasMagicBowInOffhand = player.getOffHandStack().getItem() instanceof com.yourcompany.godhand.item.MagicBowItem;

                if (!hasMagicBowInOffhand) {
                    // Revert to normal arrow
                    nbt.remove(NBT_MAGIC_ARROW);
                    arrow.setNoGravity(false);
                    continue;
                }

                arrow.setNoGravity(true);
                int magicState = nbt.getInt(NBT_ARROW_STATE);

                if (magicState != STATE_ORBITING && magicState != STATE_SEEKING) {
                    nbt.putInt(NBT_ARROW_STATE, STATE_ORBITING);
                    magicState = STATE_ORBITING;
                }

                int trappedTicks = nbt.getInt("godhand_magic_trapped_ticks");
                Vec3d lastPos = new Vec3d(nbt.getDouble("godhand_last_x"), nbt.getDouble("godhand_last_y"), nbt.getDouble("godhand_last_z"));
                if (arrow.getPos().squaredDistanceTo(lastPos) < 0.01) {
                    trappedTicks++;
                } else {
                    trappedTicks = 0;
                }
                nbt.putInt("godhand_magic_trapped_ticks", trappedTicks);
                nbt.putDouble("godhand_last_x", arrow.getX());
                nbt.putDouble("godhand_last_y", arrow.getY());
                nbt.putDouble("godhand_last_z", arrow.getZ());

                if (trappedTicks > 60) { // 3 seconds stuck = nuke
                    // Bedrock-Breaking Nuke
                    world.createExplosion(arrow, world.getDamageSources().explosion(arrow, player), new net.minecraft.world.explosion.ExplosionBehavior() {
                        @Override
                        public java.util.Optional<Float> getBlastResistance(net.minecraft.world.explosion.Explosion explosion, BlockView world, BlockPos pos, BlockState blockState, net.minecraft.fluid.FluidState fluidState) {
                            return java.util.Optional.of(0.0f); // Zero resistance for everything, including bedrock
                        }
                        @Override
                        public boolean canDestroyBlock(net.minecraft.world.explosion.Explosion explosion, BlockView world, BlockPos pos, BlockState state, float power) {
                            return true; // Destroy everything
                        }
                    }, arrow.getX(), arrow.getY(), arrow.getZ(), 20.0f, false, World.ExplosionSourceType.TNT);

                    nbt.putInt("godhand_magic_trapped_ticks", 0); // reset
                    // Don't kill the arrow
                }

                if (magicState == STATE_ORBITING) {
                    // Orbit player
                    long tick = world.getTime();
                    double radius = 2.0;
                    double speed = 0.2;
                    double x = player.getX() + Math.cos(tick * speed) * radius;
                    double y = player.getY() + 1.5 + Math.sin(tick * speed * 2) * 0.5;
                    double z = player.getZ() + Math.sin(tick * speed) * radius;

                    Vec3d targetPos = new Vec3d(x, y, z);
                    arrow.setVelocity(targetPos.subtract(arrow.getPos()).multiply(0.5));

                    // Look for target
                    List<LivingEntity> targets = world.getEntitiesByClass(LivingEntity.class, new Box(player.getPos(), player.getPos()).expand(16.0), e -> e instanceof HostileEntity && e.hasStatusEffect(net.minecraft.entity.effect.StatusEffects.GLOWING));

                    // Fallback to any hostile if none glowing
                    if (targets.isEmpty()) {
                        targets = world.getEntitiesByClass(LivingEntity.class, new Box(player.getPos(), player.getPos()).expand(16.0), e -> e instanceof HostileEntity);
                    }

                    if (!targets.isEmpty()) {
                        nbt.putInt(NBT_ARROW_STATE, STATE_SEEKING);
                        nbt.putUuid("godhand_magic_target", targets.get(0).getUuid());
                    }
                } else if (magicState == STATE_SEEKING) {
                    if (!nbt.contains("godhand_magic_target")) {
                        nbt.putInt(NBT_ARROW_STATE, STATE_ORBITING);
                        continue;
                    }
                    UUID targetId = nbt.getUuid("godhand_magic_target");
                    Entity target = world.getEntity(targetId);
                    if (target == null || !target.isAlive()) {
                        nbt.putInt(NBT_ARROW_STATE, STATE_ORBITING);
                        continue;
                    }

                    // Attack pattern
                    Vec3d targetPos = target.getEyePos();
                    Vec3d dir = targetPos.subtract(arrow.getPos()).normalize();
                    arrow.setVelocity(dir.multiply(3.0));
                }
                continue; // Skip normal super bow logic
            }

            // Removed initial processing from handleSuperBow as it is now handled in ArrowManager.onArrowLoad

            if (isSuperBowArrow) {
                int state = nbt.getInt(NBT_ARROW_STATE);

                switch (state) {
                    case STATE_ASCENDING:
                        // When arrow reaches apex (vertical velocity is close to 0), switch to seeking
                        if (arrow.getVelocity().y <= 0.1) {
                            nbt.putInt(NBT_ARROW_STATE, STATE_SEEKING);
                            DiagnosticManager.log("Arrow " + arrow.getUuid() + " reached apex, switching to SEEKING state.");
                        }
                        break;

                    case STATE_SEEKING:
                        if (arrow.getOwner() instanceof PlayerEntity player) {
                            Box searchBox = new Box(arrow.getPos(), arrow.getPos()).expand(config.arrowSeekRadius);

                            String swarmId = nbt.getString("godhand_swarm_id");
                            Map<UUID, UUID> currentSwarmTargets = SWARM_TARGETS.computeIfAbsent(swarmId, k -> new ConcurrentHashMap<>());

                            // Cleanup dead arrows from swarm map
                            currentSwarmTargets.values().removeIf(id -> {
                                Entity e = world.getEntity(id);
                                return e == null || !e.isAlive();
                            });

                            // Check if this arrow already has a target
                            LivingEntity myTarget = null;
                            for (Map.Entry<UUID, UUID> entry : currentSwarmTargets.entrySet()) {
                                if (entry.getValue().equals(arrow.getUuid())) {
                                    Entity e = world.getEntity(entry.getKey());
                                    if (e instanceof LivingEntity && e.isAlive() && e.getBoundingBox().intersects(searchBox)) {
                                        myTarget = (LivingEntity) e;
                                    } else {
                                        // Target dead or out of range, clear it
                                        currentSwarmTargets.remove(entry.getKey());
                                    }
                                    break;
                                }
                            }

                            // If no valid target, find a new unique one
                            if (myTarget == null) {
                                List<LivingEntity> targets = world.getEntitiesByClass(LivingEntity.class, searchBox, (target) -> {
                                    if (target.equals(player)) return false; // Don't target self
                                    if (CompanionManager.isCompanion(target)) return false; // Don't target companions
                                    if (currentSwarmTargets.containsKey(target.getUuid()) && !currentSwarmTargets.get(target.getUuid()).equals(arrow.getUuid())) return false; // Already targeted by another arrow in swarm
                                    if (config.superBowTargetsAllMobs) return target.isAlive();
                                    return target instanceof HostileEntity || target instanceof PlayerEntity;
                                });

                                double minDistanceSq = Double.MAX_VALUE;
                                for (LivingEntity target : targets) {
                                    double distSq = target.squaredDistanceTo(arrow);
                                    if (distSq < minDistanceSq) {
                                        minDistanceSq = distSq;
                                        myTarget = target;
                                    }
                                }

                                if (myTarget != null) {
                                    currentSwarmTargets.put(myTarget.getUuid(), arrow.getUuid());
                                }
                            }

                            if (myTarget != null) {
                                Vec3d direction = myTarget.getEyePos().subtract(arrow.getPos()).normalize();
                                // Adjust velocity towards target, preserving some momentum
                                Vec3d currentVelocity = arrow.getVelocity();
                                double speed = Math.min(currentVelocity.length() * 1.1, 5.0); // Increase speed slightly when homing, but cap it
                                Vec3d newVelocity = direction.multiply(speed);

                                // Extreme clamping to absolutely prevent OutOfBounds chunk loading crashes
                                double clampX = Math.max(-10.0, Math.min(10.0, newVelocity.x));
                                double clampY = Math.max(-10.0, Math.min(10.0, newVelocity.y));
                                double clampZ = Math.max(-10.0, Math.min(10.0, newVelocity.z));
                                newVelocity = new Vec3d(clampX, clampY, clampZ);

                                if (Double.isNaN(newVelocity.lengthSquared()) || newVelocity.lengthSquared() > 1000) {
                                    arrow.discard();
                                    return;
                                }

                                arrow.setVelocity(newVelocity);
                                DiagnosticManager.log("Arrow " + arrow.getUuid() + " seeking target " + myTarget.getName().getString() + " (Swarm Intelligence)");
                            } else {
                                // Fallback: no target found, dive straight down
                                Vec3d currentVel = arrow.getVelocity();
                                arrow.setVelocity(new Vec3d(
                                    Math.max(-5.0, Math.min(5.0, currentVel.x)),
                                    -2.0,
                                    Math.max(-5.0, Math.min(5.0, currentVel.z))
                                ));
                                DiagnosticManager.log("Arrow " + arrow.getUuid() + " has no target, diving down.");
                            }
                        }
                        break;
                }
            }
        }
    }

    /**
     * Behandelt die Logik für Explosionspfeile, wenn ein Pfeil ein Ziel trifft.
     * @param arrow Der Pfeil, der das Ziel getroffen hat.
     * @param owner Der Besitzer des Pfeils (normalerweise ein Spieler).
     */
    public static void handleExplosiveArrow(ArrowEntity arrow, LivingEntity owner) {
        if (!(owner instanceof PlayerEntity player)) {
            return; // Nur Spieler können Explosionspfeile abfeuern
        }

        GodHandConfig config = GodHandConfig.getInstance();
        ExplosiveBowConfig explosiveBowConfig = config.player.explosiveBowConfig;

        // Ensure Super Bow and Explosive Bow are ON. If OFF, cancel the arrow's explosion capability.
        if (!config.player.superBowEnabled || !explosiveBowConfig.enabled) {
            IEntityDataSaver dataSaver = (IEntityDataSaver) arrow;
            NbtCompound nbt = dataSaver.getPersistentData();
            if (nbt.contains(NBT_SUPER_BOW_ARROW)) {
                arrow.discard();
            }
            return;
        }

        if (!BowWhitelistManager.isWhitelistedSafe(player.getServer(), player.getUuid())) {
            player.sendMessage(Text.translatable("godhand.chat.bow_whitelist.not_whitelisted"), false);
            return;
        }

        World world = arrow.getWorld();
        Vec3d pos = arrow.getPos();

        World.ExplosionSourceType destructionType = explosiveBowConfig.explosionMode == 1 ? World.ExplosionSourceType.BLOCK : World.ExplosionSourceType.NONE;

        // Custom ExplosionBehavior to prevent Bedrock destruction
        ExplosionBehavior customBehavior = new ExplosionBehavior() {

            @Override
            public Optional<Float> getBlastResistance(Explosion explosion, BlockView world, BlockPos pos, BlockState blockState, FluidState fluidState) {
                // Return max resistance for Bedrock and indestructible blocks to prevent destruction
                if (blockState.getBlock().getHardness() < 0) {
                    return Optional.of(3600000.0F); // Unbreakable
                }
                return super.getBlastResistance(explosion, world, pos, blockState, fluidState);
            }

            @Override
            public boolean canDestroyBlock(Explosion explosion, BlockView world, BlockPos pos, BlockState state, float power) {
                if (state.getBlock().getHardness() < 0) {
                    return false; // Cannot destroy bedrock/unbreakable
                }

                return true;
            }
        };

        // Erstelle die Explosion
        world.createExplosion(
            arrow, // Entity, die die Explosion verursacht (der Pfeil selbst)
            world.getDamageSources().explosion(arrow, owner), // DamageSource
            customBehavior, // ExplosionBehavior (null für Standardverhalten)
            pos.x, pos.y, pos.z, // Position
            (float) explosiveBowConfig.explosionRadius, // Radius
            false, // Flammen
            destructionType // Zerstörungstyp
        );

        // Entferne den Pfeil sofort nach der Explosion, um Mehrfachauslösungen zu verhindern
        arrow.discard();
        DiagnosticManager.log("Explosive arrow detonated at " + pos.toString() + " with radius " + explosiveBowConfig.explosionRadius + " and destruction type " + destructionType.name() + " (Limited to 5 blocks)");
    }
}
