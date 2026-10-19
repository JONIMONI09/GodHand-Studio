package com.yourcompany.godhand.mixin;

import com.yourcompany.godhand.GodHandFeatures;
import com.yourcompany.godhand.PlayerFeatures;
import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.projectile.ArrowEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Mixin für die {@link LivingEntity}-Klasse, um Schadensereignisse abzufangen und den God Mode zu integrieren.
 */
@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin {
    /**
     * Default constructor for LivingEntityMixin.
     */
    public LivingEntityMixin() {
        super();
    }


    /**
     * Injiziert Logik vor der Schadensberechnung bei LivingEntities.
     * Wenn das Ziel der Schadensbehandlung der Spieler ist und der God Mode aktiv ist,
     * wird der Schaden blockiert (abgesagt) und false zurückgegeben.
     * @param source Die Quelle des Schadens.
     * @param amount Die Menge des Schadens.
     * @param cir Der CallbackInfoReturnable, der es ermöglicht, den Rückgabewert der ursprünglichen Methode zu überschreiben und die Ausführung abzubrechen.
     */
    @Inject(method = "damage", at = @At("HEAD"), cancellable = true)
    public void damageMixin(DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
        boolean allowDamage = GodHandFeatures.handleDamage((LivingEntity) (Object) this, source, amount);
        if (!allowDamage) {
            cir.setReturnValue(false);
        }
    }
}
