# Learning Proposal: Strict English Directive for Plugins, Code, and Documentation

**Status:** APPROVED & ENFORCED  
**Scope:** Global Workspace, GodHand Studio, Persistent Memory Plugin, All Subprojects  
**Rule ID:** HARDRULE-LANG-001  
**Author:** Antigravity AI Engine  

---

## 1. Context & Motivation

During recent codebase audits and CI inspection, residual German text was identified in several non-chat locations:
1. Workflow configuration comments (e.g. `.github/workflows/gradle.yml` and `.github/workflows/vibeworks-check.yml`).
2. Plugin sidecar web UI placeholders and labels (e.g. `dashboard_server.py` in `persistent-memory-plugin`).
3. Outdated documentation references.

While the primary user communication channel (chat messages, prompts, user interaction) is strictly conducted in **German** per user directive, **all code, configuration files, commit messages, PR descriptions, plugin configurations, and documentation files (`.md`) MUST be strictly and exclusively written in English**.

---

## 2. Hardrule Specification

### Rule HARDRULE-LANG-001: Strict Separation of Concerns
1. **User Communication (Chat Only):**
   - Direct messages to the human user are exclusively in German (**Ausschließlich Deutsch**).
2. **Repository Files & Code (100% English):**
   - Source code files (`.ts`, `.tsx`, `.js`, `.mjs`, `.java`, `.py`, `.json`, `.yaml`, `.yml`).
   - Markdown and documentation files (`.md`, `.txt`, `.html`, `.rst`).
   - Configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`, `fabric.mod.json`).
   - GitHub Actions workflow step names, descriptions, and inline comments.
   - Plugin definitions, sidecar UI labels, tool declarations, and schema definitions.
   - Git commit messages, branch names, and pull request titles/bodies.
3. **Localization Architecture (`i18n`):**
   - User interfaces must offer bilingual capability via canonical localization files (e.g., `dashboard/src/i18n/translations.ts`).
   - Hardcoded strings in UI templates are strictly prohibited; all user-facing strings must use translation keys.
   - The default base locale and dictionary key definitions must be in English.

---

## 3. Remediations Executed

1. **Persistent Memory Plugin (`persistent-memory-plugin`):**
   - Replaced German placeholder text and drawer labels in `dashboard_server.py`:
     - Changed `➕ Schnellnotiz / Memory speichern (Save Custom Knowledge Note)` → `➕ Save Custom Knowledge Note / Quick Memory`.
     - Changed `placeholder="Topic (z.B. Firebase Auth Fix, Gradle RunClient)"` → `placeholder="Topic (e.g. Firebase Auth Fix, Gradle RunClient)"`.
     - Changed `placeholder="Workspace (z.B. AI_studio_mod oder Global)"` → `placeholder="Workspace (e.g. AI_studio_mod or Global)"`.
     - Changed `⭐ Auch als aktive Regel für LLMs speichern (Permanently injected into prompts)` → `⭐ Also save as active rule for LLMs (Permanently injected into prompts)`.
   - Updated `scripts/consolidate.py` with English noise filters (`"still there"`, `"still broken"`, `"not working"`).

2. **GitHub Actions Workflows:**
   - Translated German wrapper execution explanation in `.github/workflows/gradle.yml`.
   - Translated header comments and step names in `.github/workflows/vibeworks-check.yml` to clean English.

3. **Documentation:**
   - Updated root `README.md`, `godhand/README.md`, `docs/README.md`, and `docs/DEVELOPER_DOCUMENTATION.md` to English.
   - Created `dashboard/README.md` completely in English.

---

## 4. Automated Verification & Safeguards

- Run `npm run test:ci` to execute the local CI pipeline:
  1. `node scripts/generate-vfs-bundle.mjs` (VFS bundle up-to-date)
  2. `npm run lint --prefix dashboard` (TypeScript type check)
  3. `npm run build --prefix dashboard` (Production bundle generation)
  4. `npm test` (105 automated unit and integration tests across 23 suites)
  5. `godhand/gradlew.bat test remapJar` (Loom build & remap)
- All automated checks pass with 0 warnings and 0 failures.
