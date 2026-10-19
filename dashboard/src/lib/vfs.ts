import JSZip from 'jszip';

export interface VFSNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: VFSNode[];
  size?: number;
}

export interface ModProjectMeta {
  id: string;
  name: string;
  loader: 'fabric' | 'neoforge' | 'forge';
  mcVersion: string;
  description: string;
  isSample?: boolean;
}

// In-Memory fallback store
const memoryStore = new Map<string, string>();
const DB_NAME = 'GodHandStudio_VFS_DB';
const DB_VERSION = 1;
const STORE_NAME = 'vfs_files';

function openVFSDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openVFSDB();
  if (!db) {
    return memoryStore.get(key) ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.content : null);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

async function idbSet(key: string, content: string): Promise<void> {
  memoryStore.set(key, content);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, content);
    } catch (_) {}
  }
  const db = await openVFSDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, content, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  memoryStore.delete(key);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
  const db = await openVFSDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

async function idbGetAllKeys(prefix: string): Promise<string[]> {
  const db = await openVFSDB();
  if (!db) {
    const keys: string[] = [];
    for (const k of memoryStore.keys()) {
      if (k.startsWith(prefix)) keys.push(k);
    }
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && !keys.includes(k)) {
          keys.push(k);
        }
      }
    }
    return keys;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const allKeys = (req.result as string[]).filter(k => typeof k === 'string' && k.startsWith(prefix));
        resolve(allKeys);
      };
      req.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

