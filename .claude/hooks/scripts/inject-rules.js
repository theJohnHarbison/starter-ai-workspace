#!/usr/bin/env node
/**
 * Inject Rules Hook
 * Injects contextually relevant learned rules based on the user's prompt.
 *
 * Uses keyword matching (not embedding) for speed — must complete within
 * the hook timeout (~1s). Reads rules.json directly (no Qdrant dependency).
 *
 * Triggered on: UserPromptSubmit
 */

const fs = require('fs');
const path = require('path');

// Find workspace root
function findWorkspaceRoot() {
  if (process.env.WORKSPACE_ROOT) return process.env.WORKSPACE_ROOT;
  let current = __dirname;
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, 'CLAUDE.md'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();
const RULES_PATH = path.join(WORKSPACE_ROOT, 'scripts', 'self-improvement', 'rules.json');

// Get user prompt from environment
const prompt = (process.env.USER_PROMPT || '').toLowerCase();

if (!prompt) {
  process.exit(0);
}

// Load rules (silent failure if file doesn't exist)
let rules;
try {
  rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
} catch {
  process.exit(0);
}

// Filter to active rules only
const activeRules = rules.filter(r => r.status === 'active');

if (activeRules.length === 0) {
  process.exit(0);
}

// Extract keywords from prompt (lowercase, split on spaces/punctuation)
const promptKeywords = prompt
  .replace(/[^a-z0-9\s\-_.]/g, ' ')
  .split(/\s+/)
  .filter(w => w.length > 2);

if (promptKeywords.length === 0) {
  process.exit(0);
}

// Score each rule by keyword matches against rule text + categories
const scored = [];

for (const rule of activeRules) {
  const ruleText = rule.text.toLowerCase();
  const ruleCategories = (rule.categories || []).join(' ').toLowerCase();
  const searchText = ruleText + ' ' + ruleCategories;

  let score = 0;
  for (const keyword of promptKeywords) {
    if (searchText.includes(keyword)) {
      score++;
    }
  }

  if (score > 0) {
    scored.push({ rule, score });
  }
}

// Sort by relevance score (descending) and take top 5-8
scored.sort((a, b) => b.score - a.score);
const topRules = scored.slice(0, 8).filter(s => s.score >= 2);

// Only output if we have meaningful matches (score >= 2 means at least 2 keyword hits)
if (topRules.length > 0) {
  const ruleLines = topRules.map(s => `- ${s.rule.text}`).join('\n');
  console.log(`Relevant learned rules:\n${ruleLines}`);
}

process.exit(0);
