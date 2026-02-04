#!/usr/bin/env ts-node
/**
 * Reinforcement Tracker: Track which rules are being reinforced by
 * session activity, and prune stale ones.
 *
 * Usage:
 *   ts-node reinforcement-tracker.ts track    # Update reinforcement counts
 *   ts-node reinforcement-tracker.ts prune    # Remove stale rules
 *   ts-node reinforcement-tracker.ts stats    # Show rule statistics
 */

import * as fs from 'fs';
import * as path from 'path';
import { Rule, Config } from './types';
import { embed } from '../shared/embedder';
import * as qdrant from './qdrant-client';
import { loadRules, saveRules, writeRulesToClaudeMd } from './proposal-manager';
import { execSync } from 'child_process';

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
const RULES_PATH = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/rules.json');
const CLAUDE_MD_PATH = path.join(WORKSPACE_ROOT, 'CLAUDE.md');

function loadConfig(): Config {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * Track reinforcement: for each active rule, search recent session chunks
 * for conceptual matches and increment reinforcement count.
 */
export async function trackReinforcement(): Promise<void> {
  const rules = loadRules();
  const activeRules = rules.filter(r => r.status === 'active');

  if (activeRules.length === 0) {
    console.log('No active rules to track.');
    return;
  }

  const qdrantOk = await qdrant.isQdrantAvailable();

  if (!qdrantOk) {
    console.error('Qdrant not available.');
    return;
  }

  console.log(`Tracking reinforcement for ${activeRules.length} active rule(s)...`);

  let updated = 0;
  for (const rule of activeRules) {
    const embedding = await embed(rule.text);
    const results = await qdrant.searchSessions(embedding, 5, { min: 6 });

    // Count recent matches (last 7 days) that aren't from the rule's source sessions
    const recentMatches = results.filter(r => {
      const date = r.payload.date as string;
      if (!date) return false;
      const daysSince = (Date.now() - new Date(date).getTime()) / 86400000;
      const sessionId = r.payload.session_id as string;
      return daysSince <= 7 && !rule.sourceSessionIds.includes(sessionId) && r.score >= 0.7;
    });

    if (recentMatches.length > 0) {
      rule.reinforcementCount += recentMatches.length;
      rule.lastReinforced = new Date().toISOString();
      updated++;
      console.log(`  [${rule.id}] +${recentMatches.length} reinforcement(s): "${rule.text.substring(0, 60)}..."`);
    }
  }

  if (updated > 0) {
    saveRules(rules);
    console.log(`\nUpdated ${updated} rule(s).`);
  } else {
    console.log('No reinforcements detected.');
  }
}

/**
 * Prune stale rules: flag rules that haven't been reinforced recently.
 */
export function pruneStaleRules(): { pruned: number; flagged: number } {
  const config = loadConfig();
  const rules = loadRules();
  const now = Date.now();

  let pruned = 0;
  let flagged = 0;

  for (const rule of rules) {
    if (rule.status !== 'active') continue;

    // Rules with high reinforcement are exempt
    if (rule.reinforcementCount >= 10) continue;

    const daysSinceReinforced = (now - new Date(rule.lastReinforced).getTime()) / 86400000;

    if (daysSinceReinforced > config.stalenessThresholdDays &&
        rule.reinforcementCount < config.minReinforcementsToKeep) {
      rule.status = 'retired';
      pruned++;
      console.log(`  Retired (stale): "${rule.text.substring(0, 60)}..." (${Math.round(daysSinceReinforced)}d, ${rule.reinforcementCount} reinforcements)`);
    } else if (daysSinceReinforced > config.stalenessThresholdDays / 2) {
      flagged++;
      console.log(`  Warning (aging): "${rule.text.substring(0, 60)}..." (${Math.round(daysSinceReinforced)}d)`);
    }
  }

  if (pruned > 0) {
    saveRules(rules);
    writeRulesToClaudeMd(rules);

    // Git commit
    try {
      execSync(`git add "${RULES_PATH}" "${CLAUDE_MD_PATH}"`, { cwd: WORKSPACE_ROOT, stdio: 'pipe' });
      execSync(`git commit -m "chore(self-improve): prune ${pruned} stale rule(s)\n\nCo-Authored-By: Claude <noreply@anthropic.com>"`, {
        cwd: WORKSPACE_ROOT,
        stdio: 'pipe',
      });
    } catch { /* ignore */ }
  }

  return { pruned, flagged };
}

/**
 * Show statistics about the rule system.
 */
export async function showStats(): Promise<void> {
  const rules = loadRules();
  const config = loadConfig();

  const active = rules.filter(r => r.status === 'active');
  const proposed = rules.filter(r => r.status === 'proposed');
  const retired = rules.filter(r => r.status === 'retired');
  const stale = rules.filter(r => r.status === 'stale');

  console.log('Self-Improvement Statistics');
  console.log('='.repeat(40));
  console.log(`\nRules:`);
  console.log(`  Active:   ${active.length} / ${config.maxActiveRules} max`);
  console.log(`  Proposed: ${proposed.length}`);
  console.log(`  Retired:  ${retired.length}`);
  console.log(`  Stale:    ${stale.length}`);

  if (active.length > 0) {
    const avgReinforcement = active.reduce((s, r) => s + r.reinforcementCount, 0) / active.length;
    const proven = active.filter(r => r.reinforcementCount >= 10);
    console.log(`\n  Avg reinforcement: ${avgReinforcement.toFixed(1)}`);
    console.log(`  Proven (10+):      ${proven.length}`);
  }

  // Source breakdown
  const bySrc = new Map<string, number>();
  for (const r of active) {
    bySrc.set(r.source, (bySrc.get(r.source) || 0) + 1);
  }
  if (bySrc.size > 0) {
    console.log(`\n  By source:`);
    for (const [src, count] of Array.from(bySrc.entries())) {
      console.log(`    ${src}: ${count}`);
    }
  }

  // Reflections stats
  try {
    const reflectionStats = await qdrant.getReflectionStats();
    console.log(`\nReflections: ${reflectionStats.count}`);
  } catch {
    console.log('\nReflections: (Qdrant unavailable)');
  }

  // Skill candidates
  const candidatesDir = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/skill-candidates');
  if (fs.existsSync(candidatesDir)) {
    const candidates = fs.readdirSync(candidatesDir).filter(f => f.endsWith('.json'));
    console.log(`Skill candidates: ${candidates.length}`);
    for (const f of candidates) {
      console.log(`  - ${f.replace('.json', '')}`);
    }
  }

  console.log(`\nConfig: mode=${config.approvalMode}, maxRules=${config.maxActiveRules}, staleness=${config.stalenessThresholdDays}d`);
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'stats';

  switch (command) {
    case 'track':
      await trackReinforcement();
      break;
    case 'prune':
      console.log('Pruning stale rules...');
      const result = pruneStaleRules();
      console.log(`\nPruned: ${result.pruned}, Flagged: ${result.flagged}`);
      break;
    case 'stats':
      await showStats();
      break;
    default:
      console.log('Usage: reinforcement-tracker.ts [track|prune|stats]');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
