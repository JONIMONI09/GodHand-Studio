package com.yourcompany.godhand.mixin;

import com.yourcompany.godhand.GodHand;
import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.Entity;
import net.minecraft.nbt.NbtCompound;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Mixin für die Entity-Klasse, um persistente NBT-Daten zu speichern und zu laden.
 * Implementiert das IEntityDataSaver-Interface.
 */
@Mixin(Entity.class)
public abstract class EntityDataSaverMixin implements IEntityDataSaver {
    /**
     * Default constructor for EntityDataSaverMixin.
     */
    public EntityDataSaverMixin() {
        super();
    }

    private static final Logger LOGGER = LoggerFactory.getLogger(GodHand.MOD_ID);

    private NbtCompound persistentData;

    /**
     * Gibt die persistenten NBT-Daten für diese Entität zurück.
     * Initialisiert die Daten, falls sie noch nicht existieren.
     * @return Die NbtCompound, die die persistenten Daten enthält.
     */
    @Override
    public NbtCompound getPersistentData() {
        if(this.persistentData == null) {
            this.persistentData = new NbtCompound();
        }
        return persistentData;
    }

    /**
     * Injiziert Code in die writeNbt-Methode der Entity-Klasse, um die persistenten Daten zu speichern.
     * @param nbt Das NbtCompound, in das die Daten geschrieben werden sollen.
     * @param ci Der CallbackInfo für die Injektion.
     */
    @Inject(method = "writeNbt", at = @At("HEAD"))
    protected void injectWriteMethod(NbtCompound nbt, CallbackInfoReturnable<NbtCompound> ci) {
        try {
            if(persistentData != null) {
                nbt.put("godhand.custom_data", persistentData);
            }
        } catch (Exception e) {
            // Logge Fehler, aber lasse die Entity-Serialisierung nicht fehlschlagen
            LOGGER.error("Error writing GodHand persistent data", e);
        }
    }

    /**
     * Injiziert Code in die readNbt-Methode der Entity-Klasse, um die persistenten Daten zu laden.
     * @param nbt Das NbtCompound, aus dem die Daten gelesen werden sollen.
     * @param ci Der CallbackInfo für die Injektion.
     */
    @Inject(method = "readNbt", at = @At("HEAD"))
    protected void injectReadMethod(NbtCompound nbt, CallbackInfo ci) {
        try {
            if (nbt.contains("godhand.custom_data", 10)) { // 10 for NbtCompound
                this.persistentData = nbt.getCompound("godhand.custom_data");
            }
        } catch (Exception e) {
            // Logge Fehler, aber lasse die Entity-Deserialisierung nicht fehlschlagen
            LOGGER.error("Error reading GodHand persistent data", e);
            this.persistentData = null; // Setze auf null bei Fehler
        }
    }
}