import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { 
  validateFileName, 
  validatePath, 
  WINDOWS_RESERVED_NAMES, 
  INVALID_FILENAME_CHARS,
  isBinaryAssetPath,
  decodeBase64ToUint8Array,
  toBinaryPayload,
  getBinaryAssetMime
} from '../dashboard/lib/runtime.mjs';

// Mirroring server.js path resolution & validation
function resolveAndCheckPath(filePath, projectBase = '/mock/godhand') {
  if (!filePath || typeof filePath !== 'string') return null;
  const base = path.resolve(projectBase);
  const cleaned = filePath.replace(/^[/\\]+/, '');
  const fullPath = path.resolve(base, cleaned);
  if (!fullPath.startsWith(base)) return null;
  return fullPath;
}

function validateFolderMove(srcPath, destPath) {
  if (!srcPath || !destPath) return { valid: false, error: 'Paths required' };
  if (srcPath === destPath) return { valid: false, error: 'Same path' };
  // Check if moving into subfolder of itself
  if (destPath.startsWith(srcPath + '/')) {
    return { valid: false, error: 'Cannot move folder into own subfolder' };
  }
  return { valid: true };
}

function validateFileSize(contentString, maxBytes = 5 * 1024 * 1024) {
  const bytes = Buffer.byteLength(contentString, 'utf8');
  return bytes <= maxBytes;
}

