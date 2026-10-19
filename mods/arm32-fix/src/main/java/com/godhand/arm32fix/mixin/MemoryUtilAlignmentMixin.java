package com.godhand.arm32fix.mixin;

import org.lwjgl.system.MemoryUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;
import org.spongepowered.asm.mixin.Shadow;

/**
 * Mixin targeting org.lwjgl.system.MemoryUtil.
 * Overwrites memPutFloat to prevent SIGBUS hardware alignment exceptions on ARM32 architectures
 * (such as ARMv7 and ARMv8l in 32-bit compatibility mode on Android PojavLauncher/Amethyst).
 *
 * When the memory address is naturally aligned (address % 4 == 0), writes raw float bits via memPutInt.
 * When the address is misaligned (address % 4 != 0), writes 4 sequential bytes in little-endian order,
 * completely preventing the ARM hardware Data Abort / SIGBUS trap.
 */
@Mixin(value = MemoryUtil.class, remap = false)
public abstract class MemoryUtilAlignmentMixin {

    @Shadow
    public static void memPutInt(long address, int value) {
        throw new AssertionError();
    }

    @Shadow
    public static void memPutByte(long address, byte value) {
        throw new AssertionError();
    }

    /**
     * @author GodHand AI Engine
     * @reason Intercepts float native writes to guarantee hardware alignment safety on ARM32/Android.
     */
    @Overwrite
    public static void memPutFloat(long address, float value) {
        int bits = Float.floatToRawIntBits(value);
        if ((address & 3L) == 0L) {
            memPutInt(address, bits);
        } else {
            memPutByte(address, (byte) (bits & 0xFF));
            memPutByte(address + 1L, (byte) ((bits >> 8) & 0xFF));
            memPutByte(address + 2L, (byte) ((bits >> 16) & 0xFF));
            memPutByte(address + 3L, (byte) ((bits >> 24) & 0xFF));
        }
    }
}
