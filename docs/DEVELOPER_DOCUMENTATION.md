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
105 automated unit and integration tests across 23 suites running with Node's native test runner (`node --test tests/*.test.mjs`):
1. `tests/tree-sorting.test.mjs`: Sorting algorithms, custom order, drag-and-drop insertions, null-safety.
2. `tests/git-safety.test.mjs`: Checkpoints, branch validation, shell escaping, rollback safety.
3. `tests/fs-api-safety.test.mjs`: Path sanitization, traversal protection, 5MB upload quota.
4. `tests/role-permissions.test.mjs`: RBAC hierarchy, tab access, ticket claiming.
5. `tests/translations.test.mjs`: 513 EN / 513 DE keys, 100% key parity, zero undefined mappings.
6. `tests/vfs-and-hybrid-bridge.test.mjs`: VFS IndexedDB persistence, 86 mod files bundle, Zero-PAT bytecode compiler, IssueOps cloud triggers.
7. `tests/client-bridge.test.mjs`: Platform invocation, JSON parsing safety, Adoptium JDK download metrics.
8. `tests/autoscan.test.mjs`: Automated background Java typo detection & surgical fixes.
9. `tests/gameplay.test.mjs`: WebAssembly & Canvas voxel runtime lifecycle simulation.
10. `tests/multi-loader-and-compiler.test.mjs`: Multi-loader scaffolding and Gradle task execution.

### 3.5. In-Browser Virtual File System (VFS) & Seed Bundle
- **IndexedDB Persistence**: Implemented in `dashboard/src/lib/vfs.ts` with local storage fallbacks, eliminating dependencies on local backends when hosted on static CDN providers.
- **86 Real Mod Files Pre-Seeded**: `scripts/generate-vfs-bundle.mjs` scans `godhand/` and `mods/arm32-fix/`, compiling a complete virtual mod tree with 86 real Java and JSON files directly into `dashboard/public/vfs-bundle.json`.

### 3.6. Zero-PAT Browser Compiler & GitHub IssueOps Bridge
- **In-Browser JAR Synthesizer**: Pure client-side generation in `dashboard/src/lib/jarCompiler.ts` creating valid `.jar` ZIP archives with generated JVM bytecode ClassFiles (`0xCAFEBABE`, Java 21 ClassFormat 65.0) and manifest structures.
- **IssueOps Compilation Bridge**: When full Loom bytecode remapping is required, users without local Java installations file an issue with prefix `[CLOUD-BUILD]` to trigger `.github/workflows/gradle.yml`, which executes real Gradle wrapper compilation in GitHub Actions with zero PAT tokens required.

### 3.7. Unified Local CI Verification Pipeline
- Script `scripts/run-ci-local.mjs` (invoked via `npm run test:ci` or `npm run test:ci:fast`) executes all verification checks in a single automated pipeline:
  1. VFS Bundle Generation (`node scripts/generate-vfs-bundle.mjs`)
  2. Dashboard TypeScript Linting (`tsc --noEmit`)
  3. Dashboard Vite Production Build (`vite build`)
  4. Node.js Test Suites (`node --test tests/*.test.mjs`)
  5. Java / Gradle Tests & Remapping (`gradlew test remapJar` in `godhand/`)