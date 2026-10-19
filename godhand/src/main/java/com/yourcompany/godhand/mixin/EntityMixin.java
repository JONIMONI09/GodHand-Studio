package com.yourcompany.godhand.mixin;

import com.yourcompany.godhand.PlayerFeatures;
import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.Entity;
import net.minecraft.entity.projectile.ArrowEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Mixin for Entity.
 */
@Mixin(Entity.class)
public abstract class EntityMixin {

    /**
     * Constructor
     */
    public EntityMixin() {
        super();
    }

    @Inject(method = "discard", at = @At("HEAD"), cancellable = true)
    private void onDiscard(CallbackInfo ci) {
        if ((Object) this instanceof ArrowEntity arrow) {
            if (((IEntityDataSaver) arrow).getPersistentData().contains(PlayerFeatures.NBT_MAGIC_ARROW)) {
                ci.cancel();
            }
        }
    }

    @Inject(method = "kill", at = @At("HEAD"), cancellable = true)
    private void onKill(CallbackInfo ci) {
        if ((Object) this instanceof ArrowEntity arrow) {
            if (((IEntityDataSaver) arrow).getPersistentData().contains(PlayerFeatures.NBT_MAGIC_ARROW)) {
                ci.cancel();
            }
        }
    }
}
