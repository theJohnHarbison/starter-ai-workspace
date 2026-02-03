#!/usr/bin/env ts-node
/**
 * Maintenance: Orchestrate all self-improvement tasks.
 *
 * Runs:
 * 1. Insight extraction (ExpeL)
 * 2. Reinforcement tracking
 * 3. Pruning stale rules
 * 4. Stats summary
 *
 * Usage:
 *   npm run self:maintenance
 *   ts-node maintenance.ts --dry-run
 */

import { extractInsights } from './insight-extractor';
import { trackReinforcement } from './reinforcement-tracker';
import { pruneStaleRules, showStats } from './reinforcement-tracker';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  console.log('╔══════════════════════════════════════╗');
  console.log('║   Self-Improvement Maintenance Run   ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Step 1: Extract insights
  console.log('─── Step 1: Insight Extraction ───\n');
  try {
    await extractInsights({ dryRun });
  } catch (err) {
    console.error('Insight extraction failed:', (err as Error).message);
  }

  // Step 2: Track reinforcement
  console.log('\n─── Step 2: Reinforcement Tracking ───\n');
  try {
    await trackReinforcement();
  } catch (err) {
    console.error('Reinforcement tracking failed:', (err as Error).message);
  }

  // Step 3: Prune stale rules
  console.log('\n─── Step 3: Pruning ───\n');
  try {
    const result = pruneStaleRules();
    console.log(`Pruned: ${result.pruned}, Flagged: ${result.flagged}`);
  } catch (err) {
    console.error('Pruning failed:', (err as Error).message);
  }

  // Step 4: Stats
  console.log('\n─── Summary ───\n');
  try {
    await showStats();
  } catch (err) {
    console.error('Stats failed:', (err as Error).message);
  }

  console.log('\nMaintenance complete.');
}

main().catch(console.error);
