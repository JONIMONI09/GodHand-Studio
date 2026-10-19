import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';

function sanitizeCommitMessage(message) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Commit message is required');
  }
  return message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
}

function validateBranchName(branch) {
  if (!branch || typeof branch !== 'string') return false;
  const trimmed = branch.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  // Branch names cannot start or end with slash, cannot contain spaces, ~, ^, :, ?, *, [, \, or ..
  const invalidChars = /[\s~^:?*\[\]\\@]|\.\.|\/\/|^[\/\.]|[\/\.]$/;
  return !invalidChars.test(trimmed);
}

function sanitizeAuthor(name) {
  if (!name || typeof name !== 'string') return null;
  const cleaned = name.trim();
  if (/^[a-zA-Z0-9_\-\.\s]+$/.test(cleaned)) {
    return cleaned.replace(/"/g, '');
  }
  return null;
}

function isValidCommitHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  return /^[a-zA-Z0-9]{6,40}$/.test(hash.trim());
}

function resolveCommitFlag(isClean, allowEmpty) {
  return (isClean || allowEmpty) ? '--allow-empty' : '';
}

function validateDiscardFilePath(filePath, projectBase = '/mock/godhand') {
  if (!filePath || typeof filePath !== 'string') return null;
  const safeFile = filePath.replace(/["$`\\]/g, '');
  const base = path.resolve(projectBase);
  const resolved = path.resolve(base, safeFile);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return safeFile;
}

import path from 'node:path';

describe('Git Studio Security and Input Validation', () => {
  it('rejects empty or whitespace commit messages', () => {
    assert.throws(() => sanitizeCommitMessage(''), /Commit message is required/);
    assert.throws(() => sanitizeCommitMessage('   '), /Commit message is required/);
    assert.throws(() => sanitizeCommitMessage(null), /Commit message is required/);
  });

  it('escapes quotes and shell expansion in commit messages', () => {
    const raw = 'Fix issue with $(whoami) and "quotes"';
    const safe = sanitizeCommitMessage(raw);
    assert.strictEqual(safe, 'Fix issue with \\$(whoami) and \\"quotes\\"');
  });

  it('validates branch names correctly', () => {
    assert.strictEqual(validateBranchName('feature/awesome-mod'), true);
    assert.strictEqual(validateBranchName('dev-2.0'), true);
    assert.strictEqual(validateBranchName('main'), true);

    // Invalid branches
    assert.strictEqual(validateBranchName('branch with spaces'), false);
    assert.strictEqual(validateBranchName('bad..branch'), false);
    assert.strictEqual(validateBranchName('/starts-with-slash'), false);
    assert.strictEqual(validateBranchName('ends-with-slash/'), false);
    assert.strictEqual(validateBranchName('bad~char'), false);
    assert.strictEqual(validateBranchName('bad^char'), false);
  });

  it('sanitizes git author fields', () => {
    assert.strictEqual(sanitizeAuthor('Dev User'), 'Dev User');
    assert.strictEqual(sanitizeAuthor('Dev; rm -rf /'), null);
    assert.strictEqual(sanitizeAuthor('hacker$(id)'), null);
  });

  it('handles empty working tree with --allow-empty flag', () => {
    assert.strictEqual(resolveCommitFlag(true, false), '--allow-empty');
    assert.strictEqual(resolveCommitFlag(false, true), '--allow-empty');
    assert.strictEqual(resolveCommitFlag(false, false), '');
  });

  it('validates commit hash format for restore & checkout', () => {
    assert.strictEqual(isValidCommitHash('019a5e6'), true);
    assert.strictEqual(isValidCommitHash('019a5e6ee75641431648b619875a3c8a67c1326c'), true);
    assert.strictEqual(isValidCommitHash('short'), false);
    assert.strictEqual(isValidCommitHash('019a5e6; rm -rf /'), false);
    assert.strictEqual(isValidCommitHash('../master'), false);
  });

  it('safely checks discard file paths against path traversal', () => {
    const BASE = '/mock/godhand';
    assert.strictEqual(validateDiscardFilePath('src/main/Mod.java', BASE), 'src/main/Mod.java');
    assert.strictEqual(validateDiscardFilePath('../../etc/passwd', BASE), null);
    assert.strictEqual(validateDiscardFilePath('`touch evil`', BASE), 'touch evil');
  });
});
