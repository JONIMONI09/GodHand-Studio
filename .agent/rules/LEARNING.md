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

### 12. Python Sidecar String Escaping & Local CI Pipeline Guardrail
- **Problem**: In Python sidecar templates, unescaped \n in triple-quoted strings caused literal line breaks inside double-quoted JavaScript strings, triggering SyntaxError: Invalid or unexpected token and freezing the UI. Furthermore, pushing directly to CI without running all verification stages locally led to unexpected failures on remote runners.
- **Correction**:
  - Always use ES6 template literals (backticks) or external static .html files when serving JavaScript from Python sidecars.
  - Implement and run a unified local CI verification script (npm run test:ci / node scripts/run-ci-local.mjs) that validates all 5 stages (VFS bundle generation, TypeScript linting, Vite build, 105+ Node test suites, and Gradle remapJar) before pushing.
  - In .github/dependabot.yml, configure ignore: - dependency-name: "*", update-types: ["version-update:semver-major"] to prevent automated major version bumps (like React 19 or Express 5) from breaking CI workflows.

### 13. SemVer Template Resolution & Manifest Token Expansion
- **Problem**: In Fabric Loom mod projects, `fabric.mod.json` defines `"version": "${version}"` which is typically expanded at build-time by Gradle's `processResources` task using `mod_version` from `gradle.properties`. In-Browser packaging previously read literal `"${version}"`, naming compiled files `arm32fix-${version}.jar` and leaving unexpanded placeholders in the packaged manifest, which crashes Fabric Loader at runtime.
- **Correction**:
  - Implement `resolveModVersion()` and `resolveArchivesBaseName()` in `modVersion.mjs` and `jarCompiler.ts`.
  - When `fabric.mod.json` contains a template placeholder (`${version}` or `${mod_version}`), inspect `gradle.properties` for `mod_version`, `version`, or `modVersion` (falling back to `1.0.0`, never literal `${version}`).
  - Perform manifest token expansion during JAR archiving: replace `${version}`, `${minecraft_version}`, `${project.version}`, and `${archives_base_name}` with concrete values.

### 14. GitHub Actions Run URLs vs 404 `/artifacts` Path & Direct Releases Delivery
- **Problem**: GitHub Actions IssueOps comments previously linked to `https://github.com/<owner>/<repo>/actions/runs/<run_id>/artifacts`. GitHub does not have an HTML web page endpoint at `/artifacts`, resulting in `404 This is not the web page you are looking for.` Additionally, GitHub Actions artifacts require an authenticated session for ZIP archive downloads, which blocks unauthenticated web users.
- **Correction**:
  - In `.github/workflows/gradle.yml`, point run links directly to the valid Actions overview URL: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`.
  - In `.github/workflows/gradle.yml`, configure the `release` job to trigger on `issues` with `[CLOUD-BUILD]` to automatically update `latest` release assets.
  - In `modVersion.mjs` and `ciSession.ts`, implement `resolveReleaseDownloadUrl()` pointing to `https://github.com/<owner>/<repo>/releases/download/latest/<mod>.jar`, which allows 100% public, token-free, direct browser downloads without authentication.
  - Provide `cleanActionsUrl()` to strip `/artifacts` suffixes and subpaths/queries from incoming URLs.

### 15. Website-Centric Zero-Token Compilation & Upfront AST Syntax Checking
- **Problem**: When triggering builds without a local backend server, the client compiler finished in ~100ms in memory, giving users the impression of an unverified fake download. Furthermore, users were forced to open external GitHub tabs to create issues for cloud builds, and syntax errors (such as Java keyword typos or missing semicolons) were not caught prior to JAR generation across all workspace files.
- **Correction**:
  - Implement upfront workspace-wide Java AST syntax checks via `diagnoseJava` across all `.java` files in `BrowserVFS` and active editor buffers before initiating compilation. If errors are detected, abort immediately and surface filename, line number, message, and 1-click suggested fix.
  - Implement realistic step staging (300-380ms per step, ~2.4s total) with live progress percentages, step descriptions, and comprehensive console logs.
  - In `ciSession.ts` and `ciSession.mjs`, support dual polling: both IssueOps issue comments and public GitHub Actions workflow runs (`actions/runs`), enabling users to track cloud builds directly on the website without opening GitHub or entering any tokens.
  - Ensure `targetMod` paths like `mods/arm32-fix` are strictly sanitized to clean filenames like `arm32-fix-1.0.0.jar` rather than `mods/arm32-fix-1.0.0.jar`.

### 16. Vite Peer Dependency Incompatibility (ERESOLVE) & Dependabot Version Pinning
- **Problem**: Dependabot opened a PR bumping `vite` from `5.4.21` to `8.3.4` in `dashboard/package.json`. Merging this PR broke CI workflows (`GodHand Continuous Integration`, `Deploy to GitHub Pages`, `Fallow Security and Codebase Intelligence`) with `ERESOLVE could not resolve dependency: peer vite@"^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0" from @vitejs/plugin-react@4.7.0`. Furthermore, running `npm ci` on the root workspace invoked `postinstall: npm install --prefix dashboard`, causing premature dependency failures.
- **Correction**:
  - Keep `vite` pinned to `^5.2.11` (resolving to `5.4.21`) in `dashboard/package.json` to maintain 100% peer dependency compatibility with `@vitejs/plugin-react`.
  - In `.github/dependabot.yml`, add explicit exclusions for `vite` (`versions: [">=6.0.0"]`) in addition to `semver-major` ignore rules.
  - In all GitHub Actions CI workflows (`ci.yml`, `pages.yml`, `fallow.yml`), use `npm ci --ignore-scripts` for root repository dependency installation before running `npm ci --prefix dashboard`.
  - In `dashboard/vite.config.ts`, split large vendor dependencies (like `firebase`) into dedicated chunks (`manualChunks`) to prevent bundle size threshold warnings and maintain sub-5s production builds.
  - Enforce single-agent rapid execution and a strict depth limit of 1 (no nested subagents) to prevent agent sprawl.
