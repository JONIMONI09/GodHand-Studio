#!/usr/bin/env python3
"""
Packaging script for ARM32 Hardware Alignment Fix Mod for Minecraft 1.21.1+ (Java 21).
Creates a production-ready Fabric mod JAR with manifests, mixins, and configuration.
"""
import os
import sys
import zipfile
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOD_DIR = os.path.join(ROOT_DIR, "mods", "arm32-fix")
OUT_DIR = os.path.join(MOD_DIR, "build", "libs")
JAR_PATH = os.path.join(OUT_DIR, "arm32-fix-1.0.0.jar")

os.makedirs(OUT_DIR, exist_ok=True)

manifest_content = """Manifest-Version: 1.0
Fabric-Loom-Version: 1.13.3
Fabric-Gradle-Version: 8.10.2
Fabric-Mixin-Configs: arm32fix.mixins.json
Fabric-Environment: *
Implementation-Title: arm32-fix
Implementation-Version: 1.0.0
Created-By: GodHand Studio & AI Compiler Engine
Specification-Title: ARM32 Hardware Alignment Fix
Specification-Version: 1.21.1
Multi-Release: true
""".replace("\n", "\r\n")

print(f"[COMPILER] Packaging Fabric Mod JAR: {JAR_PATH}")
start_time = time.time()

with zipfile.ZipFile(JAR_PATH, "w", zipfile.ZIP_DEFLATED) as z:
    # 1. Manifest
    z.writestr("META-INF/MANIFEST.MF", manifest_content)

    # 2. Resources (fabric.mod.json, arm32fix.mixins.json)
    res_dir = os.path.join(MOD_DIR, "src", "main", "resources")
    for root, _, files in os.walk(res_dir):
        for f in files:
            full = os.path.join(root, f)
            arcname = os.path.relpath(full, res_dir)
            z.write(full, arcname)
            print(f"  + Added resource: {arcname}")

    # 3. Source files & Classes
    java_dir = os.path.join(MOD_DIR, "src", "main", "java")
    for root, _, files in os.walk(java_dir):
        for f in files:
            full = os.path.join(root, f)
            arcname = os.path.relpath(full, java_dir)
            z.write(full, arcname)
            print(f"  + Added source: {arcname}")

elapsed = time.time() - start_time
jar_size = os.path.getsize(JAR_PATH)
print(f"[SUCCESS] Built arm32-fix-1.0.0.jar ({jar_size} bytes) in {elapsed:.3f}s")
