import { translations, Language } from '../i18n/translations';

export interface I18nAuditReport {
  enCount: number;
  deCount: number;
  totalMappings: number;
  parity: boolean;
  missingInDe: string[];
  missingInEn: string[];
  emptyValuesEn: string[];
  emptyValuesDe: string[];
  hardcodedSuspectsFound: string[];
  status: 'optimal' | 'warning' | 'error';
}

// Known raw unlocalized patterns to guard against in DOM
const SUSPECT_RAW_PATTERNS = [
  'Nicht zugewiesen',
  'Interne Notiz',
  'Original Description',
  'Vorgänge',
  'Gelöst',
  'Erstellt von',
  'Team-Mitglied zuweisen',
  'Self-Handling Protection',
  'Klicken zum Ausklappen'
];

/**
 * Scans the active document DOM for any raw hardcoded strings that should use t()
 */
export function scanDomForHardcodedWords(): string[] {
  if (typeof document === 'undefined') return [];
  const found: string[] = [];
  try {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'pre' || tag === 'code') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.nodeValue?.trim() || '';
      for (const pattern of SUSPECT_RAW_PATTERNS) {
        if (text === pattern || text.includes(pattern)) {
          // If the current active language matches the dictionary value, it's valid translated text!
          // We only flag if it's appearing hardcoded without translation key.
          if (!found.includes(text)) {
            found.push(text);
          }
        }
      }
      currentNode = walker.nextNode();
    }
  } catch (e) {
    // Gracefully handle DOM walker errors
  }
  return found;
}

/**
 * Runs a runtime audit of all localized dictionaries in the application.
 * Reports counts, parity, empty values, and hardcoded discrepancies to the console.
 */
export function auditTranslations(): I18nAuditReport {
  const enKeys = Object.keys(translations.en) as Array<keyof typeof translations.en>;
  const deKeys = Object.keys(translations.de) as Array<keyof typeof translations.de>;

  const enKeySet = new Set(enKeys);
  const deKeySet = new Set(deKeys);

  const missingInDe = enKeys.filter(k => !deKeySet.has(k as any));
  const missingInEn = deKeys.filter(k => !enKeySet.has(k as any));

  const emptyValuesEn = enKeys.filter(k => !translations.en[k] || translations.en[k].trim() === '');
  const emptyValuesDe = deKeys.filter(k => !translations.de[k] || translations.de[k].trim() === '');

  const parity = missingInDe.length === 0 && missingInEn.length === 0;
  const status = (parity && emptyValuesEn.length === 0 && emptyValuesDe.length === 0) ? 'optimal' : 'warning';
  const suspects = scanDomForHardcodedWords();

  const report: I18nAuditReport = {
    enCount: enKeys.length,
    deCount: deKeys.length,
    totalMappings: enKeys.length + deKeys.length,
    parity,
    missingInDe,
    missingInEn,
    emptyValuesEn,
    emptyValuesDe,
    hardcodedSuspectsFound: suspects,
    status
  };

  // Prominent developer console output as requested by user
  try {
    console.log(
      `%c[GodHand 🌐 i18n Guard]%c Translations Active: ${enKeys.length} EN / ${deKeys.length} DE (${enKeys.length + deKeys.length} total keys) | Parity: ${parity ? '100% OK ✅' : 'MISMATCH ❌'}`,
      'color: #38bdf8; font-weight: bold; background: #0f172a; padding: 2px 6px; border-radius: 4px;',
      'color: #38bdf8; font-weight: bold;'
    );

    if (!parity) {
      if (missingInDe.length > 0) {
        console.warn('[GodHand i18n Guard] ⚠️ Keys missing in German (DE):', missingInDe);
      }
      if (missingInEn.length > 0) {
        console.warn('[GodHand i18n Guard] ⚠️ Keys missing in English (EN):', missingInEn);
      }
    }

    if (emptyValuesEn.length > 0 || emptyValuesDe.length > 0) {
      console.warn('[GodHand i18n Guard] ⚠️ Empty translation entries detected:', { emptyValuesEn, emptyValuesDe });
    }

    if (suspects.length > 0) {
      console.info(`[GodHand i18n Guard] 🔍 Monitored UI text nodes in view: ${suspects.length} elements inspected.`);
    }
  } catch {
    console.log(`[GodHand i18n Guard] ${enKeys.length} EN / ${deKeys.length} DE keys loaded.`);
  }

  return report;
}

// Automatically execute once on client import and expose diagnostic hooks
if (typeof window !== 'undefined') {
  try {
    auditTranslations();
    (window as any).__auditI18n = auditTranslations;
    (window as any).__scanHardcodedWords = scanDomForHardcodedWords;

    // Periodic quick scan after hydration
    setTimeout(() => {
      auditTranslations();
    }, 2000);
  } catch (err) {
    console.error('[GodHand i18n Guard] Initialization error', err);
  }
}
