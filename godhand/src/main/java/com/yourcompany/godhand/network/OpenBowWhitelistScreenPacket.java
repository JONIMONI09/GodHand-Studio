package com.yourcompany.godhand.network;
import com.yourcompany.godhand.GodHand;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public record OpenBowWhitelistScreenPacket() implements CustomPayload {
    public static final CustomPayload.Id<OpenBowWhitelistScreenPacket> ID = new CustomPayload.Id<>(Identifier.of(GodHand.MOD_ID, "open_bow_whitelist"));
    public static final PacketCodec<RegistryByteBuf, OpenBowWhitelistScreenPacket> CODEC = PacketCodec.unit(new OpenBowWhitelistScreenPacket());
    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() { return ID; }
}