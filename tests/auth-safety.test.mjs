import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractDomainForAuthWhitelist,
  buildFirebaseConsoleAuthUrl,
  classifyAuthError
} from '../dashboard/lib/authSafety.mjs';

describe('Firebase Auth Safety & Domain Whitelist Engine', () => {
  describe('extractDomainForAuthWhitelist', () => {
    it('strips http and https protocols from URLs', () => {
      assert.strictEqual(extractDomainForAuthWhitelist('http://localhost:3000'), 'localhost');
      assert.strictEqual(extractDomainForAuthWhitelist('https://godhand.mod.dev'), 'godhand.mod.dev');
    });

    it('strips port numbers from localhost and IP addresses', () => {
      assert.strictEqual(extractDomainForAuthWhitelist('localhost:3000'), 'localhost');
      assert.strictEqual(extractDomainForAuthWhitelist('127.0.0.1:8080'), '127.0.0.1');
      assert.strictEqual(extractDomainForAuthWhitelist('http://127.0.0.1:3000/callback'), '127.0.0.1');
    });

    it('strips URL paths, query parameters and hash fragments', () => {
      assert.strictEqual(
        extractDomainForAuthWhitelist('https://example.com/auth/handler?client_id=123#token'),
        'example.com'
      );
    });

    it('normalizes uppercase and mixed-case domain strings to lowercase', () => {
      assert.strictEqual(extractDomainForAuthWhitelist('LOCALHOST'), 'localhost');
      assert.strictEqual(extractDomainForAuthWhitelist('http://MyModDomain.COM:443'), 'mymoddomain.com');
    });

    it('gracefully handles empty, null, or invalid inputs', () => {
      assert.strictEqual(extractDomainForAuthWhitelist(''), '');
      assert.strictEqual(extractDomainForAuthWhitelist(null), '');
      assert.strictEqual(extractDomainForAuthWhitelist(undefined), '');
    });
  });

  describe('buildFirebaseConsoleAuthUrl', () => {
    it('builds standard Firebase Console authentication settings URL for given project ID', () => {
      const url = buildFirebaseConsoleAuthUrl('project-910a2a4c-fa54-4621-b21');
      assert.strictEqual(
        url,
        'https://console.firebase.google.com/project/project-910a2a4c-fa54-4621-b21/authentication/settings'
      );
    });

    it('uses project default fallback if no project ID is provided', () => {
      const url = buildFirebaseConsoleAuthUrl();
      assert.ok(url.includes('authentication/settings'));
      assert.ok(url.startsWith('https://console.firebase.google.com/project/'));
    });
  });

  describe('classifyAuthError', () => {
    it('identifies auth/unauthorized-domain error accurately', () => {
      const res = classifyAuthError({ code: 'auth/unauthorized-domain', message: 'Domain not whitelisted' });
      assert.strictEqual(res.category, 'unauthorized-domain');
      assert.strictEqual(res.code, 'auth/unauthorized-domain');
    });

    it('identifies popup-blocked and popup-closed errors', () => {
      const blocked = classifyAuthError({ code: 'auth/popup-blocked' });
      assert.strictEqual(blocked.category, 'popup-blocked');

      const closed = classifyAuthError({ code: 'auth/popup-closed-by-user' });
      assert.strictEqual(closed.category, 'popup-closed');
    });

    it('identifies credential errors', () => {
      const invalid = classifyAuthError({ code: 'auth/invalid-credential' });
      assert.strictEqual(invalid.category, 'invalid-credential');

      const inUse = classifyAuthError({ code: 'auth/email-already-in-use' });
      assert.strictEqual(inUse.category, 'email-already-in-use');
    });

    it('falls back to generic category for unknown errors or missing error object', () => {
      const generic = classifyAuthError({ code: 'auth/internal-error' });
      assert.strictEqual(generic.category, 'generic');

      const empty = classifyAuthError(null);
      assert.strictEqual(empty.category, 'generic');
    });
  });

  describe('Auth Localization & Terms Modal Parity', () => {
    const translationsPath = path.resolve('dashboard/src/i18n/translations.ts');
    const content = fs.readFileSync(translationsPath, 'utf-8');

    const requiredKeys = [
      'unauthorizedDomainTitle',
      'unauthorizedDomainDesc',
      'unauthorizedDomainGuidance',
      'copyDomain',
      'domainCopied',
      'openFirebaseConsole',
      'switchToLocalhost',
      'unauthorizedDomainFallback',
      'termsSection3Title',
      'domainWhitelistNote',
      'orUseEmailPassword',
      'defaultUserName'
    ];

    it('ensures all required domain guidance and terms keys exist in translations.ts', () => {
      for (const key of requiredKeys) {
        assert.ok(content.includes(`${key}:`), `Missing key in translations.ts: ${key}`);
      }
    });

    it('ensures termsSection3Title is present and distinct from privacyText', () => {
      assert.ok(content.includes('termsSection3Title: "3. Privacy and Data Protection"'));
      assert.ok(content.includes('termsSection3Title: "3. Datenschutz und Privatsphäre"'));
    });
  });
});
