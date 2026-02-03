#!/usr/bin/env ts-node
/**
 * Insight Extractor (ExpeL): Compare high/low quality session chunks
 * to extract actionable rules using Claude CLI.
 *
 * Algorithm:
 * 1. Query Qdrant for high-quality (>=7) and low-quality (<=3) chunks
 * 2. For each success/failure pair, prompt Claude to extract rules
 * 3. Deduplicate against existing rules
 * 4. Apply or stage via proposal-manager
 *
 * Usage:
 *   npm run self:extract-insights
 *   ts-node insight-extractor.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';
import * as claude from './claude-client';
import * as qdrant from './qdrant-client';
import { addRule } from './proposal-manager';

function findWorkspaceRoot(): string {
  if (process.env.WORKSPACE_ROOT) return process.env.WORKSPACE_ROOT;
  let current = process.cwd();
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();
const CONFIG_PATH = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/config.json');

function loadConfig(): Config {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

interface ChunkGroup {
  highQuality: Array<{ text: string; score: number; sessionId: string }>;
  lowQuality: Array<{ text: string; score: number; sessionId: string }>;
}

/**
 * Fetch scored chunks from Qdrant and group by quality.
 */
async function fetchAndGroupChunks(config: Config): Promise<ChunkGroup> {
  const highQuality: ChunkGroup['highQuality'] = [];
  const lowQuality: ChunkGroup['lowQuality'] = [];

  // Fetch high-quality chunks
  const highPoints = await qdrant.scrollSessions(
    { must: [{ key: 'quality_score', range: { gte: config.qualityThresholdSuccess } }] },
    200
  );

  for (const point of highPoints) {
    const text = (point.payload.chunk_text as string) || (point.payload.text as string) || '';
    if (text.length > 50) {
      highQuality.push({
        text,
        score: point.payload.quality_score as number,
        sessionId: point.payload.session_id as string,
      });
    }
  }

  // Fetch low-quality chunks
  const lowPoints = await qdrant.scrollSessions(
    { must: [{ key: 'quality_score', range: { lte: config.qualityThresholdFailure } }] },
    200
  );

  for (const point of lowPoints) {
    const text = (point.payload.chunk_text as string) || (point.payload.text as string) || '';
    if (text.length > 50) {
      lowQuality.push({
        text,
        score: point.payload.quality_score as number,
        sessionId: point.payload.session_id as string,
      });
    }
  }

  return { highQuality, lowQuality };
}

/**
 * Extract rules by comparing high and low quality chunk pairs using Claude CLI.
 */
async function extractRulesFromPairs(
  group: ChunkGroup,
  maxPairs: number = 10
): Promise<Array<{ text: string; sessionIds: string[] }>> {
  const extracted: Array<{ text: string; sessionIds: string[] }> = [];

  // Take up to maxPairs comparisons
  const pairCount = Math.min(maxPairs, group.highQuality.length, group.lowQuality.length);

  // Build prompts for batching
  const pairs: Array<{ high: typeof group.highQuality[0]; low: typeof group.lowQuality[0] }> = [];
  for (let i = 0; i < pairCount; i++) {
    pairs.push({
      high: group.highQuality[i],
      low: group.lowQuality[i % group.lowQuality.length],
    });
  }

  // Process in batches of 3 pairs per Claude call
  const batchSize = 3;
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);

    const prompt = `Compare these session chunk pairs and extract actionable rules. For each pair, provide 1-2 specific rules (under 50 words each) that explain what made the first chunk successful and the second fail.

${batch.map((pair, idx) => `
=== PAIR ${idx + 1} ===
HIGH QUALITY (score ${pair.high.score}/10):
${pair.high.text.substring(0, 600)}

LOW QUALITY (score ${pair.low.score}/10):
${pair.low.text.substring(0, 600)}
`).join('\n')}

Return ONLY the rules, one per line, starting with "- ". Group by pair number.
Example:
PAIR 1:
- Rule about what worked vs what didn't
PAIR 2:
- Another rule`;

    try {
      const response = await claude.generate(prompt);
      const lines = response.split('\n').filter(l => l.trim().startsWith('- '));

      for (const line of lines) {
        const ruleText = line.replace(/^-\s*/, '').trim();
        if (ruleText.length > 10 && ruleText.length < 200) {
          // Associate with session IDs from this batch
          const sessionIds = batch.flatMap(p => [p.high.sessionId, p.low.sessionId]).filter(Boolean);
          extracted.push({
            text: ruleText,
            sessionIds: [...new Set(sessionIds)],
          });
        }
      }

      process.stdout.write(`\r  Processed ${Math.min(i + batchSize, pairs.length)}/${pairs.length} pairs...`);
    } catch (err) {
      console.error(`\n  Failed to extract from batch ${i / batchSize + 1}:`, (err as Error).message);
    }
  }

  console.log('');
  return extracted;
}

export async function extractInsights(options?: { dryRun?: boolean }): Promise<number> {
  const config = loadConfig();

  console.log('Insight Extractor (ExpeL) - Claude CLI');
  console.log('='.repeat(40));

  // Check services
  const claudeOk = await claude.isClaudeAvailable();
  const qdrantOk = await qdrant.isQdrantAvailable();

  if (!claudeOk) {
    console.error('Claude CLI is not available. Cannot extract insights.');
    return 0;
  }
  if (!qdrantOk) {
    console.error('Qdrant is not available. Cannot extract insights.');
    return 0;
  }

  // Fetch and group chunks
  console.log('Fetching scored session chunks...');
  const group = await fetchAndGroupChunks(config);
  console.log(`Found ${group.highQuality.length} high-quality and ${group.lowQuality.length} low-quality chunks.`);

  if (group.highQuality.length === 0 || group.lowQuality.length === 0) {
    console.log('Need both high and low quality chunks to extract insights.');
    console.log('Run `npm run session:score` first to score session chunks.');
    return 0;
  }

  // Extract rules from pairs
  console.log('\nExtracting rules from chunk comparisons...');
  const candidates = await extractRulesFromPairs(group);
  console.log(`Extracted ${candidates.length} candidate rule(s).`);

  // Apply each candidate
  let applied = 0;
  for (const candidate of candidates) {
    const result = await addRule(
      candidate.text,
      'insight-extraction',
      candidate.sessionIds,
      { dryRun: options?.dryRun }
    );
    if (result.applied) {
      applied++;
      console.log(`  ✓ Applied: "${candidate.text.substring(0, 60)}..."`);
    } else {
      console.log(`  → ${result.reason}: "${candidate.text.substring(0, 60)}..."`);
    }
  }

  console.log(`\nDone. Applied ${applied} of ${candidates.length} candidate(s).`);
  return applied;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await extractInsights({ dryRun });
}

if (require.main === module) {
  main().catch(console.error);
}
