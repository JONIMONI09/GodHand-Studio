import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyClientLogLine,
  pickMinecraftWindowTitle,
  computeProgress,
  formatBytes,
  diagnoseJava,
  applyJavaFix,
  sanitizeGradleArgs
} from '../dashboard/lib/runtime.mjs';

describe('Minecraft Client (runClient) Bridge & Log Lifecycle', () => {
  it('correctly classifies all client lifecycle phases and fabric mod loads', () => {
    // Starting / Launching
    assert.strictEqual(classifyClientLogLine('[main/INFO]: Setting user: DevPlayer'), 'launching');
    assert.strictEqual(classifyClientLogLine('[Render thread/INFO]: Backend library: LWJGL 3.3.3'), 'launching');
    
    // Mod Loaded event
    assert.strictEqual(classifyClientLogLine('Loading 65 mods: - godhand 1.0.0'), 'modloaded');
    assert.strictEqual(classifyClientLogLine('GodHand Mod initialized successfully! Registered 14 items.'), 'modloaded');
    
    // Client Ready
    assert.strictEqual(classifyClientLogLine('[Render thread/INFO]: Sound engine started'), 'ready');
    assert.strictEqual(classifyClientLogLine('[Render thread/INFO]: Created: 1024x512x4 minecraft:textures/atlas/blocks.png-atlas'), 'ready');
    
    // Crash detection
    assert.strictEqual(classifyClientLogLine('---- Minecraft Crash Report ----'), 'crashed');
    assert.strictEqual(classifyClientLogLine('Minecraft has crashed! Exception in thread main'), 'crashed');
    assert.strictEqual(classifyClientLogLine('Game crashed! java.lang.NullPointerException'), 'crashed');
    
    // Non-lifecycle log lines
    assert.strictEqual(classifyClientLogLine('[INFO] Simple normal line'), null);
    assert.strictEqual(classifyClientLogLine(''), null);
    assert.strictEqual(classifyClientLogLine(null), null);
  });

  it('correctly extracts Minecraft window title from tasklist and raw strings', () => {
    assert.strictEqual(pickMinecraftWindowTitle('Minecraft* 1.21.1 - Singleplayer'), 'Minecraft* 1.21.1 - Singleplayer');
    assert.strictEqual(pickMinecraftWindowTitle('"javaw.exe","1234","Minecraft 1.21.1"'), 'Minecraft 1.21.1');
    assert.strictEqual(pickMinecraftWindowTitle('Chrome - Google'), null);
    assert.strictEqual(pickMinecraftWindowTitle(undefined), null);
  });

  it('safely validates runClient commands against shell injection', () => {
    assert.deepStrictEqual(sanitizeGradleArgs('runClient'), ['runClient']);
    assert.deepStrictEqual(sanitizeGradleArgs('./gradlew runClient --debug'), ['runClient', '--debug']);
    assert.throws(() => sanitizeGradleArgs('runClient && del C:\\*'), /Invalid/);
    assert.throws(() => sanitizeGradleArgs('runClient; echo evil'), /Invalid/);
  });
});

describe('SDK & JDK Download Progress Calculation', () => {
  it('computes accurate percentage without crashing on zero total', () => {
    assert.strictEqual(computeProgress(0, 100), 0);
    assert.strictEqual(computeProgress(50, 100), 50);
    assert.strictEqual(computeProgress(150, 100), 100);
    assert.strictEqual(computeProgress(10, 0), null);
    assert.strictEqual(computeProgress(-10, 100), 0);
    assert.strictEqual(computeProgress(NaN, 100), 0);
  });

  it('formats byte metrics for human readability', () => {
    assert.strictEqual(formatBytes(0), '0 B');
    assert.strictEqual(formatBytes(1024), '1.0 KB');
    assert.strictEqual(formatBytes(10 * 1024 * 1024), '10.0 MB');
    assert.strictEqual(formatBytes(195 * 1024 * 1024), '195.0 MB');
  });
});

describe('Automated Diagnostic Scanner (Auto-Scan Logic)', () => {
  it('detects syntax errors and typos automatically without user interaction', () => {
    const brokenJavaCode = `
package com.yourcompany.godhand;

pubilc class TestEntity extneds LivingEntity {
    privat int health = 20
    
    pubic viod heal() {
        Sytsem.out.pritnln("Healing player")
    }
}
`;
    const diagnostics = diagnoseJava(brokenJavaCode);
    assert.ok(diagnostics.length >= 5, `Expected >= 5 issues, found ${diagnostics.length}`);

    // Typos
    const typos = diagnostics.filter(d => d.type === 'typo');
    assert.ok(typos.some(t => t.typo === 'pubilc'));
    assert.ok(typos.some(t => t.typo === 'extneds'));
    assert.ok(typos.some(t => t.typo === 'pubic'));
    assert.ok(typos.some(t => t.typo === 'viod'));
    assert.ok(typos.some(t => t.typo === 'Sytsem'));
    assert.ok(typos.some(t => t.typo === 'pritnln'));

    // Semicolons
    const semicolons = diagnostics.filter(d => d.suggestedFix === ';');
    assert.ok(semicolons.length >= 2, 'Should detect missing semicolons on statements');
  });

  it('safely applies auto-fixes sequentially', () => {
    let code = 'pubilc class MyMod {';
    const fix1 = applyJavaFix(code, { line: 1, type: 'typo', typo: 'pubilc', suggestedFix: 'public' });
    assert.strictEqual(fix1, 'public class MyMod {');

    const fix2 = applyJavaFix(fix1, { line: 1, suggestedFix: '}' });
    assert.strictEqual(fix2, 'public class MyMod {\n}');
  });
});