// Built-in Seeds
export const ARM32_FIX_SEED: Record<string, string> = {
  'godhand-mod.json': JSON.stringify({
    id: "arm32-fix",
    name: "ARM32 Hardware Alignment Fix",
    loader: "fabric",
    mcVersion: "1.21.1",
    isSample: false,
    description: "Fixes fatal ARM32/v8l hardware alignment crashes (java.lang.InternalError: a fault occurred in an unsafe memory access operation / Unsafe.putFloat) on Android devices by safely redirecting unaligned float memory writes."
  }, null, 2),
  'gradle.properties': `minecraft_version=1.21.1
yarn_mappings=1.21.1+build.3
loader_version=0.16.5
mod_version=1.0.0
maven_group=com.godhand.arm32fix
archives_base_name=arm32-fix
`,
  'settings.gradle': `pluginManagement {
    repositories {
        maven {
            name = 'Fabric'
            url = 'https://maven.fabricmc.net/'
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
rootProject.name = 'arm32-fix'
`,
  'build.gradle': `plugins {
    id 'fabric-loom' version '1.13.3'
    id 'java'
}

version = project.mod_version
group = project.maven_group

base {
    archivesName = project.archives_base_name
}

repositories {
    mavenCentral()
    maven { url = "https://maven.fabricmc.net/" }
}

dependencies {
    minecraft "com.mojang:minecraft:\${project.minecraft_version}"
    mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"
}

processResources {
    inputs.property "version", project.version
    inputs.property "minecraft_version", project.minecraft_version

    filesMatching("fabric.mod.json") {
        expand "version": project.version,
                "minecraft_version": project.minecraft_version
    }
}

tasks.withType(JavaCompile).configureEach {
    it.options.release = 21
    it.options.encoding = "UTF-8"
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

jar {
    from("LICENSE") {
        rename { "\${it}_\${project.base.archivesName.get()}" }
    }
}
`,
  'src/main/resources/fabric.mod.json': JSON.stringify({
    schemaVersion: 1,
    id: "arm32fix",
    version: "${version}",
    name: "ARM32 Hardware Alignment Fix",
    description: "Fixes fatal ARM32/v8l hardware alignment crashes (java.lang.InternalError: a fault occurred in an unsafe memory access operation / Unsafe.putFloat) on Android devices by safely redirecting unaligned float memory writes.",
    authors: [
      "GodHand AI Engine",
      "Admin Team"
    ],
    contact: {
      homepage: "https://github.com/JONIMONI09/GodHand-Studio"
    },
    license: "MIT",
    environment: "*",
    entrypoints: {
      main: [
        "com.godhand.arm32fix.Arm32FixMod"
      ]
    },
    mixins: [
      "arm32fix.mixins.json"
    ],
    depends: {
      fabricloader: ">=0.15.0",
      minecraft: ">=1.21",
      java: ">=21"
    }
  }, null, 2),
  'src/main/resources/arm32fix.mixins.json': JSON.stringify({
    required: true,
    minVersion: "0.8",
    package: "com.godhand.arm32fix.mixin",
    compatibilityLevel: "JAVA_21",
    mixins: [
      "MemoryUtilAlignmentMixin"
    ],
    injectors: {
      defaultRequire: 1
    }
  }, null, 2),
  'src/main/java/com/godhand/arm32fix/Arm32FixMod.java': `package com.godhand.arm32fix;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ARM32 Hardware Alignment Fix Mod for Minecraft 1.21.1+ (Java 21)
 *
 * Intercepts unsafe memory writes on 32-bit ARM architectures (ARMv7, ARMv8l in 32-bit mode)
 * where float operations to odd memory addresses throw SIGBUS hardware alignment traps
 * (java.lang.InternalError: a fault occurred in an unsafe memory access operation).
 */
public class Arm32FixMod implements ModInitializer {
    public static final String MOD_ID = "arm32fix";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static final boolean IS_ARM32;

    static {
        String arch = System.getProperty("os.arch", "").toLowerCase();
        IS_ARM32 = arch.contains("arm") || arch.contains("aarch32") || arch.contains("armv7") || arch.contains("armv8l");
    }

    @Override
    public void onInitialize() {
        LOGGER.info("[ARM32-Fix] Initializing hardware alignment safety system for Minecraft 1.21.1+ (Java 21)");
        if (IS_ARM32) {
            LOGGER.warn("[ARM32-Fix] Active ARM32 runtime detected ('{}'). Unsafe.putFloat alignment redirect ACTIVE.", System.getProperty("os.arch"));
        } else {
            LOGGER.info("[ARM32-Fix] Host architecture is '{}'. Alignment guard running in pass-through safe mode.", System.getProperty("os.arch"));
        }
    }

    public static boolean isArm32() {
        return IS_ARM32;
    }

    /**
     * Safely write a float value into native memory address.
     * Prevents SIGBUS alignment traps by writing 4 individual bytes or 32-bit int raw bits.
     *
     * @param address Native memory address
     * @param value   Float value to store
     */
    public static void safePutFloat(long address, float value) {
        int bits = Float.floatToRawIntBits(value);
        if ((address & 3L) == 0L) {
            // Naturally aligned to 4 bytes: safe 32-bit integer store
            org.lwjgl.system.MemoryUtil.memPutInt(address, bits);
        } else {
            // Unaligned on 32-bit boundary: write byte-by-byte in little-endian byte order
            org.lwjgl.system.MemoryUtil.memPutByte(address, (byte) (bits & 0xFF));
            org.lwjgl.system.MemoryUtil.memPutByte(address + 1L, (byte) ((bits >> 8) & 0xFF));
            org.lwjgl.system.MemoryUtil.memPutByte(address + 2L, (byte) ((bits >> 16) & 0xFF));
            org.lwjgl.system.MemoryUtil.memPutByte(address + 3L, (byte) ((bits >> 24) & 0xFF));
        }
    }
}
`,
  'src/main/java/com/godhand/arm32fix/mixin/MemoryUtilAlignmentMixin.java': `package com.godhand.arm32fix.mixin;

import org.lwjgl.system.MemoryUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;
import org.spongepowered.asm.mixin.Shadow;

/**
 * Mixin targeting org.lwjgl.system.MemoryUtil.
 * Overwrites memPutFloat to prevent SIGBUS hardware alignment exceptions on ARM32 architectures
 * (such as ARMv7 and ARMv8l in 32-bit compatibility mode on Android PojavLauncher/Amethyst).
 */
@Mixin(value = MemoryUtil.class, remap = false)
public abstract class MemoryUtilAlignmentMixin {

    @Shadow
    public static void memPutInt(long address, int value) {
        throw new AssertionError();
    }

    @Shadow
    public static void memPutByte(long address, byte value) {
        throw new AssertionError();
    }

    /**
     * @author GodHand AI Engine
     * @reason Intercepts float native writes to guarantee hardware alignment safety on ARM32/Android.
     */
    @Overwrite
    public static void memPutFloat(long address, float value) {
        int bits = Float.floatToRawIntBits(value);
        if ((address & 3L) == 0L) {
            memPutInt(address, bits);
        } else {
            memPutByte(address, (byte) (bits & 0xFF));
            memPutByte(address + 1L, (byte) ((bits >> 8) & 0xFF));
            memPutByte(address + 2L, (byte) ((bits >> 16) & 0xFF));
            memPutByte(address + 3L, (byte) ((bits >> 24) & 0xFF));
        }
    }
}
`
};

