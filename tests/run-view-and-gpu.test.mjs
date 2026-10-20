import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load pure ESM helpers for unit testing
import { detectGpuSupport, getGpuTooltip } from '../dashboard/lib/gpuDetection.mjs';
import { createCiSession, parseCiSessionFromComment } from '../dashboard/lib/ciSession.mjs';

describe('Run Progress View, GPU Hardware Acceleration & IssueOps Test Suite', () => {
  const rootDir = path.resolve('.');

  describe('GPU & WebGL Hardware Detection Logic', () => {
    it('gracefully handles headless Node.js environment without throwing', () => {
      const gpu = detectGpuSupport();
      assert.strictEqual(gpu.supported, false);
      assert.strictEqual(gpu.isSoftware, true);
      assert.strictEqual(gpu.webglVersion, null);
      assert.ok(gpu.error?.includes('Headless'));
    });

    it('generates informative bilingual tooltips', () => {
      const softwareGpu = {
        supported: false,
        renderer: 'Google SwiftShader (CPU Software)',
        vendor: 'Google Inc.',
        isSoftware: true,
        webglVersion: 'webgl2',
        error: 'Software rasterizer detected'
      };

      const tipDe = getGpuTooltip('de', softwareGpu);
      const tipEn = getGpuTooltip('en', softwareGpu);

      assert.ok(tipDe.includes('GPU-Hardwarebeschleunigung') || tipDe.includes('WebGL'));
      assert.ok(tipDe.includes('Google SwiftShader'));
      assert.ok(tipEn.includes('Hardware GPU acceleration') || tipEn.includes('WebGL'));
      assert.ok(tipEn.includes('Google SwiftShader'));

      const hardwareGpu = {
        supported: true,
        renderer: 'NVIDIA GeForce RTX 4090',
        vendor: 'NVIDIA Corporation',
        isSoftware: false,
        webglVersion: 'webgl2'
      };

      const tipHwDe = getGpuTooltip('de', hardwareGpu);
      const tipHwEn = getGpuTooltip('en', hardwareGpu);
      assert.ok(tipHwDe.includes('NVIDIA GeForce RTX 4090'));
      assert.ok(tipHwEn.includes('NVIDIA GeForce RTX 4090'));
    });
  });

  describe('CI Session Bridge & Machine-Readable IssueOps Parsing', () => {
    it('creates initialized CI session with unique ID and build/task tag log', () => {
      const session = createCiSession('godhand');
      assert.ok(session.id.startsWith('ci-'));
      assert.strictEqual(session.targetMod, 'godhand');
      assert.strictEqual(session.status, 'pending');
      assert.ok(session.logs.some(l => l.includes('build, task')));
    });

    it('accurately parses structured machine comment from GitHub Actions workflow', () => {
      const sampleComment = `
### 🚀 GodHand Studio Cloud Build Result

Compilation finished for mod **godhand**!
Artifact is available for download.

<!-- GODHAND_CI_SESSION: {"status": "success", "runId": "12345678", "artifactUrl": "https://github.com/JONIMONI09/GodHand-Studio/actions/runs/12345678/artifacts", "issueNumber": 42} -->
      `;

      const parsed = parseCiSessionFromComment(sampleComment);
      assert.ok(parsed);
      assert.strictEqual(parsed.status, 'success');
      assert.strictEqual(parsed.runId, '12345678');
      assert.strictEqual(parsed.artifactUrl, 'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/12345678/artifacts');
      assert.strictEqual(parsed.issueNumber, 42);
    });

    it('correctly parses failure comments and fallback heuristics', () => {
      const failComment = `
<!-- GODHAND_CI_SESSION: {"status": "failure", "runId": "99999", "issueNumber": 43} -->
      `;
      const parsedFail = parseCiSessionFromComment(failComment);
      assert.ok(parsedFail);
      assert.strictEqual(parsedFail.status, 'failed');
      assert.strictEqual(parsedFail.runId, '99999');

      const heuristicComment = 'Cloud Build completed ✅ with success! See https://github.com/JONIMONI09/GodHand-Studio/actions/runs/55555';
      const parsedHeuristic = parseCiSessionFromComment(heuristicComment);
      assert.ok(parsedHeuristic);
      assert.strictEqual(parsedHeuristic.status, 'success');
      assert.strictEqual(parsedHeuristic.runId, '55555');

      assert.strictEqual(parseCiSessionFromComment(''), null);
      assert.strictEqual(parseCiSessionFromComment('Irrelevant comment text'), null);
    });
  });

  describe('IssueOps Workflow & UI Integration Contract', () => {
    it('verifies .github/workflows/gradle.yml automatically labels IssueOps runs with [build, task] and guards non-build issues', () => {
      const workflowPath = path.resolve(rootDir, '.github/workflows/gradle.yml');
      assert.ok(fs.existsSync(workflowPath), 'gradle.yml must exist');
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');

      assert.ok(workflowContent.includes("labels: ['build', 'task']"), 'Workflow must apply [build, task] labels');
      assert.ok(workflowContent.includes('<!-- GODHAND_CI_SESSION:'), 'Workflow must emit structured CI session comment');
      assert.ok(workflowContent.includes("contains(github.event.issue.title, '[CLOUD-BUILD]')"), 'Workflow must guard Label Issue and Comment against regular non-build issues');
      assert.ok(workflowContent.includes('mods/$TARGET'), 'Workflow must resolve sub-mods inside mods/ directory');
    });

    it('verifies IDEHeader triggers GitHub Issue with labels=build,task parameter and focuses active runs', () => {
      const headerPath = path.resolve(rootDir, 'dashboard/src/components/ide/IDEHeader.tsx');
      assert.ok(fs.existsSync(headerPath), 'IDEHeader.tsx must exist');
      const headerContent = fs.readFileSync(headerPath, 'utf8');

      assert.ok(headerContent.includes('labels=build,task'), 'IDEHeader must pass labels=build,task in Issue URL');
      assert.ok(headerContent.includes('GODHAND_CI_SESSION'), 'IDEHeader must embed session metadata in Issue template');
      assert.ok(headerContent.includes('hasActiveRun || isBuilding'), 'IDEHeader must implement active run focus mode');
    });

    it('verifies Dedicated Run Progress View and Multi-View integration in Editor Area', () => {
      const runViewPath = path.resolve(rootDir, 'dashboard/src/components/ide/IDERunProgressView.tsx');
      const editorAreaPath = path.resolve(rootDir, 'dashboard/src/components/ide/IDEEditorArea.tsx');
      const appPath = path.resolve(rootDir, 'dashboard/src/App.tsx');
      const consolePath = path.resolve(rootDir, 'dashboard/src/components/ide/IDEConsole.tsx');
      const localhostBannerPath = path.resolve(rootDir, 'dashboard/src/components/LocalhostBanner.tsx');
      const statusBarPath = path.resolve(rootDir, 'dashboard/src/components/ide/IDETaskStatusBar.tsx');

      assert.ok(fs.existsSync(runViewPath), 'IDERunProgressView.tsx must exist');
      assert.ok(fs.existsSync(editorAreaPath), 'IDEEditorArea.tsx must exist');
      assert.ok(fs.existsSync(consolePath), 'IDEConsole.tsx must exist');

      const runViewContent = fs.readFileSync(runViewPath, 'utf8');
      assert.ok(runViewContent.includes('export const IDERunProgressView'), 'Must export IDERunProgressView component');
      assert.ok(runViewContent.includes('PipelineStep'), 'Must export PipelineStep interface');
      assert.ok(runViewContent.includes('RunArtifact'), 'Must export RunArtifact interface');

      const editorAreaContent = fs.readFileSync(editorAreaPath, 'utf8');
      assert.ok(editorAreaContent.includes('centerView === \'run\''), 'IDEEditorArea must support run view mode');
      assert.ok(editorAreaContent.includes('centerView === \'gameplay\''), 'IDEEditorArea must support gameplay view mode');

      const appContent = fs.readFileSync(appPath, 'utf8');
      assert.ok(appContent.includes('h-[100dvh]'), 'App.tsx must use 100dvh for mobile safe-area responsiveness');
      assert.ok(appContent.includes('onToggleRunView'), 'App.tsx must wire onToggleRunView to IDEHeader');
      assert.ok(appContent.includes('diagnoseJava(code)'), 'App.tsx must use diagnoseJava for typo fixes');

      const consoleContent = fs.readFileSync(consolePath, 'utf8');
      assert.ok(consoleContent.includes('activeCompileStep'), 'IDEConsole must parse and track active compilation steps');

      const localhostBannerContent = fs.readFileSync(localhostBannerPath, 'utf8');
      assert.ok(!localhostBannerContent.includes('handleRedirectLocalhost'), 'LocalhostBanner must not have localhost redirect');

      const statusBarContent = fs.readFileSync(statusBarPath, 'utf8');
      assert.ok(!statusBarContent.includes('handleConnectLocalhost'), 'IDETaskStatusBar must not have localhost redirect button');
    });
  });
});
