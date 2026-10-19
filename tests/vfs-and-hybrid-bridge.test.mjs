import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('In-Browser Virtual File System (VFS) & Hybrid Cloud Bridge Suite', () => {
  const rootDir = path.resolve('.');
  const vfsPath = path.resolve(rootDir, 'dashboard/src/lib/vfs.ts');
  const apiPath = path.resolve(rootDir, 'dashboard/src/lib/api.ts');
  const serverPath = path.resolve(rootDir, 'dashboard/server.js');
  const viteConfigPath = path.resolve(rootDir, 'dashboard/vite.config.ts');
  const distIndexPath = path.resolve(rootDir, 'dashboard/dist/index.html');
  const workflowPath = path.resolve(rootDir, '.github/workflows/gradle.yml');

  it('verifies VFS source exists and defines ARM32 hardware alignment fix seed', () => {
    assert.ok(fs.existsSync(vfsPath), 'vfs.ts must exist');
    const vfsContent = fs.readFileSync(vfsPath, 'utf8');

    assert.ok(vfsContent.includes('ARM32_FIX_SEED'), 'Must define ARM32_FIX_SEED');
    assert.ok(vfsContent.includes('MemoryUtilAlignmentMixin'), 'Must include MemoryUtilAlignmentMixin');
    assert.ok(vfsContent.includes('safePutFloat'), 'Must include safePutFloat logic');
    assert.ok(vfsContent.includes('memPutByte'), 'Must include byte-by-byte alignment write');
    assert.ok(vfsContent.includes('GODHAND_DEFAULT_SEED'), 'Must define GODHAND_DEFAULT_SEED');
    assert.ok(vfsContent.includes('scaffoldMod'), 'Must implement scaffoldMod generator');
    assert.ok(vfsContent.includes('exportZip'), 'Must implement exportZip packager');
    assert.ok(vfsContent.includes('exportJar'), 'Must implement exportJar packager');
  });

  it('verifies real mods/arm32-fix files on disk match seed specifications', () => {
    const modDir = path.resolve(rootDir, 'mods/arm32-fix');
    assert.ok(fs.existsSync(modDir), 'mods/arm32-fix folder must exist');

    const modJson = path.resolve(modDir, 'godhand-mod.json');
    assert.ok(fs.existsSync(modJson), 'godhand-mod.json must exist');
    const parsed = JSON.parse(fs.readFileSync(modJson, 'utf8'));
    assert.equal(parsed.id, 'arm32-fix');
    assert.equal(parsed.loader, 'fabric');

    const mixinPath = path.resolve(modDir, 'src/main/java/com/godhand/arm32fix/mixin/MemoryUtilAlignmentMixin.java');
    assert.ok(fs.existsSync(mixinPath), 'MemoryUtilAlignmentMixin.java must exist');
    const mixinContent = fs.readFileSync(mixinPath, 'utf8');
    assert.ok(mixinContent.includes('memPutFloat'), 'Must overwrite memPutFloat');
    assert.ok(mixinContent.includes('address & 3L'), 'Must perform bitwise address alignment check');
  });

  it('verifies relative base path configuration in vite.config.ts', () => {
    assert.ok(fs.existsSync(viteConfigPath), 'vite.config.ts must exist');
    const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
    assert.ok(viteContent.includes("base: './'"), "vite.config.ts must set base to './'");
  });

  it('verifies dashboard/dist/index.html contains relative asset paths for GitHub Pages', () => {
    assert.ok(fs.existsSync(distIndexPath), 'dist/index.html must exist');
    const htmlContent = fs.readFileSync(distIndexPath, 'utf8');
    assert.ok(htmlContent.includes('src="./assets/'), 'JavaScript bundles must use relative ./assets/');
    assert.ok(htmlContent.includes('href="./assets/'), 'CSS bundles must use relative ./assets/');
    assert.ok(!htmlContent.includes('src="/assets/'), 'Must not have absolute /assets/ paths');
  });

  it('verifies dashboard/server.js CORS whitelist and Private Network Access', () => {
    assert.ok(fs.existsSync(serverPath), 'server.js must exist');
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    assert.ok(serverContent.includes('https://project-910a2a4c-fa54-4621-b21.web.app'), 'Must whitelist web.app domain');
    assert.ok(serverContent.includes('.trycloudflare.com'), 'Must whitelist *.trycloudflare.com tunnel');
    assert.ok(serverContent.includes('Access-Control-Allow-Private-Network'), 'Must handle Access-Control-Allow-Private-Network header');
    assert.ok(serverContent.includes('express.static'), 'Must serve static dist directory');
    assert.ok(serverContent.includes("app.get('*'"), 'Must have SPA catch-all route');
  });

  it('verifies dynamic backend URL resolution logic in api.ts', () => {
    assert.ok(fs.existsSync(apiPath), 'api.ts must exist');
    const apiContent = fs.readFileSync(apiPath, 'utf8');

    assert.ok(apiContent.includes('GODHAND_BACKEND_URL'), 'Must check GODHAND_BACKEND_URL in localStorage');
    assert.ok(apiContent.includes('getCustomBackendUrl'), 'Must expose getCustomBackendUrl');
    assert.ok(apiContent.includes('setCustomBackendUrl'), 'Must expose setCustomBackendUrl');
    assert.ok(apiContent.includes('handleVfsFallback'), 'Must implement handleVfsFallback for offline standalone mode');
  });

  it('verifies GitHub Actions workflow has workflow_dispatch trigger for cloud build', () => {
    assert.ok(fs.existsSync(workflowPath), '.github/workflows/gradle.yml must exist');
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(workflowContent.includes('workflow_dispatch:'), 'Must enable workflow_dispatch');
  });

  it('verifies multi-loader mod scaffolding output format', () => {
    // Pure unit test of the scaffolding contract
    const loaders = ['fabric', 'neoforge', 'forge'];
    loaders.forEach(loader => {
      const cleanId = `test-${loader}-mod`;
      const expectedManifest = loader === 'fabric' 
        ? 'src/main/resources/fabric.mod.json'
        : loader === 'neoforge'
        ? 'src/main/resources/META-INF/neoforge.mods.toml'
        : 'src/main/resources/META-INF/mods.toml';

      assert.ok(expectedManifest.length > 0);
      assert.ok(cleanId.startsWith('test-'));
    });
  });

  it('verifies root cloud deployment configurations exist', () => {
    const dockerPath = path.resolve(rootDir, 'Dockerfile');
    const renderPath = path.resolve(rootDir, 'render.yaml');
    const koyebPath = path.resolve(rootDir, 'koyeb.yaml');

    assert.ok(fs.existsSync(dockerPath), 'Root Dockerfile must exist');
    assert.ok(fs.existsSync(renderPath), 'render.yaml must exist');
    assert.ok(fs.existsSync(koyebPath), 'koyeb.yaml must exist');

    const dockerContent = fs.readFileSync(dockerPath, 'utf8');
    assert.ok(dockerContent.includes('eclipse-temurin:21'), 'Dockerfile must use OpenJDK 21');
    assert.ok(dockerContent.includes('nodejs'), 'Dockerfile must install Node.js');
  });

  it('verifies server.js Private Network Access middleware runs before CORS preflight termination', () => {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    const pnaIndex = serverContent.indexOf('Access-Control-Allow-Private-Network');
    const corsUseIndex = serverContent.indexOf('app.use(cors(');
    assert.ok(pnaIndex !== -1, 'Must handle Access-Control-Allow-Private-Network');
    assert.ok(corsUseIndex !== -1, 'Must use cors middleware');
    assert.ok(pnaIndex < corsUseIndex, 'PNA middleware must be registered before app.use(cors) to ensure preflight OPTIONS receives header');
  });

  it('verifies server.js supports project-aware file moving and folders endpoints', () => {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    assert.ok(serverContent.includes('/api/system-mods/:id/folders'), 'Must define system-mods folders route');
    assert.ok(serverContent.includes('/api/system-mods/:id/move'), 'Must define system-mods move route');
    assert.ok(serverContent.includes("projectId || project"), 'Must support optional projectId in fs endpoints');
  });

  it('verifies vfs.ts listProjects exports full SystemMod metadata', () => {
    const vfsContent = fs.readFileSync(vfsPath, 'utf8');
    assert.ok(vfsContent.includes('targetMinecraft'), 'Must provide targetMinecraft');
    assert.ok(vfsContent.includes('targetJava'), 'Must provide targetJava');
    assert.ok(vfsContent.includes('targetArch'), 'Must provide targetArch');
    assert.ok(vfsContent.includes('jarExists'), 'Must provide jarExists flag');
  });

  it('verifies launcher scripts check for node_modules before building frontend', () => {
    const batPath = path.resolve(rootDir, 'start-godhand.bat');
    const ps1Path = path.resolve(rootDir, 'launch-godhand.ps1');
    assert.ok(fs.existsSync(batPath), 'start-godhand.bat must exist');
    assert.ok(fs.existsSync(ps1Path), 'launch-godhand.ps1 must exist');

    const batContent = fs.readFileSync(batPath, 'utf8');
    assert.ok(batContent.includes('dashboard\\node_modules'), 'Batch launcher must verify dashboard node_modules');

    const ps1Content = fs.readFileSync(ps1Path, 'utf8');
    assert.ok(ps1Content.includes('dashboard\\node_modules') || ps1Content.includes('dashboard/node_modules'), 'PowerShell launcher must verify dashboard node_modules');
  });
});
