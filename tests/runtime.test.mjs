import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeGradleArgs, gradlewInvocation, buildJavaEnv, adoptiumUrl, computeProgress,
  formatBytes, classifyClientLogLine, pickMinecraftWindowTitle, diagnoseJava, applyJavaFix, detectJavaHome
} from '../dashboard/lib/runtime.mjs';

describe('sanitizeGradleArgs', () => {
  it('strips wrapper prefix and splits', () => {
    assert.deepEqual(sanitizeGradleArgs('./gradlew clean build -x test'), ['clean', 'build', '-x', 'test']);
    assert.deepEqual(sanitizeGradleArgs('gradlew.bat runClient'), ['runClient']);
    assert.deepEqual(sanitizeGradleArgs(['build', '--stacktrace']), ['build', '--stacktrace']);
  });
  it('rejects shell injection and empty input', () => {
    assert.throws(() => sanitizeGradleArgs('build && del /q *'), /Invalid/);
    assert.throws(() => sanitizeGradleArgs('build; rm -rf /'), /Invalid/);
    assert.throws(() => sanitizeGradleArgs('build $(whoami)'), /Invalid/);
    assert.throws(() => sanitizeGradleArgs('build |calc'), /Invalid/);
    assert.throws(() => sanitizeGradleArgs('-Pa=../../x'), /Invalid/);
    assert.throws(() => sanitizeGradleArgs('./gradlew'), /No Gradle task/);
    assert.throws(() => sanitizeGradleArgs(null), /must be/);
  });
});

describe('platform helpers', () => {
  it('uses gradlew.bat with shell on Windows', () => {
    const w = gradlewInvocation('C:\\proj', 'win32');
    assert.equal(w.shell, true);
    assert.match(w.command, /gradlew\.bat"$/);
    assert.equal(gradlewInvocation('/proj', 'linux').shell, false);
  });
  it('builds PATH with platform delimiter', () => {
    const win = buildJavaEnv('C:\\jdk', { Path: 'C:\\Windows' }, 'win32');
    assert.equal(win.Path, 'C:\\jdk\\bin;C:\\Windows');
    assert.equal(win.JAVA_HOME, 'C:\\jdk');
    const lin = buildJavaEnv('/jdk', { PATH: '/usr/bin' }, 'linux');
    assert.equal(lin.PATH, '/jdk/bin:/usr/bin');
  });
  it('returns null JDK home when none exists', () => {
    assert.equal(detectJavaHome({ env: {}, candidates: ['/definitely/missing'], jdkDir: '/nope' }), null);
  });
  it('maps adoptium URLs and rejects unknown platforms', () => {
    assert.match(adoptiumUrl('win32', 'x64'), /\/windows\/x64\/jdk\//);
    assert.match(adoptiumUrl('linux', 'arm64'), /\/linux\/aarch64\//);
    assert.throws(() => adoptiumUrl('aix', 'ppc'), /Unsupported/);
  });
  it('computes progress and formats bytes safely', () => {
    assert.equal(computeProgress(50, 200), 25);
    assert.equal(computeProgress(500, 200), 100);
    assert.equal(computeProgress(10, 0), null);
    assert.equal(computeProgress(NaN, 100), 0);
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1536), '1.5 KB');
  });
});

describe('client log classification', () => {
  it('detects lifecycle phases', () => {
    assert.equal(classifyClientLogLine('[main/INFO]: Setting user: Player123'), 'launching');
    assert.equal(classifyClientLogLine('Loading 54 mods: - godhand 1.0.0'), 'modloaded');
    assert.equal(classifyClientLogLine('GodHand Mod initialized successfully'), 'modloaded');
    assert.equal(classifyClientLogLine('[Render thread/INFO]: Sound engine started'), 'ready');
    assert.equal(classifyClientLogLine('---- Minecraft Crash Report ----'), 'crashed');
    assert.equal(classifyClientLogLine(''), null);
    assert.equal(classifyClientLogLine(undefined), null);
  });
  it('picks Minecraft window titles', () => {
    assert.equal(pickMinecraftWindowTitle('foo\r\nMinecraft* 1.21.1\r\n'), 'Minecraft* 1.21.1');
    assert.equal(pickMinecraftWindowTitle('Minecraft 1.21.1 - Singleplayer'), 'Minecraft 1.21.1 - Singleplayer');
    assert.equal(pickMinecraftWindowTitle('Notepad'), null);
    assert.equal(pickMinecraftWindowTitle(null), null);
  });
});

describe('diagnoseJava', () => {
  it('returns empty for valid code and non-strings', () => {
    const ok = 'package a;\n\npublic class A {\n  int x = 1;\n  String s = "{ not a brace";\n  // int y = 2\n  void f() {\n    call(a,\n      b);\n    int z = cond\n      ? 1 : 2;\n  }\n}\n';
    assert.deepEqual(diagnoseJava(ok), []);
    assert.deepEqual(diagnoseJava(null), []);
    assert.deepEqual(diagnoseJava(42), []);
  });
  it('finds typos, missing semicolons and braces', () => {
    const bad = 'pubilc class A {\n  int x = 1\n  void f() {\n';
    const d = diagnoseJava(bad);
    assert.ok(d.some(x => x.type === 'typo' && x.typo === 'pubilc'));
    assert.ok(d.some(x => x.line === 2 && x.suggestedFix === ';'));
    assert.ok(d.some(x => /2 missing closing/.test(x.message)));
  });
  it('detects unclosed strings and stray braces', () => {
    const d = diagnoseJava('class A {\n  String s = "abc;\n}\n}\n');
    assert.ok(d.some(x => /Unclosed string/.test(x.message)));
    assert.ok(d.some(x => /Extraneous/.test(x.message)));
  });
  it('ignores typos inside comments and strings', () => {
    assert.deepEqual(diagnoseJava('class A {\n  // pubilc\n  String s = "viod";\n  /* retunr */\n}\n'), []);
  });
});

describe('applyJavaFix', () => {
  it('applies typo, semicolon and brace fixes', () => {
    assert.equal(applyJavaFix('pubilc class A {}', { line: 1, type: 'typo', typo: 'pubilc', suggestedFix: 'public' }), 'public class A {}');
    assert.equal(applyJavaFix('int x = 1  ', { line: 1, suggestedFix: ';' }), 'int x = 1;');
    assert.equal(applyJavaFix('class A {', { line: 1, suggestedFix: '}' }), 'class A {\n}');
  });
  it('rejects invalid input and regex injection', () => {
    assert.equal(applyJavaFix('', { line: 1, suggestedFix: ';' }), null);
    assert.equal(applyJavaFix('a', { line: 5, suggestedFix: ';' }), null);
    assert.equal(applyJavaFix('a', { line: 1, type: 'typo', typo: '.*', suggestedFix: 'x' }), null);
    assert.equal(applyJavaFix('a', { line: 1, suggestedFix: 'rm' }), null);
  });
});
