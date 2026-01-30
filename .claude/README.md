# Claude Code Configuration

This directory contains project-specific Claude Code configuration.

## Structure

- `agents/` - Specialized subagents for complex tasks
  - `agent-creator.md` - Meta-agent for creating new agents
  - `ops-generalist.md` - Platform operations and infrastructure
  - `swe-csharp.md` - C#/.NET specialization
  - `swe-frontend.md` - React/Next.js specialization

- `commands/` - Workspace-specific slash commands
  - `/setup` - Run development environment setup
  - `/list-roles` - List available AI agent roles
  - `/add-project` - Add a project to the workspace
  - `/add-example` - Add a file or directory as an example

- `skills/` - Workspace-specific agent skills
  - `architecture-reference` - Project architecture patterns
  - `project-setup` - Project setup and configuration
  - `godot-standards` - Godot game engine standards
  - `unity-standards` - Unity game engine standards
  - `react-typescript-standards` - React + TypeScript patterns
  - `compliance-and-consent` - Privacy and consent patterns

- `hooks/` - Code quality enforcement hooks
  - Automatically enforce TypeScript patterns
  - Block security issues (hardcoded secrets, `as any` casts)
  - Warn about code quality issues (debug code, `.forEach()` usage)
  - All hooks committed to repo - no setup required!

- `reference/` - On-demand reference documentation
  - Read when you need deep expertise on specific topics
  - Not automatically loaded into context
  - Reference from CLAUDE.md when relevant

- `settings.json` - Team-shared project settings (committed)
- `settings.local.json` - Developer-specific overrides (gitignored)
- `mcp-resources.json` - MCP resource manifest for documentation discovery

## Optional User Configuration

Users can optionally create `~/.claude/settings.json` for personal preferences that apply across ALL projects (not just this workspace). This is completely optional - the workspace is fully functional without it.

Example use cases:
- Personal thinking token budget different from team default
- Additional personal commands for your workflow
- Editor or environment-specific settings

## Workspace-Specific Features

The ai-workspace has unique centralized systems not found in typical Claude Code setups:

- `.claude/vector-store/` - Embedded session memory for semantic search
- `.claude/logs/sessions/` - Exported session transcripts
- `agent/_roles/` - Centralized role guides (generalist, software-engineering, etc.)
- `agent/_tasks/` - Centralized task tracking across projects
- `docs/` - Centralized documentation system

These are intentionally centralized rather than per-project for reusability and consistency.

## Getting Started

1. **Clone and go** - No setup required! All configuration is in the repo.
2. **Select a role** - Check `agent/_roles/` for available AI roles
3. **Start working** - `claude` command just works
4. **Add personal overrides** - Create `.claude/settings.local.json` if needed (optional)

## Hooks

This workspace includes code quality hooks that enforce standards automatically:

| Hook | Action | Description |
|------|--------|-------------|
| `block-as-any` | Block | Prevents `as any` type casts |
| `block-hardcoded-secrets` | Block | Prevents committing secrets |
| `warn-any-type` | Warn | Suggests specific types instead of `any` |
| `warn-debug-code` | Warn | Reminds to remove debug statements |
| `warn-foreach` | Warn | Suggests `for...of` instead of `.forEach()` |
| `warn-interface-prefix` | Warn | Suggests modern naming (no `I` prefix) |

Hooks are powered by the **hookify plugin** and configured in `settings.json`.

## Recommended Plugins

This workspace is configured to use the following Claude Code plugins. Install them to unlock additional capabilities:

### Required for Full Functionality

**hookify** - Code quality enforcement via hooks
```bash
# Add Anthropic marketplace (one-time setup)
/plugin marketplace add https://marketplace.claude.ai

# Install hookify plugin
/plugin install hookify
```

### Recommended for Enhanced Workflow

**commit-commands** - Git workflow automation
```bash
# Install from Anthropic marketplace
/plugin install commit-commands
```

**Available commands after installation:**
- `/commit` - Auto-generate styled commit messages
- `/commit-push-pr` - Complete branch → commit → push → PR workflow
- `/clean_gone` - Remove deleted remote branches locally

**pr-review-toolkit** - Advanced code review
```bash
# Install from Anthropic marketplace
/plugin install pr-review-toolkit
```

**Available agents after installation:**
- Six specialized review agents analyzing: comments, tests, silent failures, type design, compliance, simplification

### Installation Steps

1. **Start Claude Code** in the workspace:
   ```bash
   cd ai-workspace
   claude
   ```

2. **Add Anthropic marketplace** (first time only):
   ```bash
   /plugin marketplace add https://marketplace.claude.ai
   ```

3. **Install plugins**:
   ```bash
   /plugin install hookify
   /plugin install commit-commands
   /plugin install pr-review-toolkit
   ```

4. **Verify installation**:
   ```bash
   /plugin list
   ```

### Why These Plugins?

- **hookify**: Essential for code quality hooks to work (TypeScript patterns, security checks)
- **commit-commands**: Automates Git workflow, follows workspace commit strategy
- **pr-review-toolkit**: Complements hooks with deeper code review capabilities

**Note**: The workspace is functional without plugins, but installing them enhances productivity and code quality enforcement.
