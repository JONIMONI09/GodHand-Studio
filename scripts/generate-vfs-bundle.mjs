import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetJsonPath = path.resolve(rootDir, 'dashboard/public/vfs-bundle.json');

const EXCLUDED_DIRS = new Set([
  '.gradle',
  'build',
  'bin',
  'logs',
  'out',
  'node_modules',
  '.git',
  '.idea',
  '.vscode'
]);

const EXCLUDED_FILES = new Set([
  'gradlew',
  'gradlew.bat',
  '.DS_Store'
]);

function scanDirectory(dir, baseDir = dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    if (EXCLUDED_FILES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      Object.assign(result, scanDirectory(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Ignore binary log archives or jar files in bundle
      if (entry.name.endsWith('.log.gz') || entry.name.endsWith('.jar') || entry.name.endsWith('.class')) {
        continue;
      }
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        result[relPath] = content;
      } catch (err) {
        console.warn(`[VFS-Bundle] Warning: Skipped ${relPath}: ${err.message}`);
      }
    }
  }
  return result;
}

console.log('[VFS-Bundle] Scanning godhand and mods/arm32-fix...');

const godhandFiles = scanDirectory(path.resolve(rootDir, 'godhand'));
const arm32Files = scanDirectory(path.resolve(rootDir, 'mods/arm32-fix'));

// Ensure godhand.json exists in godhandFiles if not present
if (!godhandFiles['godhand.json']) {
  godhandFiles['godhand.json'] = JSON.stringify({
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
  }, null, 2);
}

const bundle = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  projects: {
    godhand: godhandFiles,
    'arm32-fix': arm32Files
  }
};

const outputDir = path.dirname(targetJsonPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(targetJsonPath, JSON.stringify(bundle, null, 2), 'utf8');

const godhandCount = Object.keys(godhandFiles).length;
const arm32Count = Object.keys(arm32Files).length;
console.log(`[VFS-Bundle] Successfully bundled ${godhandCount} godhand files and ${arm32Count} arm32-fix files into:`);
console.log(`[VFS-Bundle] ${targetJsonPath}`);
