// Cross-platform runtime helpers for Gradle, JDK provisioning and the runClient bridge.
// Pure functions are kept free of side effects so they can be unit tested.
import path from 'node:path';
import fs from 'node:fs';

/** Allowed characters for Gradle task names / flags passed through a shell on Windows. */
const SAFE_GRADLE_ARG = /^[A-Za-z0-9_:.\-=/]+$/;

/**
 * Validates and normalizes a Gradle command string or arg array.
 * Strips a leading `./gradlew` / `gradlew` / `gradlew.bat`.
 * @returns {string[]} sanitized args
 * @throws {Error} on invalid input
 */
export function sanitizeGradleArgs(input) {
  let parts;
  if (Array.isArray(input)) {
    parts = input.map(p => String(p ?? '').trim()).filter(Boolean);
  } else if (typeof input === 'string') {
    parts = input.trim().split(/\s+/).filter(Boolean);
  } else {
    throw new Error('Gradle command must be a string or array');
  }
  if (parts.length > 0 && /^(\.[\\/])?gradlew(\.bat)?$/i.test(parts[0])) parts.shift();
  if (parts.length === 0) throw new Error('No Gradle task specified');
  if (parts.length > 20) throw new Error('Too many Gradle arguments');
  for (const p of parts) {
    if (p.length > 120 || !SAFE_GRADLE_ARG.test(p) || p.includes('..')) {
      throw new Error(`Invalid Gradle argument: ${p.slice(0, 40)}`);
    }
  }
  return parts;
}

/** Returns the executable + spawn options for the Gradle wrapper on the given platform. */
export function gradlewInvocation(projectDir, platform = process.platform) {
  if (platform === 'win32') {
    // Node >= 18.20 refuses to spawn .bat files without a shell (CVE-2024-27980).
    // Args are validated by sanitizeGradleArgs before reaching the shell.
    return { command: `"${path.join(projectDir, 'gradlew.bat')}"`, shell: true };
  }
  return { command: path.join(projectDir, 'gradlew'), shell: false };
}

export function javaBinName(platform = process.platform) {
  return platform === 'win32' ? 'java.exe' : 'java';
}

export function hasJava(javaHome, platform = process.platform) {
  if (!javaHome || typeof javaHome !== 'string') return false;
  try {
    return fs.existsSync(path.join(javaHome, 'bin', javaBinName(platform)));
  } catch {
    return false;
  }
}

/** Builds a child-process environment with the JDK first on PATH (platform delimiter aware). */
export function buildJavaEnv(javaHome, baseEnv = process.env, platform = process.platform) {
  const delimiter = platform === 'win32' ? ';' : ':';
  const sep = platform === 'win32' ? '\\' : '/';
  const pathKey = Object.keys(baseEnv).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  const env = { ...baseEnv, JAVA_HOME: javaHome };
  env[pathKey] = `${javaHome}${sep}bin${delimiter}${baseEnv[pathKey] || ''}`;
  return env;
}

/** Finds a usable JDK home from env, candidates and the local runtime dir. */
export function detectJavaHome({ env = process.env, candidates = [], jdkDir, platform = process.platform } = {}) {
  const ordered = [env.JAVA_HOME, ...candidates, jdkDir].filter(Boolean);
  for (const c of ordered) {
    if (hasJava(c, platform)) return c;
  }
  return null;
}

/** Adoptium API URL for the latest Temurin JDK 21 for the given platform. */
export function adoptiumUrl(platform = process.platform, arch = process.arch) {
  const osMap = { win32: 'windows', linux: 'linux', darwin: 'mac' };
  const archMap = { x64: 'x64', arm64: 'aarch64', arm: 'arm' };
  const os = osMap[platform];
  const a = archMap[arch];
  if (!os || !a) throw new Error(`Unsupported platform for JDK download: ${platform}/${arch}`);
  return `https://api.adoptium.net/v3/binary/latest/21/ga/${os}/${a}/jdk/hotspot/normal/eclipse`;
}

