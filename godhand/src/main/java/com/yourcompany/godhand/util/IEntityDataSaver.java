package com.yourcompany.godhand.util;

import net.minecraft.nbt.NbtCompound;

/**
 * Interface für Entitäten, die persistente NBT-Daten speichern können.
 */
public interface IEntityDataSaver {
    /**
     * Gibt die persistenten NBT-Daten für diese Entität zurück.
     * @return Die NbtCompound, die die persistenten Daten enthält.
     */
    NbtCompound getPersistentData();
}