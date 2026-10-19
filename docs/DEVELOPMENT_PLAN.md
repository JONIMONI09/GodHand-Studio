# Development Plan: Bow Whitelist Filtering Resolution

## 1. Introduction

This document describes the engineering development plan for resolving issues where arrows are not correctly filtered by the whitelist. The `GodHand` mod provides features such as the "Super Bow" and "Explosive Arrows", which must only be usable by players on a designated whitelist.

## 2. Bug Analysis

### 2.1 Problem Description
Arrows fired by players who are *not* on the bow whitelist must not trigger special effects (such as the "Super Bow" or "Explosive Arrows"). Previously, effects could trigger intermittently or whitelist evaluations exhibited timing inconsistencies.

### 2.2 Relevant Code Areas
The primary modules affected include:
* [`BowWhitelistManager.java`](godhand/src/main/java/com/yourcompany/godhand/BowWhitelistManager.java): Manages adding, removing, and validating whitelisted player UUIDs.
* [`PlayerFeatures.java`](godhand/src/main/java/com/yourcompany/godhand/PlayerFeatures.java): Player feature execution logic, including whitelist checks for Super Bow (`handleSuperBow`) and explosive arrows (`handleExplosiveArrow`).
* [`GodHandConfig.java`](godhand/src/main/java/com/yourcompany/godhand/GodHandConfig.java): Stores bow whitelist configurations.

### 2.3 Potential Root Causes
* **UUID Resolution**: Ensuring player `UUID` retrieval is immutable and robust against client disconnects.
* **Configuration State Consistency**: Safe saving and serialization in `GodHandConfig` so `BowWhitelistManager.isWhitelisted()` returns deterministic results.
* **Event Timing**: Executing whitelist checks immediately upon arrow release before trajectory physics calculations.
* **Client-Server Synchronization**: Ensuring authoritative server verification rather than relying on client packet claims.

## 3. Architecture & Solution Design

### 3.1 Strict Server-Authoritative UUID Validation
Ensure player `UUID` retrieval is always validated server-side with structured debug logging.

### 3.2 Robust Configuration Persistence
* Hot-reload synchronization when whitelist changes are triggered via GUI screens (`BowWhitelistScreen.java`).
* Thread-safe in-memory sets with disk persistence.

### 3.3 Early Lifecycle Enforcement
* Evaluate whitelist status at the earliest possible hook in `PlayerFeatures`.
* Send localized notification (`godhand.chat.bow_whitelist.not_whitelisted`) if an unauthorized player attempts feature usage.

## 4. Verification & Testing

Automated test cases covering whitelist filtering:
- `godhand/src/test/java/com/yourcompany/godhand/BowWhitelistManagerTest.java`
- `godhand/src/test/java/com/yourcompany/godhand/BowWhitelistIntegrationTest.java`
- `godhand/src/test/java/com/yourcompany/godhand/BowWhitelistPerformanceTest.java`