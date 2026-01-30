/**
 * Role Recommend Tool
 *
 * Recommends appropriate AI roles based on task description.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

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

export const roleRecommendTool: Tool = {
  name: 'role-recommend',
  description: `Get role recommendations for a task based on workspace role guides.

Available roles include:
- software-engineering: Full-stack development (TypeScript, React, Node.js, etc.)
- swe-supabase: Backend with Supabase
- swe-mobile-expo: Mobile development with Expo/React Native
- swe-csharp: C# and .NET development
- generalist: General problem-solving
- ops-generalist: DevOps and infrastructure
- analyzer: Data analysis and debugging
- ux-designer: Design and UX

Returns recommended role(s) with reasoning.`,
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Description of the task you want to accomplish',
      },
      listAll: {
        type: 'boolean',
        description: 'List all available roles without recommendation',
        default: false,
      },
    },
    required: ['task'],
  },
};

interface RoleInfo {
  name: string;
  path: string;
  keywords: string[];
  description: string;
}

// Role metadata for matching
const ROLES: RoleInfo[] = [
  {
    name: 'Software Engineering Guide',
    path: 'agent/_roles/software-engineering/software-engineering-guide.md',
    keywords: ['typescript', 'javascript', 'react', 'node', 'api', 'backend', 'frontend', 'fullstack', 'web', 'development', 'code', 'programming'],
    description: 'Full-stack development with TypeScript, React, Node.js',
  },
  {
    name: 'Supabase Development',
    path: 'agent/_roles/software-engineering/swe-supabase.md',
    keywords: ['supabase', 'database', 'postgres', 'auth', 'realtime', 'storage', 'edge functions', 'backend'],
    description: 'Backend development with Supabase (database, auth, realtime)',
  },
  {
    name: 'Mobile (Expo)',
    path: 'agent/_roles/software-engineering/swe-mobile-expo.md',
    keywords: ['mobile', 'expo', 'react native', 'ios', 'android', 'app', 'native'],
    description: 'Mobile app development with Expo and React Native',
  },
  {
    name: 'C# Development',
    path: 'agent/_roles/software-engineering/swe-csharp.md',
    keywords: ['csharp', 'c#', '.net', 'dotnet', 'aspnet', 'entity framework', 'azure', 'windows'],
    description: 'C# and .NET development',
  },
  {
    name: 'Generalist',
    path: 'agent/_roles/generalist/generalist-guide.md',
    keywords: ['general', 'help', 'question', 'research', 'explain', 'understand', 'learn'],
    description: 'General problem-solving and research',
  },
  {
    name: 'Operations Generalist',
    path: 'agent/_roles/ops/ops-generalist-guide.md',
    keywords: ['devops', 'infrastructure', 'deployment', 'docker', 'kubernetes', 'ci/cd', 'monitoring', 'cloud', 'ops'],
    description: 'DevOps, infrastructure, and deployment',
  },
  {
    name: 'Analyzer',
    path: 'agent/_roles/analyzer/analyzer-guide.md',
    keywords: ['analyze', 'debug', 'investigate', 'data', 'metrics', 'performance', 'logs', 'trace'],
    description: 'Data analysis, debugging, and investigation',
  },
  {
    name: 'UX Designer',
    path: 'agent/_roles/ux-designer/ux-designer-guide.md',
    keywords: ['ux', 'ui', 'design', 'user experience', 'interface', 'prototype', 'wireframe', 'figma'],
    description: 'User experience and interface design',
  },
  {
    name: 'QA Engineer',
    path: 'agent/_roles/qa-engineer/qa-engineer-guide.md',
    keywords: ['test', 'testing', 'qa', 'quality', 'automation', 'e2e', 'unit test', 'integration'],
    description: 'Quality assurance and testing',
  },
];

function scoreRole(role: RoleInfo, taskLower: string): number {
  let score = 0;

  for (const keyword of role.keywords) {
    if (taskLower.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

export async function executeRoleRecommend(args: Record<string, unknown>): Promise<string> {
  const task = String(args.task || '');
  const listAll = Boolean(args.listAll);

  if (listAll || !task) {
    return `# Available Roles

${ROLES.map((r, i) => `${i + 1}. **${r.name}**
   ${r.description}
   Path: \`${r.path}\``).join('\n\n')}

Use the **task** parameter to get a recommendation for your specific task.`;
  }

  const taskLower = task.toLowerCase();

  // Score each role
  const scored = ROLES.map(role => ({
    role,
    score: scoreRole(role, taskLower),
  })).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // Default to generalist
    const generalist = ROLES.find(r => r.name === 'Generalist')!;

    return `# Role Recommendation

For task: "${task}"

**Recommended Role:** ${generalist.name}

No specific role matched your task keywords. The Generalist role is recommended for general problem-solving.

To load this role, read: \`${generalist.path}\`

## All Available Roles
${ROLES.map(r => `- ${r.name}: ${r.description}`).join('\n')}`;
  }

  const top = scored[0];
  const alternatives = scored.slice(1, 3);

  let result = `# Role Recommendation

For task: "${task}"

## Recommended Role

**${top.role.name}** (${top.score} keyword matches)

${top.role.description}

To load this role, read: \`${top.role.path}\``;

  if (alternatives.length > 0) {
    result += `

## Alternative Roles

${alternatives.map(a => `- **${a.role.name}** (${a.score} matches): ${a.role.description}`).join('\n')}`;
  }

  // Check if role file exists
  const workspaceRoot = findWorkspaceRoot();
  const rolePath = path.join(workspaceRoot, top.role.path);

  if (fs.existsSync(rolePath)) {
    result += `

---
*Role guide found at: ${rolePath}*`;
  } else {
    result += `

---
*Note: Role guide not found at expected path. Check workspace structure.*`;
  }

  return result;
}
