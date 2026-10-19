package com.yourcompany.godhand.network;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class S2COpenBowWhitelistScreenPacketTest {

    @Test
    void testRegisterAndPayload() {
        S2COpenBowWhitelistScreenPacket packet = new S2COpenBowWhitelistScreenPacket();
        assertNotNull(packet.getId());
        assertEquals(S2COpenBowWhitelistScreenPacket.ID, packet.getId());
        assertNotNull(S2COpenBowWhitelistScreenPacket.CODEC);
    }
}
