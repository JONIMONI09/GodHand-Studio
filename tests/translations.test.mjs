import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function extractDictionaryKeys(fileContent) {
  // Extract keys within en: { ... } and de: { ... }
  const enMatch = fileContent.match(/en:\s*\{([\s\S]*?)\n\s*\},/);
  const deMatch = fileContent.match(/de:\s*\{([\s\S]*?)\n\s*\}\s*;/);

  if (!enMatch || !deMatch) {
    throw new Error('Failed to locate en and de dictionaries in translations.ts');
  }

  const parseKeys = (block) => {
    const keys = new Set();
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      const keyMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*:/);
      if (keyMatch) {
        keys.add(keyMatch[1]);
      }
    }
    return Array.from(keys);
  };

  const enKeys = parseKeys(enMatch[1]);
  const deKeys = parseKeys(deMatch[1]);

  return { enKeys, deKeys };
}

describe('Bilingual Translation & Localization Engine', () => {
  const filePath = path.resolve('dashboard/src/i18n/translations.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  const { enKeys, deKeys } = extractDictionaryKeys(content);

  it('contains over 100 localized dictionary keys in each language', () => {
    assert.ok(enKeys.length > 100, `Expected > 100 keys, got ${enKeys.length}`);
    assert.ok(deKeys.length > 100, `Expected > 100 keys, got ${deKeys.length}`);
  });

  it('guarantees 100% key parity between English and German', () => {
    const missingInDe = enKeys.filter(k => !deKeys.includes(k));
    const missingInEn = deKeys.filter(k => !enKeys.includes(k));

    assert.deepStrictEqual(missingInDe, [], `Keys in English missing in German: ${missingInDe.join(', ')}`);
    assert.deepStrictEqual(missingInEn, [], `Keys in German missing in English: ${missingInEn.join(', ')}`);
    assert.strictEqual(enKeys.length, deKeys.length, 'Key counts must match exactly');
  });

  it('has no empty or undefined key mappings', () => {
    assert.ok(enKeys.every(k => k.length > 0));
    assert.ok(deKeys.every(k => k.length > 0));
  });
});
