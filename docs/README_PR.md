# 🧪 [Testing] Add coverage for PlayerFeatures.handleExplosiveArrow

🎯 **What:** The `PlayerFeatures.handleExplosiveArrow` method was previously untested. This logic controls explosive arrows based on configuration flags and whitelist status, executing Minecraft world explosions accordingly.

📊 **Coverage:** The following scenarios are covered by JUnit 5 tests in `PlayerFeaturesTest.java`:
- Arrow owner is not a `PlayerEntity` (Early Exit).
- Player is not present on the whitelist (Early Exit).
- Explosive bows are disabled via config (`config.player.explosiveBowConfig.enabled == false`).
- Master Super Bow feature is disabled (`config.player.superBowEnabled == false`).
- Explosive arrow triggers successfully with `explosionMode == 1` (`World.ExplosionSourceType.BLOCK`).
- Explosive arrow triggers successfully with `explosionMode != 1` (`World.ExplosionSourceType.NONE`).

✨ **Result:** Improved unit test coverage for `PlayerFeatures.java`. Ensures all configuration flags (`superBowEnabled`, `explosiveBowConfig.enabled`, `explosiveBowConfig.explosionMode`) accurately govern explosion logic and interact properly with `BowWhitelistManager`.
