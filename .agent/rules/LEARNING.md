# Active Learning & Correction Log (LEARNING.md)

**Scope:** GodHand Studio | **Last Updated:** 2026-10-19

## Critical Architectural Learnings & Past Resolutions

### 1. Diagnostic Scanner Must Be Fully Automated (Background Debounced)
- **Problem**: Diagnostic scanner only ran when the user manually clicked a button or switched tabs, leading users to believe the scanner was broken.
- **Correction**: Always implement continuous debounced background execution (`useEffect` with 600ms delay on code buffers) in `IDEConsole.tsx` alongside instant auto-fix actions.

### 2. Minecraft `runClient` In-Browser Bridge
- **Problem**: Desktop Java Minecraft clients cannot run directly inside a pure browser sandbox without a bridge.
- **Correction**: Implement a dual-layer bridge:
  - **Native Backend Process**: Launches `./gradlew runClient` on the local machine with real-time log parsing (`classifyClientLogLine`) and window title tracking.
  - **In-Browser WebGL / WASM Display**: Renders an interactive 3D voxel canvas preview in the dedicated `Gameplay` tab with hold-to-peek terminal log capability.

### 3. Windows Compatibility & Gradle Wrappers
- **Problem**: On Windows, spawning `./gradlew` fails because the wrapper is `gradlew.bat`, and Node >= 18.20 requires `shell: true` for `.bat` files.
- **Correction**: Always sanitize args through `sanitizeGradleArgs` and resolve platform invocation via `gradlewInvocation(projectDir)`.

### 4. SDK / JDK Download Visibility
- **Problem**: Large JDK downloads ran silently without feedback, causing confusion.
- **Correction**: Always expose `/api/sdk/progress` and display an overlay modal (`SDKDownloadModal.tsx`) showing download percentage, downloaded MB/total MB, and transfer speed.

### 5. Task & Health Visibility (Bottom-Right Status Bar)
- **Problem**: Users lacked immediate visibility into active jobs and error counts.
- **Correction**: Provide a permanent docked status bar (`IDETaskStatusBar.tsx`) in the bottom-right showing active task counts, error badges (1-click jump to Diagnose), and client status.

### 6. Firebase Auth `auth/unauthorized-domain` & Loopback Whitelist
- **Problem**: Google Sign-In failed with `Firebase: Error (auth/unauthorized-domain)` during local development because Firebase projects no longer automatically whitelist `localhost` or `127.0.0.1`.
- **Correction**:
  - Always intercept `auth/unauthorized-domain` in authentication flows and present an interactive guidance card instead of a generic red error message.
  - Provide a 1-click domain copying button that normalizes input to a naked hostname (stripping `http://`, `https://`, and port `:3000`), as Firebase Console strictly rejects URLs with protocols or ports.
  - Provide direct deep-links to Firebase Console Authentication Settings (`/authentication/settings`).
  - Distinguish between `localhost` and `127.0.0.1` (which are treated as separate origins by OAuth), and offer a 1-click fallback to `http://localhost:3000`.
  - Reassure developers that Email/Password sign-in and registration function immediately without domain whitelisting.