export const GODHAND_DEFAULT_SEED: Record<string, string> = {
  'godhand.json': JSON.stringify({
    godMode: {
      enabled: false,
      respawnInvulnerability: true,
      blockExplosions: true,
      blockFire: true,
      flightEnabled: false
    },
    companion: {
      maxCompanions: 1,
      followDistance: 3.0,
      defendRadius: 10.0,
      recruitRadius: 10.0
    }
  }, null, 2),
  'gradle.properties': `minecraft_version=1.21.1
fabric_loader_version=0.15.11
fabric_api_version=0.104.0+1.21.1
mod_version=1.0.0
maven_group=com.yourcompany.godhand
archives_base_name=godhand
yarn_mappings=1.21.1+build.3
`,
  'settings.gradle': `pluginManagement {
    repositories {
        maven {
            name = 'Fabric'
            url = 'https://maven.fabricmc.net/'
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
rootProject.name = 'godhand'
`,
  'build.gradle': `plugins {
    id 'fabric-loom' version '1.13.3'
    id 'java'
}
version = project.mod_version
group = project.maven_group
repositories {
    mavenCentral()
    maven { url = "https://maven.fabricmc.net/" }
}
dependencies {
    minecraft "com.mojang:minecraft:\${project.minecraft_version}"
    mappings "net.fabricmc:yarn:\${project.yarn_mappings}"
    modImplementation "net.fabricmc:fabric-loader:\${project.fabric_loader_version}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_api_version}"
}
java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
`,
  'src/main/resources/fabric.mod.json': JSON.stringify({
    schemaVersion: 1,
    id: "godhand",
    version: "1.0.0",
    name: "GodHand",
    description: "GodHand Fabric Minecraft Mod",
    authors: ["GodHand Studio"],
    license: "MIT",
    environment: "*",
    entrypoints: {
      main: ["com.yourcompany.godhand.GodHand"],
      client: ["com.yourcompany.godhand.GodHandClient"]
    },
    mixins: ["godhand.mixins.json"],
    depends: {
      fabricloader: ">=0.14.24",
      minecraft: ">=1.21.1",
      java: ">=21"
    }
  }, null, 2),
  'src/main/resources/godhand.mixins.json': JSON.stringify({
    required: true,
    minVersion: "0.8",
    package: "com.yourcompany.godhand.mixin",
    compatibilityLevel: "JAVA_21",
    mixins: ["LivingEntityMixin"],
    injectors: { defaultRequire: 1 }
  }, null, 2),
  'src/main/java/com/yourcompany/godhand/GodHand.java': `package com.yourcompany.godhand;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class GodHand implements ModInitializer {
    public static final String MOD_ID = "godhand";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("[GodHand] Initialized successfully in browser VFS cloud mode!");
    }
}
`,
  'src/main/java/com/yourcompany/godhand/GodHandClient.java': `package com.yourcompany.godhand;

import net.fabricmc.api.ClientModInitializer;

public class GodHandClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        GodHand.LOGGER.info("[GodHandClient] Client components initialized.");
    }
}
`,
  'src/main/java/com/yourcompany/godhand/GodHandFeatures.java': `package com.yourcompany.godhand;

public class GodHandFeatures {
    public static boolean isGodModeEnabled() {
        return true;
    }
}
`
};

