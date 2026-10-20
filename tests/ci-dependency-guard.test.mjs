import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('CI Dependency Guard & Workflow Safety Suite', () => {
  it('verifies dashboard/package.json specifies compatible Vite 5.x dependency', () => {
    const pkgPath = path.join(rootDir, 'dashboard', 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'dashboard/package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const viteVersion = pkg.devDependencies?.vite;
    assert.ok(viteVersion, 'vite must be present in devDependencies');
    
    // Ensure vite is 5.x and strictly below 6.0.0
    const cleanVer = viteVersion.replace(/^[\^~]/, '');
    const major = parseInt(cleanVer.split('.')[0], 10);
    assert.strictEqual(major, 5, `Vite major version must be 5 to avoid peer dependency conflicts with @vitejs/plugin-react, found: ${viteVersion}`);
  });

  it('verifies .github/dependabot.yml ignores semver-major and vite >= 6.0.0', () => {
    const depPath = path.join(rootDir, '.github', 'dependabot.yml');
    assert.ok(fs.existsSync(depPath), '.github/dependabot.yml must exist');
    const content = fs.readFileSync(depPath, 'utf8');
    
    assert.ok(content.includes('version-update:semver-major'), 'dependabot.yml must ignore semver-major');
    assert.ok(content.includes('dependency-name: "vite"'), 'dependabot.yml must specify vite exclusion');
    assert.ok(content.includes('versions: [">=6.0.0"]'), 'dependabot.yml must ignore vite >= 6.0.0');
  });

  it('verifies CI workflows use npm ci --ignore-scripts for root installations', () => {
    const workflows = ['ci.yml', 'pages.yml', 'fallow.yml'];
    for (const wf of workflows) {
      const wfPath = path.join(rootDir, '.github', 'workflows', wf);
      assert.ok(fs.existsSync(wfPath), `${wf} must exist`);
      const content = fs.readFileSync(wfPath, 'utf8');
      assert.ok(
        content.includes('npm ci --ignore-scripts'),
        `${wf} must include npm ci --ignore-scripts to avoid unexpected postinstall failures`
      );
    }
  });

  it('verifies dashboard/vite.config.ts configures firebase manualChunks', () => {
    const configPath = path.join(rootDir, 'dashboard', 'vite.config.ts');
    assert.ok(fs.existsSync(configPath), 'dashboard/vite.config.ts must exist');
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(content.includes('firebase:'), 'vite.config.ts must declare a separate firebase manualChunk');
    assert.ok(content.includes("'firebase/auth'"), 'firebase manualChunk must include firebase/auth');
    assert.ok(content.includes("'firebase/firestore'"), 'firebase manualChunk must include firebase/firestore');
  });

  it('verifies dashboard/src/App.tsx does not contain redundant dynamic firebase imports', () => {
    const appPath = path.join(rootDir, 'dashboard', 'src', 'App.tsx');
    assert.ok(fs.existsSync(appPath), 'dashboard/src/App.tsx must exist');
    const content = fs.readFileSync(appPath, 'utf8');
    const matches = content.match(/import\(['"]firebase/g);
    assert.strictEqual(matches, null, 'App.tsx must not contain dynamic import("firebase/...") calls');
  });
});
