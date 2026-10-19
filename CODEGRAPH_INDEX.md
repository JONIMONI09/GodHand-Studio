# CodeGraph Index

Master index and navigation map for GodHand Studio codebase documentation and architectural graphs.

## Index of Architectural Resources

- **[System Architecture & Core Graph](CODEGRAPH.md#1-system-architecture--data-flow)**: Complete overview of browser client, Express backend, local mod workspace, and Firebase/GitHub integrations.
- **[Component Dependency Graph](CODEGRAPH.md#2-component-dependency-graph)**: Relationships between core modules (`AuthContext`, `translations`), shared UI components (`LanguageSwitcher`, `GitStudio`), and main application pages.
- **[Backend Endpoints & Security Map](CODEGRAPH.md#3-backend-endpoints--security-map)**: Audit of `/api/fs/*`, `/api/git/*`, and `/api/build` with their corresponding input sanitization and quota limits.
- **[Test Suites & Coverage Matrix](CODEGRAPH.md#4-test-suites--coverage-matrix)**: Overview of all 34 automated unit tests across 6 test suites in `tests/*.test.mjs`.
- **[Security & CI/CD Pipeline](CODEGRAPH.md#5-security--quality-pipeline)**: Automated checks via GitHub Actions, Fallow, Gitleaks, OSV-Scanner, and Semgrep.

## Related Documentation

- **[Root README](README.md)**: Main open-source project overview and getting started guide.
- **[Error & Fix Log](error.md)**: Comprehensive issue tracking log from ERR-01 through ERR-13.
- **[Contributing Guide](.github/CONTRIBUTING.md)**: Open-source developer guide and PR standards.
- **[Security Policy](.github/SECURITY.md)**: Security reporting procedures and SLAs.
- **[Developer Manual](docs/DEVELOPER_DOCUMENTATION.md)**: In-depth technical specifications.
