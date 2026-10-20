import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveModVersion,
  resolveArchivesBaseName,
  extractGradleProp,
  expandManifestTokens,
  cleanActionsUrl
} from '../dashboard/lib/modVersion.mjs';
import { parseCiSessionFromComment, createCiSession } from '../dashboard/lib/ciSession.mjs';
import { diagnoseJava } from '../dashboard/lib/runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('SemVer Template Resolution & Manifest Token Expansion Suite', () => {
  it('resolves ${version} template placeholder to concrete mod_version in gradle.properties', () => {
    const gradleProps = `
# Fabric Mod Properties
minecraft_version=1.21.1
yarn_mappings=1.21.1+build.3
loader_version=0.16.5
mod_version=1.0.0
maven_group=com.godhand.arm32fix
archives_base_name=arm32-fix
    `;

    const version = resolveModVersion('${version}', gradleProps);
    assert.strictEqual(version, '1.0.0', 'Must resolve ${version} to 1.0.0 from gradle.properties');
    assert.ok(!version.includes('${'), 'Resolved version must never contain template braces');
  });

  it('resolves ${mod_version} and version variants from gradle.properties', () => {
    const gradleProps1 = 'mod_version=2.4.1-alpha';
    assert.strictEqual(resolveModVersion('${mod_version}', gradleProps1), '2.4.1-alpha');

    const gradleProps2 = 'version = 3.0.0';
    assert.strictEqual(resolveModVersion('${version}', gradleProps2), '3.0.0');

    const gradleProps3 = 'modVersion=1.5.2';
    assert.strictEqual(resolveModVersion('${version}', gradleProps3), '1.5.2');
  });

  it('preserves concrete versions and does not overwrite non-template strings', () => {
    const concrete = '2.1.0';
    assert.strictEqual(resolveModVersion(concrete, 'mod_version=1.0.0'), '2.1.0');
    assert.strictEqual(resolveModVersion('0.9.5-rc1', undefined), '0.9.5-rc1');
  });

  it('safely falls back to 1.0.0 when version is missing or gradle.properties is empty', () => {
    assert.strictEqual(resolveModVersion(undefined, undefined), '1.0.0');
    assert.strictEqual(resolveModVersion('${version}', ''), '1.0.0');
    assert.strictEqual(resolveModVersion('', '# only comments\n'), '1.0.0');
  });

  it('resolves archivesBaseName and falls back to modId cleanly', () => {
    const gradleProps = 'archives_base_name = arm32-fix\nmod_version=1.0.0';
    assert.strictEqual(resolveArchivesBaseName('arm32fix', gradleProps), 'arm32-fix');

    const camelProps = 'archivesBaseName = custom-mod-name';
    assert.strictEqual(resolveArchivesBaseName('custommod', camelProps), 'custom-mod-name');

    assert.strictEqual(resolveArchivesBaseName('my-mod', undefined), 'my-mod');
  });

  it('extracts custom properties from gradle.properties safely', () => {
    const gradleProps = `
minecraft_version=1.21.1
loader_version=0.16.5
    `;
    assert.strictEqual(extractGradleProp(gradleProps, 'minecraft_version'), '1.21.1');
    assert.strictEqual(extractGradleProp(gradleProps, 'loader_version'), '0.16.5');
    assert.strictEqual(extractGradleProp(gradleProps, 'unknown_prop', 'default'), 'default');
  });

  it('expands all template tokens in fabric.mod.json manifest resources', () => {
    const template = JSON.stringify({
      schemaVersion: 1,
      id: "arm32fix",
      version: "${version}",
      name: "ARM32 Hardware Alignment Fix",
      depends: {
        minecraft: ">=${minecraft_version}"
      }
    }, null, 2);

    const expanded = expandManifestTokens(template, {
      version: '1.0.0',
      minecraftVersion: '1.21.1',
      modId: 'arm32-fix'
    });

    assert.ok(!expanded.includes('${version}'), 'Must not contain literal ${version}');
    assert.ok(!expanded.includes('${minecraft_version}'), 'Must not contain literal ${minecraft_version}');
    assert.ok(expanded.includes('"version": "1.0.0"'), 'Must contain expanded "1.0.0"');
    assert.ok(expanded.includes('>=1.21.1'), 'Must contain expanded ">=1.21.1"');
  });
});

