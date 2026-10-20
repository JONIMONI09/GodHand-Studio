# GodHand Studio — Web IDE & Dashboard Frontend

The frontend and developer workspace for **GodHand Studio**, a high-performance web-based integrated development environment and dashboard for Fabric Minecraft mod development, automated compiling, real-time diagnostics, and in-browser testing.

---

## 🏗️ Architecture

- **Framework**: React 18 with TypeScript and Vite
- **Styling**: Tailwind CSS with custom IDE dark theme
- **Code Editor**: `@monaco-editor/react` (Monaco Editor)
- **Local Compiler Bridge**: Express.js server (`server.js`) on Node.js 20
- **Database & Auth**: Firebase Firestore and Firebase Authentication
- **Virtual File System**: Client-side IndexedDB persistence (`src/lib/vfs.ts`) with fallback to localStorage
- **Bytecode & ZIP Engine**: Client-side JAR synthesizer (`src/lib/jarCompiler.ts`) using JSZip and synthetic ClassFile generation (Java 21, ClassFormat 65.0)

---

## 🌟 Key Features

### 1. In-Browser Virtual File System (VFS)
- Complete offline and cloud capability without a local Node.js backend.
- Automatically pre-seeds **86 real mod files** from `godhand/` and 8 from `mods/arm32-fix/` via `dashboard/public/vfs-bundle.json`.
- IndexedDB storage guarantees fast file reads, edits, and persistent folder structures across page reloads.

### 2. Zero-PAT Client-Side `.jar` Compiler
- Generates valid, downloadable Minecraft `.jar` packages directly in the browser.
- Synthesizes JVM bytecode ClassFiles (`0xCAFEBABE`, Java 21) from source code alongside `fabric.mod.json` manifests and assets.
- Requires zero personal access tokens (PAT) or cloud infrastructure.

### 3. GitHub IssueOps Cloud Compilation Bridge
- For heavy Loom Gradle tasks (`./gradlew remapJar`), users without a local Java 21 JDK can trigger GitHub Actions cloud compilation.
- Filing an issue with title `[CLOUD-BUILD] godhand` triggers `.github/workflows/gradle.yml`, which compiles the mod and attaches downloadable `.jar` artifacts with zero PAT setup.

### 4. Monaco Code Editor & Intelligent Diagnostic Scanner
- Full syntax highlighting for Java, JSON, Markdown, and XML.
- Continuous background debounced syntax scanner that detects Java keyword typos (`pubilc`, `viod`, `Stirng`), missing semicolons, and unclosed braces with 1-click surgical auto-fixes.

### 5. Private Network Access (PNA) & Hybrid Bridge
- Express server (`server.js`) includes preflight headers (`Access-Control-Allow-Private-Network: true`) enabling secure communication between public HTTPS cloud frontends (e.g. Firebase Hosting) and local Node.js compilation backends (`http://localhost:3000`).

### 6. Dynamic Bilingual Localization (EN / DE)
- 100% string parity across English and German verified by `tests/translations.test.mjs`.

---

## 🚀 Development Scripts

```bash
# Start local Express backend and Vite dev server
npm run dev

# TypeScript type checking
npm run lint

# Generate production build
npm run build

# Generate static build with relative paths for GitHub Pages
npm run build:static

# Run automated unit test suites
npm test
```
