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

### 9. In-Browser Virtual File System (VFS) & Standalone Cloud Modding
- **Problem**: When users access static deployments (Firebase Hosting or GitHub Pages) without a running local server, all file operations and mod tree queries fail, preventing code inspection and mod development.
- **Correction**:
  - Implement a persistent, client-side Virtual File System (`vfs.ts`) using IndexedDB (with `localStorage` fallback) pre-seeded with project files (e.g., `mods/arm32-fix/` and `godhand/` templates).
  - Wrap API routes in `api.ts` to transparently route to the VFS when the local server is offline or returns HTML fallbacks.
  - Integrate native HTML5 `showDirectoryPicker` / folder uploads and client-side ZIP/JAR packaging (`JSZip`) so users can develop, import, and export complete mod packages directly in the browser with zero backend requirements.

### 10. Chromium Private Network Access (PNA) Preflight & Relative Asset Paths
- **Problem**: Chromium blocks cross-origin requests from public HTTPS origins (e.g. `*.web.app`) to private local network endpoints (`http://localhost:3000`) unless preflights explicitly return `Access-Control-Allow-Private-Network: true`. Additionally, Vite absolute paths (`/assets/...`) break on subpath static hosts like GitHub Pages (`https://<user>.github.io/<repo>/`).
- **Correction**:
  - In Express, register PNA header injection middleware *before* the CORS middleware so preflight `OPTIONS` requests receive `Access-Control-Allow-Private-Network: true` with HTTP 204.
  - In `vite.config.ts`, set `base: './'` to enforce relative asset paths for universal portability across GitHub Pages, Firebase Hosting, and local Express static serving.
  - Utilize `HashRouter` for client-side routing on static CDNs to eliminate 404 Not Found errors on deep link reloads.

### 11. Strict English Language Directive for Plugins, Code, and Documentation
- **Problem**: German strings, comments, or labels were accidentally introduced into configuration files, workflow definitions (e.g. `gradle.yml`, `vibeworks-check.yml`), plugin UIs, and documentation. While chat conversations with the user must strictly remain in German, all written project code, markdown files, configurations, plugin UI labels, and commit messages MUST be exclusively in English.
- **Correction**:
  - Enforce a strict separation: User Chat = German; ALL Files/Artifacts/Plugins = English.
  - Audit all plugin configurations (e.g., `persistent-memory-plugin`), documentation, and UI components to ensure zero German text leakage.
  - In workflow files and scripts, write all comments, step descriptions, and log outputs in English.
  - In dashboard UI, use English as the default canonical dictionary key source and English labels in sidecars/plugins.
