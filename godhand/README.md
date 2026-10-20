# GodHand Mod 🖐️⚡

GodHand is an administrative and utility Minecraft mod featuring enhanced capabilities, custom combat mechanics, companion AI, and headless diagnostic logging, built for Fabric with Loom.

---

## 🌟 Features

- **God Mode & Smart Combat**: Complete invulnerability and automated fallback regeneration/speed buffs upon lethal damage.
- **Super Bow & Explosive Projectiles**: Custom bow trajectory calculations and explosive arrow physics.
- **Bow Whitelisting**: Operator-controlled whitelist restricting special projectile capabilities to permitted players.
- **Companion AI**: Tamed companions with custom AI goal prioritization (`CompanionBuffGoal`, `CompanionDefendOwnerGoal`, `CompanionFollowOwnerGoal`).
- **Diagnostic Logging**: Headless logging architecture with tiered error capture (INFO, WARN, CRITICAL).
- **VFS Bundle & Cloud IDE Integration**: Full mod workspace with 86 real Java and JSON files packaged into GodHand Studio's Virtual File System (`vfs-bundle.json`), allowing instant browser editing, client-side `.jar` synthesis, and zero-PAT IssueOps compilation.

---

## 🛠️ Building & Verification

### Local Gradle Build
```bash
# Verify wrapper version
./gradlew --version

# Run JUnit 5 test suite
./gradlew test

# Compile and remap Fabric mod JAR
./gradlew remapJar
```

Artifacts are produced in `godhand/build/libs/`.

### Local CI Pipeline
From the repository root:
```bash
npm run test:ci
```
Executes Gradle tests alongside the Web IDE build and Node.js test suites.

---

## ☁️ Compilation Options

1. **Local Compiler**: Runs `./gradlew build` via local Express backend on `http://localhost:3000`.
2. **In-Browser Zero-PAT Compiler**: Pure client-side synthetic `.jar` generation directly in the browser via JSZip and JVM bytecode classfile generation (magic `0xCAFEBABE`, Java 21 ClassFormat 65.0).
3. **GitHub IssueOps Cloud Build**: File an issue with title `[CLOUD-BUILD] godhand` on GitHub to trigger server-side Gradle compilation in GitHub Actions with zero personal access tokens required.

---

## 🔧 Troubleshooting & Known Issues

### Game Crash Due to JNA Incompatibility (Common on PojavLauncher / Custom Runtimes)

**Log Error Description:**
```
java.lang.Error: There is an incompatible JNA native library installed on this system
Expected: 6.1.6
Found:    7.0.2
```

**Resolution:**
This crash is caused by an incompatible version of the `Java Native Access` (JNA) library installed in the host Java runtime environment.

To resolve this issue, add the following JVM flag to the launch arguments in your Minecraft launcher:

```
-Djna.nosys=true
```

This instructs the JVM to use the bundled JNA library instead of the host system's native library, avoiding the crash.
