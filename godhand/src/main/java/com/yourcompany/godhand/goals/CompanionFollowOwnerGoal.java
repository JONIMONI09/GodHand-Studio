package com.yourcompany.godhand.goals;

import com.yourcompany.godhand.CompanionManager;
import com.yourcompany.godhand.GodHand;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.ai.goal.Goal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.world.World;

import java.util.EnumSet;
import java.util.UUID;

/**
 * Ein benutzerdefiniertes Ziel, das es einem Begleiter ermöglicht, seinem Besitzer zu folgen.
 * Dieses Ziel ist generischer als das Standard-FollowOwnerGoal und funktioniert für jede PathAwareEntity.
 */
public class CompanionFollowOwnerGoal extends Goal {
    private static final Logger LOGGER = LoggerFactory.getLogger(GodHand.MOD_ID);

    private final PathAwareEntity companion;
    private LivingEntity owner;
    private final World world;
    private final double speed;
    private final float minDistance;
    private final float maxDistance;
    private int updateCountdownTicks;

    /**
     * Erstellt ein neues CompanionFollowOwnerGoal.
     * @param companion Der Begleiter, der folgen soll.
     * @param speed Die Bewegungsgeschwindigkeit des Begleiters.
     * @param minDistance Der minimale Abstand zum Besitzer, bevor der Begleiter aufhört zu folgen.
     * @param maxDistance Der maximale Abstand zum Besitzer, bevor der Begleiter beginnt zu folgen.
     */
    public CompanionFollowOwnerGoal(PathAwareEntity companion, double speed, float minDistance, float maxDistance) {
        this.companion = companion;
        this.world = companion.getWorld();
        this.speed = speed;
        this.minDistance = minDistance;
        this.maxDistance = maxDistance;
        this.setControls(EnumSet.of(Control.MOVE, Control.LOOK));
    }

    /**
     * Überprüft, ob dieses Ziel ausgeführt werden kann.
     * @return True, wenn das Ziel ausgeführt werden kann, sonst false.
     */
    @Override
    public boolean canStart() {
        try {
            UUID ownerUuid = CompanionManager.getOwnerUuid(this.companion);
            if (ownerUuid == null) {
                return false;
            }
            PlayerEntity player = this.world.getPlayerByUuid(ownerUuid);
            if (player == null || player.isSpectator()) {
                return false;
            }
            // Don't start if we are already closer than the max distance
            if (this.companion.squaredDistanceTo(player) < (double)(this.maxDistance * this.maxDistance)) {
                return false;
            }
            this.owner = player;
            return true;
        } catch (Exception e) {
            // Logge Fehler und verhindere, dass das Goal startet
            LOGGER.error("Error in CompanionFollowOwnerGoal.canStart()", e);
            return false;
        }
    }

    /**
     * Überprüft, ob dieses Ziel weiterhin ausgeführt werden soll.
     * @return True, wenn das Ziel weiterhin ausgeführt werden soll, sonst false.
     */
    @Override
    public boolean shouldContinue() {
        // Continue if navigation is not idle, owner is not a spectator, and we are further than the min distance
        return !this.companion.getNavigation().isIdle() && !this.owner.isSpectator() && this.companion.squaredDistanceTo(this.owner) > (double)(this.minDistance * this.minDistance);
    }

    /**
     * Beginnt die Ausführung des Ziels.
     */
    @Override
    public void start() {
        this.updateCountdownTicks = 0;
        this.companion.getNavigation().startMovingTo(this.owner, this.speed);
    }

    /**
     * Beendet die Ausführung des Ziels.
     */
    @Override
    public void stop() {
        this.owner = null;
        this.companion.getNavigation().stop();
    }

    /**
     * Führt einen Tick der Ziel-Logik aus.
     */
    @Override
    public void tick() {
        try {
            this.companion.getLookControl().lookAt(this.owner, 10.0F, (float)this.companion.getMaxLookPitchChange());
            if (--this.updateCountdownTicks <= 0) {
                this.updateCountdownTicks = this.adjustTickDelay(10);
                this.companion.getNavigation().startMovingTo(this.owner, this.speed);
            }
        } catch (Exception e) {
            // Logge Fehler und stoppe das Goal bei kritischen Fehlern
            LOGGER.error("Error in CompanionFollowOwnerGoal.tick()", e);
            this.stop();
        }
    }

    private int adjustTickDelay(int i) {
        return i;
    }
}
