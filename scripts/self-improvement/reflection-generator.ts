#!/usr/bin/env ts-node
/**
 * Reflection Generator (Reflexion): Detect failures in sessions,
 * generate reflections using Claude CLI, and store them in Qdrant.
 *
 * Failure signals:
 * - Tool errors followed by 3+ retries
 * - Same file edited 3+ times in sequence (backtracking)
 * - Git reset/revert operations
 * - Explicit error messages in assistant output
 *
 * Usage:
 *   npm run self:generate-reflections
 *   ts-node reflection-generator.ts [session-file.json]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Reflection } from './types';
import * as claude from './claude-client';
import { embed } from '../shared/embedder';
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
const SESSIONS_DIR = path.join(WORKSPACE_ROOT, '.claude/logs/sessions');
const REFLECTION_STATE_PATH = path.join(WORKSPACE_ROOT, 'scripts/self-improvement/reflection-state.json');

interface FailureSignal {
  type: 'retry-loop' | 'backtracking' | 'git-revert' | 'error-message';
  description: string;
  context: string;
  sessionId: string;
}

interface ReflectionState {
  processedSessions: Record<string, { date: string; failureCount: number }>;
}

function loadReflectionState(): ReflectionState {
  try {
    return JSON.parse(fs.readFileSync(REFLECTION_STATE_PATH, 'utf8'));
  } catch {
    return { processedSessions: {} };
  }
}

function saveReflectionState(state: ReflectionState): void {
  fs.writeFileSync(REFLECTION_STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

/**
 * Detect failure patterns in a session's messages.
 */