describe('File System API Safety & Path Sanitization', () => {
  const BASE = path.resolve('/workspace/godhand');

  it('blocks path traversal attempts (.. / etc)', () => {
    assert.strictEqual(resolveAndCheckPath('../../etc/passwd', BASE), null);
    assert.strictEqual(resolveAndCheckPath('../../../root/.ssh/id_rsa', BASE), null);
    assert.strictEqual(resolveAndCheckPath('src/../../..', BASE), null);
    assert.strictEqual(resolveAndCheckPath('../outside.txt', BASE), null);
  });

  it('allows valid in-project paths with stripped leading slashes', () => {
    assert.strictEqual(resolveAndCheckPath('/src/main/Mod.java', BASE), path.resolve(BASE, 'src/main/Mod.java'));
    assert.strictEqual(resolveAndCheckPath('build.gradle', BASE), path.resolve(BASE, 'build.gradle'));
  });

  it('prevents folder moving into its own subfolder', () => {
    const invalidMove = validateFolderMove('src/main', 'src/main/sub/test');
    assert.strictEqual(invalidMove.valid, false);
    assert.strictEqual(invalidMove.error, 'Cannot move folder into own subfolder');

    const validMove = validateFolderMove('src/main/old', 'src/main/new');
    assert.strictEqual(validMove.valid, true);
  });

  it('enforces 5MB file upload quota', () => {
    const smallContent = 'Hello World!'.repeat(100);
    assert.strictEqual(validateFileSize(smallContent), true);

    const oversizedContent = 'X'.repeat(5 * 1024 * 1024 + 10);
    assert.strictEqual(validateFileSize(oversizedContent), false);
  });

  describe('Windows Reserved Device Names & Illegal Character Validation', () => {
    it('rejects classic DOS/Windows reserved device names regardless of case', () => {
      const reserved = ['con', 'prn', 'aux', 'nul', 'com1', 'com5', 'com9', 'lpt1', 'lpt4', 'lpt9', 'conin$', 'conout$', 'clock$'];
      for (const name of reserved) {
        const lowerRes = validateFileName(name);
        assert.strictEqual(lowerRes.valid, false, `Expected "${name}" to be rejected`);
        assert.strictEqual(lowerRes.code, 'RESERVED_DEVICE_NAME');

        const upperRes = validateFileName(name.toUpperCase());
        assert.strictEqual(upperRes.valid, false, `Expected "${name.toUpperCase()}" to be rejected`);
        assert.strictEqual(upperRes.code, 'RESERVED_DEVICE_NAME');
      }
    });

    it('rejects reserved device names with file extensions (e.g. nul.txt, con.json, conin$.txt)', () => {
      const reservedWithExt = ['nul.txt', 'CON.java', 'aux.png', 'COM1.log', 'lpt2.dat', 'prn.zip', 'conin$.txt', 'CONOUT$.json', 'clock$.bin'];
      for (const name of reservedWithExt) {
        const res = validateFileName(name);
        assert.strictEqual(res.valid, false, `Expected "${name}" to be rejected`);
        assert.strictEqual(res.code, 'RESERVED_DEVICE_NAME');
      }
    });

    it('accepts legitimate names that contain reserved words as sub-strings', () => {
      const legitimate = ['contact.txt', 'constant.java', 'auxiliary.json', 'null_pointer.log', 'printer.png', 'computer.dat', 'clock.java'];
      for (const name of legitimate) {
        const res = validateFileName(name);
        assert.strictEqual(res.valid, true, `Expected "${name}" to be accepted, got: ${res.error}`);
      }
    });

    it('rejects illegal filename characters (<>:"/\\|?*) and control characters', () => {
      const invalid = ['foo<bar', 'foo>bar', 'foo:bar', 'foo"bar', 'foo/bar', 'foo\\bar', 'foo|bar', 'foo?bar', 'foo*bar', 'foo\x00bar', 'foo\x7fbar'];
      for (const name of invalid) {
        const res = validateFileName(name);
        assert.strictEqual(res.valid, false, `Expected "${name}" to be rejected`);
        assert.strictEqual(res.code, 'INVALID_CHARACTERS');
      }
    });

    it('rejects leading and trailing dots and spaces in filenames', () => {
      assert.strictEqual(validateFileName('myfile.').valid, false);
      assert.strictEqual(validateFileName('myfile.').code, 'TRAILING_DOT_OR_SPACE');

      assert.strictEqual(validateFileName('myfile. ').valid, false);
      assert.strictEqual(validateFileName('myfile. ').code, 'TRAILING_DOT_OR_SPACE');

      assert.strictEqual(validateFileName('myfile ').valid, false);
      assert.strictEqual(validateFileName('myfile ').code, 'TRAILING_DOT_OR_SPACE');

      assert.strictEqual(validateFileName(' myfile').valid, false);
      assert.strictEqual(validateFileName(' myfile').code, 'TRAILING_DOT_OR_SPACE');

      assert.strictEqual(validateFileName('  test.java').valid, false);
      assert.strictEqual(validateFileName('  test.java').code, 'TRAILING_DOT_OR_SPACE');
    });

    it('validates deep relative paths with validatePath', () => {
      assert.strictEqual(validatePath('src/main/java/GodHand.java').valid, true);
      assert.strictEqual(validatePath('src/main/resources/assets/godhand/icon.png').valid, true);

      // Traversal segment
      const traversal = validatePath('src/main/../../evil.txt');
      assert.strictEqual(traversal.valid, false);
      assert.strictEqual(traversal.code, 'PATH_TRAVERSAL');

      // Reserved segment inside subfolder
      const reservedSub = validatePath('src/main/nul/test.java');
      assert.strictEqual(reservedSub.valid, false);
      assert.strictEqual(reservedSub.code, 'RESERVED_DEVICE_NAME');

      // Invalid character in folder name
      const invalidFolder = validatePath('src/ma*in/test.java');
      assert.strictEqual(invalidFolder.valid, false);
      assert.strictEqual(invalidFolder.code, 'INVALID_CHARACTERS');

      // Empty path
      assert.strictEqual(validatePath('').valid, false);
      assert.strictEqual(validatePath('   ').valid, false);
    });
  });

  describe('VFS In-Memory Cascading Rename & Delete Operations', () => {
    it('simulates cascading rename of folder updating all child keys and paths', () => {
      const storage = new Map([
        ['vfs::godhand::src/main/java/GodHand.java', 'public class GodHand {}'],
        ['vfs::godhand::src/main/resources/fabric.mod.json', '{"id":"godhand"}'],
        ['vfs::godhand::build.gradle', 'plugins { id "fabric-loom" }']
      ]);

      const oldFolder = 'src/main';
      const newFolder = 'src/core';
      const prefix = `vfs::godhand::${oldFolder}/`;

      const keysToRename = [];
      for (const [key, value] of storage.entries()) {
        if (key.startsWith(prefix)) {
          const relativeChild = key.slice(prefix.length);
          keysToRename.push({ oldKey: key, newKey: `vfs::godhand::${newFolder}/${relativeChild}`, value });
        }
      }

      for (const { oldKey, newKey, value } of keysToRename) {
        storage.delete(oldKey);
        storage.set(newKey, value);
      }

      assert.strictEqual(storage.has('vfs::godhand::src/main/java/GodHand.java'), false);
      assert.strictEqual(storage.has('vfs::godhand::src/core/java/GodHand.java'), true);
      assert.strictEqual(storage.has('vfs::godhand::src/core/resources/fabric.mod.json'), true);
      assert.strictEqual(storage.has('vfs::godhand::build.gradle'), true);
    });

    it('simulates cascading delete of folder removing all descendant keys', () => {
      const storage = new Map([
        ['vfs::godhand::src/main/java/GodHand.java', 'public class GodHand {}'],
        ['vfs::godhand::src/main/resources/fabric.mod.json', '{"id":"godhand"}'],
        ['vfs::godhand::build.gradle', 'plugins { id "fabric-loom" }']
      ]);

      const targetFolder = 'src/main';
      const prefix = `vfs::godhand::${targetFolder}/`;

      for (const key of Array.from(storage.keys())) {
        if (key === `vfs::godhand::${targetFolder}` || key.startsWith(prefix)) {
          storage.delete(key);
        }
      }

      assert.strictEqual(storage.has('vfs::godhand::src/main/java/GodHand.java'), false);
      assert.strictEqual(storage.has('vfs::godhand::src/main/resources/fabric.mod.json'), false);
      assert.strictEqual(storage.has('vfs::godhand::build.gradle'), true);
    });

    it('simulates editor tabs synchronization on folder rename and delete', () => {
      let openTabs = [
        'src/main/java/GodHand.java',
        'src/main/resources/fabric.mod.json',
        'build.gradle'
      ];
      let activeFile = 'src/main/java/GodHand.java';

      // 1. Rename src/main -> src/core
      const oldFolder = 'src/main';
      const newFolder = 'src/core';
      openTabs = openTabs.map(tab => {
        if (tab === oldFolder) return newFolder;
        if (tab.startsWith(oldFolder + '/')) return `${newFolder}/${tab.slice(oldFolder.length + 1)}`;
        return tab;
      });
      if (activeFile.startsWith(oldFolder + '/')) {
        activeFile = `${newFolder}/${activeFile.slice(oldFolder.length + 1)}`;
      }

      assert.deepStrictEqual(openTabs, [
        'src/core/java/GodHand.java',
        'src/core/resources/fabric.mod.json',
        'build.gradle'
      ]);
      assert.strictEqual(activeFile, 'src/core/java/GodHand.java');

      // 2. Delete src/core
      const deletedFolder = 'src/core';
      openTabs = openTabs.filter(tab => tab !== deletedFolder && !tab.startsWith(deletedFolder + '/'));
      if (activeFile.startsWith(deletedFolder + '/')) {
        activeFile = openTabs[0] || null;
      }

      assert.deepStrictEqual(openTabs, ['build.gradle']);
      assert.strictEqual(activeFile, 'build.gradle');
    });
  });

  describe('Binary Asset Integrity & Payload Conversion', () => {
    it('accurately identifies binary asset file extensions including .nbt and .gz', () => {
      assert.strictEqual(isBinaryAssetPath('assets/godhand/icon.png'), true);
      assert.strictEqual(isBinaryAssetPath('sounds/ambient/creature.ogg'), true);
      assert.strictEqual(isBinaryAssetPath('data/structures/ancient_ruin.nbt'), true);
      assert.strictEqual(isBinaryAssetPath('archives/backup.tar.gz'), true);
      assert.strictEqual(isBinaryAssetPath('src/main/java/GodHand.java'), false);
      assert.strictEqual(isBinaryAssetPath('fabric.mod.json'), false);
    });

    it('decodes base64 data URLs with embedded whitespace or newlines into valid binary bytes', () => {
      const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      // Introduce multiline breaks and spaces
      const formattedDataUrl = `data:image/png;base64,\n  ${validPngBase64.substring(0, 40)}\r\n  ${validPngBase64.substring(40)}  \n`;
      const payload = toBinaryPayload(formattedDataUrl);

      assert.ok(payload instanceof Uint8Array, 'Decoded payload must be Uint8Array');
      // Verify PNG magic header
      assert.strictEqual(payload[0], 0x89);
      assert.strictEqual(payload[1], 0x50);
      assert.strictEqual(payload[2], 0x4E);
      assert.strictEqual(payload[3], 0x47);
    });

    it('decodes raw binary string starting with PNG header into Uint8Array', () => {
      const rawBinaryString = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR';
      const payload = toBinaryPayload(rawBinaryString);
      assert.ok(payload instanceof Uint8Array, 'Raw binary string must be converted to Uint8Array');
      assert.strictEqual(payload[0], 0x89);
      assert.strictEqual(payload[1], 0x50);
      assert.strictEqual(payload[2], 0x4E);
      assert.strictEqual(payload[3], 0x47);
    });
  });

  describe('Server API Route Parity & Path Validation Guardrails', () => {
    it('verifies dashboard/server.js registers /api/fs/rename endpoint', () => {
      const serverFile = path.resolve('/mock/..', 'dashboard/server.js');
      const serverCode = fs.readFileSync(path.resolve('dashboard/server.js'), 'utf8');
      assert.ok(serverCode.includes("app.post('/api/fs/rename'"), 'server.js must define /api/fs/rename');
      assert.ok(serverCode.includes("app.post('/api/system-mods/:id/rename'"), 'server.js must define /api/system-mods/:id/rename');
    });

    it('verifies dashboard/server.js checks validatePath across file reading, creation, move, and deletion', () => {
      const serverCode = fs.readFileSync(path.resolve('dashboard/server.js'), 'utf8');
      // /api/fs/file GET
      assert.ok(serverCode.includes("const pathVal = validatePath(filePath);"), 'server.js /api/fs/file must validate path');
      // /api/fs/file POST
      assert.ok(serverCode.includes("const pathVal = validatePath(filePath);"), 'server.js /api/fs/file must validate path');
      // /api/fs/move POST
      assert.ok(serverCode.includes("const srcVal = validatePath(sourcePath);"), 'server.js /api/fs/move must validate sourcePath');
      assert.ok(serverCode.includes("const dstVal = validatePath(destinationPath);"), 'server.js /api/fs/move must validate destinationPath');
      // /api/fs/file DELETE
      assert.ok(serverCode.includes("const pathVal = validatePath(filePath);"), 'server.js /api/fs/file DELETE must validate path');
      // /api/system-mods/:id/file GET
      assert.ok(serverCode.includes("const pathVal = validatePath(relativePath);"), 'server.js /api/system-mods/:id/file must validate path');
    });

    it('verifies dashboard/server.js serves binary assets with base64 Data URLs and writes binary bytes', () => {
      const serverCode = fs.readFileSync(path.resolve('dashboard/server.js'), 'utf8');
      assert.ok(serverCode.includes('isBinaryAssetPath(filePath)'), 'server.js must check isBinaryAssetPath');
      assert.ok(serverCode.includes("Buffer.from(b64, 'base64')"), 'server.js must decode base64 binary uploads');
    });

    it('verifies dashboard/src/App.tsx verifies res.ok on save and create and keeps openTabs synchronized', () => {
      const appCode = fs.readFileSync(path.resolve('dashboard/src/App.tsx'), 'utf8');
      assert.ok(appCode.includes('handleMoveModalConfirm'), 'App.tsx must define handleMoveModalConfirm');
      assert.ok(appCode.includes('handleMoveUp'), 'App.tsx must define handleMoveUp');
      assert.ok(appCode.includes('setOpenTabs(prev => prev.map('), 'App.tsx must cascade tab updates on move');
      assert.ok(appCode.includes('if (!res.ok)'), 'App.tsx must check res.ok on file operations');
    });
  });

  describe('Adversarial Edge Cases & Font / Audio Assets', () => {
    it('rejects URL-encoded traversal and null bytes in validatePath', () => {
      assert.strictEqual(validatePath('%2e%2e/secret.txt').valid, false);
      assert.strictEqual(validatePath('%2e%2e%2froot.key').valid, false);
      assert.strictEqual(validatePath('%252e%252e/nested').valid, false);
      assert.strictEqual(validatePath('%20spaced_file.java').valid, false);
      assert.strictEqual(validatePath('good/folder/%2e%2e').valid, false);
      assert.strictEqual(validatePath('%00nullbyte.java').valid, false);
      assert.strictEqual(validatePath('%E0%A4%A').valid, false); // malformed URI
    });

    it('identifies font assets (.ttf, .otf, .woff, .woff2) and audio formats (.mp3, .flac) as binary', () => {
      assert.strictEqual(isBinaryAssetPath('assets/godhand/font/minecraft.ttf'), true);
      assert.strictEqual(isBinaryAssetPath('assets/godhand/font/custom.otf'), true);
      assert.strictEqual(isBinaryAssetPath('assets/godhand/font/web.woff'), true);
      assert.strictEqual(isBinaryAssetPath('assets/godhand/font/web2.woff2'), true);
      assert.strictEqual(isBinaryAssetPath('assets/godhand/sounds/bg.mp3'), true);
      assert.strictEqual(isBinaryAssetPath('assets/godhand/sounds/effect.flac'), true);
      assert.strictEqual(isBinaryAssetPath('assets/godhand/sounds/sound.wav'), true);
    });

    it('converts raw binary sound headers (OGG, WAV) and NBT structure bytes into Uint8Array via toBinaryPayload', () => {
      const oggBinaryString = 'OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00';
      const oggPayload = toBinaryPayload(oggBinaryString);
      assert.ok(oggPayload instanceof Uint8Array, 'OGG payload must be Uint8Array');
      assert.strictEqual(oggPayload[0], 0x4F); // 'O'
      assert.strictEqual(oggPayload[1], 0x67); // 'g'
      assert.strictEqual(oggPayload[2], 0x67); // 'g'
      assert.strictEqual(oggPayload[3], 0x53); // 'S'

      const wavBinaryString = 'RIFF\x24\x00\x00\x00WAVEfmt ';
      const wavPayload = toBinaryPayload(wavBinaryString);
      assert.ok(wavPayload instanceof Uint8Array, 'WAV payload must be Uint8Array');
      assert.strictEqual(wavPayload[0], 0x52); // 'R'
      assert.strictEqual(wavPayload[1], 0x49); // 'I'
      assert.strictEqual(wavPayload[2], 0x46); // 'F'
      assert.strictEqual(wavPayload[3], 0x46); // 'F'

      const nbtGzBinaryString = '\x1f\x8b\x08\x00\x00\x00\x00\x00';
      const nbtPayload = toBinaryPayload(nbtGzBinaryString);
      assert.ok(nbtPayload instanceof Uint8Array, 'GZ/NBT payload must be Uint8Array');
      assert.strictEqual(nbtPayload[0], 0x1f);
      assert.strictEqual(nbtPayload[1], 0x8b);
    });

    it('resolves correct MIME types via getBinaryAssetMime for all textures, audio, and font assets', () => {
      assert.strictEqual(getBinaryAssetMime('icon.png'), 'image/png');
      assert.strictEqual(getBinaryAssetMime('photo.jpg'), 'image/jpeg');
      assert.strictEqual(getBinaryAssetMime('photo.jpeg'), 'image/jpeg');
      assert.strictEqual(getBinaryAssetMime('anim.gif'), 'image/gif');
      assert.strictEqual(getBinaryAssetMime('texture.webp'), 'image/webp');
      assert.strictEqual(getBinaryAssetMime('favicon.ico'), 'image/x-icon');
      assert.strictEqual(getBinaryAssetMime('bitmap.bmp'), 'image/bmp');
      assert.strictEqual(getBinaryAssetMime('vector.svg'), 'image/svg+xml');
      assert.strictEqual(getBinaryAssetMime('sound.ogg'), 'audio/ogg');
      assert.strictEqual(getBinaryAssetMime('track.mp3'), 'audio/mpeg');
      assert.strictEqual(getBinaryAssetMime('audio.wav'), 'audio/wav');
      assert.strictEqual(getBinaryAssetMime('lossless.flac'), 'audio/flac');
      assert.strictEqual(getBinaryAssetMime('font.ttf'), 'font/ttf');
      assert.strictEqual(getBinaryAssetMime('font.otf'), 'font/otf');
      assert.strictEqual(getBinaryAssetMime('font.woff'), 'font/woff');
      assert.strictEqual(getBinaryAssetMime('font.woff2'), 'font/woff2');
      assert.strictEqual(getBinaryAssetMime('data.nbt'), 'application/octet-stream');
    });

    it('converts ArrayBuffer input into Uint8Array via toBinaryPayload', () => {
      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view[0] = 0xCA; view[1] = 0xFE; view[2] = 0xBA; view[3] = 0xBE;
      const payload = toBinaryPayload(buffer);
      assert.ok(payload instanceof Uint8Array, 'ArrayBuffer must convert to Uint8Array');
      assert.strictEqual(payload.length, 4);
      assert.strictEqual(payload[0], 0xCA);
      assert.strictEqual(payload[1], 0xFE);
    });

    it('correctly handles base64 image strings that begin with BM or GIF8 without corruption', () => {
      // Create raw bytes that when base64-encoded start with 'BM' (e.g. 0x04 0xc3)
      const rawBytes = new Uint8Array([0x04, 0xc3, 0x55, 0xaa, 0x11, 0x22]);
      const base64Str = Buffer.from(rawBytes).toString('base64');
      assert.ok(base64Str.startsWith('BM'), `Test requires base64 starting with BM, got: ${base64Str}`);

      // toBinaryPayload must decode the base64 string back into the original raw bytes
      const decodedPayload = toBinaryPayload(base64Str);
      assert.ok(decodedPayload instanceof Uint8Array);
      assert.strictEqual(decodedPayload[0], 0x04);
      assert.strictEqual(decodedPayload[1], 0xc3);
      assert.strictEqual(decodedPayload[2], 0x55);
      assert.strictEqual(decodedPayload[3], 0xaa);
    });

    it('verifies dashboard/server.js and dashboard/src/lib/vfs.ts use getBinaryAssetMime', () => {
      const serverCode = fs.readFileSync(path.resolve('dashboard/server.js'), 'utf8');
      assert.ok(serverCode.includes('getBinaryAssetMime(fullPath)'), 'server.js /api/fs/file must use getBinaryAssetMime');
      assert.ok(serverCode.includes('getBinaryAssetMime(resolved)'), 'server.js /api/system-mods/:id/file must use getBinaryAssetMime');

      const vfsCode = fs.readFileSync(path.resolve('dashboard/src/lib/vfs.ts'), 'utf8');
      assert.ok(vfsCode.includes('getBinaryAssetMime(path)'), 'vfs.ts saveFile must use getBinaryAssetMime');
      assert.ok(vfsCode.includes('idbGetAllKeys(folderPrefix)'), 'vfs.ts must query folderPrefix in rename and delete');
    });
  });
});

