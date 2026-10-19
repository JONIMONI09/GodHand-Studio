# Bug Report: Critical Allocation & GC Pressure in CompanionBuffGoal.java

- **File:** `godhand/src/main/java/com/yourcompany/godhand/goals/CompanionBuffGoal.java`
- **Lines:** 39-50

## Description
In the `tick()` method of `CompanionBuffGoal`, new `StatusEffectInstance` objects for active companion buffs (Regeneration, Strength, Speed, Resistance) were instantiated and applied on every single game tick (20 times per second per companion entity). With persistent companions present in the world, this triggered up to 80 allocations per second per companion, generating severe Garbage Collection (GC) pressure and noticeable TPS degradation on multi-entity servers.

## Resolution Strategy
Implement a throttle condition ensuring that a new `StatusEffectInstance` is only allocated and applied when the target entity lacks the active status effect or when the effect's remaining duration drops below a defined threshold (e.g., 20 ticks). This drastically cuts allocation rate and resolves server TPS stuttering.
