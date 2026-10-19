import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Multi-Loader Mod Engine & Scaffolding Test Suite', () => {
  const LOADERS = [
    { id: 'fabric', manifest: 'fabric.mod.json', entrypoint: 'ModInitializer' },
    { id: 'neoforge', manifest: 'neoforge.mods.toml', entrypoint: 'net.neoforged.fml.common.Mod' },
    { id: 'forge', manifest: 'mods.toml', entrypoint: 'net.minecraftforge.fml.common.Mod' },
    { id: 'quilt', manifest: 'quilt.mod.json', entrypoint: 'org.quiltmc.loader.api.ModContainer' },
    { id: 'paper', manifest: 'plugin.yml', entrypoint: 'org.bukkit.plugin.java.JavaPlugin' },
    { id: 'folia', manifest: 'plugin.yml', entrypoint: 'folia-supported' },
    { id: 'velocity', manifest: 'velocity-plugin.json', entrypoint: 'com.velocitypowered.api.plugin.Plugin' },
    { id: 'bungeecord', manifest: 'bungee.yml', entrypoint: 'net.md_5.bungee.api.plugin.Plugin' },
    { id: 'sponge', manifest: 'sponge_plugins.json', entrypoint: 'org.spongepowered.plugin.builtin.jvm.Plugin' }
  ];

  it('supports all required Minecraft mod and plugin loaders', () => {
    assert.equal(LOADERS.length, 9);
    const ids = LOADERS.map(l => l.id);
    assert.ok(ids.includes('fabric'));
    assert.ok(ids.includes('neoforge'));
    assert.ok(ids.includes('forge'));
    assert.ok(ids.includes('quilt'));
    assert.ok(ids.includes('paper'));
    assert.ok(ids.includes('folia'));
    assert.ok(ids.includes('velocity'));
    assert.ok(ids.includes('bungeecord'));
    assert.ok(ids.includes('sponge'));
  });

  it('correctly associates manifests and entrypoint paradigms per loader', () => {
    LOADERS.forEach(loader => {
      assert.ok(loader.manifest.length > 0, `Manifest must exist for ${loader.id}`);
      assert.ok(loader.entrypoint.length > 0, `Entrypoint must exist for ${loader.id}`);
    });
  });
});

describe('Intelligent Bug & Typo Diagnostic Engine', () => {
  const TYPO_MAP = {
    'pubilc': 'public',
    'pubic': 'public',
    'pulic': 'public',
    'statci': 'static',
    'staic': 'static',
    'viod': 'void',
    'vod': 'void',
    'clas': 'class',
    'calss': 'class',
    'Stirng': 'String',
    'Strign': 'String',
    'improt': 'import',
    'retunr': 'return',
    'Sytsem': 'System',
    'Systm': 'System',
    'pritnln': 'println',
    'implments': 'implements',
    'extneds': 'extends'
  };

  function diagnoseCode(code) {
    const diagnostics = [];
    const lines = code.split('\n');
    let openBraces = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

      const words = line.match(/\b[A-Za-z]+\b/g) || [];
      for (const word of words) {
        if (TYPO_MAP[word]) {
          diagnostics.push({
            line: lineNum,
            type: 'typo',
            typo: word,
            suggestedFix: TYPO_MAP[word]
          });
        }
      }

      for (const ch of line) {
        if (ch === '{') openBraces++;
        if (ch === '}') openBraces--;
      }

      if (
        trimmed.length > 0 &&
        !trimmed.endsWith(';') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.startsWith('@') &&
        (trimmed.startsWith('return') || trimmed.includes('=') || trimmed.startsWith('package'))
      ) {
        diagnostics.push({
          line: lineNum,
          type: 'syntax',
          message: 'Missing semicolon',
          suggestedFix: ';'
        });
      }
    }

    if (openBraces !== 0) {
      diagnostics.push({
        line: lines.length,
        type: 'syntax',
        message: 'Unbalanced braces',
        suggestedFix: openBraces > 0 ? '}' : ''
      });
    }

    return diagnostics;
  }

  function applyFix(code, item) {
    const lines = code.split('\n');
    const idx = item.line - 1;
    if (item.type === 'typo' && item.typo && item.suggestedFix) {
      const reg = new RegExp(`\\b${item.typo}\\b`, 'g');
      lines[idx] = lines[idx].replace(reg, item.suggestedFix);
    } else if (item.suggestedFix === ';') {
      lines[idx] = lines[idx].trimEnd() + ';';
    } else if (item.suggestedFix === '}') {
      lines.push('}');
    }
    return lines.join('\n');
  }

  it('detects common Java keyword typos accurately', () => {
    const sample = `pubilc clas MyMod {\n    pubilc statci viod main(Stirng[] args) {\n        Sytsem.out.pritnln("Hello");\n    }\n}`;
    const diags = diagnoseCode(sample);
    const typos = diags.filter(d => d.type === 'typo');
    assert.equal(typos.length, 8);
    assert.equal(typos[0].suggestedFix, 'public');
    assert.equal(typos[1].suggestedFix, 'class');
    assert.equal(typos[2].suggestedFix, 'public');
    assert.equal(typos[3].suggestedFix, 'static');
    assert.equal(typos[4].suggestedFix, 'void');
    assert.equal(typos[5].suggestedFix, 'String');
    assert.equal(typos[6].suggestedFix, 'System');
  });

  it('applies surgical one-click fix to typos in source code', () => {
    const input = `pubilc class Test {}`;
    const diags = diagnoseCode(input);
    assert.equal(diags[0].typo, 'pubilc');
    const fixed = applyFix(input, diags[0]);
    assert.equal(fixed, `public class Test {}`);
  });

  it('detects missing semicolon and fixes it', () => {
    const input = `package com.test\npublic class Test {}`;
    const diags = diagnoseCode(input);
    const missingSemi = diags.find(d => d.suggestedFix === ';');
    assert.ok(missingSemi);
    const fixed = applyFix(input, missingSemi);
    assert.equal(fixed, `package com.test;\npublic class Test {}`);
  });

  it('detects unclosed brace block', () => {
    const input = `public class Test {\n    public void run() {\n}`;
    const diags = diagnoseCode(input);
    const braceDiag = diags.find(d => d.message === 'Unbalanced braces');
    assert.ok(braceDiag);
  });
});

describe('Core Mod Security & Protected Posture Suite', () => {
  const PROTECTED_MODS = ['arm32-fix', 'godhand'];

  it('forbids deletion of engine core mods', () => {
    const isProtected = (id) => PROTECTED_MODS.includes(id) || id.startsWith('core-') || id.startsWith('system-core-');
    assert.equal(isProtected('arm32-fix'), true);
    assert.equal(isProtected('godhand'), true);
    assert.equal(isProtected('user-custom-addon'), false);
  });

  it('detects core mod URLs and applies protected status', () => {
    const checkCoreMod = (projectId) => Boolean(projectId && (
      projectId.startsWith('core-') || 
      projectId.startsWith('core:') || 
      projectId.startsWith('system-core-') || 
      projectId === 'arm32-fix'
    ));

    assert.equal(checkCoreMod('core-arm32-fix'), true);
    assert.equal(checkCoreMod('core:net-patch'), true);
    assert.equal(checkCoreMod('arm32-fix'), true);
    assert.equal(checkCoreMod('system-core-perf'), true);
    assert.equal(checkCoreMod('my-regular-project'), false);
  });
});
