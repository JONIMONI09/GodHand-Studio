package com.yourcompany.godhand;

import com.yourcompany.godhand.network.OpenBowWhitelistScreenPacket;
import com.yourcompany.godhand.network.S2COpenBowWhitelistScreenPacket;
import com.yourcompany.godhand.network.ToggleMagicBowPacket;
import com.yourcompany.godhand.network.UpdateBowWhitelistPacket;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class NetworkSecurityTest {

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();
        } catch (Throwable t) {
            // Ignore headless bootstrap errors
        }
    }

    @Test
    void testOpenBowWhitelistScreenPacket_PayloadId() {
        OpenBowWhitelistScreenPacket packet = new OpenBowWhitelistScreenPacket();
        assertEquals(OpenBowWhitelistScreenPacket.ID, packet.getId());
        assertNotNull(OpenBowWhitelistScreenPacket.CODEC);
        assertEquals("godhand:open_bow_whitelist", packet.getId().id().toString());
    }

    @Test
    void testToggleMagicBowPacket_PayloadId() {
        ToggleMagicBowPacket packet = new ToggleMagicBowPacket();
        assertEquals(ToggleMagicBowPacket.ID, packet.getId());
        assertNotNull(ToggleMagicBowPacket.CODEC);
        assertEquals("godhand:toggle_magic_bow", packet.getId().id().toString());
    }

    @Test
    void testUpdateBowWhitelistPacket_PayloadIdAndData() {
        UpdateBowWhitelistPacket addPacket = new UpdateBowWhitelistPacket("TestPlayer", true);
        assertEquals(UpdateBowWhitelistPacket.ID, addPacket.getId());
        assertEquals("TestPlayer", addPacket.input());
        assertTrue(addPacket.add());
        assertNotNull(UpdateBowWhitelistPacket.CODEC);
        assertEquals("godhand:update_bow_whitelist", addPacket.getId().id().toString());

        UpdateBowWhitelistPacket removePacket = new UpdateBowWhitelistPacket("TestPlayer", false);
        assertEquals("TestPlayer", removePacket.input());
        assertFalse(removePacket.add());
    }

    @Test
    void testS2COpenBowWhitelistScreenPacket_PayloadId() {
        S2COpenBowWhitelistScreenPacket packet = new S2COpenBowWhitelistScreenPacket();
        assertEquals(S2COpenBowWhitelistScreenPacket.ID, packet.getId());
        assertNotNull(S2COpenBowWhitelistScreenPacket.CODEC);
        assertEquals("godhand:s2c_open_bow_whitelist", packet.getId().id().toString());
    }
}
