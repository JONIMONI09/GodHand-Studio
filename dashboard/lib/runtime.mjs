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
