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

export function parseCiSessionFromComment(commentBody) {
  if (!commentBody) return null;

  const match = commentBody.match(/<!--\s*GODHAND_CI_SESSION:\s*(\{.*?\})\s*-->/);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      return {
        status: data.status === 'success' ? 'success' : data.status === 'failure' ? 'failed' : 'running',
        runId: data.runId,
        artifactUrl: data.artifactUrl,
        artifactDownloadUrl: data.artifactUrl || (data.runId ? `https://github.com/JONIMONI09/GodHand-Studio/actions/runs/${data.runId}/artifacts` : undefined),
        issueNumber: data.issueNumber
      };
    } catch (_) {}
  }

  if (commentBody.includes('Cloud Build completed')) {
    const isSuccess = commentBody.includes('Success') || commentBody.includes('✅');
    const runIdMatch = commentBody.match(/actions\/runs\/(\d+)/);
    const runId = runIdMatch ? runIdMatch[1] : undefined;

    return {
      status: isSuccess ? 'success' : 'failed',
      runId,
      artifactUrl: runId ? `https://github.com/JONIMONI09/GodHand-Studio/actions/runs/${runId}/artifacts` : undefined,
      artifactDownloadUrl: runId ? `https://github.com/JONIMONI09/GodHand-Studio/actions/runs/${runId}/artifacts` : undefined
    };
  }

  return null;
}