export function detectFailures(sessionData: Record<string, unknown>, sessionId: string): FailureSignal[] {
  const failures: FailureSignal[] = [];
  const messages = (sessionData.messages as Array<Record<string, unknown>>) || [];

  // Track file edits for backtracking detection
  const fileEditSequence: string[] = [];
  // Track tool errors for retry detection
  let consecutiveErrors = 0;
  let lastErrorContext = '';

  for (const msg of messages) {
    const inner = (msg.message as Record<string, unknown>) || msg;
    const role = inner.role as string;
    const content = typeof inner.content === 'string'
      ? inner.content
      : JSON.stringify(inner.content || '');

    if (!content) continue;

    // Check for tool errors / retries
    if (role === 'assistant') {
      const hasError = /error|failed|Error:|FAILED|exception/i.test(content);
      if (hasError) {
        consecutiveErrors++;
        lastErrorContext = content.substring(0, 500);
        if (consecutiveErrors >= 3) {
          failures.push({
            type: 'retry-loop',
            description: `${consecutiveErrors} consecutive errors detected`,
            context: lastErrorContext,
            sessionId,
          });
          consecutiveErrors = 0;
        }
      } else {
        consecutiveErrors = 0;
      }
    }

    // Track file edits for backtracking
    const editMatch = content.match(/(?:Edit|Write)\s+(?:file\s+)?['"]?([^\s'"]+)/i);
    if (editMatch) {
      const file = editMatch[1];
      fileEditSequence.push(file);

      // Check last N edits for same file
      const recent = fileEditSequence.slice(-6);
      const counts = new Map<string, number>();
      for (const f of recent) {
        counts.set(f, (counts.get(f) || 0) + 1);
      }
      for (const [f, count] of Array.from(counts.entries())) {
        if (count >= 3) {
          failures.push({
            type: 'backtracking',
            description: `File "${f}" edited ${count} times in recent sequence`,
            context: content.substring(0, 500),
            sessionId,
          });
        }
      }
    }

    // Check for git reset/revert
    if (/git\s+(reset|revert|checkout\s+--)/i.test(content)) {
      failures.push({
        type: 'git-revert',
        description: 'Git reset/revert operation detected',
        context: content.substring(0, 500),
        sessionId,
      });
    }
  }

  return failures;
}

/**
 * Generate reflections from multiple failures in one Claude call.
 */
async function generateReflections(failures: FailureSignal[]): Promise<Array<Reflection | null>> {
  if (failures.length === 0) return [];

  const prompt = `Analyze these failures from a developer assistant session and provide reflections.

${failures.map((f, i) => `
=== FAILURE ${i + 1} ===
Type: ${f.type}
Description: ${f.description}
Context: ${f.context.substring(0, 400)}
`).join('\n')}

For EACH failure, provide:
- ROOT_CAUSE: What went wrong (one sentence)
- REFLECTION: What should have been done differently (one sentence)
- PREVENTION_RULE: A specific rule to prevent this in the future (under 50 words)

Format each as:
FAILURE N:
ROOT_CAUSE: ...
REFLECTION: ...
PREVENTION_RULE: ...`;

  try {
    const response = await claude.generate(prompt);

    // Parse responses for each failure
    const results: Array<Reflection | null> = [];

    for (let i = 0; i < failures.length; i++) {
      const failure = failures[i];
      const pattern = new RegExp(
        `FAILURE\\s*${i + 1}[:\\s]*[\\s\\S]*?ROOT_CAUSE:\\s*(.+?)\\s*REFLECTION:\\s*(.+?)\\s*PREVENTION_RULE:\\s*(.+?)(?=FAILURE\\s*\\d|$)`,
        'i'
      );
      const match = response.match(pattern);

      if (match) {
        results.push({
          session_id: failure.sessionId,
          date: new Date().toISOString(),
          failure_description: failure.description,
          root_cause: match[1].trim(),
          reflection: match[2].trim(),
          prevention_rule: match[3].trim(),
          quality_score: 0,
        });
      } else {
        results.push(null);
      }
    }

    return results;
  } catch {
    return failures.map(() => null);
  }
}

/**
 * Store a reflection in Qdrant and optionally stage a prevention rule.
 */
async function storeReflection(reflection: Reflection, sessionId: string, index: number): Promise<boolean> {
  const reflectionText = `${reflection.failure_description} | ${reflection.root_cause} | ${reflection.reflection}`;
  try {
    const embedding = await embed(reflectionText);
    await qdrant.storeReflection(
      `reflection-${sessionId}-${index}`,
      embedding,
      reflection as unknown as Record<string, unknown>
    );
    console.log(`  Stored reflection: ${reflection.root_cause.substring(0, 80)}`);

    if (reflection.prevention_rule) {
      await addRule(reflection.prevention_rule, 'reflection', [sessionId]);
    }
    return true;
  } catch (err) {
    console.error(`  Failed to store reflection:`, (err as Error).message);
    return false;
  }
}

/**
 * Process a session file for failures and generate reflections.
 */
export async function processSession(sessionPath: string): Promise<number> {
  const sessionId = path.basename(sessionPath, '.json');
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  const failures = detectFailures(sessionData, sessionId);

  if (failures.length === 0) return 0;

  console.log(`Found ${failures.length} failure signal(s) in session ${sessionId}`);

  // Generate reflections in batch
  const reflections = await generateReflections(failures);

  let stored = 0;
  for (let i = 0; i < reflections.length; i++) {
    const reflection = reflections[i];
    if (!reflection) continue;

    if (await storeReflection(reflection, sessionId, stored)) {
      stored++;
    }
  }

  return stored;
}

/**
 * Process all sessions or a specific one.
 * Uses a two-pass approach for batch processing:
 *   Pass 1 (fast, no Claude): detectFailures() on all unprocessed sessions
 *   Pass 2 (slow, Claude): batch failures into groups of ~10
 */
export async function generateReflectionsFromSessions(sessionPath?: string): Promise<number> {
  console.log('Reflection Generator (Reflexion) - Claude CLI');
  console.log('='.repeat(40));

  const claudeOk = await claude.isClaudeAvailable();
  if (!claudeOk) {
    console.error('Claude CLI is not available.');
    return 0;
  }

  const qdrantOk = await qdrant.isQdrantAvailable();
  if (!qdrantOk) {
    console.error('Qdrant is not available.');
    return 0;
  }

  // Single session mode bypasses state tracking
  if (sessionPath) {
    return processSession(sessionPath);
  }

  // Process all sessions with state tracking
  if (!fs.existsSync(SESSIONS_DIR)) {
    console.log('No sessions directory found.');
    return 0;
  }

  const state = loadReflectionState();
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const unprocessed = files.filter(f => {
    const sessionId = path.basename(f, '.json');
    return !state.processedSessions[sessionId];
  });

  console.log(`Processing ${unprocessed.length} unprocessed sessions (${files.length - unprocessed.length} skipped)...\n`);

  if (unprocessed.length === 0) {
    console.log('No new sessions to process.');
    return 0;
  }

  // Pass 1: Detect failures in all unprocessed sessions (fast, no Claude)
  const allFailures: FailureSignal[] = [];
  const sessionFailureCounts: Record<string, number> = {};

  for (const file of unprocessed) {
    const sessionId = path.basename(file, '.json');
    try {
      const sessionData = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8'));
      const failures = detectFailures(sessionData, sessionId);
      sessionFailureCounts[sessionId] = failures.length;
      allFailures.push(...failures);
    } catch (err) {
      console.error(`Error reading ${file}:`, (err as Error).message);
      // Mark as processed to avoid retrying broken files
      state.processedSessions[sessionId] = {
        date: new Date().toISOString(),
        failureCount: 0,
      };
    }
  }

  console.log(`Pass 1: Found ${allFailures.length} failure signal(s) across ${unprocessed.length} sessions`);

  // Pass 2: Batch failures into groups of ~10 and generate reflections
  const BATCH_SIZE = 10;
  let total = 0;

  for (let i = 0; i < allFailures.length; i += BATCH_SIZE) {
    const batch = allFailures.slice(i, i + BATCH_SIZE);
    console.log(`\nPass 2: Processing failure batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} failures)...`);

    try {
      const reflections = await generateReflections(batch);

      for (let j = 0; j < reflections.length; j++) {
        const reflection = reflections[j];
        if (!reflection) continue;

        if (await storeReflection(reflection, batch[j].sessionId, total)) {
          total++;
        }
      }
    } catch (err) {
      console.error(`Error processing batch:`, (err as Error).message);
    }
  }

  // Record all processed sessions in state (even those with 0 failures)
  for (const file of unprocessed) {
    const sessionId = path.basename(file, '.json');
    if (!state.processedSessions[sessionId]) {
      state.processedSessions[sessionId] = {
        date: new Date().toISOString(),
        failureCount: sessionFailureCounts[sessionId] ?? 0,
      };
    }
  }
  saveReflectionState(state);

  console.log(`\nDone. Generated ${total} reflection(s).`);
  return total;
}

async function main(): Promise<void> {
  const sessionPath = process.argv[2];
  await generateReflectionsFromSessions(sessionPath);
}

if (require.main === module) {
  main().catch(console.error);
}
