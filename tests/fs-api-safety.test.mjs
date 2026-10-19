import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// Mirroring server.js path resolution & validation
function resolveAndCheckPath(filePath, projectBase = '/mock/godhand') {
  if (!filePath || typeof filePath !== 'string') return null;
  const base = path.resolve(projectBase);
  const cleaned = filePath.replace(/^[/\\]+/, '');
  const fullPath = path.resolve(base, cleaned);
  if (!fullPath.startsWith(base)) return null;
  return fullPath;
}

function validateFolderMove(srcPath, destPath) {
  if (!srcPath || !destPath) return { valid: false, error: 'Paths required' };
  if (srcPath === destPath) return { valid: false, error: 'Same path' };
  // Check if moving into subfolder of itself
  if (destPath.startsWith(srcPath + '/')) {
    return { valid: false, error: 'Cannot move folder into own subfolder' };
  }
  return { valid: true };
}

function validateFileSize(contentString, maxBytes = 5 * 1024 * 1024) {
  const bytes = Buffer.byteLength(contentString, 'utf8');
  return bytes <= maxBytes;
}

describe('File System API Safety & Path Sanitization', () => {
  const BASE = path.resolve('/workspace/godhand');

  it('blocks path traversal attempts (.. / etc)', () => {
    assert.strictEqual(resolveAndCheckPath('../../etc/passwd', BASE), null);
    assert.strictEqual(resolveAndCheckPath('../../../root/.ssh/id_rsa', BASE), null);
    assert.strictEqual(resolveAndCheckPath('src/../../..', BASE), null);
    assert.strictEqual(resolveAndCheckPath('../outside.txt', BASE), null);
  });

  it('allows valid in-project paths with stripped leading slashes', () => {
    assert.strictEqual(resolveAndCheckPath('/src/main/Mod.java', BASE), path.resolve(BASE, 'src/main/Mod.java'));
    assert.strictEqual(resolveAndCheckPath('build.gradle', BASE), path.resolve(BASE, 'build.gradle'));
  });

  it('prevents folder moving into its own subfolder', () => {
    const invalidMove = validateFolderMove('src/main', 'src/main/sub/test');
    assert.strictEqual(invalidMove.valid, false);
    assert.strictEqual(invalidMove.error, 'Cannot move folder into own subfolder');

    const validMove = validateFolderMove('src/main/old', 'src/main/new');
    assert.strictEqual(validMove.valid, true);
  });

  it('enforces 5MB file upload quota', () => {
    const smallContent = 'Hello World!'.repeat(100);
    assert.strictEqual(validateFileSize(smallContent), true);

    const oversizedContent = 'X'.repeat(5 * 1024 * 1024 + 10);
    assert.strictEqual(validateFileSize(oversizedContent), false);
  });
});
