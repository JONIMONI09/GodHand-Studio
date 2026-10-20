/**
 * CI Session Bridge & Direct Artifact Delivery
 * Seamlessly tracks GitHub Actions IssueOps cloud compilation runs and connects artifacts directly into the web IDE.
 */

export interface CiSession {
  id: string;
  targetMod: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  issueNumber?: number;
  issueUrl?: string;
  runId?: string;
  runUrl?: string;
  artifactUrl?: string;
  artifactDownloadUrl?: string;
  message?: string;
  startTime: number;
  updatedTime: number;
  logs: string[];
}

const STORAGE_KEY = 'godhand_active_ci_session';
const listeners = new Set<(session: CiSession | null) => void>();

export function getStoredCiSession(): CiSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveCiSession(session: CiSession): void {
  if (typeof window === 'undefined') return;
  try {
    session.updatedTime = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    notifyListeners(session);
  } catch (_) {}
}

export function clearCiSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyListeners(null);
  } catch (_) {}
}

export function subscribeCiSession(listener: (session: CiSession | null) => void): () => void {
  listeners.add(listener);
  listener(getStoredCiSession());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(session: CiSession | null): void {
  listeners.forEach(fn => {
    try {
      fn(session);
    } catch (e) {
      console.error('CI Session listener error:', e);
    }
  });
}

export function createCiSession(targetMod: string = 'godhand', issueNumber?: number): CiSession {
  const sessionId = `ci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const session: CiSession = {
    id: sessionId,
    targetMod,
    status: 'pending',
    issueNumber,
    issueUrl: issueNumber ? `https://github.com/JONIMONI09/GodHand-Studio/issues/${issueNumber}` : undefined,
    startTime: Date.now(),
    updatedTime: Date.now(),
    logs: [
      `[CI Session] Created session ${sessionId} for target mod "${targetMod}"`,
      `[CI Session] Tagged with GitHub IssueOps labels: [build, task]`
    ]
  };
  saveCiSession(session);
  return session;
}

/**
 * Sanitizes GitHub Actions URLs by stripping invalid /artifacts suffixes.
 * GitHub Actions run URLs are https://github.com/<owner>/<repo>/actions/runs/<run_id>.
 * Appending /artifacts returns 404 on GitHub.
 */
export function cleanActionsUrl(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  return url.replace(/\/actions\/runs\/(\d+)\/artifacts(?:\/.*|\?.*)?$/, '/actions/runs/$1');
}

/**
 * Resolves the 100% public, token-free direct download URL for a compiled mod from GitHub Releases.
 */
export function resolveReleaseDownloadUrl(
  targetMod: string = 'godhand',
  version: string = '1.0.0',
  repo: string = 'JONIMONI09/GodHand-Studio'
): string {
  const cleanMod = (targetMod || 'godhand').replace(/^mods[\/\\]/, '').replace(/[\\\/]/g, '');
  const baseName = cleanMod.includes('arm32') ? 'arm32-fix' : cleanMod;
  const jarName = `${baseName}-${version}.jar`;
  return `https://github.com/${repo}/releases/download/latest/${jarName}`;
}

/**
 * Extracts structured metadata emitted in workflow issue comments:
 * <!-- GODHAND_CI_SESSION: {"status": "success", "runId": "12345", "artifactUrl": "https://..."} -->
 */
export function parseCiSessionFromComment(commentBody: string, targetMod: string = 'godhand'): Partial<CiSession> | null {
  if (!commentBody) return null;

  const match = commentBody.match(/<!--\s*GODHAND_CI_SESSION:\s*(\{.*?\})\s*-->/);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const cleanDownload = cleanActionsUrl(data.artifactUrl);
      const fallbackRunUrl = data.runId ? `https://github.com/JONIMONI09/GodHand-Studio/actions/runs/${data.runId}` : undefined;
      const target = data.target || targetMod || 'godhand';
      const directReleaseUrl = resolveReleaseDownloadUrl(target);

      const downloadUrl = (cleanDownload && cleanDownload.includes('/releases/download/'))
        ? cleanDownload
        : (data.status === 'success' ? directReleaseUrl : (cleanDownload || fallbackRunUrl));

      return {
        status: data.status === 'success' ? 'success' : data.status === 'failure' ? 'failed' : 'running',
        runId: data.runId,
        runUrl: fallbackRunUrl,
        artifactUrl: data.artifactUrl,
        artifactDownloadUrl: downloadUrl,
        issueNumber: data.issueNumber
      };
    } catch (_) {}
  }

  // Fallback: heuristic regex
  if (commentBody.includes('Cloud Build') || commentBody.includes('GodHand Studio')) {
    const isSuccess = commentBody.includes('Success') || commentBody.includes('✅');
    const runIdMatch = commentBody.match(/actions\/runs\/(\d+)/);
    const runId = runIdMatch ? runIdMatch[1] : undefined;
    const runUrl = runId ? `https://github.com/JONIMONI09/GodHand-Studio/actions/runs/${runId}` : undefined;
    const directReleaseUrl = resolveReleaseDownloadUrl(targetMod);

    return {
      status: isSuccess ? 'success' : 'failed',
      runId,
      runUrl,
      artifactUrl: runUrl,
      artifactDownloadUrl: isSuccess ? directReleaseUrl : runUrl
    };
  }

  return null;
}

