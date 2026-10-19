# 📘 GodHand Modding Studio — Complete User Manual & Documentation

Welcome to **GodHand**, the full-featured web-based cloud IDE, community hub, and mod development ecosystem for Minecraft Java editions!

---

## 📑 Table of Contents
1. [Overview & Features](#1-overview--features)
2. [File Explorer & Reordering](#2-file-explorer--reordering)
   - [Creating Files & Folders](#creating-files--folders)
   - [Custom Sequence Reordering](#custom-sequence-reordering)
   - [Moving Files (Drag & Drop, Move Up, Target Modal)](#moving-files)
   - [Deleting Files & Folders](#deleting-files--folders)
3. [Monaco Code Editor & Shortcuts](#3-monaco-code-editor--shortcuts)
4. [Build System & Java Versions](#4-build-system--java-versions)
   - [Java 17 & Java 21 LTS Selection](#java-17--java-21-lts-selection)
   - [Gradle Compilation Engine](#gradle-compilation-engine)
   - [Build Console & Diagnostics](#build-console--diagnostics)
   - [Mod JAR Download](#mod-jar-download)
5. [Git Studio & Version Rollback](#5-git-studio--version-rollback)
6. [Team Dashboard & Staff Hub](#6-team-dashboard--staff-hub)
7. [Support Ticket & Report Center](#7-support-ticket--report-center)
8. [Backend API Reference](#8-backend-api-reference)

---

## 1. Overview & Features

GodHand integrates a sandboxed cloud development environment with an Express backend and Firebase real-time community services:
- **Monaco Code Editor**: Powered by VS Code's editor engine with syntax highlighting, autocomplete, and error diagnostics for Java, JSON, TypeScript, HTML, and CSS.
- **Workspace File System**: Direct manipulation of mod source files, assets, and Gradle configs in the isolated `godhand/` workspace directory.
- **Real-Time Cloud Compilation**: Automated Gradle builds supporting Java 17 and Java 21 LTS with live log streaming via Server-Sent Events.
- **Dynamic Bilingual Localization**: Full English (`en`) and German (`de`) coverage with reactive runtime toggling via `<LanguageSwitcher />`.
- **Integrated Git Studio**: Complete version control with commit history, unified diff inspection, milestone checkpoints, and full version rollback.
- **Community Hub**: Publish mods with descriptions, screenshots, download permissions, like counts, and community report safeguards.

---

## 2. File Explorer & Reordering

### Creating Files & Folders
- **Root Directory**: Click the `+` icon in the "Project Files" header. Type the file name (e.g. `README.md` or `config.json`) and press `Enter`.
- **Inside Subfolders**: Hover over any directory node and click the contextual `+` icon. The new file will be instantiated directly within that path.

### Custom Sequence Reordering
GodHand allows arbitrary, user-defined vertical arrangement:
1. **1-Click Row Adjustments**:
   - Each row reveals two buttons on hover:
     - `↑` (`ArrowUp`): Shift item up by one position in the current directory.
     - `↓` (`ArrowDown`): Shift item down by one position.
   - Your custom arrangement is persisted in `localStorage` and automatically restored on page load.
2. **Drag-and-Drop Reordering**:
   - Drag any file or folder row.
   - Hovering over the **top 50%** displays a bright blue insertion line **above** (`Insert above`).
   - Hovering over the **bottom 50%** displays a blue insertion line **below** (`Insert below`).
3. **Sorting Modes**:
   - Click the `⇅` (`ArrowUpDown`) icon to select between:
     - **Custom Arrangement (Manual)**: User-defined order.
     - **Folders First (Standard)**: Groups folders first, followed by alphabetical order.
     - **Alphabetical (A → Z)**: Lexical ascending order.
     - **Alphabetical (Z → A)**: Lexical descending order.
     - **By File Extension / Type**: Groups Java classes, configs, and assets together.
     - **Reset Custom Arrangement**: Restores default directory grouping in one click.

### Moving Files
- **Into Subfolder**: Drag an item onto the middle of a folder until it highlights with *"Drop to move into folder"*.
- **Move to Parent Directory**: Click the `↖` (`CornerLeftUp`) button to shift the file up into the enclosing directory.
- **Move Dialog (Modal)**: Click the `⇄` (`FolderInput`) icon to choose the destination folder from an interactive tree modal.

### Deleting Files & Folders
- Hover over any file or directory and click the red trash icon (`🗑`). Confirm deletion to remove the node permanently.

---

## 3. Monaco Code Editor & Shortcuts

- **Editor Engine**: Monaco Editor (VS Code standard).
- **Saving**:
  - Click **Save** in the top navigation bar.
  - Keyboard shortcuts:
    - Windows / Linux: `Ctrl + S`
    - macOS: `Cmd + S`
- **Panel Resizing**:
  - **Sidebar Width**: Drag the vertical divider between file tree and editor. Double-click to reset to standard 260px.
  - **Console Height**: Drag the horizontal divider between editor and console. Double-click to reset to standard 220px.

---

## 4. Build System & Java Versions

### Java 17 & Java 21 LTS Selection
Switch Java runtime environments directly from the top navigation dropdown:
- **Java 17**: Standard for Minecraft 1.18 through 1.20.4.
- **Java 21**: Recommended for modern Minecraft 1.20.5+ and 1.21+ with modern language features.

### Gradle Compilation Engine
1. Click the green **Build Mod** button (`Play` icon).
2. The backend initiates `./gradlew build --no-daemon` in an isolated thread.
3. The build console streams all compiler outputs, compiler warnings, and progress percentages in real time.

### Mod JAR Download
Upon a successful build (`BUILD SUCCESSFUL`), the compiled `.jar` artifact is made available for download via the **JAR** header button.

---

## 5. Git Studio & Version Rollback

Access the built-in version control system via the **Git Studio** button:
- **Milestone Checkpoints**: When no uncommitted changes exist, click "Create Checkpoint Commit" to save a clean bookmark commit (`--allow-empty`).
- **Workspace Rollback**: In the Commit History tab, click "Restore Workspace" on any past commit to revert all project files back to that exact state with an automated rollback commit.
- **Discarding Changes**: Discard individual file modifications or perform a complete workspace clean (`reset --hard HEAD && clean -fd`).
- **Branch Off Commit**: Branch off from any historic commit hash directly from the commit card.

---

## 6. Team Dashboard & Staff Hub

The **Team Dashboard** provides role-segregated administrative oversight:
- **Role Hierarchy**:
  - 👑 **Owner**: Full platform sovereignty, staff member assignment/removal with mandatory justification, and exclusive access to `#owner-audit-log`.
  - 🛡️ **Admin**: Moderator and supporter governance, maintenance mode (system lockdown), and access to `#admin-only`.
  - ⚡ **Moderator**: Content moderation, report adjudication, and quarantine handling.
  - 🎧 **Supporter**: Support ticket resolution and user assistance.
- **Discord-Style Channels**:
  - `#allgemein-team`: General staff communication.
  - `#support-desk`: Ticket coordination.
  - `#admin-only`: Confidential administrative discussions.
  - `#owner-audit-log`: Real-time streaming feed of all system actions.

---

## 7. Support Ticket & Report Center

- **User Tickets**: Submit categorized support tickets (Bug, Question, Report, General) with priority and attachments.
- **Claiming Tickets**: Staff members can claim tickets with 1 click (`Claim Case`).
- **Staff Reassignment**: Transfer cases to specific team members with justification.
- **Internal Notes**: Leave staff-only notes on tickets (`isInternal: true`).

---

## 8. Backend API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Heartbeat probe returning build, server, and JDK availability |
| `GET` | `/api/logs` | In-memory buffer of recent build and server logs |
| `GET` | `/api/download-logs` | Raw download of server log file |
| `POST` | `/api/build` | Initiates Gradle compilation with SSE streaming |
| `GET` | `/api/download-jar` | Serves compiled mod JAR file |
| `GET` | `/api/fs/tree` | Recursive directory tree of `godhand/` workspace |
| `GET` | `/api/fs/folders` | Flat list of all project folder paths |
| `GET` | `/api/fs/file?path={path}` | Reads file content with UTF-8 encoding |
| `POST` | `/api/fs/file` | Creates/updates file with 5MB quota check |
| `DELETE` | `/api/fs/file?path={path}` | Deletes a file or directory |
| `POST` | `/api/fs/move` | Moves/renames file or folder with cyclic loop protection |
| `GET` | `/api/git/status` | Returns porcelain Git status (branch, modified files) |
| `POST` | `/api/git/commit` | Creates Git commit with empty checkpoint support |
| `POST` | `/api/git/restore` | Performs full workspace rollback or discards changes |
| `POST` | `/api/git/branch` | Creates or switches branches |
| `GET` | `/api/git/history` | Fetches recent 50 commits with hashes and authors |
| `GET` | `/api/git/diff` | Generates side-by-side or unified diffs |
| `GET` | `/api/system-mods` | Lists all internal engine core mods, loaders, and sample statuses |
| `POST` | `/api/system-mods/create` | Scaffolds new mods for Fabric, Forge, NeoForge, Quilt, Paper, Folia, Velocity, Bungee, Sponge |
| `POST` | `/api/system-mods/:id/toggle-sample` | Toggles sample template designation for developer scaffolding |
| `GET` | `/api/compiler/tasks` | Lists available Gradle compiler task targets |
| `POST` | `/api/compiler/run` | Executes specific compiler targets or custom commands |
| `POST` | `/api/compiler/diagnose` | Scans source buffer for keyword typos, unclosed braces, and missing semicolons |
| `POST` | `/api/compiler/fix` | Applies surgical one-click fixes to source code |

---

## 9. Multi-Loader Mod Scaffolding Engine

GodHand provides instant project generation for all major Minecraft platforms:

| Loader / Framework | Ecosystem | Generated Manifest | Base Class & Dependency Structure |
|---|---|---|---|
| **Fabric** | Client & Server | `fabric.mod.json` | `implements ModInitializer`, Fabric Loom 1.7 |
| **NeoForge** | Modern Forge LTS | `META-INF/neoforge.mods.toml` | `@Mod`, NeoForged UserDev 7.0 |
| **Minecraft Forge** | Legacy/Modern Forge | `META-INF/mods.toml` | `@Mod`, ForgeGradle 6.0 |
| **Quilt** | Community Loom | `quilt.mod.json` | `implements ModInitializer`, Quilt Loom 1.7 |
| **Paper / Spigot** | Bukkit Plugins | `plugin.yml` | `extends JavaPlugin`, Paper API 1.21.1 |
| **Folia / Purpur** | Threaded Bukkit | `plugin.yml` (`folia-supported: true`) | `extends JavaPlugin`, Folia API 1.21.1 |
| **Velocity** | Modern Proxy | `velocity-plugin.json` | `@Plugin`, Velocity API 3.3.0 |
| **BungeeCord** | Traditional Proxy | `bungee.yml` | `extends Plugin`, BungeeCord API 1.20 |
| **Sponge** | Sponge Engine | `META-INF/sponge_plugins.json` | `@Plugin`, SpongeAPI 11.0.0 |

---

## 10. IDE Console "+" Task Palette & Custom Command Runner

The IDE Terminal bar includes a multi-tab capability accessible via the **`+`** button:
- **Available Targets**: One-click execution cards for `./gradlew build`, `clean`, `classes`, `test`, `check`, `jar`, `spotlessApply`, and `runClient`.
- **Custom Command Runner**: Allows entering custom build targets or bash arguments with live streaming log capture and execution history.
- **Auto-Switching View**: Clicking any task automatically routes logs to the terminal view and streams output.

---

## 11. Intelligent Bug & Typo Diagnostic Engine

The embedded Java diagnostic scanner analyzes active source code buffers in real-time:
- **Typo Detection**: Scans and identifies misspellings of Java primitives and keywords (`pubilc` → `public`, `Stirng` → `String`, `Systm` → `System`, `viod` → `void`, `clas` → `class`, `retunr` → `return`, `statci` → `static`).
- **Syntax Guards**: Detects missing semicolons on statements, unbalanced braces (`{}`), and unclosed string literals.
- **One-Click Quick Fix**: Each error card provides a green **Fix** button that applies the fix to the active editor buffer without loss of cursor context.
- **Fix All Typos**: Batch-remedies all detected vocabulary typos in a single operation.

---

## 12. Core Mod Protected Posture

Internal engine modules (e.g., `arm32-fix`, `godhand`, or any mod opened via `/ide/core-[id]`) operate under strict protection:
- **Protected Visual Banner**: Displays a glowing `[🛡️ CORE MOD - PROTECTED]` badge in the IDE top bar.
- **Marketplace Publishing Disabled**: Public publishing is locked to prevent internal system code from leaking into public user listings.
- **Abuse Reporting Disabled**: Reporting controls are hidden for system mods.
- **Sample Template Registry**: Owners can toggle any core mod as a **Sample Template** (`⭐ Sample`) for community developers to fork and scaffold.

---

## 13. Advanced Support Ticket Management & Collaboration

GodHand includes an enterprise support desk supporting user history, multi-member collaboration, audit trails, and HTML archiving:
- **Recent Tickets History ("Letzte Tickets")**: Users and staff can view full ticket history, status indicators (`open`, `in_progress`, `resolved`, `closed`, `deleted`), category badges, and assigned staff.
- **Ticket Deletion with Justification**: Administrators and owners can delete tickets with mandatory reasons (`reasonModal`), generating permanent entries in the Owner Audit Log.
- **Collaborator Invitations**: Owners, creators, and staff can invite teammates or other users to tickets by email or username (`@user`), automatically posting system notification announcements into the message thread.
- **Standalone HTML Transcript Export**: Users and staff can export any support ticket thread into a standalone, styled HTML document (`GodHand-Ticket-[ID].html`) featuring requester metadata, status badges, resolution/deletion reasons, and full formatted message history.
- **Write-Lock on Inactive Tickets**: Once a ticket is marked as `closed`, `resolved`, or `deleted`, writing is automatically disabled with a security lock notice to prevent desynchronized comments. Tickets can be reopened by authorized personnel.

---

## 14. Admin & Owner Dashboard Enhancements

- **Draggable & Collapsible Sidebar**: The left navigation panel features a draggable resize handle (160px – 480px) and a one-click collapse button (`PanelLeftClose` / `PanelLeft`) for maximum workspace visibility on any screen.
- **Quarantined Projects Governance**:
  - **Permanent Deletion**: Delete quarantined projects directly from the dashboard with mandatory justification.
  - **Direct Owner Suspension**: Instantly ban offending project owners directly from the quarantine card with audit logging.
  - **Quarantine Release**: Restore valid projects back to active status in one click.

---

## 15. Clean IDE Toolbar Ergonomics

- **Elimination of Duplicate Controls**: Redundant save, console toggle, fullscreen, and sidebar toggle buttons in the tab bar breadcrumbs were consolidated into the top-level IDE header for a clean, distraction-free editing surface.
- **Keyboard Shortcuts & Zoom**: Quick word-wrap toggles, breadcrumb navigation, and Monaco zoom controls remain conveniently positioned directly above the editor canvas.

---

## 16. Gameplay Tab & WebAssembly / `runClient` Bridge

GodHand features an in-browser Minecraft client testing surface in the bottom console panel:
- **Dedicated Gameplay Tab (`IDEGameplayTab.tsx`)**: Easily accessible via the gamepad icon next to the Build Console, Tasks Palette, and Diagnostics tabs.
- **Dual Execution Bridge**:
  - **Native Fabric Client Execution**: Triggers `./gradlew runClient` on the local machine via `/api/client/start` with automatic detection of mod initialization strings (`GodHand Mod loaded`) and window title tracking.
  - **Interactive 3D WebGL / WASM Voxel Display**: High-performance animated 3D voxel renderer displaying interactive mod artifacts, real-time FPS counter, and lighting simulation.
- **Hold-to-Peek Terminal Logs**:
  - When pressed and held (`onMouseDown` / `onTouchStart`), the live Gradle / client console output slides in transparently over the gameplay display.
  - Releasing immediately returns focus to the game display.
- **In-Game Command Bar**: Send live commands (`/gamemode creative`, `/give @p godhand:magic_bow`) to the client process stdin via `/api/client/command`.

---

## 17. Continuous Diagnostic Auto-Scanner

- **Automated Background Debounce**: Source code in the Monaco Editor is continuously verified with a 600ms debounce without requiring manual clicks or tab switches.
- **String & Comment-Aware AST Scanner**: Checks for Java keyword typos (`pubilc`, `viod`, `privat`, `Sytsem`), missing statement semicolons, and unclosed brace hierarchies without false positives in comments or string literals.
- **Live Badge & 1-Click Fixes**: Real-time error badges appear directly on the tab header and bottom status bar, with surgical 1-click and batch ("Fix All Typos") capabilities.

---

## 18. SDK & JDK Download Progress HUD

- **Visual Download Modal (`SDKDownloadModal.tsx`)**: Displays an animated progress bar, percentage indicator, downloaded megabytes versus total size, and current network speed during Adoptium OpenJDK 21 provisioning.
- **Cross-Platform Adoptium API Integration**: Automatically selects native archive formats (`.zip` on Windows, `.tar.gz` on Linux) and unpacks the runtime to the local JDK directory.

---

## 19. Real-Time Task & Health Status Bar

- **Docked Bottom-Right Status Monitor (`IDETaskStatusBar.tsx`)**:
  - **Active Tasks Counter**: Displays real-time spinning indicator when builds, background diagnostics, or client startups are in progress (`1 task running`).
  - **Diagnostic Error Badge**: Red badge showing exact count of compiler errors. Clicking opens and focuses the Diagnostics tab.
  - **Warning Badge**: Amber badge showing warning counts.
  - **Quick Gameplay & Console Access**: Instant toggles for expanding the console or switching directly to the Gameplay tab.

---

## 20. Expanded Backend REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/client/start` | POST | Launches `./gradlew runClient` process with live lifecycle tracking. |
| `/api/client/stop` | POST | Gracefully stops the running Minecraft client process. |
| `/api/client/status` | GET | Returns `{ status, modLoaded, windowTitle, uptime, logsCount }`. |
| `/api/client/logs` | GET | Returns recent client stdout/stderr logs. |
| `/api/client/command` | POST | Forwards a command string to client stdin. |
| `/api/sdk/progress` | GET | Returns `{ isDownloading, percent, receivedBytes, totalBytes, speed, status }`. |
| `/api/compiler/diagnose` | POST | Scans Java source code and returns syntax and typo diagnostics. |
| `/api/compiler/fix` | POST | Applies a suggested diagnostic fix and returns corrected code. |
| `/api/compiler/tasks` | GET | Returns available Gradle compiler tasks. |
| `/api/compiler/run` | POST | Sanitizes and executes arbitrary Gradle tasks via the wrapper. |

---

## 21. Firebase Authentication & Authorized Domains Architecture

GodHand Studio integrates Firebase Authentication for account management, Google OAuth single sign-on, and role-based access control.

### Google Sign-In & Authorized Domains Policy
Google OAuth uses an origin-based whitelist maintained within the Firebase project:
- **Root Cause of `auth/unauthorized-domain`**: When signing in from a development server (e.g. `http://localhost:3000` or `http://127.0.0.1:3000`), Firebase Authentication checks the request hostname against the authorized domains list in Firebase Console. If `localhost` or `127.0.0.1` is not listed, Firebase immediately rejects the popup with code `auth/unauthorized-domain`.
- **Note on Loopback Origins**: `localhost` and `127.0.0.1` are treated as two distinct hostnames. Both must be added if testing across both URLs.

### In-App Interactive Diagnostic Card
When `auth/unauthorized-domain` is encountered:
1. **Automated Interception**: GodHand Studio catches the error and hides generic error alerts, displaying a dedicated diagnostic card.
2. **1-Click Domain Copy**: Displays the exact hostname (e.g., `localhost` or `127.0.0.1`) with a copy button that strips all protocols and port numbers.
3. **Direct Console Link**: Provides a direct link to Firebase Console (`https://console.firebase.google.com/project/<projectId>/authentication/settings`).
4. **Configuration Rule**: Domains in Firebase Console must be entered as **naked hostnames** (e.g., `localhost` or `127.0.0.1`), never including `http://`, `https://`, or port `:3000`.
5. **Immediate Alternative**: Email and Password authentication operates independently of the domain whitelist and can be used immediately without console configuration.

---

## 22. Production Cloud Deployment (Firebase Hosting & Live URLs)

GodHand Studio is fully provisioned and deployed to global edge CDNs via Firebase Hosting:
- **Primary Production URL**: [https://project-910a2a4c-fa54-4621-b21.web.app](https://project-910a2a4c-fa54-4621-b21.web.app)
- **Secondary Firebase Domain**: [https://project-910a2a4c-fa54-4621-b21.firebaseapp.com](https://project-910a2a4c-fa54-4621-b21.firebaseapp.com)
- **Automatic OAuth Whitelisting**: The project's `.web.app` and `.firebaseapp.com` domains are automatically pre-authorized by Google Cloud / Firebase Authentication, enabling instant Google Single Sign-On without manual console configuration.
- **Continuous Deployment Command**:
  ```powershell

---

## 23. Local Launchers, Cloud Hybrid Bridge & Client-Side Auto-Scan

### Localhost 1-Click Launchers
GodHand includes dedicated local launcher scripts to spin up the Node.js Express server on port 3000 and immediately launch the default browser:
- **Windows Batch**: Double-click `start-godhand.bat` from File Explorer or run in terminal.
- **PowerShell**: Execute `.\launch-godhand.ps1`.
- **Local IDE URL**: [http://localhost:3000](http://localhost:3000)

### Cloud Hybrid Bridge & Safe Content-Type Verification
When accessing GodHand through static cloud hosting (e.g. Firebase Hosting):
- The `apiFetch` client automatically validates that API responses have `content-type: application/json`. If static hosting serves `index.html` (HTML fallback), it prevents `SyntaxError: JSON.parse` crashes.
- The `<LocalhostBanner />` alerts users that local compiling and file access require the local server, providing a 1-click redirect button to `http://localhost:3000`.

### Real-Time Client-Side Auto-Scan & Typo Repair
- **Zero Network Latency**: Built directly into `dashboard/src/lib/diagnostics.ts`, the diagnostic scanner inspects Java code synchronously on every keystroke (debounced 400ms).
- **Checks Performed**: Common Java keyword typos (`pubilc`, `staic`, `viod`, `calss`, `Strign`), unclosed block braces, string quotes, and missing semicolons.
- **1-Click Auto-Fix**: Automatically replaces typos and missing semicolons without requiring server round-trips.

### In-Browser RunClient Gameplay Simulation
- **60 FPS Canvas Viewport**: Visualizes Minecraft Fabric mod execution with animated voxel terrain, player HUD, crosshair, and performance statistics.
- **Hold-to-Peek Terminal**: Hold down the terminal button (`onMouseDown` / `onTouchStart`) to inspect live Gradle Loom logs in real time; release to resume game view.
- **Mod Status**: Real-time indicator displaying `GodHand Fabric Mod 1.21.1 Loaded`.
