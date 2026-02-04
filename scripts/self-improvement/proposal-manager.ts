#!/usr/bin/env ts-node
/**
 * Proposal Manager: Stage, review, validate, and apply changes to CLAUDE.md and skills.
 *
 * In autonomous mode: validates via Claude CLI → writes to CLAUDE.md → git commits.
 * In propose-and-confirm mode: stages proposals for manual review.
 *
 * Usage:
 *   ts-node proposal-manager.ts review           # Show recent changes and pending proposals
 *   ts-node proposal-manager.ts apply             # Apply pending proposals
 *   ts-node proposal-manager.ts apply --dry-run   # Preview what would be applied
 *   ts-node proposal-manager.ts add "rule text"   # Add a rule directly
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Rule, StagedChange, Config } from './types';
import * as claude from './claude-client';
import { embed, cosineSimilarity } from '../shared/embedder';

const WORKSPACE_ROOT = findWorkspaceRoot();
const RULES_PATH = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/rules.json');
const CONFIG_PATH = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/config.json');
const STAGED_DIR = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/staged-changes');
const CLAUDE_MD_PATH = path.join(WORKSPACE_ROOT, 'CLAUDE.md');

const LEARNED_RULES_HEADER = '## Learned Rules';
const LEARNED_RULES_MARKER = '<!-- AUTO-MANAGED by self-improvement system. Do not edit manually. -->';

function findWorkspaceRoot(): string {
  if (process.env.WORKSPACE_ROOT) return process.env.WORKSPACE_ROOT;
  let current = process.cwd();
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    if (fs.existsSync(path.join(current, 'package.json'))) {
      try {
        const content = fs.readFileSync(path.join(current, 'package.json'), 'utf8');
        if (content.includes('"name": "ai-workspace"')) return current;
      } catch { /* ignore */ }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function loadConfig(): Config {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function loadRules(): Rule[] {
  try {
    return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export function saveRules(rules: Rule[]): void {
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + '\n');
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Validate a rule using Claude CLI: check coherence, non-contradiction, specificity.
 * Returns { valid: boolean, reason: string }.
 */
export async function validateRule(ruleText: string, existingRules: Rule[]): Promise<{ valid: boolean; reason: string }> {
  const available = await claude.isClaudeAvailable();
  if (!available) {
    return { valid: false, reason: 'Claude CLI unavailable — staging instead of auto-applying' };
  }

  const existingTexts = existingRules
    .filter(r => r.status === 'active')
    .map(r => `- ${r.text}`)
    .join('\n');

  const prompt = `You are a rule validator for a developer assistant. Evaluate this proposed rule:

"${ruleText}"

Existing rules:
${existingTexts || '(none)'}

Check these criteria:
1. SPECIFIC: Is it actionable and specific? (Reject vague rules like "be careful" or "try harder")
2. NON-CONTRADICTING: Does it contradict any existing rule?
3. COHERENT: Is it well-formed and makes sense?
4. CONCISE: Is it under 50 words?

Respond with exactly one line: VALID or INVALID: <reason>`;

  try {
    const response = await claude.generate(prompt);
    const firstLine = response.trim().split('\n')[0];
    if (firstLine.toUpperCase().startsWith('VALID')) {
      return { valid: true, reason: 'Passed validation' };
    }
    const reason = firstLine.replace(/^INVALID:\s*/i, '');
    return { valid: false, reason };
  } catch {
    return { valid: false, reason: 'Validation failed — staging instead' };
  }
}

/**
 * Check if a new rule is too similar to existing rules (deduplication).
 */
export async function isDuplicate(ruleText: string, existingRules: Rule[], threshold: number): Promise<boolean> {
  try {
    const newEmbed = await embed(ruleText);
    for (const rule of existingRules.filter(r => r.status === 'active')) {
      const existingEmbed = await embed(rule.text);
      const sim = cosineSimilarity(newEmbed, existingEmbed);
      if (sim > threshold) return true;
    }
    return false;
  } catch {
    // If embedding fails, do text-based check
    const normalizedNew = ruleText.toLowerCase().trim();
    return existingRules.some(r => r.status === 'active' && r.text.toLowerCase().trim() === normalizedNew);
  }
}

/**
 * Write the Learned Rules section to CLAUDE.md.
 */
export function writeRulesToClaudeMd(rules: Rule[]): void {
  const claudeMd = fs.readFileSync(CLAUDE_MD_PATH, 'utf8');
  const activeRules = rules.filter(r => r.status === 'active');

  // Build the new section
  const lines = [
    LEARNED_RULES_HEADER,
    LEARNED_RULES_MARKER,
  ];

  for (const rule of activeRules) {
    lines.push(`<!-- Rule: ${rule.id} | Reinforced: ${rule.reinforcementCount} | Last: ${rule.lastReinforced.split('T')[0]} -->`);
    lines.push(`- ${rule.text}`);
  }

  if (activeRules.length === 0) {
    lines.push('<!-- No rules yet. Rules are auto-extracted from session analysis. -->');
  }

  const newSection = lines.join('\n') + '\n';

  // Find and replace existing section, or append before the last section
  // Match "## Learned Rules" through to the next "## " heading (handles \r\n)
  const sectionRegex = /## Learned Rules\r?\n[\s\S]*?(?=\r?\n## [^L]|\r?\n---\s*$|$)/;
  let updatedMd: string;

  if (sectionRegex.test(claudeMd)) {
    // Replace ALL occurrences (in case of duplicates from prior bugs)
    updatedMd = claudeMd.replace(sectionRegex, newSection);
    // If somehow there's still a duplicate, remove it
    const secondIdx = updatedMd.indexOf('## Learned Rules', updatedMd.indexOf('## Learned Rules') + 1);
    if (secondIdx !== -1) {
      const nextSection = updatedMd.indexOf('\n## ', secondIdx + 1);
      updatedMd = updatedMd.slice(0, secondIdx) + (nextSection !== -1 ? updatedMd.slice(nextSection + 1) : '');
    }
    updatedMd = updatedMd.replace(/\n{3,}/g, '\n\n');
  } else {
    // Insert before "## Before You Start" or append at end
    const insertBefore = '## Before You Start';
    const insertIdx = claudeMd.indexOf(insertBefore);
    if (insertIdx !== -1) {
      updatedMd = claudeMd.slice(0, insertIdx) + newSection + '\n\n' + claudeMd.slice(insertIdx);
    } else {
      updatedMd = claudeMd + '\n\n' + newSection + '\n';
    }
  }

  fs.writeFileSync(CLAUDE_MD_PATH, updatedMd);
}

/**
 * Create a git commit for a self-improvement change.
 */
function gitCommit(message: string, files: string[]): void {
  try {
    for (const file of files) {
      // Use -f for gitignored files (rules.json), regular add for others
      try {
        execSync(`git add "${file}"`, { cwd: WORKSPACE_ROOT, stdio: 'pipe' });
      } catch {
        execSync(`git add -f "${file}"`, { cwd: WORKSPACE_ROOT, stdio: 'pipe' });
      }
    }
    const fullMessage = `chore(self-improve): ${message}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
    execSync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, {
      cwd: WORKSPACE_ROOT,
      stdio: 'pipe',
    });
  } catch (err) {
    console.error('Git commit failed:', (err as Error).message);
  }
}

/**
 * Stage a proposal for later review.
 */
function stageProposal(change: StagedChange): void {
  if (!fs.existsSync(STAGED_DIR)) {
    fs.mkdirSync(STAGED_DIR, { recursive: true });
  }
  const filePath = path.join(STAGED_DIR, `${change.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(change, null, 2));
}

/**
 * Add a new rule (validates, deduplicates, applies or stages).
 */
export async function addRule(
  ruleText: string,
  source: Rule['source'] = 'manual',
  sourceSessionIds: string[] = [],
  options?: { dryRun?: boolean }
): Promise<{ applied: boolean; reason: string }> {
  const config = loadConfig();
  const rules = loadRules();
  const activeRules = rules.filter(r => r.status === 'active');

  // Check rule cap
  if (activeRules.length >= config.maxActiveRules) {
    // Retire the least-reinforced rule
    const sorted = [...activeRules].sort((a, b) => a.reinforcementCount - b.reinforcementCount);
    const toRetire = sorted[0];
    toRetire.status = 'retired';
    console.log(`Rule cap (${config.maxActiveRules}) reached. Retiring least-reinforced: "${toRetire.text}"`);
  }

  // Deduplication check
  const dup = await isDuplicate(ruleText, rules, config.deduplicationSimilarity);
  if (dup) {
    return { applied: false, reason: 'Duplicate of existing rule' };
  }

  // Validation
  const validation = await validateRule(ruleText, rules);

  const newRule: Rule = {
    id: generateId(),
    text: ruleText,
    source,
    status: 'active',
    reinforcementCount: 0,
    createdAt: new Date().toISOString(),
    lastReinforced: new Date().toISOString(),
    sourceSessionIds,
  };

  if (options?.dryRun) {
    console.log(`[DRY RUN] Would add rule: "${ruleText}"`);
    console.log(`  Validation: ${validation.valid ? 'PASSED' : `FAILED (${validation.reason})`}`);
    return { applied: false, reason: 'Dry run' };
  }

  if (config.approvalMode === 'autonomous' && validation.valid) {
    // Auto-apply
    rules.push(newRule);
    saveRules(rules);
    writeRulesToClaudeMd(rules);
    gitCommit(`add rule: ${ruleText.substring(0, 60)}`, [RULES_PATH, CLAUDE_MD_PATH]);
    return { applied: true, reason: 'Auto-applied (autonomous mode)' };
  } else {
    // Stage for review
    newRule.status = 'proposed';
    rules.push(newRule);
    saveRules(rules);
    stageProposal({
      id: newRule.id,
      type: 'rule',
      description: ruleText,
      content: ruleText,
      status: 'proposed',
      createdAt: newRule.createdAt,
    });
    const reason = validation.valid
      ? 'Staged (propose-and-confirm mode)'
      : `Staged (${validation.reason})`;
    return { applied: false, reason };
  }
}

/**
 * Apply all pending proposals.
 */
export async function applyPending(options?: { dryRun?: boolean }): Promise<void> {
  const rules = loadRules();
  const proposed = rules.filter(r => r.status === 'proposed');

  if (proposed.length === 0) {
    console.log('No pending proposals to apply.');
    return;
  }

  console.log(`Found ${proposed.length} pending proposal(s):\n`);

  let applied = 0;
  for (const rule of proposed) {
    console.log(`  - "${rule.text}"`);
    if (options?.dryRun) {
      console.log(`    [DRY RUN] Would activate`);
      continue;
    }

    const validation = await validateRule(rule.text, rules.filter(r => r.status === 'active'));
    if (validation.valid) {
      rule.status = 'active';
      applied++;
      console.log(`    ✓ Activated`);
    } else {
      console.log(`    ✗ Rejected: ${validation.reason}`);
      rule.status = 'retired';
    }
  }

  if (!options?.dryRun && applied > 0) {
    saveRules(rules);
    writeRulesToClaudeMd(rules);
    gitCommit(`apply ${applied} pending rule(s)`, [RULES_PATH, CLAUDE_MD_PATH]);
    console.log(`\nApplied ${applied} rule(s), committed to git.`);
  }

  // Clean staged files
  if (!options?.dryRun && fs.existsSync(STAGED_DIR)) {
    for (const file of fs.readdirSync(STAGED_DIR)) {
      const filePath = path.join(STAGED_DIR, file);
      try {
        const staged: StagedChange = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (rules.some(r => r.id === staged.id && r.status !== 'proposed')) {
          fs.unlinkSync(filePath);
        }
      } catch { /* ignore */ }
    }
  }
}

/**
 * Show review of current state: active rules, pending proposals, recent changes.
 */
export function review(): void {
  const rules = loadRules();
  const active = rules.filter(r => r.status === 'active');
  const proposed = rules.filter(r => r.status === 'proposed');
  const retired = rules.filter(r => r.status === 'retired');

  console.log('Self-Improvement Review');
  console.log('='.repeat(50));

  console.log(`\nActive rules: ${active.length}`);
  for (const r of active) {
    const age = Math.round((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
    console.log(`  [${r.id}] (reinforced: ${r.reinforcementCount}, ${age}d old) ${r.text}`);
  }

  if (proposed.length > 0) {
    console.log(`\nPending proposals: ${proposed.length}`);
    for (const r of proposed) {
      console.log(`  [${r.id}] ${r.text}`);
    }
  }

  console.log(`\nRetired rules: ${retired.length}`);

  // Check staged changes directory
  if (fs.existsSync(STAGED_DIR)) {
    const stagedFiles = fs.readdirSync(STAGED_DIR).filter(f => f.endsWith('.json'));
    if (stagedFiles.length > 0) {
      console.log(`\nStaged changes: ${stagedFiles.length}`);
      for (const file of stagedFiles) {
        try {
          const staged: StagedChange = JSON.parse(fs.readFileSync(path.join(STAGED_DIR, file), 'utf8'));
          console.log(`  [${staged.type}] ${staged.description}`);
        } catch { /* ignore */ }
      }
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const dryRun = args.includes('--dry-run');

  switch (command) {
    case 'review':
      review();
      break;

    case 'apply':
      await applyPending({ dryRun });
      break;

    case 'add': {
      const ruleText = args.slice(1).filter(a => a !== '--dry-run').join(' ');
      if (!ruleText) {
        console.error('Usage: proposal-manager.ts add "rule text"');
        process.exit(1);
      }
      const result = await addRule(ruleText, 'manual', [], { dryRun });
      console.log(`Result: ${result.reason}`);
      break;
    }

    default:
      console.log('Proposal Manager');
      console.log('');
      console.log('Usage:');
      console.log('  review              Show active rules, pending proposals');
      console.log('  apply               Apply pending proposals');
      console.log('  apply --dry-run     Preview what would be applied');
      console.log('  add "rule text"     Add a rule directly');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}
