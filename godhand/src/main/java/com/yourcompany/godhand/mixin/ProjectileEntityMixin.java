package com.yourcompany.godhand.mixin;

import com.yourcompany.godhand.GodHandConfig;
import com.yourcompany.godhand.GodHandConfig.ExplosiveBowConfig;
import com.yourcompany.godhand.PlayerFeatures;
import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.entity.projectile.ProjectileEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.util.hit.HitResult;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin für die {@link ProjectileEntity}-Klasse, um die Logik für Explosionspfeile zu injizieren.
 */
@Mixin(ProjectileEntity.class)
public abstract class ProjectileEntityMixin {
    /**
     * Default constructor for ProjectileEntityMixin.
     */
    public ProjectileEntityMixin() {
        super();
    }


    private static final String NBT_EXPLODED = "godhand_exploded";




    @Inject(method = "onCollision(Lnet/minecraft/util/hit/HitResult;)V", at = @At("HEAD"), cancellable = true)
    private void onCollisionMixin(HitResult hitResult, CallbackInfo ci) {
        ProjectileEntity projectile = (ProjectileEntity) (Object) this;

        // Nur für ArrowEntity relevant
        if (!(projectile instanceof ArrowEntity arrow)) {
            return;
        }

        GodHandConfig config = GodHandConfig.getInstance();
        IEntityDataSaver dataSaver = (IEntityDataSaver) arrow;
        NbtCompound nbt = dataSaver.getPersistentData();


        if (nbt.contains(PlayerFeatures.NBT_MAGIC_ARROW)) {
            if (hitResult.getType() == HitResult.Type.BLOCK) {
                net.minecraft.util.math.BlockPos pos = ((net.minecraft.util.hit.BlockHitResult) hitResult).getBlockPos();
                if (arrow.getWorld().getBlockState(pos).getBlock().getHardness() >= 0) {
                    arrow.getWorld().breakBlock(pos, true);
                    arrow.velocityModified = true;
                    ci.cancel();
                    return;
                }
            } else if (hitResult.getType() == HitResult.Type.ENTITY) {
                // Let it hit, but prevent discard in EntityMixin
            }
        }
        if (config.player.superBowEnabled && hitResult.getType() == HitResult.Type.BLOCK && nbt.contains("godhand_super_bow_arrow")) {
            int piercedBlocks = nbt.getInt("godhand_pierced_blocks");
            if (piercedBlocks < 5) {
                net.minecraft.util.math.BlockPos pos = ((net.minecraft.util.hit.BlockHitResult) hitResult).getBlockPos();
                if (arrow.getWorld().getBlockState(pos).getBlock().getHardness() >= 0) {
                    net.minecraft.util.math.Vec3d oldVel = arrow.getVelocity();
                    arrow.getWorld().breakBlock(pos, true);
                    nbt.putInt("godhand_pierced_blocks", piercedBlocks + 1);
                    arrow.setVelocity(oldVel);
                    arrow.velocityModified = true;
                }
                else {
                    return; // Fall through for indestructible blocks
                }
                ci.cancel();
                return;
            }
        }

        Entity owner = arrow.getOwner();

        if (owner instanceof LivingEntity) {
            ExplosiveBowConfig explosiveBowConfig = config.player.explosiveBowConfig;

            if (explosiveBowConfig.enabled) {

                // Prüfe, ob der Pfeil bereits explodiert ist
                if (!nbt.getBoolean(NBT_EXPLODED)) {
                    // Nur explodieren, wenn ein LivingEntity getroffen wurde (nicht Boden oder Block)
                    if (hitResult.getType() == HitResult.Type.ENTITY && ((net.minecraft.util.hit.EntityHitResult) hitResult).getEntity() instanceof LivingEntity) {
                        PlayerFeatures.handleExplosiveArrow(arrow, (LivingEntity) owner);
                        nbt.putBoolean(NBT_EXPLODED, true);
                        arrow.discard();
                    }
                }
            }
        }
    }

}
