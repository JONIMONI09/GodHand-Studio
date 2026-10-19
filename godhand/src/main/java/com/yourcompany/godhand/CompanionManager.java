package com.yourcompany.godhand;

import com.yourcompany.godhand.goals.CompanionBuffGoal;
import com.yourcompany.godhand.mixin.MobEntityAccessor;
import com.yourcompany.godhand.mixin.MobEntityInvoker;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.text.Text;
import net.minecraft.util.math.Box;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import com.yourcompany.godhand.util.IEntityDataSaver;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Verwaltet die Logik für Begleiter, einschließlich Rekrutierung, Freigabe, Zielsetzung und NBT-Datenverwaltung.
 */
public class CompanionManager {
    /**
     * Default constructor for CompanionManager.
     */
    public CompanionManager() {
        super();
    }


    /** Set der aktuell aktiven Begleiter in der Welt. */
    private static final Set<LivingEntity> activeCompanions = ConcurrentHashMap.newKeySet();

    /** NBT-Tag, um zu markieren, ob eine Entität ein Begleiter ist. */
    private static final String NBT_IS_COMPANION = "godhand_is_companion";
    /** NBT-Tag für die UUID des Besitzers des Begleiters. */
    private static final String NBT_OWNER_UUID = "godhand_owner_uuid";
    /** NBT-Tag für die ursprüngliche maximale Gesundheit des Begleiters. */
    private static final String NBT_ORIGINAL_HEALTH = "godhand_original_health";
    /** NBT-Tag, um den Regenerationseffekt des Begleiters zu speichern. */
    private static final String NBT_EFFECT_REGEN = "godhand_effect_regen";
    /** NBT-Tag, um den Stärkeeffekt des Begleiters zu speichern. */
    private static final String NBT_EFFECT_STRENGTH = "godhand_effect_strength";
    /** NBT-Tag, um den Geschwindigkeitseffekt des Begleiters zu speichern. */
    private static final String NBT_EFFECT_SPEED = "godhand_effect_speed";
    /** NBT-Tag, um den Widerstandseffekt des Begleiters zu speichern. */
    private static final String NBT_EFFECT_RESISTANCE = "godhand_effect_resistance";

    /**
     * Registriert eine Entität als aktiven Begleiter.
     * @param entity Die zu registrierende Entität.
     */
    public static void registerCompanion(LivingEntity entity) {
        if (entity != null && isCompanion(entity)) {
            activeCompanions.add(entity);
            DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Companion registered: " + entity.getName().getString());
        }
    }

    /**
     * Löscht alle registrierten Begleiter. Hauptsächlich für Tests gedacht.
     */
    public static void clear() {
        activeCompanions.clear();
    }

    /**
     * Entfernt eine Entität aus der Liste der aktiven Begleiter.
     * @param entity Die zu entfernende Entität.
     */
    public static void unregisterCompanion(LivingEntity entity) {
        if (activeCompanions.remove(entity)) {
            DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Companion unregistered: " + entity.getName().getString());
        }
    }

    /**
     * Gibt ein unmodifiable Set der aktuell aktiven Begleiter zurück.
     * @return Ein Set von LivingEntity-Objekten.
     */
    public static Set<LivingEntity> getActiveCompanions() {
        return Collections.unmodifiableSet(activeCompanions);
    }

