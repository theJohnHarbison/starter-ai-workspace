#!/usr/bin/env node
/**
 * AI Workspace MCP Server
 *
 * Exposes workspace tools via Model Context Protocol for Claude Code.
 * Based on research:
 * - MCP Multi-Agent Framework (arXiv:2504.21030v1)
 *
 * Available Tools:
 * - session-search: Search past sessions semantically
 * - knowledge-query: Query the knowledge graph
 * - role-recommend: Get role recommendations for a task
 *
 * Usage:
 *   Add to .mcp.json:
 *   {
 *     "mcpServers": {
 *       "workspace": {
 *         "command": "node",
 *         "args": ["extensions/workspace-mcp/dist/index.js"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Import workspace tools
import { sessionSearchTool, executeSessionSearch } from './tools/session-search.js';
import { knowledgeQueryTool, executeKnowledgeQuery } from './tools/knowledge-query.js';
import { roleRecommendTool, executeRoleRecommend } from './tools/role-recommend.js';

// Define available tools
const TOOLS: Tool[] = [
  sessionSearchTool,
  knowledgeQueryTool,
  roleRecommendTool,
];

// Tool execution handlers
const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  'session-search': executeSessionSearch,
  'knowledge-query': executeKnowledgeQuery,
  'role-recommend': executeRoleRecommend,
};

async function main() {
  const server = new Server(
    {
      name: 'ai-workspace',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args || {});
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('AI Workspace MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
