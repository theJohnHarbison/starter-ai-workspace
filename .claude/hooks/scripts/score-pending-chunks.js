#!/usr/bin/env node
/**
 * Score pending chunks on session start.
 *
 * Checks for chunks marked as pending_score (from previous interrupted sessions)
 * and scores them using Claude CLI.
 *
 * Called from SessionStart hook.
 */

const { execSync } = require('child_process');
const path = require('path');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'session-embeddings';

async function checkPendingChunks() {
  try {
    // Check if Qdrant is available
    const healthCheck = await fetch(`${QDRANT_URL}/health`);
    if (!healthCheck.ok) return;

    // Check for pending chunks
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 1,
        filter: {
          must: [{ key: 'pending_score', match: { value: true } }]
        }
      }),
    });

    if (!response.ok) return;

    const data = await response.json();
    const pendingCount = data.result?.points?.length || 0;

    if (pendingCount > 0) {
      // There are pending chunks - run the scorer in background
      console.log(`[session-start] Found pending chunks, scoring in background...`);

      // Run scorer for pending chunks only
      const workspaceRoot = findWorkspaceRoot();
      execSync(
        `npx ts-node "${path.join(workspaceRoot, 'scripts/session-embedder/quality-scorer.ts')}" --pending-only`,
        {
          cwd: workspaceRoot,
          stdio: 'inherit',
          timeout: 300000, // 5 minute timeout
        }
      );
    }
  } catch (error) {
    // Silently fail - don't disrupt session start
  }
}

function findWorkspaceRoot() {
  let current = process.cwd();
  const fs = require('fs');

  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

checkPendingChunks().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(0);
});
