#!/usr/bin/env node
/**
 * Check pending self-improvement work on session start.
 *
 * Queries Qdrant for pending chunks and scored chunk counts, then outputs
 * a <pending-self-improvement> block describing what's available.
 * Claude reads this and offers the user a choice via AskUserQuestion.
 *
 * This hook does NOT execute any work — it only reports status.
 * Called from SessionStart hook.
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'session-embeddings';

async function qdrantCount(filter) {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/count`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, exact: true }),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) return 0;
  const data = await response.json();
  return data.result?.count || 0;
}

async function checkPendingWork() {
  try {
    // Check if Qdrant is available
    const healthCheck = await fetch(`${QDRANT_URL}/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!healthCheck.ok) return;

    // Run all three count queries in parallel
    const [pendingCount, highQualityCount, lowQualityCount] = await Promise.all([
      // 1. Pending (unscored) chunks
      qdrantCount({
        must: [{ key: 'pending_score', match: { value: true } }],
      }),
      // 2. High-quality scored chunks (score >= 7)
      qdrantCount({
        must: [{ key: 'quality_score', range: { gte: 7 } }],
      }),
      // 3. Low-quality scored chunks (score <= 3)
      qdrantCount({
        must: [{ key: 'quality_score', range: { lte: 3 } }],
      }),
    ]);

    // Nothing to report
    const insightAvailable = highQualityCount >= 3 && lowQualityCount >= 3;
    if (pendingCount === 0 && !insightAvailable) return;

    // Estimate scoring time (~2 sec per chunk, batched)
    const scoringMinutes = Math.max(1, Math.ceil((pendingCount * 2) / 60));
    const scoringEstimate = `~${scoringMinutes}-${scoringMinutes + 2} min`;

    // Build output block
    const lines = ['<pending-self-improvement>'];

    if (pendingCount > 0) {
      lines.push(`Pending scoring: ${pendingCount} chunks (${scoringEstimate})`);
    }

    if (insightAvailable) {
      lines.push(`Insight extraction ready: ${highQualityCount} high-quality + ${lowQualityCount} low-quality chunks (~3-5 min)`);
    }

    if (pendingCount > 0 && insightAvailable) {
      lines.push(`Full pipeline (score + extract): ~${scoringMinutes + 3}-${scoringMinutes + 5} min`);
    }

    lines.push('</pending-self-improvement>');
    console.log(lines.join('\n'));
  } catch {
    // Silently fail - don't disrupt session start
  }
}

checkPendingWork().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(0);
});