/**
 * Polls GitHub API for live CI status of an active session (both via IssueOps comments and public Actions runs)
 */
export async function pollCiSession(
  session: CiSession,
  repo = 'JONIMONI09/GodHand-Studio'
): Promise<CiSession> {
  const updated = { ...session };

  try {
    // 1. If issue number is not known yet, query recent issues with labels: build,task
    if (!updated.issueNumber) {
      const issuesRes = await fetch(`https://api.github.com/repos/${repo}/issues?labels=build,task&state=all&per_page=10`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      });
      if (issuesRes.ok) {
        const issues = await issuesRes.json();
        if (Array.isArray(issues)) {
          // Look for matching session ID in issue body or title
          const found = issues.find((iss: any) => 
            (iss.body && iss.body.includes(session.id)) ||
            (iss.title && iss.title.includes(session.targetMod))
          );
          if (found) {
            updated.issueNumber = found.number;
            updated.issueUrl = found.html_url;
            updated.logs.push(`[CI Bridge] Linked GitHub Issue #${found.number}: ${found.title}`);
          }
        }
      }
    }

    // 2. If issue number is known, poll issue comments for CI delivery
    if (updated.issueNumber) {
      const commentsRes = await fetch(`https://api.github.com/repos/${repo}/issues/${updated.issueNumber}/comments?per_page=10`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      });
      if (commentsRes.ok) {
        const comments = await commentsRes.json();
        if (Array.isArray(comments) && comments.length > 0) {
          // Check from newest to oldest
          for (let i = comments.length - 1; i >= 0; i--) {
            const comment = comments[i];
            const parsed = parseCiSessionFromComment(comment.body || '', updated.targetMod);
            if (parsed) {
              if (parsed.status) updated.status = parsed.status;
              if (parsed.runId) updated.runId = parsed.runId;
              if (parsed.runUrl) updated.runUrl = parsed.runUrl;
              if (parsed.artifactUrl) updated.artifactUrl = parsed.artifactUrl;
              if (parsed.artifactDownloadUrl) updated.artifactDownloadUrl = parsed.artifactDownloadUrl;
              if (!updated.runUrl && parsed.runId) {
                updated.runUrl = `https://github.com/${repo}/actions/runs/${parsed.runId}`;
              }
              updated.logs.push(`[CI Bridge] Received CI update from GitHub IssueOps: ${updated.status.toUpperCase()}`);
              saveCiSession(updated);
              return updated;
            }
          }
        }
      }
    }

    // 3. Fallback: Query public GitHub Actions workflow runs (Zero-Tokens required, no issue required)
    const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    });
    if (runsRes.ok) {
      const runsData = await runsRes.json();
      const runs = runsData.workflow_runs;
      if (Array.isArray(runs) && runs.length > 0) {
        const relevantRun = runs.find((r: any) => 
          r.name === 'Java CI with Gradle' || 
          r.name === 'GodHand Continuous Integration' ||
          r.event === 'issues' ||
          r.event === 'push' ||
          r.event === 'workflow_dispatch'
        ) || runs[0];

        if (relevantRun) {
          updated.runId = String(relevantRun.id);
          updated.runUrl = relevantRun.html_url || `https://github.com/${repo}/actions/runs/${relevantRun.id}`;
          
          if (relevantRun.status === 'in_progress' || relevantRun.status === 'queued') {
            updated.status = 'running';
            updated.logs.push(`[GitHub Actions] Workflow run #${relevantRun.id} is active (${relevantRun.status})`);
          } else if (relevantRun.status === 'completed') {
            const isSuccess = relevantRun.conclusion === 'success';
            updated.status = isSuccess ? 'success' : 'failed';
            const releaseUrl = resolveReleaseDownloadUrl(updated.targetMod, '1.0.0', repo);
            updated.artifactDownloadUrl = isSuccess ? releaseUrl : updated.runUrl;
            updated.logs.push(`[GitHub Actions] Workflow run #${relevantRun.id} finished with conclusion: ${relevantRun.conclusion}`);
            if (isSuccess) {
              updated.logs.push(`[Direct Delivery] Public 1-click download ready: ${releaseUrl}`);
            }
          }
        }
      }
    }
  } catch (err: any) {
    updated.logs.push(`[CI Bridge] Polling notice: ${err.message || 'Waiting for runner'}`);
  }

  saveCiSession(updated);
  return updated;
}