export function computeProgress(received, total) {
  const r = Number.isFinite(received) && received > 0 ? received : 0;
  const t = Number.isFinite(total) && total > 0 ? total : 0;
  if (!t) return null;
  return Math.max(0, Math.min(100, Math.round((r / t) * 100)));
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Classifies a runClient log line into a lifecycle event.
 * @returns {null | 'launching' | 'modloaded' | 'ready' | 'crashed' | 'error'}
 */
export function classifyClientLogLine(line, modId = 'godhand') {
  if (typeof line !== 'string' || !line) return null;
  const l = line.toLowerCase();
  if (l.includes('minecraft has crashed') || l.includes('---- minecraft crash report') || l.includes('game crashed!')) return 'crashed';
  if (l.includes('godhand mod initialized') || (l.includes('loading') && l.includes('mods') && l.includes(modId.toLowerCase()))) return 'modloaded';
  if (l.includes('sound engine started') || l.includes('created: 1024x') || l.includes('narrator library')) return 'ready';
  if (l.includes('setting user:') || l.includes('loading minecraft') || l.includes('backend library: lwjgl')) return 'launching';
  if (/\b(error|exception)\b/.test(l) && !l.includes('[info]')) return 'error';
  return null;
}

/** Extracts a Minecraft window title from `tasklist /v /fo csv` style output or plain lines. */
export function pickMinecraftWindowTitle(text) {
  if (typeof text !== 'string') return null;
  for (const raw of text.split(/\r?\n/)) {
    const parts = raw.split(/","|,/).map(s => s.trim().replace(/^"|"$/g, ''));
    for (const p of parts) {
      if (/^Minecraft\*?\s?\d/i.test(p) || /^Minecraft\*?\s*[-–]/i.test(p) || /^Minecraft\*?\s+[A-Za-z0-9]/i.test(p)) {
        return p;
      }
    }
    const t = raw.trim().replace(/^"|"$/g, '');
    if (/^Minecraft\*?\s?\d/i.test(t) || /^Minecraft\*?\s*[-–]/i.test(t) || /^Minecraft\*?\s+[A-Za-z0-9]/i.test(t)) {
      return t;
    }
  }
  return null;
}

/** Safe Java source diagnostics (string-literal & comment aware brace tracking). */
export const TYPO_MAP = Object.freeze({
  pubilc: 'public', pubic: 'public', pulic: 'public', statci: 'static', staic: 'static',
  viod: 'void', vod: 'void', clas: 'class', calss: 'class', Stirng: 'String', Strign: 'String',
  improt: 'import', imprt: 'import', retunr: 'return', retrun: 'return', Sytsem: 'System',
  Systm: 'System', pritnln: 'println', prntln: 'println', Packge: 'package', packge: 'package',
  finla: 'final', fnial: 'final', intreface: 'interface', extneds: 'extends', implments: 'implements',
  privat: 'private', prvate: 'private',
  Overide: 'Override', Overrride: 'Override', ture: 'true', flase: 'false', nul: 'null', retun: 'return'
});

const CONTINUATION_ENDINGS = [',', '(', '+', '-', '*', '/', '&&', '||', '->', '=', '.', '?', '[', '|', '&'];

/** Strips string/char literals and line comments so structural checks are not fooled. */
function stripLiterals(line, state) {
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];
    if (state.block) {
      if (c === '*' && n === '/') { state.block = false; i++; }
      continue;
    }
    if (c === '/' && n === '*') { state.block = true; i++; continue; }
    if (c === '/' && n === '/') break;
    if (c === '"' || c === '\'') {
      const q = c;
      let j = i + 1;
      let closed = false;
      while (j < line.length) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === q) { closed = true; break; }
        j++;
      }
      if (!closed) { state.unclosed = true; out += q; break; }
      out += q + q;
      i = j;
      continue;
    }
    out += c;
  }
  return out;
}

