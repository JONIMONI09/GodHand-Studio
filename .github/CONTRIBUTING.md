# Contributing to GodHand

First off, thank you for considering contributing to GodHand! We welcome code contributions, documentation improvements, issue reports, and feature suggestions.

---

## Code of Conduct

This project and everyone participating in it is governed by the [GodHand Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Development Setup

### Prerequisites

- **Node.js**: `20.x` or higher
- **npm**: `10.x` or higher
- **Java Development Kit (JDK)**: OpenJDK 21 (Temurin recommended)
- **Git**: Installed and configured

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/EZdev0/GodHand.git
   cd GodHand
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch development server:
   ```bash
   npm run dev
   ```
   The dashboard runs on `http://localhost:3000`.

---

## Pull Request Guidelines

1. **Create a Topic Branch**: Branch off `main` with a descriptive name:
   ```bash
   git checkout -b feature/interactive-file-tree
   # or
   git checkout -b fix/git-commit-milestones
   ```

2. **Commit Conventions**: Keep commit messages concise, descriptive, and written in English:
   - `feat: add drag-and-drop file tree reordering`
   - `fix: prevent empty git commit crashes`
   - `docs: update architecture overview in CODEGRAPH.md`
   - `test: expand translation parity coverage`

3. **Verify Tests & Linting**:
   Always run test and lint commands before submitting your PR:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. **Submit Your PR**:
   - Provide a clear summary of what was changed and why.
   - Reference any related issues (`Fixes #123`).
   - Fill in all sections of the [PULL_REQUEST_TEMPLATE](PULL_REQUEST_TEMPLATE.md).

---

## Coding Standards

### TypeScript & React Frontend
- Use TypeScript with strict null-safety (`?.`, `??`).
- Use Tailwind CSS for utility styling. Avoid inline `style` objects.
- Ensure all user-facing strings are localized via `useTranslation()` in `dashboard/src/i18n/translations.ts`.
- Maintain 100% key parity between English (`en`) and German (`de`).

### Express & Node.js Backend
- Strictly validate all file paths against directory traversal (`path.resolve`, `startsWith`).
- Return structured JSON errors (`{ error: string }`) with appropriate HTTP status codes.
- Sanitize all child-process commands executed with `git` or Gradle.

### Minecraft Mod Engine (Java 21)
- Code targeted for Minecraft 1.21.1+ with Fabric/Forge Gradle tooling.
- Follow standard Java code formatting and package naming (`com.yourcompany.godhand`).
