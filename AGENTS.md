# AGENTS.md - Root DOX Contract & Architecture Guide

## Scope & Project Identity
**GodHand Studio**: A high-performance, web-based integrated development environment and dashboard for Fabric Minecraft mod development, automated compiling, real-time diagnostics, and in-browser testing.

## System Architecture
- **Backend**: Node.js / Express (`dashboard/server.js`) providing Gradle wrappers, JDK provisioning, file management, and process control.
- **Frontend**: React 18 + Vite + Tailwind CSS + Monaco Editor (`dashboard/src/`).
- **Mod Base**: Fabric Mod (`godhand/`) targeting Minecraft 1.21.1+ with Loom.

## Non-Negotiable Standards & Hardrules
1. **Testing First**: Every runtime feature, API endpoint, and sanitizer must have corresponding automated unit tests in `tests/*.test.mjs` running via Node's native test runner (`node --test`).
2. **Path Sanitization**: All file system operations must strictly validate paths against traversal attacks (`..`, invalid separators).
3. **Command Execution Safety**: Never pass unsanitized user inputs to child processes or shells. All Gradle commands must be vetted through `sanitizeGradleArgs`.
4. **Bilingual Protocol**: User chat strictly in **German**; all code, markdown files (`.md`), comments, and commit messages strictly in **English**.
5. **Zero Breaking Changes**: Preserve existing endpoints, file trees, and storage schemas.
