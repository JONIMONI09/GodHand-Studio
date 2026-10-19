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
