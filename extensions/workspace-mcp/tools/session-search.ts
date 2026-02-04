/**
 * Session Search Tool
 *
 * Searches past Claude Code sessions using hybrid semantic + entity search.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';
import { safeExecNpm } from '../safe-subprocess.js';

/**
 * Find workspace root by looking for .claude directory
 * Walks up from current working directory
 */
function findWorkspaceRoot(): string {
  let current = process.cwd();

  // Walk up directory tree looking for .claude directory or package.json
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) {
      return current;
    }
    if (fs.existsSync(path.join(current, 'package.json'))) {
      // Check if this is the workspace root (should have .claude nearby)
      if (fs.existsSync(path.join(current, '.claude', 'vector-store'))) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }

  // Final fallback - just use current working directory
  return process.cwd();
}

export const sessionSearchTool: Tool = {
  name: 'session-search',
  description: `Search past Claude Code sessions for relevant context and patterns.

Uses hybrid search combining:
- Semantic similarity (embedding-based)
- Entity matching (tools, concepts, files mentioned)
- Knowledge graph relationships

Returns relevant session excerpts with scores.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query describing what you\'re looking for',
      },
      topK: {
        type: 'number',
        description: 'Number of results to return (default: 5)',
        default: 5,
      },
      tier: {
        type: 'string',
        enum: ['working', 'episodic', 'semantic', 'resource', 'all'],
        description: 'Memory tier to search (default: all)',
        default: 'all',
      },
    },
    required: ['query'],
  },
};

export async function executeSessionSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '');
  const topK = Number(args.topK) || 5;
  const tier = String(args.tier || 'all');

  if (!query) {
    return 'Error: query is required';
  }

  try {
    const workspaceRoot = process.env.WORKSPACE_ROOT || findWorkspaceRoot();

    // Run hybrid:search npm script safely
    const scriptArgs = [query, `--topk=${topK}`];
    if (tier !== 'all') {
      scriptArgs.push(`--tier=${tier}`);
    }

    const result = await safeExecNpm('hybrid:search', scriptArgs, workspaceRoot);

    if (!result.success) {
      throw new Error(result.stderr || 'Search command failed');
    }

    return result.stdout || 'No results found';
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `Search failed: ${errorMsg}

Note: This tool requires:
1. Qdrant running (docker-compose up -d)
2. Session embeddings generated via \`npm run session:embed\`
3. Node.js and npm installed in the workspace`;
  }
}
