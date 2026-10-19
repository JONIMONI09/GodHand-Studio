/**
 * Firebase Auth Domain Normalization & Classification Helpers (TypeScript)
 */

export function extractDomainForAuthWhitelist(rawInput: string): string {
  if (!rawInput || typeof rawInput !== 'string') return '';
  let cleaned = rawInput.trim();
  // Strip protocol
  cleaned = cleaned.replace(/^[a-zA-Z]+:\/\//, '');
  // Strip paths, query params, hash
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];
  // Strip port
  cleaned = cleaned.split(':')[0];
  return cleaned.toLowerCase();
}

export function buildFirebaseConsoleAuthUrl(projectId?: string): string {
  const id = projectId || 'project-910a2a4c-fa54-4621-b21';
  return `https://console.firebase.google.com/project/${id}/authentication/settings`;
}

export type AuthErrorCategory = 
  | 'unauthorized-domain'
  | 'popup-blocked'
  | 'popup-closed'
  | 'invalid-credential'
  | 'email-already-in-use'
  | 'generic';

export function classifyAuthError(err: any): { category: AuthErrorCategory; code: string; message: string } {
  const code = err?.code || '';
  const message = err?.message || 'Authentication error';

  if (code === 'auth/unauthorized-domain') {
    return { category: 'unauthorized-domain', code, message };
  }
  if (code === 'auth/popup-blocked') {
    return { category: 'popup-blocked', code, message };
  }
  if (code === 'auth/popup-closed-by-user') {
    return { category: 'popup-closed', code, message };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return { category: 'invalid-credential', code, message };
  }
  if (code === 'auth/email-already-in-use') {
    return { category: 'email-already-in-use', code, message };
  }
  return { category: 'generic', code, message };
}