describe('GitHub Actions Run URL Sanitization & 404 Prevention Suite', () => {
  it('strips invalid /artifacts suffix to prevent GitHub Actions 404 Not Found', () => {
    const brokenUrl = 'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/39402999304/artifacts';
    const clean = cleanActionsUrl(brokenUrl);
    assert.strictEqual(
      clean,
      'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/39402999304',
      'Must strip /artifacts from actions run URL'
    );

    const trailingSlashUrl = 'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/12345/artifacts/';
    assert.strictEqual(
      cleanActionsUrl(trailingSlashUrl),
      'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/12345'
    );
  });

  it('preserves valid Actions run and GitHub Releases download URLs', () => {
    const validRun = 'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/987654321';
    assert.strictEqual(cleanActionsUrl(validRun), validRun);

    const releaseUrl = 'https://github.com/JONIMONI09/GodHand-Studio/releases/download/v1.0.0/arm32-fix-1.0.0.jar';
    assert.strictEqual(cleanActionsUrl(releaseUrl), releaseUrl);

    assert.strictEqual(cleanActionsUrl(''), undefined);
    assert.strictEqual(cleanActionsUrl(undefined), undefined);

    const subpathUrl = 'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/39402999304/artifacts/12256436631?check_suite_focus=true';
    assert.strictEqual(
      cleanActionsUrl(subpathUrl),
      'https://github.com/JONIMONI09/GodHand-Studio/actions/runs/39402999304',
      'Must strip subpaths and query strings on /artifacts'
    );
  });

  it('guarantees parseCiSessionFromComment sanitizes artifactDownloadUrl against 404', () => {
    const commentWithArtifacts = `
<!-- GODHAND_CI_SESSION: {"status": "success", "runId": "39402999304", "artifactUrl": "https://github.com/JONIMONI09/GodHand-Studio/actions/runs/39402999304/artifacts", "issueNumber": 10} -->
    `;
    const parsed = parseCiSessionFromComment(commentWithArtifacts, 'arm32-fix');
    assert.ok(parsed);
    assert.strictEqual(parsed.status, 'success');
    assert.strictEqual(parsed.runId, '39402999304');
    assert.ok(
      !parsed.artifactDownloadUrl.includes('/artifacts'),
      'artifactDownloadUrl must not have /artifacts suffix'
    );
    assert.ok(
      parsed.artifactDownloadUrl.includes('releases/download/latest/arm32-fix-1.0.0.jar') ||
      parsed.artifactDownloadUrl.includes('actions/runs/39402999304'),
      'Must resolve to a valid direct download or run overview URL'
    );
  });

  it('verifies .github/workflows/gradle.yml does not append /artifacts and triggers release on IssueOps', () => {
    const workflowPath = path.resolve(rootDir, '.github/workflows/gradle.yml');
    assert.ok(fs.existsSync(workflowPath), 'Workflow file must exist');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(!content.includes('${context.runId}/artifacts'), 'Workflow must not append /artifacts to context.runId');
    assert.ok(content.includes('${context.runId}'), 'Workflow must use valid Actions run URL');
    assert.ok(content.includes('releases/download/latest'), 'Workflow must link direct public release downloads');
    assert.ok(content.includes('[CLOUD-BUILD]'), 'Workflow must handle [CLOUD-BUILD] issue triggers');
  });
});

describe('Token-Free GitHub Releases URL Resolution & Path Sanitization Suite', () => {
  it('resolves direct public token-free release URLs for arm32-fix and godhand', async () => {
    const { resolveReleaseDownloadUrl } = await import('../dashboard/lib/modVersion.mjs');
    const arm32Url = resolveReleaseDownloadUrl('arm32-fix', '1.0.0');
    assert.strictEqual(arm32Url, 'https://github.com/JONIMONI09/GodHand-Studio/releases/download/latest/arm32-fix-1.0.0.jar');

    const nestedArm32 = resolveReleaseDownloadUrl('mods/arm32-fix', '1.0.0');
    assert.strictEqual(nestedArm32, 'https://github.com/JONIMONI09/GodHand-Studio/releases/download/latest/arm32-fix-1.0.0.jar');

    const godhandUrl = resolveReleaseDownloadUrl('godhand', '1.0.0');
    assert.strictEqual(godhandUrl, 'https://github.com/JONIMONI09/GodHand-Studio/releases/download/latest/godhand-1.0.0.jar');
  });

  it('strips directory prefixes (mods/) and slashes from archives base name', () => {
    assert.strictEqual(resolveArchivesBaseName('mods/arm32-fix', undefined), 'arm32-fix');
    assert.strictEqual(resolveArchivesBaseName('mods\\arm32-fix', undefined), 'arm32-fix');
    assert.strictEqual(resolveArchivesBaseName('mods/custom-mod/', undefined), 'custom-mod');
  });

  it('handles quotes, inline comments, colon separators, and project.version in gradle.properties', () => {
    const props = `
# Java Properties Format
mod_version: "2.5.0" # release tag
archives_base_name: "custom-mod" // archive name
project.version = '3.1.4'
    `;
    assert.strictEqual(resolveModVersion('${version}', props), '2.5.0', 'Must strip quotes and inline comments');
    assert.strictEqual(resolveArchivesBaseName('fallback', props), 'custom-mod', 'Must strip quotes and comments from archivesBaseName');

    const projectProps = 'project.version = 4.0.0\n';
    assert.strictEqual(resolveModVersion('${version}', projectProps), '4.0.0');
  });

  it('ensures expandManifestTokens wipes out any custom version placeholders', () => {
    const raw = '{"version": "${custom_mod_version}", "mc": "${minecraft_version}"}';
    const clean = expandManifestTokens(raw, { version: '1.2.3', minecraftVersion: '1.21.1' });
    assert.ok(!clean.includes('${custom_mod_version}'));
    assert.ok(clean.includes('"version": "1.2.3"'));
  });
});

describe('AST Syntax Checking Integration Suite', () => {
  it('catches typos, unclosed strings, and missing semicolons in Java code before compilation', () => {
    const brokenJava = `
package com.godhand.arm32fix;

pubilc class Arm32FixMod {
    viod initialize() {
        int x = 5
    }
}
    `;

    const diags = diagnoseJava(brokenJava);
    assert.ok(diags.length > 0, 'Must detect syntax errors');

    const typo = diags.find(d => d.typo === 'pubilc');
    assert.ok(typo, 'Must detect keyword typo pubilc');
    assert.strictEqual(typo.suggestedFix, 'public');

    const viodTypo = diags.find(d => d.typo === 'viod');
    assert.ok(viodTypo, 'Must detect keyword typo viod');
    assert.strictEqual(viodTypo.suggestedFix, 'void');
  });

  it('passes completely clean Java code without false positives', () => {
    const validJava = `
package com.godhand.arm32fix;

public class Arm32FixMod {
    public void initialize() {
        int x = 5;
    }
}
    `;

    const diags = diagnoseJava(validJava);
    assert.strictEqual(diags.length, 0, 'Valid code must produce 0 diagnostic errors');
  });
});