export function diagnoseJava(code) {
  const diagnostics = [];
  if (typeof code !== 'string' || code.length === 0) return diagnostics;
  if (code.length > 2_000_000) {
    return [{ line: 1, type: 'limit', severity: 'warning', message: 'File too large for live diagnostics (>2MB)' }];
  }
  const lines = code.split(/\r?\n/);
  const state = { block: false, unclosed: false };
  let braces = 0;
  let parens = 0;
  let inTextBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    if ((raw.match(/"""/g) || []).length % 2 === 1) { inTextBlock = !inTextBlock; continue; }
    if (inTextBlock) continue;
    const wasBlock = state.block;
    state.unclosed = false;
    const code = stripLiterals(raw, state);
    const trimmed = code.trim();
    if (wasBlock && !trimmed) continue;

    for (const word of code.match(/\b[A-Za-z]+\b/g) || []) {
      if (Object.prototype.hasOwnProperty.call(TYPO_MAP, word)) {
        diagnostics.push({ line: lineNum, type: 'typo', severity: 'error', message: `Typo detected: '${word}' should be '${TYPO_MAP[word]}'`, typo: word, suggestedFix: TYPO_MAP[word] });
      }
    }
    if (state.unclosed) {
      diagnostics.push({ line: lineNum, type: 'syntax', severity: 'error', message: `Unclosed string literal on line ${lineNum}`, suggestedFix: '"' });
    }
    for (const ch of code) {
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
    }
    if (braces < 0) {
      diagnostics.push({ line: lineNum, type: 'syntax', severity: 'error', message: "Extraneous closing brace '}'", suggestedFix: '' });
      braces = 0;
    }
    const next = (lines[i + 1] || '').trim();
    const isStatementLike =
      trimmed.includes('=') ||
      /^(return|package|import|throw|assert)\b/.test(trimmed) ||
      trimmed.includes('LOGGER.') ||
      trimmed.endsWith(')');
    const isExcluded =
      !trimmed || /[;{}:]$/.test(trimmed) || trimmed.startsWith('@') ||
      /^(if|for|while|switch|catch|try|else|do|case|default|class|interface|enum|record)\b/.test(trimmed) ||
      /^(public|private|protected)\s+(static\s+)?(final\s+)?(abstract\s+)?(class|interface|enum|record)\b/.test(trimmed) ||
      CONTINUATION_ENDINGS.some(e => trimmed.endsWith(e)) ||
      /^[.+\-*/?:&|]/.test(next) || parens > 0;
    if (isStatementLike && !isExcluded) {
      diagnostics.push({ line: lineNum, type: 'syntax', severity: 'error', message: "Missing terminating semicolon ';' at end of statement", suggestedFix: ';' });
    }
  }
  if (braces > 0) {
    diagnostics.push({ line: lines.length, type: 'syntax', severity: 'error', message: `Unclosed block: ${braces} missing closing brace(s) '}'`, suggestedFix: '}' });
  }
  if (state.block) {
    diagnostics.push({ line: lines.length, type: 'syntax', severity: 'warning', message: 'Unterminated block comment' });
  }
  return diagnostics;
}

/** Applies a single diagnostic fix. Returns the new code or null when not applicable. */
export function applyJavaFix(code, { line, typo, suggestedFix, type } = {}) {
  if (typeof code !== 'string' || !code) return null;
  const idx = Number(line) - 1;
  const lines = code.split('\n');
  if (!Number.isInteger(idx) || idx < 0 || idx >= lines.length) return null;
  if (type === 'typo' && typeof typo === 'string' && typeof suggestedFix === 'string') {
    if (!/^[A-Za-z]+$/.test(typo) || !/^[A-Za-z]+$/.test(suggestedFix)) return null;
    lines[idx] = lines[idx].replace(new RegExp(`\\b${typo}\\b`, 'g'), suggestedFix);
  } else if (suggestedFix === ';') {
    const m = lines[idx].match(/^(.*?)(\s*)(\r?)$/);
    lines[idx] = `${m[1]};${m[3]}`;
  } else if (suggestedFix === '}') {
    lines.push('}');
  } else {
    return null;
  }
  return lines.join('\n');
}

export const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$|clock\$)(\..*)?$/i;
export const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f\x7f]/;

/** Validates single filename against Windows reserved device names and invalid characters. */
export function validateFileName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'File name cannot be empty', code: 'EMPTY_PATH' };
  }
  if (name.startsWith(' ') || name.endsWith(' ') || name.endsWith('.')) {
    return { valid: false, error: `File name "${name}" cannot start or end with a space, or end with a period`, code: 'TRAILING_DOT_OR_SPACE' };
  }
  const trimmed = name.trim();
  if (INVALID_FILENAME_CHARS.test(trimmed)) {
    return { valid: false, error: `File name "${trimmed}" contains forbidden characters (<>:"/\\|?*)`, code: 'INVALID_CHARACTERS' };
  }
  if (WINDOWS_RESERVED_NAMES.test(trimmed)) {
    return { valid: false, error: `"${trimmed}" is a Windows reserved device name (CON, PRN, AUX, NUL, COM0-9, LPT0-9, CONIN$, CONOUT$, CLOCK$)`, code: 'RESERVED_DEVICE_NAME' };
  }
  return { valid: true };
}

/** Validates relative path segments against directory traversal, URL encoding exploits, and invalid names. */
export function validatePath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string' || !pathStr.trim()) {
    return { valid: false, error: 'Path cannot be empty', code: 'EMPTY_PATH' };
  }
  let decoded = pathStr;
  try {
    decoded = decodeURIComponent(pathStr);
  } catch (_) {
    return { valid: false, error: 'Path contains invalid URL encoding', code: 'INVALID_CHARACTERS' };
  }
  if (decoded.includes('%')) {
    try {
      const doubleDecoded = decodeURIComponent(decoded);
      if (doubleDecoded !== decoded) {
        decoded = doubleDecoded;
      }
    } catch (_) {}
  }
  const normalized = decoded.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { valid: false, error: 'Path cannot be empty', code: 'EMPTY_PATH' };
  }
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      return { valid: false, error: 'Directory traversal (..) is strictly prohibited', code: 'PATH_TRAVERSAL' };
    }
    const res = validateFileName(segment);
    if (!res.valid) return res;
  }
  return { valid: true };
}

/** Checks if a file path corresponds to a binary mod asset (textures, audio, fonts, nbt, etc.). */
export function isBinaryAssetPath(filePath) {
  return /\.(png|jpe?g|gif|webp|ico|bmp|ogg|mp3|wav|flac|bin|dat|nbt|gz|class|jar|ttf|otf|woff2?)$/i.test(filePath);
}

/** Returns standard MIME type for binary mod assets. */
export function getBinaryAssetMime(filePath) {
  const ext = (filePath.includes('.') ? filePath.split('.').pop() : filePath).toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'ico': return 'image/x-icon';
    case 'bmp': return 'image/bmp';
    case 'svg': return 'image/svg+xml';
    case 'ogg': return 'audio/ogg';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'flac': return 'audio/flac';
    case 'ttf': return 'font/ttf';
    case 'otf': return 'font/otf';
    case 'woff': return 'font/woff';
    case 'woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

/** Safely decodes base64 into a Uint8Array across Node and browser runtimes. */
export function decodeBase64ToUint8Array(base64) {
  const clean = base64.replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Converts stored file content into a binary Uint8Array or safe string payload. */
export function toBinaryPayload(content) {
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
    return new Uint8Array(content);
  }
  if (typeof content === 'string') {
    // 1. Base64 Data URL (e.g. data:image/png;base64,iVBOR...)
    if (content.startsWith('data:') && content.includes(';base64,')) {
      const b64 = content.substring(content.indexOf(';base64,') + 8);
      return decodeBase64ToUint8Array(b64);
    }
    // 2. Plain Base64 string
    const cleanB64 = content.trim().replace(/\s+/g, '');
    if (cleanB64.startsWith('iVBORw0KGgo') || (/^[A-Za-z0-9+/=]+$/.test(cleanB64) && cleanB64.length % 4 === 0 && cleanB64.length >= 8)) {
      try {
        return decodeBase64ToUint8Array(cleanB64);
      } catch (_) {}
    }
    // 3. Raw binary string (characters whose charCodes represent byte values 0-255: sounds, textures, nbt, gz)
    const bytes = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i++) {
      bytes[i] = content.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  return new Uint8Array(0);
}


