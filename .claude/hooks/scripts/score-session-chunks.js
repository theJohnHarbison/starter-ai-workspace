#!/usr/bin/env node
/**
 * Score current session's chunks on session end.
 *
 * Called from SessionEnd hook. Behavior depends on exit reason:
 * - exit: Mark chunks as pending (fast, don't block exit)
 * - clear/other: Score immediately
 *
 * Requires session to be embedded first (export-conversation.js runs before this).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'session-embeddings';

async function scoreSessionChunks() {
  try {
    // Read hook input from stdin
    const stdinBuffer = [];
    for await (const chunk of process.stdin) {
      stdinBuffer.push(chunk);
    }

    if (stdinBuffer.length === 0) return;

    const stdinData = Buffer.concat(stdinBuffer).toString();
    const hookInput = JSON.parse(stdinData);

    const sessionId = hookInput.session_id;
    const reason = hookInput.reason || 'exit';

    if (!sessionId) return;

    // Check if Qdrant is available
    const healthCheck = await fetch(`${QDRANT_URL}/health`);
    if (!healthCheck.ok) return;

    const workspaceRoot = findWorkspaceRoot();

    // First, embed the session if not already done
    // (export-conversation.js should have created the JSON file)
    const sessionsDir = path.join(workspaceRoot, '.claude/logs/sessions');
    const sessionFile = fs.readdirSync(sessionsDir)
      .filter(f => f.includes(sessionId) && f.endsWith('.json'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(sessionsDir, a));
        const statB = fs.statSync(path.join(sessionsDir, b));
        return statB.mtimeMs - statA.mtimeMs;
      })[0];

    if (!sessionFile) {
      // No session file yet - can't score
      return;
    }

    // Run embedder for this session
    try {
      execSync(
        `npx ts-node "${path.join(workspaceRoot, 'scripts/session-embedder/embedder.ts')}"`,
        {
          cwd: workspaceRoot,
          stdio: 'pipe',
          timeout: 60000, // 1 minute for embedding
        }
      );
    } catch (e) {
      // Embedding failed - continue anyway, chunks may already exist
    }

    // Check if this is an exit (no time for full scoring)
    if (reason === 'exit' || reason === 'logout') {
      // Mark this session's unscored chunks as pending
      const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 1000,
          filter: {
            must: [{ key: 'session_id', match: { value: sessionId } }],
            must_not: [{ key: 'quality_score', match: { any: [0,1,2,3,4,5,6,7,8,9,10] } }]
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const points = data.result?.points || [];

        if (points.length > 0) {
          // Mark as pending
          await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/payload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              points: points.map(p => p.id),
              payload: { pending_score: true },
            }),
          });
        }
      }
    } else {
      // Not an exit - we have time to score
      try {
        execSync(
          `npx ts-node "${path.join(workspaceRoot, 'scripts/session-embedder/quality-scorer.ts')}" --session "${sessionId}"`,
          {
            cwd: workspaceRoot,
            stdio: 'pipe',
            timeout: 120000, // 2 minutes for scoring
          }
        );
      } catch (e) {
        // Scoring failed - will be picked up as pending next session
      }
    }

  } catch (error) {
    // Silent failure - don't disrupt session end
    const debugLog = path.join(process.cwd(), '.claude/logs/score-session-debug.log');
    try {
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] ERROR: ${error.message}\n`);
    } catch (e) {}
  }
}

function findWorkspaceRoot() {
  let current = process.cwd();

  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

scoreSessionChunks().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(0);
});
