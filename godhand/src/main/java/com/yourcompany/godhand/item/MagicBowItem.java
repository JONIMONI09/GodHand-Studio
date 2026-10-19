package com.yourcompany.godhand.item;

import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.BowItem;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.text.Text;
import net.minecraft.entity.projectile.PersistentProjectileEntity;
import net.minecraft.item.Items;
import net.minecraft.item.ArrowItem;
import net.minecraft.world.World;
import java.util.UUID;

/**
 * Ein spezieller Magischer Bogen, der an den ersten Benutzer gebunden wird.
 * Verursacht tödlichen Schaden bei nicht autorisierten Spielern.
 */
public class MagicBowItem extends BowItem {

    private static final String NBT_OWNER_UUID = "magic_bow_owner";

    /**
     * Default constructor for MagicBowItem.

     */

    @Override
    public void onStoppedUsing(ItemStack stack, World world, LivingEntity user, int remainingUseTicks) {
        if (user instanceof PlayerEntity player) {
            boolean bl = player.getAbilities().creativeMode || net.minecraft.enchantment.EnchantmentHelper.getLevel(world.getRegistryManager().get(net.minecraft.registry.RegistryKeys.ENCHANTMENT).entryOf(net.minecraft.enchantment.Enchantments.INFINITY), stack) > 0;
            ItemStack itemStack = player.getProjectileType(stack);

            // Infinite arrows for the Magic Bow
            if (itemStack.isEmpty()) {
                itemStack = new ItemStack(Items.ARROW);
            }

            int i = this.getMaxUseTime(stack, player) - remainingUseTicks;
            float f = getPullProgress(i);

            if (!((double)f < 0.1)) {
                if (!world.isClient) {
                    ArrowItem arrowItem = (ArrowItem)(itemStack.getItem() instanceof ArrowItem ? itemStack.getItem() : Items.ARROW);
                    PersistentProjectileEntity persistentProjectileEntity = arrowItem.createArrow(world, itemStack, player, stack);
                    persistentProjectileEntity.setVelocity(player, player.getPitch(), player.getYaw(), 0.0F, f * 3.0F, 1.0F);

                    if (f == 1.0F) {
                        persistentProjectileEntity.setCritical(true);
                    }

                    int j = net.minecraft.enchantment.EnchantmentHelper.getLevel(world.getRegistryManager().get(net.minecraft.registry.RegistryKeys.ENCHANTMENT).entryOf(net.minecraft.enchantment.Enchantments.POWER), stack);
                    if (j > 0) {
                        persistentProjectileEntity.setDamage(persistentProjectileEntity.getDamage() + (double)j * 0.5 + 0.5);
                    }

                    // Punch logic removed

                    if (net.minecraft.enchantment.EnchantmentHelper.getLevel(world.getRegistryManager().get(net.minecraft.registry.RegistryKeys.ENCHANTMENT).entryOf(net.minecraft.enchantment.Enchantments.FLAME), stack) > 0) {
                        persistentProjectileEntity.setOnFireFor(100);
                    }

                    stack.damage(1, player, net.minecraft.entity.EquipmentSlot.MAINHAND);

                    persistentProjectileEntity.pickupType = PersistentProjectileEntity.PickupPermission.CREATIVE_ONLY;

                    // Apply the Magic Arrow tag
                    com.yourcompany.godhand.util.IEntityDataSaver dataSaver = (com.yourcompany.godhand.util.IEntityDataSaver) persistentProjectileEntity;
                    NbtCompound nbt = dataSaver.getPersistentData();
                    nbt.putBoolean("godhand_magic_arrow", true);

                    world.spawnEntity(persistentProjectileEntity);
                }

                world.playSound(null, player.getX(), player.getY(), player.getZ(), net.minecraft.sound.SoundEvents.ENTITY_ARROW_SHOOT, net.minecraft.sound.SoundCategory.PLAYERS, 1.0F, 1.0F / (world.getRandom().nextFloat() * 0.4F + 1.2F) + f * 0.5F);
            }
        }
    }

    /**
     * Constructor for MagicBowItem.
     * @param settings Item settings.
     */
    public MagicBowItem(Settings settings) {
        super(settings);
    }

    @Override
    public void inventoryTick(ItemStack stack, World world, Entity entity, int slot, boolean selected) {
        super.inventoryTick(stack, world, entity, slot, selected);

        if (!world.isClient && entity instanceof PlayerEntity player) {
            
            net.minecraft.component.type.NbtComponent customData = stack.get(net.minecraft.component.DataComponentTypes.CUSTOM_DATA);
            NbtCompound nbt = customData != null ? customData.copyNbt() : new NbtCompound();
            if (!nbt.contains(NBT_OWNER_UUID)) {
                nbt.putUuid(NBT_OWNER_UUID, player.getUuid());
                stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_DATA, net.minecraft.component.type.NbtComponent.of(nbt));
                player.sendMessage(Text.translatable("godhand.chat.magic_bow.bound"), false);

            } else {
                UUID ownerUuid = nbt.getUuid(NBT_OWNER_UUID);
                if (!ownerUuid.equals(player.getUuid())) {
                    // Unauthorized user
                    player.sendMessage(Text.translatable("godhand.chat.magic_bow.unauthorized"), true);
                    player.damage(world.getDamageSources().magic(), Float.MAX_VALUE);

                    // The player takes extreme damage but doesn't infinitely drop clones
                }
            }
        }
    }
}
