# GodHand 🖐️⚡

**GodHand** is a feature-rich, utility-focused Minecraft mod built on the **Fabric Mod Loader (1.20.1)**. Designed with administrative utility, smart combat, and robust performance in mind, it provides players and server operators with a flexible suite of tools directly accessible via an intuitive GUI.

## 🌟 Key Features

*   **God Mode & Smart-Combat:** Complete invulnerability or intelligent regeneration and speed boosts based on player health. *Smart-Combat* engages seamlessly whenever standard God Mode is disabled.
*   **Super Bow & Explosive Arrows:** Transforms a regular bow into a powerful ranged weapon! Features customizable explosion strength and homing projectile trajectories.
*   **Whitelisting System:** A secure bow whitelisting system ensuring only authorized operators and players can trigger explosive arrows, managed directly in-game or via config.
*   **Companion Management:** Command loyal companion entities powered by custom AI prioritization for combat assistance, defense, and tactical player following.
*   **Performance Diagnostics:** Built-in headless diagnostic logging engine for rapid error trapping, configuration auditing, and crash prevention.

## 🛠️ Building the Mod

This project uses Gradle for build automation and dependency resolution. The build pipeline is optimized for GitHub Actions CI/CD workflows and local development.

### Prerequisites
*   Java Development Kit (JDK) 21
*   Active internet connection (to download the Gradle wrapper, Fabric Loader, and runtime dependencies).

### Instructions

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Navigate to the Source Directory:**
    Mod source code and Gradle configurations are located in the `godhand` directory:
    ```bash
    cd godhand
    ```

3.  **Build the Project:**
    Execute the Gradle wrapper to compile the mod and run test suites:
    ```bash
    ./gradlew build
    ```
    *If wrapper network timeouts occur on restricted networks, use a local Gradle 8.x installation:* `gradle build`.

4.  **Locate Compiled Artifact:**
    The compiled `.jar` artifact is generated in the build directory:
    ```text
    godhand/build/libs/Libs Main_jar/
    ```

## 🤖 CI/CD (GitHub Actions)

This repository includes automated continuous integration via GitHub Actions (`.github/workflows/gradle.yml` & `.github/workflows/ci.yml`). Automated checks run on:
- Pushes to the `main` branch
- Pull requests targeting `main`

> **Note for Pull Requests:** When creating a PR from a fork, GitHub may require initial maintainer approval before executing workflow runners. Workflows trigger automatically upon approval.

## 🧪 Testing

GodHand features an automated test suite utilizing JUnit 5 and Mockito to verify configuration integrity, UI state, and combat math.

To run the Java test suite manually:
```bash
cd godhand
./gradlew test
```

To run the Web Dashboard test suite:
```bash
npm test
```

To run the unified local CI verification pipeline (VFS bundle, lint, build, test, and Gradle):
```bash
npm run test:ci
```

## 🌐 Web Dashboard & Team Studio

The integrated GodHand Web Studio provides:
- **Cloud Web-IDE**: Full-featured Monaco editor with Java and TypeScript syntax highlighting.
- **In-Browser VFS Persistence**: IndexedDB-backed Virtual File System pre-seeded with 86 real mod files from `godhand/` and 8 files from `mods/arm32-fix/`.
- **Zero-PAT In-Browser .JAR Compiler**: Pure client-side JAR synthesizer using JSZip and synthetic JVM ClassFile generation (`0xCAFEBABE`, Java 21) with zero PAT tokens required.
- **GitHub IssueOps Cloud Build**: File an issue titled `[CLOUD-BUILD] godhand` to compile the mod on GitHub Actions infrastructure.
- **Custom Explorer Ordering**: Custom vertical file arrangement with 1-click controls and drag-and-drop.
- **Git Studio**: Branch branching, version rollback, diff viewer, and history inspection.
- **Team & Ticket System**: Staff Discord-style communications, support ticket assignment, and owner audit logs.
- For complete architecture details, refer to [DOCUMENTATION.md](../DOCUMENTATION.md) and [DEVELOPER_DOCUMENTATION.md](./DEVELOPER_DOCUMENTATION.md).

## 📜 License

Distributed under the MIT License. See [LICENSE](../LICENSE) for full terms.