    /**
     * Rekrutiert eine Entität als Begleiter für den angegebenen Spieler.
     * @param owner Der Spieler, der die Entität rekrutiert.
     * @param entity Die zu rekrutierende Entität.
     */
    public static void recruitCompanion(PlayerEntity owner, PathAwareEntity entity) {
        GodHandConfig.CompanionConfig config = GodHandConfig.getInstance().companion;

        if (getCompanionsOfPlayer(owner).size() >= config.maxCompanions) {
            owner.sendMessage(Text.translatable("godhand.companion.limit_reached", config.maxCompanions), false);
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Companion limit reached for player " + owner.getName().getString());
            return;
        }

        if (isCompanion(entity)) {
            owner.sendMessage(Text.translatable("godhand.companion.already_recruited"), false);
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Entity " + entity.getName().getString() + " is already a companion.");
            return;
        }
        NbtCompound nbt = ((IEntityDataSaver)entity).getPersistentData();
        nbt.putBoolean(NBT_IS_COMPANION, true);
        nbt.putString(NBT_OWNER_UUID, owner.getUuidAsString());
        if (isCompanion(entity) && java.util.Objects.equals(owner.getUuid(), getOwnerUuid(entity))) {
            DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Entity " + entity.getName().getString() + " successfully marked as companion with owner UUID.");
        } else {
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Failed to mark entity as companion or set owner UUID.");
        }

        // Store and apply health
        if (config.giveExtraHealth) {
            EntityAttributeInstance maxHealthAttribute = entity.getAttributeInstance(EntityAttributes.GENERIC_MAX_HEALTH);
            if (maxHealthAttribute != null) {
                nbt.putFloat(NBT_ORIGINAL_HEALTH, (float) maxHealthAttribute.getBaseValue());
                maxHealthAttribute.setBaseValue(maxHealthAttribute.getBaseValue() + config.extraHealthAmount);
                entity.setHealth(entity.getMaxHealth()); // Heal to full new health
                if (entity.getMaxHealth() > nbt.getFloat(NBT_ORIGINAL_HEALTH)) {
                    DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Extra health applied to companion " + entity.getName().getString() + ".");
                } else {
                    DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Failed to apply extra health to companion.");
                }
            }
        }

        // Store effect settings
        nbt.putBoolean(NBT_EFFECT_REGEN, config.giveRegenerationEffect);
        nbt.putBoolean(NBT_EFFECT_STRENGTH, config.giveStrengthEffect);
        nbt.putBoolean(NBT_EFFECT_SPEED, config.giveSpeedEffect);
        nbt.putBoolean(NBT_EFFECT_RESISTANCE, config.giveResistanceEffect);
        DiagnosticManager.log("Companion effect settings stored for " + entity.getName().getString() + ": Regen=" + config.giveRegenerationEffect + ", Strength=" + config.giveStrengthEffect + ", Speed=" + config.giveSpeedEffect + ", Resistance=" + config.giveResistanceEffect);

        // Set custom name tag for companion
        entity.setCustomName(Text.translatable("text.godhand.companion.name_tag"));
        entity.setCustomNameVisible(true);
        if (entity.hasCustomName() && entity.isCustomNameVisible()) {
            DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Custom name tag set for companion " + entity.getName().getString() + ".");
        } else {
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Failed to set custom name tag for companion.");
        }

        // Stelle sicher, dass die Entität die richtigen Ziele hat
        try {
            updateAllCompanionGoals(owner);
        } catch (Exception e) {
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Failed to update companion goals: " + e.getMessage());
        }

        addCompanionGoals(entity, owner);
        registerCompanion(entity);
        owner.sendMessage(Text.translatable("godhand.companion.recruited", entity.getName()), false);
        DiagnosticManager.log("Companion " + entity.getName().getString() + " recruited by " + owner.getName().getString() + ".");
        if (owner.getWorld().isClient) {
            GodHandClient.openCompanionScreen(); // Always reload screen to update button states
        }
    }

    /**
     * Gibt einen Begleiter für den angegebenen Spieler frei.
     * @param owner Der Spieler, der den Begleiter freigibt.
     * @param entity Der freizugebende Begleiter.
     */
    public static void releaseCompanion(PlayerEntity owner, PathAwareEntity entity) {
        if (isCompanion(entity) && java.util.Objects.equals(owner.getUuid(), getOwnerUuid(entity))) {
            NbtCompound nbt = ((IEntityDataSaver)entity).getPersistentData();

            // Restore original health
            if (nbt.contains(NBT_ORIGINAL_HEALTH)) {
                EntityAttributeInstance maxHealthAttribute = entity.getAttributeInstance(EntityAttributes.GENERIC_MAX_HEALTH);
                if (maxHealthAttribute != null) {
                    maxHealthAttribute.setBaseValue(nbt.getFloat(NBT_ORIGINAL_HEALTH));
                    entity.setHealth(entity.getMaxHealth());
                }
            }

            // Clear all companion data
            nbt.remove(NBT_IS_COMPANION);
            nbt.remove(NBT_OWNER_UUID);
            nbt.remove(NBT_ORIGINAL_HEALTH);
            nbt.remove(NBT_EFFECT_REGEN);
            nbt.remove(NBT_EFFECT_STRENGTH);
            nbt.remove(NBT_EFFECT_SPEED);
            nbt.remove(NBT_EFFECT_RESISTANCE);

            boolean dataCleared = !isCompanion(entity) && getOwnerUuid(entity) == null &&
                                  !nbt.contains(NBT_ORIGINAL_HEALTH) &&
                                  !nbt.contains(NBT_EFFECT_REGEN) &&
                                  !nbt.contains(NBT_EFFECT_STRENGTH) &&
                                  !nbt.contains(NBT_EFFECT_SPEED) &&
                                  !nbt.contains(NBT_EFFECT_RESISTANCE);
            if (dataCleared) {
                DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Companion data cleared for " + entity.getName().getString() + ".");
            } else {
                DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Failed to clear all companion data for " + entity.getName().getString() + ".");
            }

            // Remove custom name tag
            entity.setCustomName(null);
            entity.setCustomNameVisible(false);
            if (!entity.hasCustomName() && !entity.isCustomNameVisible()) {
                DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Custom name tag removed for " + entity.getName().getString() + ".");
            } else {
                DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Failed to remove custom name tag for " + entity.getName().getString() + ".");
            }

            unregisterCompanion(entity);
            removeCompanionGoals(entity);
            DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Companion goals removed for " + entity.getName().getString() + ".");
            owner.sendMessage(Text.translatable("godhand.companion.released", entity.getName()), false);
            DiagnosticManager.log("Companion " + entity.getName().getString() + " released by " + owner.getName().getString() + ".");
        } else {
            owner.sendMessage(Text.translatable("godhand.companion.not_your_companion"), false);
            DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Attempted to release non-owned companion or non-companion entity.");
        }
        if (owner.getWorld().isClient) {
            GodHandClient.openCompanionScreen(); // Always reload screen to update button states
        }
    }

