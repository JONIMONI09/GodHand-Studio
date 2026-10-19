/**
 * Client-Side Diagnostic & Typo Detection Engine for Java / Minecraft Fabric Modding.
 * Runs instantly in the browser without network latency or server roundtrips.
 */

export interface DiagnosticItem {
  line: number;
  type: 'typo' | 'syntax' | 'limit';
  severity: 'error' | 'warning';
  message: string;
  typo?: string;
  suggestedFix?: string;
}

export const TYPO_MAP: Record<string, string> = Object.freeze({
  pubilc: 'public', publc: 'public', pulic: 'public', pbublic: 'public',
  staic: 'static', statc: 'static', staitc: 'static', statci: 'static',
  viod: 'void', voide: 'void', vid: 'void',
  calss: 'class', clas: 'class', clss: 'class', classs: 'class',
  Strign: 'String', stirng: 'String', Strin: 'String',
  Bolean: 'Boolean', bollean: 'boolean',
  Itneger: 'Integer', intger: 'int',
  finla: 'final', fnial: 'final', intreface: 'interface', extneds: 'extends', implments: 'implements',
  privat: 'private', prvate: 'private',
  Overide: 'Override', Overrride: 'Override', ture: 'true', flase: 'false', nul: 'null', retun: 'return'
});

const CONTINUATION_ENDINGS = [',', '(', '+', '-', '*', '/', '&&', '||', '->', '=', '.', '?', '[', '|', '&'];

function stripLiterals(line: string, state: { block: boolean; unclosed: boolean }): string {
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

export function diagnoseJava(code: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
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
    const strippedCode = stripLiterals(raw, state);
    const trimmed = strippedCode.trim();
    if (wasBlock && !trimmed) continue;

    // Check keyword typos
    for (const word of strippedCode.match(/\b[A-Za-z]+\b/g) || []) {
      if (Object.prototype.hasOwnProperty.call(TYPO_MAP, word)) {
        diagnostics.push({
          line: lineNum,
          type: 'typo',
          severity: 'error',
          message: `Typo detected: '${word}' should be '${TYPO_MAP[word]}'`,
          typo: word,
          suggestedFix: TYPO_MAP[word]
        });
      }
    }
    if (state.unclosed) {
      diagnostics.push({
        line: lineNum,
        type: 'syntax',
        severity: 'error',
        message: `Unclosed string literal on line ${lineNum}`,
        suggestedFix: '"'
      });
    }
    for (const ch of strippedCode) {
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
    }
    if (braces < 0) {
      diagnostics.push({
        line: lineNum,
        type: 'syntax',
        severity: 'error',
        message: "Extraneous closing brace '}'",
        suggestedFix: ''
      });
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
      diagnostics.push({
        line: lineNum,
        type: 'syntax',
        severity: 'error',
        message: "Missing terminating semicolon ';' at end of statement",
        suggestedFix: ';'
      });
    }
  }
  if (braces > 0) {
    diagnostics.push({
      line: lines.length,
      type: 'syntax',
      severity: 'error',
      message: `Unclosed block: ${braces} missing closing brace(s) '}'`,
      suggestedFix: '}'
    });
  }
  if (state.block) {
    diagnostics.push({
      line: lines.length,
      type: 'syntax',
      severity: 'warning',
      message: 'Unterminated block comment'
    });
  }
  return diagnostics;
}

export function applyJavaFix(code: string, fix: Partial<DiagnosticItem>): string | null {
  if (typeof code !== 'string' || !code) return null;
  const idx = Number(fix.line) - 1;
  const lines = code.split('\n');
  if (!Number.isInteger(idx) || idx < 0 || idx >= lines.length) return null;

  if (fix.type === 'typo' && typeof fix.typo === 'string' && typeof fix.suggestedFix === 'string') {
    const escaped = fix.typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`);
    if (!regex.test(lines[idx])) return null;
    lines[idx] = lines[idx].replace(regex, fix.suggestedFix);
    return lines.join('\n');
  }

  if (fix.type === 'syntax') {
    if (fix.suggestedFix === ';') {
      const trimmed = lines[idx].trimEnd();
      if (!trimmed.endsWith(';')) {
        lines[idx] = trimmed + ';';
        return lines.join('\n');
      }
    }
    if (fix.suggestedFix === '}') {
      lines.push('}');
      return lines.join('\n');
    }
    if (fix.suggestedFix === '"') {
      lines[idx] = lines[idx] + '"';
      return lines.join('\n');
    }
  }
  return null;
}
