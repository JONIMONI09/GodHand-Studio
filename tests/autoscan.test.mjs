import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseJava, applyJavaFix } from '../dashboard/lib/runtime.mjs';

test('Automated Client-Side Java Diagnostic Engine', async (t) => {
  await t.test('detects multiple typos accurately with line numbers', () => {
    const code = `package com.example;

pubilc calss MyMod implments ModInitializer {
    staic finla Strign MOD_ID = "mymod";
    viod onInitialize() {
        retun;
    }
}`;
    const diags = diagnoseJava(code);
    assert.ok(diags.length >= 6, 'Should detect all typos');
    const typos = diags.filter(d => d.type === 'typo').map(d => d.typo);
    assert.ok(typos.includes('pubilc'));
    assert.ok(typos.includes('calss'));
    assert.ok(typos.includes('implments'));
    assert.ok(typos.includes('staic'));
    assert.ok(typos.includes('finla'));
    assert.ok(typos.includes('Strign'));
  });

  await t.test('applies surgical typo fix cleanly', () => {
    const code = 'pubilc class MyMod {}';
    const fixed = applyJavaFix(code, { line: 1, type: 'typo', typo: 'pubilc', suggestedFix: 'public' });
    assert.equal(fixed, 'public class MyMod {}');
  });

  await t.test('detects missing semicolon and fixes it', () => {
    const code = `public class Test {
    int x = 42
}`;
    const diags = diagnoseJava(code);
    const semicolonDiag = diags.find(d => d.suggestedFix === ';');
    assert.ok(semicolonDiag, 'Should detect missing semicolon');
    const fixed = applyJavaFix(code, semicolonDiag);
    assert.ok(fixed.includes('int x = 42;'));
  });

  await t.test('detects unclosed curly brace', () => {
    const code = `public class Test {
    public void run() {
        int x = 1;
    }
`;
    const diags = diagnoseJava(code);
    const braceDiag = diags.find(d => d.suggestedFix === '}');
    assert.ok(braceDiag, 'Should detect unclosed brace');
  });

  await t.test('handles empty or massive code without crashing', () => {
    assert.deepEqual(diagnoseJava(''), []);
    assert.deepEqual(diagnoseJava(null), []);
    const huge = 'a'.repeat(2_000_001);
    const diags = diagnoseJava(huge);
    assert.equal(diags[0].type, 'limit');
  });
});