    /**
     * Gibt eine Liste aller Begleiter eines Spielers zurück.
     * Nutzt das Tracking-System für eine effiziente Abfrage.
     * @param player Der Spieler, dessen Begleiter gesucht werden.
     * @return Eine Liste von LivingEntity-Objekten, die Begleiter des Spielers sind.
     */
    public static List<LivingEntity> getCompanionsOfPlayer(PlayerEntity player) {
        UUID playerUuid = player.getUuid();
        return activeCompanions.stream()
                .filter(livingEntity -> java.util.Objects.equals(playerUuid, getOwnerUuid(livingEntity)))
                .collect(Collectors.toList());
    }

    /**
     * Überprüft serverseitig, ob ein Spieler Begleiter in irgendeiner Welt hat.
     * Nutzt das Tracking-System für eine effiziente Abfrage.
     * @param player Der Server-Spieler.
     * @return True, wenn der Spieler mindestens einen Begleiter hat, sonst false.
     */
    public static boolean hasCompanionsServer(net.minecraft.server.network.ServerPlayerEntity player) {
        UUID playerUuid = player.getUuid();
        return activeCompanions.stream()
                .anyMatch(livingEntity -> java.util.Objects.equals(playerUuid, getOwnerUuid(livingEntity)));
    }

    /**
     * Überprüft, ob eine Entität ein Begleiter ist.
     * @param entity Die zu überprüfende Entität.
     * @return True, wenn die Entität ein Begleiter ist, sonst false.
     */
    public static boolean isCompanion(LivingEntity entity) {
        return ((IEntityDataSaver)entity).getPersistentData().getBoolean(NBT_IS_COMPANION);
    }

    /**
     * Gibt die UUID des Besitzers einer Begleiter-Entität zurück.
     * @param entity Die Begleiter-Entität.
     * @return Die UUID des Besitzers oder null, wenn kein Besitzer gefunden wird.
     */
    public static UUID getOwnerUuid(LivingEntity entity) {
        String uuidStr = ((IEntityDataSaver)entity).getPersistentData().getString(NBT_OWNER_UUID);
        return uuidStr.isEmpty() ? null : UUID.fromString(uuidStr);
    }

    /**
     * Rekrutiert den nächsten PathAwareEntity als Begleiter für den angegebenen Spieler.
     * Diese Implementierung ist vereinfacht und findet nur die nächste Entität.
     * @param owner Der Spieler, der den Begleiter rekrutiert.
     */
    public static void recruitNearestCompanion(PlayerEntity owner) {
        owner.getWorld().getEntitiesByClass(PathAwareEntity.class, owner.getBoundingBox().expand(GodHandConfig.getInstance().companion.recruitRadius), entity -> {
            return !isCompanion(entity) && entity.isAlive();
        })
                .stream()
                .min((e1, e2) -> Double.compare(e1.distanceTo(owner), e2.distanceTo(owner)))
                .ifPresentOrElse(
                        entity -> recruitCompanion(owner, entity),
                        () -> owner.sendMessage(Text.translatable("godhand.companion.no_recruitable_found"), false)
                );
    }

