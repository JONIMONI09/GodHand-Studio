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

### 7. GitHub CLI (`gh`), Remote Setup & Email Privacy (GH007)
- **Problem**: Pushing commits via git CLI to GitHub failed with `remote: error: GH007: Your push would publish a private email address.` when the user had GitHub's privacy protection enabled.
- **Correction**:
  - When configuring git user email in environments where GitHub email privacy is active, resolve the GitHub user ID via `gh api user` and use the GitHub-provided noreply address: `<id>+<username>@users.noreply.github.com`.
  - For public repo creation via `gh repo create <owner>/<name> --public --source=. --remote=origin --push`, ensure commits are cleanly rewritten/authored before push.
  - Always maintain a strict Git discipline: main branch protected, feature branch opened, and professional PR created via `gh pr create` with Title, Summary, Key Changes, and Verification.

### 8. Static Hosting vs Fullstack Hybrid Bridge (JSON Parsing Safety)
- **Problem**: Deploying an IDE web frontend to static hosting (e.g. Firebase Hosting) causes `/api/*` endpoints to return `index.html` (HTTP 200 text/html) because rewrite rules route unmatched paths to SPA fallback, resulting in `SyntaxError: JSON.parse: unexpected character at line 1 column 1`.
- **Correction**:
  - Wrap `fetch` responses with strict `Content-Type` checks: verify `res.headers.get('content-type')?.includes('application/json')` before calling `res.json()`.
  - If an HTML fallback is returned on an API route, gracefully catch it and expose actionable error messaging.
  - Provide `<LocalhostBanner />` and 1-click native launcher scripts (`start-godhand.bat`, `launch-godhand.ps1`) to run the Node.js compiler backend on `http://localhost:3000` alongside the cloud frontend.