export class BrowserVFS {
  private static initializedProjects = new Set<string>();

  private static getProjectScope(projectId?: string): string {
    const cleanId = (projectId || 'godhand').replace(/^(core-|core:|system-core-)/, '');
    return cleanId || 'godhand';
  }

  private static getStorageKey(projectId: string, path: string): string {
    const scope = this.getProjectScope(projectId);
    const cleanPath = path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return `vfs_${scope}::${cleanPath}`;
  }

  public static async ensureInitialized(projectId?: string): Promise<void> {
    const scope = this.getProjectScope(projectId);
    if (this.initializedProjects.has(scope)) return;

    const prefix = `vfs_${scope}::`;
    const existing = await idbGetAllKeys(prefix);

    if (existing.length === 0) {
      const seed = scope === 'arm32-fix' ? ARM32_FIX_SEED : GODHAND_DEFAULT_SEED;
      for (const [filePath, content] of Object.entries(seed)) {
        await idbSet(this.getStorageKey(scope, filePath), content);
      }
    }

    this.initializedProjects.add(scope);
  }

  public static async getFile(path: string, projectId?: string): Promise<string> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);
    const key = this.getStorageKey(scope, path);
    const content = await idbGet(key);
    if (content === null) {
      // Fallback check against static seeds
      const seed = scope === 'arm32-fix' ? ARM32_FIX_SEED : GODHAND_DEFAULT_SEED;
      const cleanPath = path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
      if (seed[cleanPath] !== undefined) {
        await idbSet(key, seed[cleanPath]);
        return seed[cleanPath];
      }
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  public static async saveFile(path: string, content: string, projectId?: string): Promise<void> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);
    const key = this.getStorageKey(scope, path);
    await idbSet(key, content);
  }

  public static async deleteFile(path: string, projectId?: string): Promise<void> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);
    const key = this.getStorageKey(scope, path);
    await idbDelete(key);

    // Also delete any child files if path is a folder
    const folderPrefix = key + '/';
    const allKeys = await idbGetAllKeys(`vfs_${scope}::`);
    for (const k of allKeys) {
      if (k.startsWith(folderPrefix)) {
        await idbDelete(k);
      }
    }
  }

  public static async moveFile(sourcePath: string, destinationPath: string, projectId?: string): Promise<void> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);

    const srcKey = this.getStorageKey(scope, sourcePath);
    const dstKey = this.getStorageKey(scope, destinationPath);

    const directContent = await idbGet(srcKey);
    if (directContent !== null) {
      await idbSet(dstKey, directContent);
      await idbDelete(srcKey);
    }

    // Move folder contents
    const folderPrefix = srcKey + '/';
    const allKeys = await idbGetAllKeys(`vfs_${scope}::`);
    for (const k of allKeys) {
      if (k.startsWith(folderPrefix)) {
        const subContent = await idbGet(k);
        if (subContent !== null) {
          const suffix = k.substring(folderPrefix.length);
          const newKey = dstKey + '/' + suffix;
          await idbSet(newKey, subContent);
          await idbDelete(k);
        }
      }
    }
  }

  public static async getTree(projectId?: string): Promise<VFSNode[]> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);

    const prefix = `vfs_${scope}::`;
    const keys = await idbGetAllKeys(prefix);
    const relativePaths = keys.map(k => k.substring(prefix.length)).sort();

    const root: VFSNode[] = [];

    for (const relPath of relativePaths) {
      const parts = relPath.split('/');
      let currentLevel = root;
      let curPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        curPath = curPath ? `${curPath}/${part}` : part;
        const isFile = i === parts.length - 1;

        let node = currentLevel.find(n => n.name === part);
        if (!node) {
          node = {
            name: part,
            path: curPath,
            type: isFile ? 'file' : 'folder',
            ...(isFile ? {} : { children: [] })
          };
          currentLevel.push(node);
        }

        if (!isFile) {
          if (!node.children) node.children = [];
          currentLevel = node.children;
        }
      }
    }

    return root;
  }

  public static async getFolders(projectId?: string): Promise<string[]> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);

    const prefix = `vfs_${scope}::`;
    const keys = await idbGetAllKeys(prefix);
    const folders = new Set<string>();

    for (const key of keys) {
      const rel = key.substring(prefix.length);
      const parts = rel.split('/');
      parts.pop(); // remove file name
      let pathAcc = '';
      for (const p of parts) {
        pathAcc = pathAcc ? `${pathAcc}/${p}` : p;
        folders.add(pathAcc);
      }
    }

    return Array.from(folders).sort();
  }

  public static async scaffoldMod(params: ModProjectMeta): Promise<void> {
    const cleanId = params.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const pkgName = cleanId.replace(/[-_]/g, '');
    const className = cleanId.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Mod';
    const loader = params.loader || 'fabric';
    const mcVersion = params.mcVersion || '1.21.1';
    const name = params.name || cleanId;
    const desc = params.description || `Minecraft ${loader} Mod created in GodHand Studio`;

    const files: Record<string, string> = {
      'godhand-mod.json': JSON.stringify({
        id: cleanId,
        name,
        loader,
        mcVersion,
        description: desc,
        isSample: false
      }, null, 2)
    };

    if (loader === 'fabric') {
      files['gradle.properties'] = `minecraft_version=${mcVersion}
yarn_mappings=${mcVersion}+build.3
loader_version=0.16.5
mod_version=1.0.0
maven_group=com.yourcompany.${pkgName}
archives_base_name=${cleanId}
`;
      files['settings.gradle'] = `pluginManagement {
    repositories {
        maven { url = 'https://maven.fabricmc.net/' }
        mavenCentral()
        gradlePluginPortal()
    }
}
rootProject.name = '${cleanId}'
`;
      files['build.gradle'] = `plugins {
    id 'fabric-loom' version '1.13.3'
    id 'java'
}
version = '1.0.0'
group = 'com.yourcompany.${pkgName}'
repositories {
    mavenCentral()
    maven { url = "https://maven.fabricmc.net/" }
}
dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings "net.fabricmc:yarn:${mcVersion}+build.3:v2"
    modImplementation "net.fabricmc:fabric-loader:0.16.5"
}
tasks.withType(JavaCompile).configureEach { it.options.release = 21 }
`;
      files['src/main/resources/fabric.mod.json'] = JSON.stringify({
        schemaVersion: 1,
        id: cleanId,
        version: "1.0.0",
        name,
        description: desc,
        authors: ["GodHand Developer"],
        license: "MIT",
        environment: "*",
        entrypoints: {
          main: [`com.yourcompany.${pkgName}.${className}`]
        },
        mixins: [`${cleanId}.mixins.json`],
        depends: {
          fabricloader: ">=0.15.0",
          minecraft: `>=${mcVersion}`,
          java: ">=21"
        }
      }, null, 2);
      files[`src/main/resources/${cleanId}.mixins.json`] = JSON.stringify({
        required: true,
        minVersion: "0.8",
        package: `com.yourcompany.${pkgName}.mixin`,
        compatibilityLevel: "JAVA_21",
        mixins: [],
        injectors: { defaultRequire: 1 }
      }, null, 2);
      files[`src/main/java/com/yourcompany/${pkgName}/${className}.java`] = `package com.yourcompany.${pkgName};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${className} implements ModInitializer {
    public static final String MOD_ID = "${cleanId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("[${name}] Fabric Mod initialized successfully on Minecraft ${mcVersion}!");
    }
}
`;
    } else if (loader === 'neoforge') {
      files['build.gradle'] = `plugins {
    id 'net.neoforged.moddev' version '2.0.78'
}
version = '1.0.0'
group = 'com.yourcompany.${pkgName}'
neoForge {
    version = '21.1.65'
}
`;
      files['src/main/resources/META-INF/neoforge.mods.toml'] = `modLoader="javafml"
loaderVersion="[4,)"
license="MIT"

[[mods]]
modId="${cleanId}"
version="1.0.0"
displayName="${name}"
description='''${desc}'''

[[dependencies.${cleanId}]]
    modId="neoforge"
    type="required"
    versionRange="[21.1,)"
    ordering="NONE"
    side="BOTH"
`;
      files[`src/main/java/com/yourcompany/${pkgName}/${className}.java`] = `package com.yourcompany.${pkgName};

import net.neoforged.fml.common.Mod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Mod("${cleanId}")
public class ${className} {
    public static final String MOD_ID = "${cleanId}";
    private static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public ${className}() {
        LOGGER.info("${name} NeoForge Mod initialized on Minecraft ${mcVersion}!");
    }
}
`;
    } else {
      // Forge
      files['build.gradle'] = `plugins {
    id 'net.minecraftforge.gradle' version '[6.0.24,6.2)'
}
version = '1.0.0'
group = 'com.yourcompany.${pkgName}'
`;
      files['src/main/resources/META-INF/mods.toml'] = `modLoader="javafml"
loaderVersion="[51,)"
license="MIT"

[[mods]]
modId="${cleanId}"
version="1.0.0"
displayName="${name}"
description='''${desc}'''
`;
      files[`src/main/java/com/yourcompany/${pkgName}/${className}.java`] = `package com.yourcompany.${pkgName};

import net.minecraftforge.fml.common.Mod;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod("${cleanId}")
public class ${className} {
    public static final String MOD_ID = "${cleanId}";
    private static final Logger LOGGER = LogManager.getLogger();

    public ${className}() {
        LOGGER.info("${name} Forge Mod initialized successfully!");
    }
}
`;
    }

    for (const [filePath, content] of Object.entries(files)) {
      await idbSet(this.getStorageKey(cleanId, filePath), content);
    }

    this.initializedProjects.add(cleanId);
  }

  public static async exportZip(projectId?: string): Promise<Blob> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);

    const prefix = `vfs_${scope}::`;
    const keys = await idbGetAllKeys(prefix);

    const zip = new JSZip();
    for (const key of keys) {
      const relPath = key.substring(prefix.length);
      const content = await idbGet(key);
      if (content !== null) {
        zip.file(relPath, content);
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  public static async exportJar(projectId?: string): Promise<Blob> {
    const scope = this.getProjectScope(projectId);
    await this.ensureInitialized(scope);

    const prefix = `vfs_${scope}::`;
    const keys = await idbGetAllKeys(prefix);

    const zip = new JSZip();
    zip.file('META-INF/MANIFEST.MF', `Manifest-Version: 1.0\nImplementation-Title: ${scope}\nImplementation-Version: 1.0.0\nCreated-By: GodHand Studio In-Browser Compiler\n`);

    for (const key of keys) {
      const relPath = key.substring(prefix.length);
      const content = await idbGet(key);
      if (content !== null) {
        // Place resources into jar root
        if (relPath.startsWith('src/main/resources/')) {
          const jarResPath = relPath.substring('src/main/resources/'.length);
          zip.file(jarResPath, content);
        } else {
          zip.file(relPath, content);
        }
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  public static async importZip(blobOrFile: Blob | File, projectId?: string): Promise<number> {
    const scope = this.getProjectScope(projectId);
    const zip = await JSZip.loadAsync(blobOrFile);
    let importedCount = 0;

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      // Filter out root wrappers if user zipped the parent folder
      const cleanPath = relativePath.replace(/^[^/]+\//, '');
      const pathTarget = cleanPath && (cleanPath.startsWith('src/') || cleanPath.endsWith('.gradle') || cleanPath.endsWith('.json') || cleanPath.endsWith('.properties')) 
        ? cleanPath 
        : relativePath;

      const content = await zipEntry.async('string');
      await idbSet(this.getStorageKey(scope, pathTarget), content);
      importedCount++;
    }

    this.initializedProjects.add(scope);
    return importedCount;
  }

  public static async importFromDirectoryHandle(dirHandle: any, projectId?: string): Promise<number> {
    const scope = this.getProjectScope(projectId);
    let count = 0;

    async function traverse(handle: any, currentPath = '') {
      for await (const entry of handle.values()) {
        const itemPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        if (entry.kind === 'file') {
          if (entry.name.endsWith('.jar') || entry.name.endsWith('.class')) continue;
          const file = await entry.getFile();
          if (file.size < 5 * 1024 * 1024) {
            const text = await file.text();
            await idbSet(BrowserVFS.getStorageKey(scope, itemPath), text);
            count++;
          }
        } else if (entry.kind === 'directory') {
          if (entry.name !== '.git' && entry.name !== 'build' && entry.name !== '.gradle' && entry.name !== 'node_modules') {
            await traverse(entry, itemPath);
          }
        }
      }
    }

    await traverse(dirHandle);
    this.initializedProjects.add(scope);
    return count;
  }

  public static async importFromFileList(files: FileList | File[], projectId?: string): Promise<number> {
    const scope = this.getProjectScope(projectId);
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const webkitPath = (file as any).webkitRelativePath;
      const cleanPath = webkitPath ? webkitPath.replace(/^[^/]+\//, '') : file.name;
      if (cleanPath.includes('.git/') || cleanPath.includes('build/') || cleanPath.includes('.gradle/')) continue;
      if (file.size < 5 * 1024 * 1024) {
        const text = await file.text();
        await idbSet(this.getStorageKey(scope, cleanPath), text);
        count++;
      }
    }

    this.initializedProjects.add(scope);
    return count;
  }

  public static async listProjects(): Promise<ModProjectMeta[]> {
    const list: ModProjectMeta[] = [
      {
        id: 'arm32-fix',
        name: 'ARM32 Hardware Alignment Fix',
        loader: 'fabric',
        mcVersion: '1.21.1',
        description: 'Fixes fatal ARM32/v8l hardware alignment crashes on Android devices.',
        isSample: false
      },
      {
        id: 'godhand',
        name: 'GodHand Studio Base',
        loader: 'fabric',
        mcVersion: '1.21.1',
        description: 'Core Fabric Minecraft Mod with Loom & In-Browser testing.',
        isSample: false
      }
    ];

    // Check custom projects stored in VFS
    const allKeys = await idbGetAllKeys('vfs_');
    const projectScopes = new Set<string>();
    for (const k of allKeys) {
      const match = k.match(/^vfs_([^:]+)::godhand-mod\.json$/);
      if (match && match[1] !== 'arm32-fix' && match[1] !== 'godhand') {
        projectScopes.add(match[1]);
      }
    }

    for (const p of projectScopes) {
      try {
        const jsonStr = await idbGet(`vfs_${p}::godhand-mod.json`);
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          list.push({
            id: p,
            name: parsed.name || p,
            loader: parsed.loader || 'fabric',
            mcVersion: parsed.mcVersion || '1.21.1',
            description: parsed.description || 'Custom Mod',
            isSample: Boolean(parsed.isSample)
          });
        }
      } catch (_) {}
    }

    return list;
  }
}
