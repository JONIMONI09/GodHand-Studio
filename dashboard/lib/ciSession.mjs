/**
 * Pure ESM CI Session helper for testing and runtime
 */

export function createCiSession(targetMod = 'godhand', issueNumber) {
  const sessionId = `ci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const session = {
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
  return session;
}

import { cleanActionsUrl, resolveReleaseDownloadUrl } from './modVersion.mjs';

export function parseCiSessionFromComment(commentBody, targetMod = 'godhand') {
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
 * Polls GitHub Actions runs, releases, and issue comments without requiring authentication or tokens.
 */
export async function pollCiSession(session, repo = 'JONIMONI09/GodHand-Studio') {
  const updated = { ...session };

  try {
    // 1. If issue number is known, poll issue comments for IssueOps delivery
    if (updated.issueNumber) {
      const commentsRes = await fetch(`https://api.github.com/repos/${repo}/issues/${updated.issueNumber}/comments?per_page=10`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      });
      if (commentsRes.ok) {
        const comments = await commentsRes.json();
        if (Array.isArray(comments) && comments.length > 0) {
          for (let i = comments.length - 1; i >= 0; i--) {
            const comment = comments[i];
            const parsed = parseCiSessionFromComment(comment.body || '', updated.targetMod);
            if (parsed) {
              if (parsed.status) updated.status = parsed.status;
              if (parsed.runId) updated.runId = parsed.runId;
              if (parsed.runUrl) updated.runUrl = parsed.runUrl;
              if (parsed.artifactUrl) updated.artifactUrl = parsed.artifactUrl;
              if (parsed.artifactDownloadUrl) updated.artifactDownloadUrl = parsed.artifactDownloadUrl;
              updated.logs.push(`[CI Bridge] Received CI update from GitHub IssueOps: ${updated.status.toUpperCase()}`);
              return updated;
            }
          }
        }
      }
    }

    // 2. Poll public GitHub Actions workflow runs (Zero Tokens required)
    const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    });
    if (runsRes.ok) {
      const runsData = await runsRes.json();
      const runs = runsData.workflow_runs;
      if (Array.isArray(runs) && runs.length > 0) {
        const relevantRun = runs.find(r => 
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
  } catch (err) {
    updated.logs.push(`[CI Bridge] Polling notice: ${err.message || 'Waiting for runner'}`);
  }

  return updated;
}

