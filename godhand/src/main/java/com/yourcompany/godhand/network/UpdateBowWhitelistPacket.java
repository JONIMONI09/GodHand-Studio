package com.yourcompany.godhand.network;
import com.yourcompany.godhand.GodHand;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public record UpdateBowWhitelistPacket(String input, boolean add) implements CustomPayload {
    public static final CustomPayload.Id<UpdateBowWhitelistPacket> ID = new CustomPayload.Id<>(Identifier.of(GodHand.MOD_ID, "update_bow_whitelist"));
    public static final PacketCodec<RegistryByteBuf, UpdateBowWhitelistPacket> CODEC = PacketCodec.tuple(
            PacketCodecs.STRING, UpdateBowWhitelistPacket::input,
            PacketCodecs.BOOL, UpdateBowWhitelistPacket::add,
            UpdateBowWhitelistPacket::new
    );
    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() { return ID; }
}