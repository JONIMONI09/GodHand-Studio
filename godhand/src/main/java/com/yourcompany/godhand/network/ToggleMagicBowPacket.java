package com.yourcompany.godhand.network;
import com.yourcompany.godhand.GodHand;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

public record ToggleMagicBowPacket() implements CustomPayload {
    public static final CustomPayload.Id<ToggleMagicBowPacket> ID = new CustomPayload.Id<>(Identifier.of(GodHand.MOD_ID, "toggle_magic_bow"));
    public static final PacketCodec<RegistryByteBuf, ToggleMagicBowPacket> CODEC = PacketCodec.unit(new ToggleMagicBowPacket());
    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() { return ID; }
}