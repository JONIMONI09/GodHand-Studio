# Security Policy

The GodHand team takes the security of our platform, user accounts, and compiled Minecraft mods seriously.

---

## Supported Versions

Only the latest release and active development branch receive security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability within GodHand, **please do not disclose it publicly** via GitHub Issues or public Discord channels.

### How to Report

1. **Email Disclosure**: Send details to the repository maintainer or security contact at `ggjonasgameryt@gmail.com`.
2. **GitHub Security Advisories**: Alternatively, submit a private report via [GitHub Security Advisories](https://github.com/EZdev0/GodHand/security/advisories/new).

### Information to Include

Please provide:
- Description of the vulnerability (e.g. path traversal, remote code execution, authentication bypass, unauthorized Firestore document access).
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Potential impact and affected components (Web IDE, Express server, Gradle builder, or Firebase rules).
- Any proposed mitigations or patch suggestions.

---

## Response Timeline & SLA

- **Acknowledgment**: Within 48 hours of initial report.
- **Triage & Assessment**: Within 5 business days.
- **Fix & Patch Release**: High-severity vulnerabilities will receive prioritized hotfixes within 14 days.
- **Coordinated Disclosure**: Public disclosure occurs only after a patch has been merged and verified.

---

## Security Practices in GodHand

- **Path Traversal Protection**: The Express backend enforces root boundary validation on `/api/fs/*` endpoints to prevent file access outside the designated workspace.
- **Upload Quotas**: A strict `5MB` upload ceiling is enforced on file uploads.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (`owner`, `admin`, `mod`, `supporter`, `user`) audited in `tests/role-permissions.test.mjs`.
- **Automated Security Scans**: Continuous automated audits using Fallow, Gitleaks, OSV-Scanner, and Semgrep.
