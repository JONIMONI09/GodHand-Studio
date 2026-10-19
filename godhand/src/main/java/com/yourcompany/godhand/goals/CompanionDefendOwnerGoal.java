package com.yourcompany.godhand.goals;

import com.yourcompany.godhand.CompanionManager;
import com.yourcompany.godhand.GodHand;
import com.yourcompany.godhand.GodHandConfig;
import net.minecraft.entity.LivingEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.minecraft.entity.ai.goal.Goal;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.entity.player.PlayerEntity;

import java.util.EnumSet;
import java.util.UUID;

/**
 * Ein Ziel zur Zielauswahl (Target Selection), das es einem Begleiter ermöglicht,
 * Entitäten zu fokussieren, die seinen Besitzer angreifen.
 */
public class CompanionDefendOwnerGoal extends Goal {
    private static final Logger LOGGER = LoggerFactory.getLogger(GodHand.MOD_ID);

    private final PathAwareEntity companion;
    private LivingEntity owner;
    private LivingEntity target;
    private final double defendRadius;

    /**
     * Erstellt ein neues CompanionDefendOwnerGoal.
     * @param companion Der Begleiter, der verteidigen soll.
     */
    public CompanionDefendOwnerGoal(PathAwareEntity companion) {
        this.companion = companion;
        this.defendRadius = GodHandConfig.getInstance().companion.defendRadius;
        this.setControls(EnumSet.of(Control.TARGET));
    }

    /**
     * Überprüft, ob ein Angreifer des Besitzers als Ziel ausgewählt werden kann.
     */
    @Override
    public boolean canStart() {
        try {
            UUID ownerUuid = CompanionManager.getOwnerUuid(this.companion);
            if (ownerUuid == null) return false;

            PlayerEntity player = this.companion.getWorld().getPlayerByUuid(ownerUuid);
            if (player == null || player.isSpectator()) return false;

            this.owner = player;
            LivingEntity attacker = player.getAttacker();

            // Prüfe, ob der Angreifer valide ist und im Verteidigungsradius des Besitzers
            if (attacker != null && attacker.isAlive() && !attacker.isRemoved() && !CompanionManager.isCompanion(attacker)) {
                if (player.squaredDistanceTo(attacker) <= this.defendRadius * this.defendRadius) {
                    this.target = attacker;
                    return true;
                }
            }

            return false;
        } catch (Exception e) {
            // Logge Fehler und verhindere, dass das Goal startet
            LOGGER.error("Error in CompanionDefendOwnerGoal.canStart()", e);
            return false;
        }
    }

    /**
     * Setzt das Ziel auf dem Begleiter-Mob, wenn das Goal startet.
     */
    @Override
    public void start() {
        this.companion.setTarget(this.target);
        super.start();
    }

    /**
     * Überprüft, ob das Ziel weiterhin verfolgt werden soll.
     */
    @Override
    public boolean shouldContinue() {
        if (this.target == null || !this.target.isAlive() || this.target.isRemoved()) {
            return false;
        }

        // Bleibe am Ziel, solange es noch in der Nähe des Besitzers ist
        double extendedRadius = this.defendRadius * 1.25;
        return this.owner.squaredDistanceTo(this.target) <= (extendedRadius * extendedRadius);
    }

    /**
     * Beendet die Zielverfolgung.
     */
    @Override
    public void stop() {
        this.target = null;
    }
}
