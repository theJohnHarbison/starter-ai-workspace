# AI Workspace

An AI-assisted development workspace with semantic session memory, designed for Claude Code. This is the starter kit for your future workspace. While there are some included skills you will need to customize this workspace for your needs.

## Quick Setup

```bash
# 1. Clone and enter workspace
git clone <repository-url> ai-workspace
cd ai-workspace

# 2. Install dependencies
npm install

# 3. Start Docker services (Qdrant)
docker-compose up -d

# 4. Embed sessions (downloads embedding model on first run)
npm run session:embed

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
| Qdrant | Vector database for session memory | http://localhost:6333 |

Embeddings are generated locally using `@huggingface/transformers` with `bge-small-en-v1.5` (384-dim). The model auto-downloads (~130MB) on first use. LLM tasks (scoring, insight extraction, reflections) use Claude CLI.

## Using as a Starter Template

This workspace is designed as a foundation for your own private AI workspace. Create your own repository and keep this starter as an upstream remote to pull future improvements.

### Initial Setup

```bash
# 1. Clone the starter
git clone https://github.com/theJohnHarbison/starter-ai-workspace.git ai-workspace
cd ai-workspace

# 2. Create your own private repository on GitHub
gh repo create my-ai-workspace --private

# 3. Change origin to your private repo
git remote set-url origin https://github.com/YOUR_USERNAME/my-ai-workspace.git

# 4. Add the starter as upstream
git remote add upstream https://github.com/theJohnHarbison/starter-ai-workspace.git

# 5. Push to your private repo
git push -u origin main

# 6. Continue with Quick Setup steps above (npm install, docker-compose, etc.)
```

### Pulling Upstream Improvements

When the starter template gets updates:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

### Contributing Back

If you develop generic improvements that would benefit all starter users:

```bash
# Create a branch from upstream
git fetch upstream
git checkout -b feat/your-improvement upstream/main

# Make changes (only generic, non-private content)
git commit -m "feat: description"
git push origin feat/your-improvement

# Create PR against the starter
gh pr create --repo theJohnHarbison/starter-ai-workspace \
  --head YOUR_USERNAME:feat/your-improvement \
  --base main --title "feat: your improvement"
```

See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for the full branching strategy and safety guidelines.

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
│   ├── self-improvement/   # Self-improvement system (ExpeL-based)
│   ├── shared/             # Shared modules (embedder)
│   ├── add-project         # Add projects (bash)
│   ├── add-example         # Add examples (bash)
│   ├── list-projects       # List projects (bash)
│   └── install-skills.*    # Install community skills
└── docker-compose.yml      # Qdrant service
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
| `npm run session:embed` | Embed sessions + run self-improvement pipeline |
| `npm run session:search "query"` | Basic semantic search |
| `npm run hybrid:search "query"` | Semantic + entity search (recommended) |
| `npm run tiered:search "query"` | Recency-weighted search |
| `npm run session:stats` | Show embedding statistics |
| `npm run session:topics` | Generate interactive topic map visualization |
| `npm run session:visualize` | Generate session embedding visualization |
| `npm run session:score` | Score session chunks (required for insights) |
| `npm run self:maintenance` | Run full self-improvement cycle |
| `npm run self:stats` | Show rule/reflection statistics |
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

## Self-Improvement System

The workspace includes an autonomous self-improvement loop inspired by ExpeL, Voyager, and Reflexion research. It learns from session patterns and automatically updates guidance in CLAUDE.md.

### How It Works

All LLM tasks use **Claude CLI**. Embeddings run locally via `@huggingface/transformers` (`bge-small-en-v1.5`).

The full pipeline is consolidated into `npm run session:embed`:
1. **Embed** - Chunk and embed sessions into Qdrant
2. **Score** - Score chunks by quality using Claude CLI
3. **Extract Insights** - Compare successful vs unsuccessful patterns
4. **Generate Reflections** - Analyze failures for improvement reflections
5. **Track Skills** - Identify novel skill candidates
6. **Reinforce/Prune** - Track rule reinforcements, prune stale rules (60-day threshold)

Use `npm run session:embed -- --embed-only` to skip the self-improvement steps.

### Behavior

- **Mode**: `autonomous` (auto-commits rules), `supervised` (proposes only), or `manual`
- **Safety**: All changes are atomic git commits, revertable with `git revert <hash>`

### Commands

| Command | Description |
|---------|-------------|
| `/improve` | Force manual insight extraction |
| `/review-improvements` | Show auto-applied rules and pending proposals |
| `/apply-improvements` | Apply pending proposals |
| `/approve-skill` | Promote a skill candidate to active |

### NPM Scripts

```bash
# View current state
npm run self:stats              # Rule/reflection statistics
npm run self:review             # Review pending proposals

# Run maintenance
npm run self:maintenance        # Full maintenance cycle
npm run session:score           # Score session chunks (required for insights)

# Individual operations
npm run self:extract-insights   # Extract rules from session pairs
npm run self:generate-reflections  # Generate failure reflections
npm run self:propose-skills     # Scan for novel skill candidates
npm run self:prune              # Remove stale rules
npm run self:apply              # Apply pending proposals
```

### Reverting Changes

All self-improvement commits use the prefix `chore(self-improve):`. To revert:

```bash
# Find the commit
git log --oneline --grep="self-improve"

# Revert it
git revert <commit-hash>
```

### Limits & Safety

- Maximum 30 active rules
- 60-day staleness pruning
- Cannot edit its own hooks, settings, or security config
- Ollama validation gate for rule quality

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

**Dependencies missing:**
```bash
npm install
```