    /**
     * Gibt den nächsten Begleiter des Spielers frei.
     * Diese Implementierung ist vereinfacht und findet nur den nächsten Begleiter.
     * @param owner Der Spieler, der den Begleiter freigibt.
     */
    public static void releaseAllCompanions(PlayerEntity owner) {
        List<LivingEntity> companions = getCompanionsOfPlayer(owner);
        if (companions.isEmpty()) {
            owner.sendMessage(Text.translatable("godhand.companion.no_companion_found"), false);
            return;
        }
        for (LivingEntity companion : companions) {
            if (companion instanceof PathAwareEntity pae) {
                releaseCompanion(owner, pae);
            }
        }
        owner.sendMessage(Text.translatable("godhand.companion.released_all", companions.size()), false);
    }

    /**
     * Teleportiert einen Begleiter zum Besitzer.
     * @param owner Der Spieler, der den Begleiter besitzt.
     * @param companion Der zu teleportierende Begleiter.
     */
    public static void teleportCompanion(PlayerEntity owner, PathAwareEntity companion) {
        if (isCompanion(companion) && java.util.Objects.equals(owner.getUuid(), getOwnerUuid(companion))) {
            companion.requestTeleport(owner.getX(), owner.getY(), owner.getZ());
            owner.sendMessage(Text.translatable("text.godhand.chat.companion.teleported", companion.getName()), false);
        } else {
            owner.sendMessage(Text.translatable("godhand.companion.not_your_companion"), false);
        }
    }

    /**
     * Fügt einem Begleiter die notwendigen KI-Ziele hinzu.
     * @param entity Die Begleiter-Entität.
     * @param owner Der Besitzer des Begleiters.
     */
    private static void addCompanionGoals(PathAwareEntity entity, PlayerEntity owner) {
        MobEntityAccessor mobAccessor = (MobEntityAccessor) entity;

        // Clear all existing goals and targets to pacify the mob
        mobAccessor.getGoalSelector().clear(goal -> true);
        mobAccessor.getTargetSelector().clear(goal -> true);

        // Add Companion Goals (Behavior)
        mobAccessor.getGoalSelector().add(1, new CompanionBuffGoal(entity));

        float configFollowDistance = (float) GodHandConfig.getInstance().companion.followDistance;
        float maxFollowDistance = (configFollowDistance >= 128) ? Float.MAX_VALUE : configFollowDistance;
        float minFollowDistance = 5.0f; // Stop following when closer than 5 blocks

        mobAccessor.getGoalSelector().add(3, new MeleeAttackGoal(entity, 1.0, true)); // Goal to attack its current target
        mobAccessor.getGoalSelector().add(4, new com.yourcompany.godhand.goals.CompanionFollowOwnerGoal(entity, 1.0, minFollowDistance, maxFollowDistance));

        // Add Companion Targets (who to select as target)
        // Priority 1: Defend the owner from its current attacker
        mobAccessor.getTargetSelector().add(1, new com.yourcompany.godhand.goals.CompanionDefendOwnerGoal(entity));
        // Priority 2: Attack things that attack it or the owner
        mobAccessor.getTargetSelector().add(2, new RevengeGoal(entity).setGroupRevenge());
        // Priority 3: Attack any hostile mob that is NOT another companion
        mobAccessor.getTargetSelector().add(3, new ActiveTargetGoal<>(entity, MobEntity.class, 5, true, false,
            (target) -> target instanceof HostileEntity && !isCompanion(target) && !(target instanceof PlayerEntity)
        ));
    }

    /**
     * Aktualisiert die KI-Ziele für alle Begleiter eines Spielers, um Einstellungsänderungen zu übernehmen.
     * @param owner Der Spieler, dessen Begleiter aktualisiert werden sollen.
     */
    public static void updateAllCompanionGoals(PlayerEntity owner) {
        List<LivingEntity> companions = getCompanionsOfPlayer(owner);
        DiagnosticManager.log("Updating goals for " + companions.size() + " companions.");
        for (LivingEntity companion : companions) {
            if (companion instanceof PathAwareEntity pae) {
                DiagnosticManager.log("Re-applying goals for companion: " + pae.getName().getString());
                addCompanionGoals(pae, owner);
            }
        }
    }

    /**
     * Entfernt die KI-Ziele von einem Begleiter.
     * @param entity Die Begleiter-Entität.
     */
    private static void removeCompanionGoals(PathAwareEntity entity) {
        MobEntityAccessor mobAccessor = (MobEntityAccessor) entity;
        mobAccessor.getGoalSelector().clear(goal -> true);
        mobAccessor.getTargetSelector().clear(goal -> true);
        ((MobEntityInvoker) entity).invokeInitGoals();
    }
}
