#!/usr/bin/env node
/**
 * GodHand GitHub Sync & PR Automation Engine
 * Supports direct token push, git bundle packaging, and PR link generation for:
 * https://github.com/JONIMONI09/Java_IDE.git
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const REPO_URL = 'https://github.com/JONIMONI09/Java_IDE.git';
const BRANCH_NAME = 'feature/admin-arm32-and-responsive-ide';

console.log('\x1b[36m%s\x1b[0m', '=======================================================');
console.log('\x1b[1m\x1b[35m%s\x1b[0m', '        🚀 GodHand GitHub Sync & PR Engine 🚀          ');
console.log('\x1b[36m%s\x1b[0m', '=======================================================');

export function createGitBundle() {
  const bundlePath = path.join(ROOT_DIR, 'export-godhand.bundle');
  try {
    execSync(`git bundle create "${bundlePath}" --all`, { cwd: ROOT_DIR, stdio: 'pipe' });
    const stat = fs.statSync(bundlePath);
    console.log(`\x1b[32m✔\x1b[0m Created Git Bundle: export-godhand.bundle (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    return { success: true, path: bundlePath, size: stat.size };
  } catch (err) {
    console.error('\x1b[31m✖ Failed to create git bundle:\x1b[0m', err.message);
    return { success: false, error: err.message };
  }
}

export function pushToRemote(token) {
  if (!token) {
    return {
      success: false,
      message: 'No GitHub Personal Access Token provided. Use Git Studio or supply GITHUB_TOKEN environment variable.'
    };
  }

  try {
    const authedUrl = `https://${token}@github.com/JONIMONI09/Java_IDE.git`;
    console.log(`\x1b[34mℹ\x1b[0m Pushing branch ${BRANCH_NAME} to GitHub...`);
    execSync(`git push "${authedUrl}" "${BRANCH_NAME}:${BRANCH_NAME}" --force`, {
      cwd: ROOT_DIR,
      stdio: 'pipe'
    });
    const prUrl = `https://github.com/JONIMONI09/Java_IDE/pull/new/${BRANCH_NAME}`;
    console.log(`\x1b[32m✔\x1b[0m Successfully pushed to GitHub!`);
    console.log(`\x1b[36m🔗 Open PR URL:\x1b[0m ${prUrl}`);
    return { success: true, prUrl, branch: BRANCH_NAME };
  } catch (err) {
    console.error('\x1b[31m✖ Git push failed:\x1b[0m', err.message);
    return { success: false, error: err.message };
  }
}

// CLI execution
if (process.argv[1]?.endsWith('github-sync.mjs')) {
  const token = process.env.GITHUB_TOKEN || process.argv[2];
  if (token) {
    pushToRemote(token);
  } else {
    createGitBundle();
    console.log(`\n\x1b[33mTo push directly, run:\x1b[0m`);
    console.log(`  node scripts/github-sync.mjs <YOUR_GITHUB_PAT_TOKEN>`);
    console.log(`\n\x1b[33mOr to clone from the offline bundle:\x1b[0m`);
    console.log(`  git clone export-godhand.bundle GodHand-Repo`);
  }
}
