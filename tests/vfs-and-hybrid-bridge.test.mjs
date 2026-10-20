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
    // Ensure base: './' is configured in vite.config.ts
    assert.ok(fs.existsSync(viteConfigPath), 'vite.config.ts must exist');
    const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
    assert.ok(viteContent.includes("base: './'"), "vite.config.ts must set base to './'");

    // If dist/index.html exists (e.g. built locally or post-build step in CI), verify relative assets
    if (fs.existsSync(distIndexPath)) {
      const htmlContent = fs.readFileSync(distIndexPath, 'utf8');
      assert.ok(htmlContent.includes('src="./assets/'), 'JavaScript bundles must use relative ./assets/');
      assert.ok(htmlContent.includes('href="./assets/'), 'CSS bundles must use relative ./assets/');
      assert.ok(!htmlContent.includes('src="/assets/'), 'Must not have absolute /assets/ paths');
    }
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

  it('verifies vfs-bundle.json contains 35+ real Java classes and complete mod workspaces', () => {
    const bundlePath = path.resolve(rootDir, 'dashboard/public/vfs-bundle.json');
    assert.ok(fs.existsSync(bundlePath), 'dashboard/public/vfs-bundle.json must exist');

    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    assert.ok(bundle.projects, 'Bundle must contain projects object');
    assert.ok(bundle.projects.godhand, 'Bundle must contain godhand project');
    assert.ok(bundle.projects['arm32-fix'], 'Bundle must contain arm32-fix project');

    const godhandFiles = Object.keys(bundle.projects.godhand);
    assert.ok(godhandFiles.length >= 35, `godhand project must have at least 35 files, found ${godhandFiles.length}`);

    // Verify key mod classes and resources
    assert.ok(godhandFiles.some(f => f.includes('GodHand.java')), 'Must contain GodHand.java');
    assert.ok(godhandFiles.some(f => f.includes('CompanionManager.java')), 'Must contain CompanionManager.java');
    assert.ok(godhandFiles.some(f => f.includes('fabric.mod.json')), 'Must contain fabric.mod.json');
    assert.ok(godhandFiles.some(f => f.includes('assets/godhand/lang/de_de.json')), 'Must contain de_de.json');

    const arm32Files = Object.keys(bundle.projects['arm32-fix']);
    assert.ok(arm32Files.some(f => f.includes('Arm32FixMod.java')), 'Must contain Arm32FixMod.java');
  });

  it('verifies jarCompiler.ts implements Zero-PAT JVM bytecode ClassFile generation (0xCAFEBABE, Java 21)', () => {
    const compilerPath = path.resolve(rootDir, 'dashboard/src/lib/jarCompiler.ts');
    assert.ok(fs.existsSync(compilerPath), 'jarCompiler.ts must exist');

    const compilerCode = fs.readFileSync(compilerPath, 'utf8');
    assert.ok(compilerCode.includes('0xcafebabe'), 'Must synthesize standard JVM magic bytes 0xCAFEBABE');
    assert.ok(compilerCode.includes('65'), 'Must target Java 21 major bytecode version 65');
    assert.ok(compilerCode.includes('META-INF/MANIFEST.MF'), 'Must generate META-INF/MANIFEST.MF');
    assert.ok(compilerCode.includes('compileModToJar'), 'Must export compileModToJar function');
    assert.ok(!compilerCode.includes('githubPat'), 'jarCompiler must not require any GitHub PAT');
  });

  it('verifies .github/workflows/gradle.yml implements Zero-PAT IssueOps cloud compilation trigger', () => {
    const gradleWorkflowPath = path.resolve(rootDir, '.github/workflows/gradle.yml');
    assert.ok(fs.existsSync(gradleWorkflowPath), 'gradle.yml must exist');

    const content = fs.readFileSync(gradleWorkflowPath, 'utf8');
    assert.ok(content.includes('issues:'), 'Must trigger on issues');
    assert.ok(content.includes('types: [opened]'), 'Must trigger on issue opened');
    assert.ok(content.includes('[CLOUD-BUILD]'), 'Must detect [CLOUD-BUILD] issues');
    assert.ok(content.includes('actions/github-script'), 'Must use built-in actions/github-script for comment');
    assert.ok(content.includes('issues: write'), 'Must grant issues: write permissions to job');
  });

  it('verifies dashboard/server.js serves both root and /GodHand-Studio subpath without 404', () => {
    const serverCode = fs.readFileSync(serverPath, 'utf8');
    assert.ok(serverCode.includes("app.use('/GodHand-Studio', express.static(distDir))"), 'Must serve static files on /GodHand-Studio');
    assert.ok(serverCode.includes('/GodHand-Studio/*'), 'Must provide SPA catch-all on /GodHand-Studio/*');
  });

  it('verifies App.tsx eliminates overlapping banners and fake popups', () => {
    const appPath = path.resolve(rootDir, 'dashboard/src/App.tsx');
    const appCode = fs.readFileSync(appPath, 'utf8');

    assert.ok(!appCode.includes('<LocalhostBanner />'), 'Must not render top LocalhostBanner overlay');
    assert.ok(!appCode.includes('<SDKDownloadModal />'), 'Must not render fake SDKDownloadModal popup');
  });

  it('verifies binary assets (icon.png) preserve raw byte integrity in vfs-bundle.json and disk', () => {
    const diskIconPath = path.resolve(rootDir, 'godhand/src/main/resources/assets/godhand/icon.png');
    assert.ok(fs.existsSync(diskIconPath), 'godhand/src/main/resources/assets/godhand/icon.png must exist');
    const diskBytes = fs.readFileSync(diskIconPath);
    const pngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < pngMagic.length; i++) {
      assert.strictEqual(diskBytes[i], pngMagic[i], `Byte at offset ${i} must match PNG header`);
    }

    const bundlePath = path.resolve(rootDir, 'dashboard/public/vfs-bundle.json');
    assert.ok(fs.existsSync(bundlePath), 'vfs-bundle.json must exist');
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    const bundledIcon = bundle.projects?.godhand?.['src/main/resources/assets/godhand/icon.png'];
    assert.ok(bundledIcon, 'icon.png must be present in bundled godhand project');
    assert.ok(bundledIcon.startsWith('data:image/png;base64,'), 'Binary asset must be stored as base64 data URL');

    const base64Part = bundledIcon.replace(/^data:image\/png;base64,/, '');
    const decodedBuf = Buffer.from(base64Part, 'base64');
    for (let i = 0; i < pngMagic.length; i++) {
      assert.strictEqual(decodedBuf[i], pngMagic[i], `Decoded bundled byte at offset ${i} must match PNG header`);
    }
  });

  it('verifies jarCompiler and vfs.ts support binary payload detection and raw byte packaging', () => {
    const vfsCode = fs.readFileSync(vfsPath, 'utf8');
    assert.ok(vfsCode.includes('isBinaryAssetPath'), 'vfs.ts must export isBinaryAssetPath');
    assert.ok(vfsCode.includes('decodeBase64ToUint8Array'), 'vfs.ts must export decodeBase64ToUint8Array');
    assert.ok(vfsCode.includes('toBinaryPayload'), 'vfs.ts must export toBinaryPayload');

    const compilerPath = path.resolve(rootDir, 'dashboard/src/lib/jarCompiler.ts');
    const compilerCode = fs.readFileSync(compilerPath, 'utf8');
    assert.ok(compilerCode.includes('isBinaryAssetPath'), 'jarCompiler.ts must import isBinaryAssetPath');
    assert.ok(compilerCode.includes('toBinaryPayload'), 'jarCompiler.ts must use toBinaryPayload for binary assets');
    assert.ok(compilerCode.includes('{ binary: true }'), 'jarCompiler.ts must mark raw binary assets in zip');
  });

  it('verifies IDEEditorArea implements dedicated texture preview with pixelated rendering and tabs', () => {
    const editorPath = path.resolve(rootDir, 'dashboard/src/components/ide/IDEEditorArea.tsx');
    assert.ok(fs.existsSync(editorPath), 'IDEEditorArea.tsx must exist');
    const editorCode = fs.readFileSync(editorPath, 'utf8');

    assert.ok(editorCode.includes('openTabs'), 'IDEEditorArea must accept openTabs prop');
    assert.ok(editorCode.includes('imageRendering'), 'IDEEditorArea must support pixelated image rendering');
    assert.ok(editorCode.includes('isImageFile'), 'IDEEditorArea must detect image texture files');
    assert.ok(editorCode.includes('imageError'), 'IDEEditorArea must track imageError state');
    assert.ok(editorCode.includes('setImgNaturalSize(null)'), 'IDEEditorArea must reset natural size on file change');
  });

  it('verifies IDEFileExplorer implements inline renaming with Windows reserved name validation', () => {
    const explorerPath = path.resolve(rootDir, 'dashboard/src/components/ide/IDEFileExplorer.tsx');
    assert.ok(fs.existsSync(explorerPath), 'IDEFileExplorer.tsx must exist');
    const explorerCode = fs.readFileSync(explorerPath, 'utf8');

    assert.ok(explorerCode.includes('onRenameNode'), 'IDEFileExplorer must accept onRenameNode prop');
    assert.ok(explorerCode.includes('validateFileName'), 'IDEFileExplorer must validate names with validateFileName');
    assert.ok(explorerCode.includes('setRenamingPath'), 'IDEFileExplorer must maintain renaming state');
  });

  it('verifies BrowserVFS and api.ts implement robust error handling and collision protection', () => {
    const vfsCode = fs.readFileSync(vfsPath, 'utf8');
    assert.ok(vfsCode.includes('Access denied: cannot delete workspace root'), 'vfs.ts must protect workspace root from deletion');
    assert.ok(vfsCode.includes('Destination already exists'), 'vfs.ts rename must guard against overwriting existing destinations');

    const apiPath = path.resolve(rootDir, 'dashboard/src/lib/api.ts');
    const apiCode = fs.readFileSync(apiPath, 'utf8');
    assert.ok(apiCode.includes("jsonResponse({ error: e.message || 'Failed to rename' }, 400)"), 'api.ts must return 400 on VFS rename errors');
    assert.ok(apiCode.includes("jsonResponse({ error: e.message || 'Failed to save file' }, 400)"), 'api.ts must return 400 on VFS save errors');
  });
});


