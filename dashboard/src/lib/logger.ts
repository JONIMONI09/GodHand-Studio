/**
 * GodHand Studio Unified Logging & Null-Safety Utility
 * Provides colorful console tracing, error-trapping, and debug logging.
 */

export const logger = {
  debug: (tag: string, ...args: any[]) => {
    try {
      console.log(`%c[GodHand ⚙️ ${tag}]`, 'color: #94a3b8; font-weight: 600;', ...args);
    } catch {
      console.log(`[GodHand ${tag}]`, ...args);
    }
  },

  info: (tag: string, ...args: any[]) => {
    try {
      console.log(`%c[GodHand ℹ️ ${tag}]`, 'color: #38bdf8; font-weight: 700;', ...args);
    } catch {
      console.info(`[GodHand ${tag}]`, ...args);
    }
  },

  warn: (tag: string, ...args: any[]) => {
    try {
      console.warn(`%c[GodHand ⚠️ ${tag}]`, 'color: #f59e0b; font-weight: 700;', ...args);
    } catch {
      console.warn(`[GodHand ${tag}]`, ...args);
    }
  },

  error: (tag: string, error: any, context?: any) => {
    try {
      console.error(
        `%c[GodHand 🛑 ERROR: ${tag}]`, 
        'color: #f43f5e; font-weight: bold; background: rgba(244,63,94,0.1); padding: 2px 6px; border-radius: 4px;',
        error?.message || error,
        context ? { context } : ''
      );
    } catch {
      console.error(`[GodHand ERROR: ${tag}]`, error);
    }
  },

  audit: (action: string, actor: string, details: any) => {
    try {
      console.log(
        `%c[GodHand 🛡️ AUDIT] ${action} by ${actor}`,
        'color: #a855f7; font-weight: bold; background: rgba(168,85,247,0.1); padding: 2px 6px; border-radius: 4px;',
        details
      );
    } catch {
      console.log(`[GodHand AUDIT] ${action} by ${actor}`, details);
    }
  }
};
