/**
 * Knowledge Query Tool
 *
 * Query the knowledge graph for entities and relationships.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';
import { safeExecNpm } from '../safe-subprocess.js';

/**
 * Find workspace root by looking for .claude directory
 */
function findWorkspaceRoot(): string {
  // Try environment variable first
  if (process.env.WORKSPACE_ROOT) {
    return process.env.WORKSPACE_ROOT;
  }

  let current = process.cwd();

  // Walk up directory tree looking for .claude directory
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) {
      return current;
    }
    if (fs.existsSync(path.join(current, 'package.json'))) {
      try {
        const pkgPath = path.join(current, 'package.json');
        const content = fs.readFileSync(pkgPath, 'utf8');
        if (content.includes('"name": "ai-workspace"')) {
          return current;
        }
      } catch {
        // Ignore read errors
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

export const knowledgeQueryTool: Tool = {
  name: 'knowledge-query',
  description: `Query the workspace knowledge graph for entities and relationships.

The knowledge graph contains:
- Tools: npm packages, frameworks, libraries used
- Concepts: programming patterns, methodologies
- Decisions: architectural choices made
- Files: frequently referenced file paths
- Relationships: connections between sessions via shared entities

Useful for finding related sessions, understanding patterns, and discovering connections.`,
  inputSchema: {
    type: 'object',
    properties: {
      entityName: {
        type: 'string',
        description: 'Name of entity to search for (e.g., "react", "docker", "supabase")',
      },
      entityType: {
        type: 'string',
        enum: ['tool', 'concept', 'decision', 'file', 'action'],
        description: 'Type of entity to filter by',
      },
      action: {
        type: 'string',
        enum: ['find-sessions', 'top-entities', 'stats', 'related'],
        description: 'Action to perform',
        default: 'find-sessions',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        default: 10,
      },
    },
  },
};

export async function executeKnowledgeQuery(args: Record<string, unknown>): Promise<string> {
  const action = String(args.action || 'find-sessions');
  const entityName = String(args.entityName || '');
  const limit = Number(args.limit) || 10;

  try {
    // Use session:search for entity-based queries
    const workspaceRoot = findWorkspaceRoot();

    switch (action) {
      case 'find-sessions': {
        if (!entityName) {
          return 'Error: entityName is required for find-sessions action';
        }

        // Use hybrid search to find sessions mentioning this entity
        const result = await safeExecNpm('hybrid:search', [entityName, `--topk=${limit}`], workspaceRoot);

        if (!result.success) {
          return `No sessions found referencing entity: ${entityName}`;
        }

        return `# Sessions Referencing "${entityName}"\n\n${result.stdout}`;
      }

      case 'top-entities': {
        return `# Top Entities

This feature requires the knowledge linker to be built.
Use \`npm run session:embed\` to generate entity statistics.

For now, use \`session-search\` tool to find sessions mentioning specific entities.`;
      }

      case 'stats': {
        return `# Knowledge Graph Statistics

The knowledge graph is built from session embeddings.
Run \`npm run session:stats\` to view embedding statistics.`;
      }

      case 'related': {
        if (!entityName) {
          return 'Error: entityName (session ID) is required for related action';
        }

        // Search for related content
        const result = await safeExecNpm('hybrid:search', [entityName, `--topk=${limit}`], workspaceRoot);

        if (!result.success) {
          return `No related sessions found for: ${entityName}`;
        }

        return `# Sessions Related to "${entityName}"\n\n${result.stdout}`;
      }

      default:
        return `Unknown action: ${action}. Use: find-sessions, top-entities, stats, or related`;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `Knowledge query failed: ${errorMsg}`;
  }
}
