package com.yourcompany.godhand.network;
import com.yourcompany.godhand.GodHand;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public record S2COpenBowWhitelistScreenPacket() implements CustomPayload {
    public static final CustomPayload.Id<S2COpenBowWhitelistScreenPacket> ID = new CustomPayload.Id<>(Identifier.of(GodHand.MOD_ID, "s2c_open_bow_whitelist"));
    public static final PacketCodec<RegistryByteBuf, S2COpenBowWhitelistScreenPacket> CODEC = PacketCodec.unit(new S2COpenBowWhitelistScreenPacket());
    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() { return ID; }
}