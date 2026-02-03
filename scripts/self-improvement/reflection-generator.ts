#!/usr/bin/env ts-node
/**
 * Reflection Generator (Reflexion): Detect failures in sessions,
 * generate reflections, and store them in Qdrant for future retrieval.
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
import * as ollama from './ollama-client';
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

interface FailureSignal {
  type: 'retry-loop' | 'backtracking' | 'git-revert' | 'error-message';
  description: string;
  context: string;
  sessionId: string;
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
 * Generate a reflection from a failure signal using Ollama.
 */
async function generateReflection(failure: FailureSignal): Promise<Reflection | null> {
  const prompt = `A developer assistant encountered this failure during a session:

Type: ${failure.type}
Description: ${failure.description}
Context: ${failure.context}

Analyze this failure and provide:
1. ROOT_CAUSE: What went wrong (one sentence)
2. REFLECTION: What should have been done differently (one sentence)
3. PREVENTION_RULE: A specific rule to prevent this in the future (under 50 words)

Format your response exactly as:
ROOT_CAUSE: ...
REFLECTION: ...
PREVENTION_RULE: ...`;

  try {
    const response = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 300 });

    const rootCause = response.match(/ROOT_CAUSE:\s*(.+)/)?.[1]?.trim() || '';
    const reflection = response.match(/REFLECTION:\s*(.+)/)?.[1]?.trim() || '';
    const preventionRule = response.match(/PREVENTION_RULE:\s*(.+)/)?.[1]?.trim() || '';

    if (!rootCause || !reflection || !preventionRule) return null;

    return {
      session_id: failure.sessionId,
      date: new Date().toISOString(),
      failure_description: failure.description,
      root_cause: rootCause,
      reflection,
      prevention_rule: preventionRule,
      quality_score: 0, // Will be scored later
    };
  } catch {
    return null;
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

  let stored = 0;
  for (const failure of failures) {
    const reflection = await generateReflection(failure);
    if (!reflection) continue;

    // Embed and store the reflection
    const reflectionText = `${reflection.failure_description} | ${reflection.root_cause} | ${reflection.reflection}`;
    try {
      const embedding = await ollama.embed(reflectionText);
      await qdrant.storeReflection(
        `reflection-${sessionId}-${stored}`,
        embedding,
        reflection as unknown as Record<string, unknown>
      );
      stored++;
      console.log(`  Stored reflection: ${reflection.root_cause.substring(0, 80)}`);

      // Optionally stage a prevention rule
      if (reflection.prevention_rule) {
        await addRule(reflection.prevention_rule, 'reflection', [sessionId]);
      }
    } catch (err) {
      console.error(`  Failed to store reflection:`, (err as Error).message);
    }
  }

  return stored;
}

/**
 * Process all sessions or a specific one.
 */
export async function generateReflections(sessionPath?: string): Promise<number> {
  console.log('Reflection Generator (Reflexion)');
  console.log('='.repeat(40));

  const ollamaOk = await ollama.isOllamaAvailable();
  if (!ollamaOk) {
    console.error('Ollama is not available.');
    return 0;
  }

  const qdrantOk = await qdrant.isQdrantAvailable();
  if (!qdrantOk) {
    console.error('Qdrant is not available.');
    return 0;
  }

  if (sessionPath) {
    return processSession(sessionPath);
  }

  // Process all sessions
  if (!fs.existsSync(SESSIONS_DIR)) {
    console.log('No sessions directory found.');
    return 0;
  }

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  console.log(`Processing ${files.length} session file(s)...\n`);

  let total = 0;
  for (const file of files) {
    try {
      const count = await processSession(path.join(SESSIONS_DIR, file));
      total += count;
    } catch (err) {
      console.error(`Error processing ${file}:`, (err as Error).message);
    }
  }

  console.log(`\nDone. Generated ${total} reflection(s).`);
  return total;
}

async function main(): Promise<void> {
  const sessionPath = process.argv[2];
  await generateReflections(sessionPath);
}

if (require.main === module) {
  main().catch(console.error);
}
