import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeGradleArgs, classifyClientLogLine, pickMinecraftWindowTitle } from '../dashboard/lib/runtime.mjs';

test('RunClient Gameplay & WebAssembly Lifecycle Suite', async (t) => {
  await t.test('safely validates runClient commands against shell injection', () => {
    assert.deepEqual(sanitizeGradleArgs('./gradlew runClient'), ['runClient']);
    assert.deepEqual(sanitizeGradleArgs('runClient --info'), ['runClient', '--info']);
    assert.throws(() => sanitizeGradleArgs('runClient; rm -rf /'), /Invalid Gradle argument/);
    assert.throws(() => sanitizeGradleArgs('runClient & whoami'), /Invalid Gradle argument/);
  });

  await t.test('correctly parses Minecraft client log lifecycle', () => {
    assert.equal(classifyClientLogLine('[FabricLoader] Loading 42 mods including godhand'), 'modloaded');
    assert.equal(classifyClientLogLine('Setting user: DevUser'), 'launching');
    assert.equal(classifyClientLogLine('Sound engine started'), 'ready');
    assert.equal(classifyClientLogLine('Minecraft has crashed!'), 'crashed');
    assert.equal(classifyClientLogLine('Uncaught exception in thread main'), 'error');
  });

  await t.test('detects Minecraft window title from tasklist and raw output', () => {
    assert.equal(pickMinecraftWindowTitle('Minecraft 1.21.1 - Singleplayer'), 'Minecraft 1.21.1 - Singleplayer');
    assert.equal(pickMinecraftWindowTitle('Minecraft 1.21.1'), 'Minecraft 1.21.1');
    assert.equal(pickMinecraftWindowTitle('"javaw.exe","1234","Console","1","500,000 K","Running","User","0:01:23","Minecraft* 1.21.1"'), 'Minecraft* 1.21.1');
    assert.equal(pickMinecraftWindowTitle('random text without window'), null);
  });
});
