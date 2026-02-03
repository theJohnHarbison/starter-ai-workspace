#!/usr/bin/env ts-node
/**
 * SessionEnd hook entry point for the self-improvement system.
 *
 * Runs after each session ends:
 * 1. Finds the most recent session export
 * 2. Generates reflections from failures (Reflexion)
 * 3. Checks for novel successes to propose skills (Voyager)
 *
 * Compiled to JS for hook execution:
 *   npx ts-node scripts/self-improvement/on-session-end.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as claude from './claude-client';
import * as ollama from './ollama-client';
import * as qdrant from './qdrant-client';
import { processSession } from './reflection-generator';
import { checkAndProposeSkill } from './skill-generator';

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

/**
 * Find the most recently modified session file.
 */
function findLatestSession(): string | null {
  if (!fs.existsSync(SESSIONS_DIR)) return null;

  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(SESSIONS_DIR, f),
      mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

async function main(): Promise<void> {
  // Check services are up (with short timeout to not block session end)
  const [claudeOk, ollamaOk, qdrantOk] = await Promise.all([
    claude.isClaudeAvailable(),
    ollama.isOllamaAvailable(), // Still needed for embeddings
    qdrant.isQdrantAvailable(),
  ]);

  if (!claudeOk || !ollamaOk || !qdrantOk) {
    // Silently exit if services aren't available
    return;
  }

  const latestSession = findLatestSession();
  if (!latestSession) return;

  try {
    // Phase 3: Generate reflections from failures
    await processSession(latestSession);

    // Phase 4: Check for novel successes to propose skills
    await checkAndProposeSkill(latestSession);
  } catch {
    // Silently fail — don't disrupt session end
  }
}

main();
