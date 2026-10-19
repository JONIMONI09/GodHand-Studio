# GodHand Mod — Technical & Architecture Documentation

*Last Updated: 2026-10-16*

This document provides in-depth technical documentation for the GodHand Minecraft Mod and Web Studio platform. It serves as an architectural reference for maintainers and developers.

---

## 1. System Architecture

The codebase is organized into modular manager classes encapsulating specific functional domains:
- `CompanionManager`: Tamed companion summoning, buffs, follow-owner AI, and defend-owner goals.
- `GodHandFeatures`: Core capabilities including God Mode damage nullification and Smart Mode lethal-damage save.
- `PlayerFeatures`: Player-specific capabilities including Magic Bow mechanics and whitelisted explosive arrows.
- `DiagnosticManager`: Centralized diagnostic and multi-level logging system.
- `GodHandConfig`: Configuration loading, disk serialization, and runtime hot-reloads.

The mod leverages Fabric Mixins to intercept Minecraft engine events (damage, death, projectile release). Client-server synchronization utilizes custom network packet channels registered in `GodHand.java` and `GodHandClient.java`.

---

## 2. Key Engine Mechanics

### 2.1. Companion System: Server-Authoritative Status
- **Client-to-Server Handshake**: `SimpleCompanionScreen` issues `C2S_REQUEST_COMPANION_STATUS_PACKET_ID` on open.
- **Server Evaluation**: `CompanionManager.hasCompanionsServer()` scans all loaded dimensions for player-owned entities.
- **Client Response**: `S2C_COMPANION_STATUS_RESPONSE_PACKET_ID` responds with authoritative boolean state, enabling or disabling GUI actions reliably.

### 2.2. God Mode & Smart Mode Prioritization
- **God Mode**: Unconditional priority. Nullifies all incoming damage except `OUT_OF_WORLD`.
- **Smart Mode**: Active only when God Mode is disabled. Intercepts lethal damage instances (simulating a Totem of Undying effect) and grants temporary speed boost (`StatusEffects.SPEED`).
- **Mutual Exclusion**: Toggling God Mode automatically deactivates Smart Mode to prevent conflicting state machines.

### 2.3. Despawning Bow Mechanics
- Bow marked with NBT `{godhand_despawning_bow: 1b}`.
- Intercepted by `BowItemMixin.onStoppedUsing`: transfers `from_despawning_bow: true` and unique `bow_uuid` to spawned projectile.
- Intercepted by `LivingEntityMixin.onDeath`: verifies kill attribution from matching arrow, searches player inventory, and decrements stack count.

### 2.4. Leveled Diagnostic System
`DiagnosticManager.java` implements a 3-tier logging architecture:
- `INFO`: Console/log-only output during active diagnostic mode.
- `WARN`: Logged to console and presented as amber text in in-game chat.
- `CRITICAL`: Unconditionally logged and presented in bold red in chat.

### 2.5. Command Security & Operator Gates
The `/godhand` command tree enforces operator level 2 permission checks:
```java
literal("godhand").requires(source -> source.hasPermissionLevel(2))
```
Restricts administrative commands to authorized server operators.

---

## 3. Web Dashboard & Cloud IDE Architecture

### 3.1. File Explorer & Custom Arrangement Engine
- **State Management**: `sortMode` ('custom' | 'folders-first' | 'name-asc' | 'name-desc' | 'type') and `customOrder` (directory path to file array mapping).
- **Persistence**: Persisted in browser `localStorage` (`godhand_sort_mode` and `godhand_file_order`).
- **Interactive Reordering**:
  - `moveItemOrder(parentPath, nodeName, 'up' | 'down', siblings)` allows discrete vertical shifts.
  - Drag-and-drop with geometric position calculation (`before` / `after` / `inside`) and visual insertion indicators.
  - Separated icon controls: `CornerLeftUp` moves items into parent folders; `ArrowUp`/`ArrowDown` reorders the list.

### 3.2. Team RBAC & Support System
- **Role Hierarchy**:
  - Owner (Weight 4) - `ggjonasgameryt@gmail.com`
  - Admin (Weight 3)
  - Moderator (Weight 2)
  - Supporter (Weight 1)
  - User (Weight 0)
- **Ticket Workflow**: User ticket creation → Staff claiming → State transitions (`open` → `in_progress` → `resolved` → `closed`) with required justification recorded in Firestore audit logs.

### 3.3. Git Studio & Version Rollback
- Integrated Git management with real-time porcelain status tracking.
- Milestone checkpoint commit creation with `--allow-empty`.
- Point-in-time full project restoration via `/api/git/restore`.

### 3.4. Automated Unit Test Suite (`npm test`)
25 automated unit tests across 5 suites:
1. `tests/tree-sorting.test.mjs` (8 tests): Sorting algorithms, custom order, drag-and-drop insertions, null-safety.
2. `tests/git-safety.test.mjs` (7 tests): Checkpoints, branch validation, shell escaping, rollback safety.
3. `tests/fs-api-safety.test.mjs` (4 tests): Path sanitization, traversal protection, 5MB upload quota.
4. `tests/role-permissions.test.mjs` (3 tests): RBAC hierarchy, tab access, ticket claiming.
5. `tests/translations.test.mjs` (3 tests): 317 EN / 317 DE keys, 100% key parity, zero undefined mappings.