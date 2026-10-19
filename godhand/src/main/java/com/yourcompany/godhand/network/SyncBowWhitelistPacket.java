package com.yourcompany.godhand.network;
import com.yourcompany.godhand.GodHand;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;
import java.util.List;
import net.minecraft.network.codec.PacketCodecs;

public record SyncBowWhitelistPacket(List<String> whitelist) implements CustomPayload {
    public static final CustomPayload.Id<SyncBowWhitelistPacket> ID = new CustomPayload.Id<>(Identifier.of(GodHand.MOD_ID, "sync_bow_whitelist"));
    public static final PacketCodec<RegistryByteBuf, SyncBowWhitelistPacket> CODEC = PacketCodec.tuple(
            PacketCodecs.STRING.collect(PacketCodecs.toList()), SyncBowWhitelistPacket::whitelist,
            SyncBowWhitelistPacket::new
    );
    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() { return ID; }
}