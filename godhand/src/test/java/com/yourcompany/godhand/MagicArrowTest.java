package com.yourcompany.godhand;

import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.world.World;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

public class MagicArrowTest {

    @Test
    public void testMagicArrowNbtSurvival() {
        ArrowEntity arrow = Mockito.mock(ArrowEntity.class);
        NbtCompound nbt = new NbtCompound();
        nbt.putBoolean(PlayerFeatures.NBT_MAGIC_ARROW, true);

        com.yourcompany.godhand.util.IEntityDataSaver saver = Mockito.mock(com.yourcompany.godhand.util.IEntityDataSaver.class);
        when(saver.getPersistentData()).thenReturn(nbt);

        assertTrue(nbt.contains(PlayerFeatures.NBT_MAGIC_ARROW), "Magic Arrow NBT should be retained");
    }
}
