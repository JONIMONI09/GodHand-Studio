# Project Rules & Guidelines

1. **Strict TypeScript & Linter Zero Tolerance**:
   - `npm run lint --prefix dashboard` must pass with zero TypeScript errors (`tsc --noEmit`).
   - `npm run build --prefix dashboard` must succeed without bundler or Rollup warnings.
2. **Automated Verification**:
   - Every feature must be backed by a `.test.mjs` test file in `tests/`.
   - Run `npm test` to verify all suites before marking tasks complete.
3. **Reactive UI & Localization**:
   - All user-facing strings must have entries in both `en` and `de` dictionaries inside `dashboard/src/i18n/translations.ts`.
4. **Resilient Process Handling**:
   - Long running tasks (`runClient`, `runServer`, `build`) must handle process closure, SIGTERM, and error states gracefully.
5. **Strict English for Plugins and Documentation**:
   - All plugin files (scripts, sidecars, UI templates, documentation, rule files) and project documentation (`.md` files) must strictly be written in English.
   - User chat communication remains strictly in German.
6. **Local CI Pipeline & Dependabot Major Update Guardrail**:
   - Always run `npm run test:ci` (`node scripts/run-ci-local.mjs`) locally to verify all 5 stages (VFS bundle generation, TypeScript linting, Vite build, 105+ Node test suites, and Gradle remapJar).
   - In `.github/dependabot.yml`, ignore all `semver-major` updates (`dependency-name: "*"`) to prevent breaking changes in core frameworks (React 18 / Express 4) from breaking CI.
7. **Strict Subagent Recursion Limit & Rapid Direct Execution**:
   - Never spawn unnecessary swarms of subagents. Maintain a maximum depth limit of 1 (strictly no nested subagents) and default to single-agent direct execution for speed and stability.
   - Run focused, time-bounded verification using local fast CI (pm run test:ci:fast) instead of prolonged open-ended checks.
