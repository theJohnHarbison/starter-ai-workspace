# AI Workspace

An AI-assisted development workspace with semantic session memory, designed for Claude Code.

## Quick Setup

```bash
# 1. Clone and enter workspace
git clone <repository-url> ai-workspace
cd ai-workspace

# 2. Install dependencies
npm install

# 3. Start Docker services (Ollama + Qdrant)
docker-compose up -d

# 4. Pull required models
npm run setup:models

# 5. Verify setup
npm run session:stats

# 6. Build the workspace MCP server
cd extensions/workspace-mcp && npm install && npm run build && cd ../..

# 7. (Optional) Configure MCP integrations - see "MCP Configuration" below
cp .mcp.json.example .mcp.json
# Edit .mcp.json to add your GitHub token, etc.
```

**Services started by docker-compose:**
| Service | Purpose | URL |
|---------|---------|-----|
| Ollama | Local LLM (`qwen2.5-coder:7b`) and embeddings (`nomic-embed-text`) | http://localhost:11434 |
| Qdrant | Vector database for session memory | http://localhost:6333 |

## Session Memory System

The workspace automatically embeds Claude Code sessions for semantic search. This lets you find past solutions, patterns, and decisions.

### Search Past Sessions

```bash
# Semantic search
npm run session:search "authentication error handling"

# Hybrid search (semantic + entity extraction) - recommended
npm run hybrid:search "React hooks TypeScript"

# Tiered search (recent sessions weighted higher)
npm run tiered:search "database migrations"
```

### Manage Embeddings

```bash
# Embed new sessions
npm run session:embed

# View statistics
npm run session:stats

# Run maintenance
npm run tiered:maintenance
```

## Directory Structure

```
ai-workspace/
├── .claude/
│   ├── commands/           # Slash commands (/commit, /debug, etc.)
│   ├── hooks/              # Code quality hooks
│   ├── skills/             # AI skills (auto-loaded by context)
│   ├── logs/sessions/      # Exported session JSON files
│   ├── visualizations/     # Generated topic map HTML
│   └── settings.json       # Workspace settings
├── agent/
│   ├── _projects/          # Project symlinks
│   ├── _examples/          # Reference examples
│   └── _tasks/             # Task tracking (markdown files)
├── docs/                   # Documentation
├── scripts/
│   ├── session-embedder/   # Session embedding system
│   ├── setup-models.js     # Pull required Ollama models
│   ├── add-project         # Add projects (bash)
│   ├── add-example         # Add examples (bash)
│   ├── list-projects       # List projects (bash)
│   └── install-skills.*    # Install community skills
└── docker-compose.yml      # Ollama + Qdrant services
```

## Knowledge Graph Visualization

The workspace can generate interactive visualizations of your session knowledge:

### Topic Map

Generates an interactive HTML word cloud showing extracted concepts, tools, and patterns from your sessions.

```bash
# Generate topic map
npm run session:topics

# Opens: .claude/visualizations/topic-map.html
```

The topic map extracts and categorizes terms by type:
- **Tools** (blue) - Technologies like TypeScript, React, Docker
- **Concepts** (green) - Topics like authentication, embeddings, testing
- **Actions** (pink) - Operations like deployments, migrations, refactoring
- **Patterns** (teal) - Recurring code identifiers (CamelCase/PascalCase)
- **Search queries** (orange) - Frequently searched terms

Click any term to see its frequency, related sessions, and context snippets. Use the filter buttons and search box to explore specific categories.

### Session Visualize

```bash
npm run session:visualize
```

Generates a visualization of session embeddings and their relationships.

The topic map is also automatically regenerated after each `npm run session:embed` run.

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run setup:models` | Pull required Ollama models |
| `npm run session:embed` | Embed new sessions into vector store |
| `npm run session:search "query"` | Basic semantic search |
| `npm run hybrid:search "query"` | Semantic + entity search (recommended) |
| `npm run tiered:search "query"` | Recency-weighted search |
| `npm run session:stats` | Show embedding statistics |
| `npm run session:topics` | Generate interactive topic map visualization |
| `npm run session:visualize` | Generate session embedding visualization |
| `npm run list-scripts` | Show all available scripts |

## Skills

Skills are auto-loaded from `.claude/skills/` based on context. They provide domain-specific guidance for:

- **Frontend**: React, TypeScript, Next.js patterns
- **Backend**: Supabase, database patterns
- **Mobile**: Expo, React Native
- **C#/.NET**: ASP.NET patterns
- **Debugging**: Systematic 4-phase analysis
- **Testing**: Test-driven development

Install community skills:
```bash
# Windows
.\scripts\install-skills.ps1

# Linux/Mac
./scripts/install-skills.sh
```

## Code Quality Hooks

Workspace hooks in `.claude/hooks/` enforce code quality:

- Block `as any` type casts
- Block hardcoded secrets
- Warn about `console.log` and debug code
- Warn about `.forEach()` (prefer `for...of`)

## Project Management

Add projects to `agent/_projects/`:

```bash
# From GitHub (clones)
./scripts/add-project https://github.com/user/repo

# From local path (symlinks)
./scripts/add-project /path/to/local/project
```

Note: These are bash scripts. On Windows, use WSL or Git Bash.

## MCP Configuration (Optional)

MCP (Model Context Protocol) servers extend Claude Code with additional capabilities like GitHub integration, browser automation, and local LLM access.

### Setup

```bash
# Copy the example configuration
cp .mcp.json.example .mcp.json

# Edit .mcp.json and add your tokens
```

### GitHub Integration

To enable GitHub MCP (issues, PRs, code search):

1. Create a GitHub Personal Access Token at https://github.com/settings/tokens
2. Edit `.mcp.json` and replace `ghp_YOUR_TOKEN_HERE` with your token

```json
{
  "mcpServers": {
    "github": {
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_actual_token"
      }
    }
  }
}
```

### Available MCP Servers

| Server | Purpose | Requires Token |
|--------|---------|----------------|
| `github` | GitHub issues, PRs, code search | Yes (PAT) |
| `chrome-devtools` | Browser automation | No |
| `ollama` | Local LLM inference | No |

**Important:** `.mcp.json` contains secrets and is gitignored. Never commit tokens.

## Contributing

The `main` branch is protected. All changes must go through pull requests.

```bash
# 1. Create a feature branch
git checkout -b feat/your-feature

# 2. Make your changes and commit
git add .
git commit -m "feat: description of change"

# 3. Push and open a PR
git push -u origin feat/your-feature
gh pr create --fill
```

### Branch Naming

Use prefixed branch names:
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `chore/` - Maintenance, dependency updates

### Skills and Hooks

If you add new skills (`.claude/skills/`) or hooks (`.claude/hooks/`), include a brief description in your PR so reviewers understand the intent.

## Configuration Files

| File | Purpose | Committed |
|------|---------|-----------|
| `.mcp.json` | MCP servers + tokens | No (gitignored) |
| `.mcp.json.example` | MCP template | Yes |
| `.claude/settings.json` | Workspace settings | Yes |
| `docker-compose.yml` | Docker services | Yes |

## Troubleshooting

**Services not running:**
```bash
docker-compose ps        # Check status
docker-compose logs -f   # View logs
docker-compose up -d     # Restart
```

**Models missing:**
```bash
npm run setup:models
```

**Dependencies missing:**
```bash
npm install
```
