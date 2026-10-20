#!/usr/bin/env node

/**
 * Unified Local CI Verification Script for GodHand Studio
 * 
 * Executes all continuous integration checks locally before pushing:
 * 1. Virtual File System (VFS) bundle generation
 * 2. Dashboard TypeScript linting (tsc --noEmit)
 * 3. Dashboard Vite production build
 * 4. Node.js unit and integration test suites (node --test)
 * 5. Java / Loom Gradle build, tests, and jar remapping in godhand/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
GodHand Studio — Local CI Pipeline Orchestrator

Usage:
  node scripts/run-ci-local.mjs [options]
  npm run test:ci
  npm run test:ci:fast

Options:
  --fast          Skip remapping and run fast tests only
  --skip-gradle   Skip Java/Gradle build and test execution
  -h, --help      Show this help message
`);
  process.exit(0);
}

const skipGradle = args.includes('--skip-gradle');
const fastMode = args.includes('--fast');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function logStep(stepNum, totalSteps, title) {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}[Step ${stepNum}/${totalSteps}] ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);
}

function runCommand(command, cmdArgs, cwd, stepName) {
  const startTime = Date.now();
  console.log(`${colors.dim}> [${cwd}] ${command} ${cmdArgs.join(' ')}${colors.reset}\n`);

  const proc = spawnSync(command, cmdArgs, {
    cwd,
    stdio: 'inherit',
    shell: isWindows
  });

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(2);

  if (proc.error) {
    console.error(`\n${colors.red}❌ Error executing ${stepName}: ${proc.error.message}${colors.reset}`);
    return { success: false, durationSec, error: proc.error.message };
  }

  if (proc.status !== 0) {
    console.error(`\n${colors.red}❌ ${stepName} failed with exit code ${proc.status} (${durationSec}s)${colors.reset}`);
    return { success: false, durationSec, code: proc.status };
  }

  console.log(`\n${colors.green}✔ ${stepName} completed successfully in ${durationSec}s${colors.reset}`);
  return { success: true, durationSec };
}

async function main() {
  const overallStart = Date.now();
  console.log(`\n${colors.bold}${colors.yellow}⚡ GodHand Studio — Local CI Pipeline Verification${colors.reset}`);
  console.log(`${colors.dim}Root Directory: ${rootDir}${colors.reset}`);
  console.log(`${colors.dim}Platform: ${process.platform} (${process.arch}) | Node: ${process.version}${colors.reset}`);
  if (skipGradle) {
    console.log(`${colors.yellow}⚠️  --skip-gradle flag detected: Gradle steps will be skipped.${colors.reset}`);
  }

  const results = [];
  const totalSteps = skipGradle ? 4 : 5;
  let currentStep = 1;

  // 1. Generate VFS Bundle
  logStep(currentStep++, totalSteps, 'Generate VFS In-Browser Bundle');
  const stepVfs = runCommand(
    process.execPath,
    ['scripts/generate-vfs-bundle.mjs'],
    rootDir,
    'VFS Bundle Generation'
  );
  results.push({ name: '1. VFS Bundle Generation', ...stepVfs });
  if (!stepVfs.success) finishAndExit(results, overallStart);

  // 2. TypeScript Linting Check
  logStep(currentStep++, totalSteps, 'Dashboard TypeScript Linting (tsc --noEmit)');
  const stepLint = runCommand(
    isWindows ? 'npm.cmd' : 'npm',
    ['run', 'lint', '--prefix', 'dashboard'],
    rootDir,
    'Dashboard TypeScript Linting'
  );
  results.push({ name: '2. Dashboard TypeScript Linting', ...stepLint });
  if (!stepLint.success) finishAndExit(results, overallStart);

  // 3. Web IDE Production Build
  logStep(currentStep++, totalSteps, 'Dashboard Production Build (Vite)');
  const stepBuild = runCommand(
    isWindows ? 'npm.cmd' : 'npm',
    ['run', 'build', '--prefix', 'dashboard'],
    rootDir,
    'Dashboard Vite Build'
  );
  results.push({ name: '3. Dashboard Production Build', ...stepBuild });
  if (!stepBuild.success) finishAndExit(results, overallStart);

  // 4. Node.js Automated Test Suites
  logStep(currentStep++, totalSteps, 'Automated Test Suites (node --test tests/*.test.mjs)');
  const stepTests = runCommand(
    process.execPath,
    ['--test', 'tests/*.test.mjs'],
    rootDir,
    'Node.js Test Suites'
  );
  results.push({ name: '4. Node.js Test Suites', ...stepTests });
  if (!stepTests.success) finishAndExit(results, overallStart);

  // 5. Java / Gradle Tests & Remapping
  if (!skipGradle) {
    logStep(currentStep++, totalSteps, 'Java / Gradle Tests & remapJar (godhand/)');
    const godhandDir = path.resolve(rootDir, 'godhand');
    const gradlewCmd = isWindows
      ? path.resolve(godhandDir, 'gradlew.bat')
      : path.resolve(godhandDir, 'gradlew');

    if (!isWindows) {
      try {
        fs.chmodSync(gradlewCmd, 0o755);
      } catch {
        // Continue even if chmod fails
      }
    }

    const gradleArgs = fastMode
      ? ['test', '--warning-mode', 'none']
      : ['test', 'remapJar', '--warning-mode', 'none'];

    const stepGradle = runCommand(
      gradlewCmd,
      gradleArgs,
      godhandDir,
      'Gradle test & remapJar'
    );
    results.push({ name: '5. Gradle test & remapJar', ...stepGradle });
    if (!stepGradle.success) finishAndExit(results, overallStart);
  }

  finishAndExit(results, overallStart);
}

function finishAndExit(results, overallStart) {
  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const allPassed = results.every(r => r.success);

  console.log(`\n${colors.bold}======================================================================${colors.reset}`);
  console.log(`${colors.bold}Local CI Verification Summary (Total Time: ${totalDuration}s)${colors.reset}`);
  console.log(`${colors.bold}======================================================================${colors.reset}`);

  for (const res of results) {
    const badge = res.success ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(` ${badge}  ${res.name.padEnd(38)} (${res.durationSec}s)`);
  }
  console.log(`${colors.bold}======================================================================${colors.reset}\n`);

  if (allPassed) {
    console.log(`${colors.bold}${colors.green}🎉 ALL LOCAL CI CHECKS PASSED! Ready for push / PR.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.bold}${colors.red}❌ CI VERIFICATION FAILED! Please resolve errors above.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal unhandled error:', err);
  process.exit(1);
});
