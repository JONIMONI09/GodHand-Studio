package com.godhand.arm32fix;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ARM32 Hardware Alignment Fix Mod for Minecraft 1.21.1+ (Java 21)
 *
 * Intercepts unsafe memory writes on 32-bit ARM architectures (ARMv7, ARMv8l in 32-bit mode)
 * where float operations to odd memory addresses throw SIGBUS hardware alignment traps
 * (java.lang.InternalError: a fault occurred in an unsafe memory access operation).
 */
public class Arm32FixMod implements ModInitializer {
    public static final String MOD_ID = "arm32fix";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static final boolean IS_ARM32;

    static {
        String arch = System.getProperty("os.arch", "").toLowerCase();
        IS_ARM32 = arch.contains("arm") || arch.contains("aarch32") || arch.contains("armv7") || arch.contains("armv8l");
    }

    @Override
    public void onInitialize() {
        LOGGER.info("[ARM32-Fix] Initializing hardware alignment safety system for Minecraft 1.21.1+ (Java 21)");
        if (IS_ARM32) {
            LOGGER.warn("[ARM32-Fix] Active ARM32 runtime detected ('{}'). Unsafe.putFloat alignment redirect ACTIVE.", System.getProperty("os.arch"));
        } else {
            LOGGER.info("[ARM32-Fix] Host architecture is '{}'. Alignment guard running in pass-through safe mode.", System.getProperty("os.arch"));
        }
    }

    public static boolean isArm32() {
        return IS_ARM32;
    }

    /**
     * Safely write a float value into native memory address.
     * Prevents SIGBUS alignment traps by writing 4 individual bytes or 32-bit int raw bits.
     *
     * @param address Native memory address
     * @param value   Float value to store
     */
    public static void safePutFloat(long address, float value) {
        int bits = Float.floatToRawIntBits(value);
        if ((address & 3L) == 0L) {
            // Naturally aligned to 4 bytes: safe 32-bit integer store
            org.lwjgl.system.MemoryUtil.memPutInt(address, bits);
        } else {
            // Unaligned on 32-bit boundary: write byte-by-byte in little-endian byte order
            org.lwjgl.system.MemoryUtil.memPutByte(address, (byte) (bits & 0xFF));
            org.lwjgl.system.MemoryUtil.memPutByte(address + 1L, (byte) ((bits >> 8) & 0xFF));
            org.lwjgl.system.MemoryUtil.memPutByte(address + 2L, (byte) ((bits >> 16) & 0xFF));
            org.lwjgl.system.MemoryUtil.memPutByte(address + 3L, (byte) ((bits >> 24) & 0xFF));
        }
    }
}
