# WHO YOU ARE
-------------------
- You take on a role based on skills loaded from `.claude/skills/`
- You always prefer to use MCP over local filesystem
- You respect workspace structure and security protocols

# FIRST-TIME SETUP (After Git Clone)
-------------------

## 🚀 Quick Setup (New Users)

For complete step-by-step instructions, see **[README.md](README.md)**.

### Essential Setup Commands

```bash
# 1. Install Node.js dependencies
npm install

# 2. Start Docker services (Ollama + Qdrant)
docker-compose up -d

# 3. Pull required models
npm run setup:models

# 4. Verify everything is working
npm run session:stats
```

### Verify Setup Success

```bash
docker-compose ps           # Shows ollama and qdrant as "Up"
npm run session:stats       # Shows vector store statistics
```

### Infrastructure Services

This workspace requires and automatically starts:

| Service | Purpose | URL | Port |
|---------|---------|-----|------|
| **Ollama** | Embeddings (`nomic-embed-text`) for session memory | http://localhost:11434 | 11434 |
| **Qdrant** | Vector database for session embeddings | http://localhost:6333 | 6333 |

Start/stop all services with:
```bash
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose logs -f    # View service logs
```

**Session hooks will validate the environment on startup** and warn if anything is missing.

# WORKSPACE GUIDANCE
-------------------
You are working in a structured workspace with specialized tools and skills designed for collaborative development. See `README.md` and `docs/` for comprehensive guidance.

**Important**: Skills are auto-loaded from `.claude/skills/` based on context.

**Note**: Ollama is used only for embeddings. All LLM tasks (scoring, insights, validation) use Claude CLI.

## Security & Configuration
- **`.mcp.json`**: Contains authentication tokens - NEVER commit to git
  - Live on your machine only, protected by `.gitignore`
  - Copy from `.mcp.json.example` and add your tokens
  - Git pre-commit hook prevents accidental commits
- **Pre-commit hook**: Automatically checks for protected files before committing

## Workspace Tools
Use these powerful workspace tools to enhance your capabilities:

**Project Management:**
- **list-projects**: View available projects (`scripts/list-projects`)
- **add-project**: Add new projects (`scripts/add-project`)
- **add-example**: Add examples for reference (`scripts/add-example`)
- **install-skills**: Install community skills (`/install-skills`)
- **list-scripts**: Discover all workspace scripts (`npm run list-scripts`)

**Development Commands:**
- **/commit**: Create conventional commits with proper formatting
- **/debug**: Systematic debugging with 4-phase root cause analysis
- **/pr-review**: Comprehensive pull request review
- **/session-review**: End-of-session review with CLAUDE.md improvement suggestions

**Session Memory & Search:**
- **session:search**: Search past sessions semantically (`npm run session:search "query"`)
- **hybrid:search**: Semantic + entity search (`npm run hybrid:search "query"`)
- **tiered:search**: Memory-tier aware search (`npm run tiered:search "query"`)
- **session:stats**: View embedding statistics (`npm run session:stats`)

**Self-Improvement:**
- **/improve**: Force insight extraction from past sessions
- **/review-improvements**: Review auto-applied rules and pending proposals
- **/apply-improvements**: Apply pending proposals
- **/approve-skill**: Promote a skill candidate to active skills
- **self:maintenance**: Full maintenance cycle (`npm run self:maintenance`)
- **self:stats**: View rule/reflection statistics (`npm run self:stats`)

**Task Management:**
- **Create tasks**: Add tasks to `agent/_tasks/<project>/` as markdown files (see structure below)

## Session Memory System
**IMPORTANT**: This workspace embeds all Claude Code sessions for semantic search. Use it to find past solutions and context.

```bash
# Search past sessions semantically
npm run session:search "authentication error handling"

# Hybrid search (semantic + entity extraction)
npm run hybrid:search "database migration patterns"

# Tiered search (recent sessions weighted higher)
npm run tiered:search "React component architecture"

# View embedding statistics
npm run session:stats
```

### When to Search Session Memory
**Always search session memory when:**
1. Starting work on a feature you've touched before
2. Troubleshooting issues you may have solved previously
3. Looking for patterns or code examples from past work
4. Trying to remember decisions made in earlier sessions

### Example Workflow
```bash
# Before implementing a feature:
npm run hybrid:search "similar feature implementation"

# Before debugging an issue:
npm run session:search "error message or symptom"

# Finding past architectural decisions:
npm run tiered:search "architecture decision for X"
```

Sessions are automatically embedded when you run `npm run session:embed`.

## Problem-Solving Approach (OODA Loop)

Follow this approach for EVERY non-trivial task:

### 1. OBSERVE - Understand the situation
- Read the user's request carefully
- Identify what files, systems, or contexts are involved
- Note any constraints or requirements mentioned

### 2. ORIENT - Consult session memory before acting ⚠️ CRITICAL
**You MUST search session memory before starting work:**

```bash
# Recommended default: tiered search (recency-weighted, avoids stale results)
npm run tiered:search "your topic or keywords"

# Hybrid search (semantic + entity extraction, good for specific terms)
npm run hybrid:search "your topic or keywords"

# Basic semantic search (when recency doesn't matter)
npm run session:search "specific terms"
```

**Interpret results carefully:**
- Results older than 30 days may reference outdated code — verify before acting
- If multiple results say the same thing, look for diverse perspectives too
- Always confirm that referenced files/functions still exist in the codebase

**Why this matters:**
- Avoid repeating work already done in past sessions
- Find patterns and solutions that worked before
- Understand decisions and context from previous work
- Build on existing knowledge instead of starting fresh

**Skip session search ONLY if:**
- Task is trivial (fix a typo, add a simple log)
- User explicitly says "don't look anything up"
- You're continuing work from earlier in the same session

### 3. DECIDE - Choose the best approach
- Consider what the knowledge search revealed
- Select appropriate tools and workspace capabilities
- Plan the implementation (use TodoWrite for complex tasks)
- Ask clarifying questions if approach is unclear

### 4. ACT - Execute with small, focused steps
- Make incremental changes
- **Verify each step before proceeding** (read files back after edits, check exit codes after commands)
- If a step produces unexpected results, STOP and re-evaluate — do not continue on a potentially wrong premise
- Re-evaluate if something unexpected happens
- Commit after completing logical units of work

## Task Classification

Classify work before starting to choose the right interaction mode:

- **Autonomous (auto-accept)**: Prototyping, test generation, refactoring, docs, boilerplate, unfamiliar-language tasks
- **Supervised (synchronous)**: Core business logic, security-sensitive changes, architecture decisions, critical bug fixes
- **Slot machine pattern**: Commit checkpoint → let Claude work → review result → accept or `git reset --hard HEAD~1` and try differently

Restarting fresh usually beats wrestling with bad output. If Claude is over-engineering, interrupt and ask for a simpler approach.

## Tool-Calling Rules
- Use absolute paths; never `cd` unnecessarily
- Run `pytest <path>` not `cd <dir> && pytest`
- Prefer MCP tools over CLI for data access
- When stuck in a loop (>3 attempts at same fix), stop and try a simpler approach
- Read files before editing; never guess at file contents
- After file edits, read the file back to confirm the edit applied correctly
- After running commands, check exit codes and output before proceeding

## Working Principles
- Prefer small, incremental changes over large modifications
- Edit existing files rather than creating new ones unless necessary
- Use workspace tools to enhance your understanding and capabilities
- Re-evaluate after each action to ensure you're on the right track

## Git Commit Strategy

**COMMIT AFTER EACH UNIT OF WORK** - This keeps history clean and changes atomic.

### When to Commit
- ✅ After completing a feature or task
- ✅ After fixing a bug
- ✅ After updating documentation
- ✅ After refactoring code
- ✅ After adding tests
- ❌ DON'T commit partial/incomplete work
- ❌ DON'T commit unrelated changes together

### Commit Message Format
```
<type>: <subject>

<body (optional)>

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`

### Experimental/Exploratory Work
When outcome is uncertain, use the checkpoint-revert pattern:
1. Commit current clean state as a checkpoint
2. Let Claude work autonomously (auto-accept mode)
3. Review the result
4. Accept (continue) or revert (`git reset --hard HEAD~1`) and try a different approach

This is more effective than trying to course-correct bad output mid-stream.

### Multi-Project Workflow
1. **Work on one project at a time** - Focus on complete units
2. **Commit in that project** - Keep changes isolated
3. **Verify all repos are clean** - Before moving to next unit
   ```bash
   # Check status in each project
   git status
   ```

### Before Session End
- ✅ Verify all changes are committed in all repos
- ✅ Run `git status` in each repository
- ✅ No uncommitted files should remain

## Workspace Directory Structure

```
ai-workspace/
├── .git/                           # Git repository
│   └── hooks/pre-commit            # Security hook
├── .claude/
│   ├── commands/                   # Slash commands (/commit, /debug, etc.)
│   ├── hooks/                      # Workspace hooks
│   │   └── scripts/                # Hook implementations
│   ├── logs/                       # Session logs
│   │   └── sessions/               # Exported session JSON files
│   ├── skills/                     # Claude Code skills (auto-detected)
│   │   ├── <skill-name>/           # Each skill in its own directory
│   │   │   ├── SKILL.md            # Main skill file (required)
│   │   │   └── patterns.md         # Additional reference (optional)
│   │   └── .installed/             # Community skills (gitignored)
│   ├── vector-store/               # Session embeddings (legacy, now uses Qdrant)
│   └── services/                   # Service state tracking
├── .mcp.json (LOCAL - gitignored)  # Your tokens - NEVER commit
├── .mcp.json.example               # Template for setup
├── agent/
│   ├── _projects/                  # Project symlinks
│   │   └── [project-name]/         # Linked project directories
│   ├── _examples/                  # Reference examples
│   └── _tasks/                     # Project task tracking
│       └── [project-name]/         # Tasks for specific projects
├── docs/                           # Essential reference docs ONLY
│   ├── OLLAMA_WORKFLOW.md          # Local LLM usage guide
│   └── projects/<project>/         # Project-specific docs
├── extensions/                     # MCP server configurations
├── scripts/
│   ├── install-skills.sh           # Install community skills
│   ├── session-embedder/           # Session embedding system
│   └── [other scripts]
└── README.md                       # Main workspace guide
```

**Key Design Principles:**
- Skills provide procedural expertise, auto-loaded from `.claude/skills/`
- Custom skills are git-tracked; community skills are installed via script
- Session memory via embeddings captures institutional knowledge
- Tasks are tracked as markdown files in `agent/_tasks/<project>/`

### Task System

Tasks are stored as **markdown files** in `agent/_tasks/<project>/`. This keeps them tracked in git and accessible without external tools.

**Task File Format**:
```markdown
# Task: [Title]

**Status**: Not Started | In Progress | Completed
**Priority**: High | Medium | Low
**Estimated Effort**: [duration]
**Dependencies**: [what this depends on]

---

## Goal
[What needs to be done]

---

## Problem/Context
[Why this matters, current situation]

---

## Implementation Approach
[How to solve it, options if applicable]

---

## Steps
[Detailed steps to complete]

---

## Validation
[How to verify it's complete]

---

## References
[Related files, docs, links]

---

**Created**: [date]
**Type**: [Bug Fix | Enhancement | Research | etc]
**Effort**: [Low | Medium | High]
**Value**: [Impact assessment]
```

**Example Projects**:
- `agent/_tasks/ai-workspace/` - Workspace infrastructure tasks
- `agent/_tasks/<project-name>/` - Project-specific tasks

### Essential File Paths (Reference Only)

**IMPORTANT**: These paths are for reference. You should NOT create files here unless explicitly requested by user or for rare essential documentation.

- **Session embeddings**: Qdrant vector database at `localhost:6333` (managed automatically)
- **Session exports**: `.claude/logs/sessions/*.json` (auto-generated)
- **Skills**: `.claude/skills/<skill>/SKILL.md` (auto-loaded by context)
- **Project tasks**: `agent/_tasks/<project>/*.md` (task tracking)
- **Essential docs**: `docs/*.md` (setup guides, config examples only)
- **Project docs**: `docs/projects/<project>/*.md` (schemas, API docs only)

## Session Memory System

The workspace uses an **embedding-based session memory** system with Qdrant vector database. All Claude Code sessions are automatically embedded for semantic search.

### How It Works

1. **Session Export**: Claude Code exports session JSON to `.claude/logs/sessions/`
2. **Embedding**: Sessions are chunked and embedded using Ollama's `nomic-embed-text` model
3. **Storage**: Vectors stored in Qdrant vector database
4. **Search**: Multiple search modes available for different use cases

### Search Modes

| Mode | Command | Best For |
|------|---------|----------|
| **Semantic** | `npm run session:search "query"` | General searches, concepts |
| **Hybrid** | `npm run hybrid:search "query"` | Semantic + entity extraction |
| **Tiered** | `npm run tiered:search "query"` | Recency-weighted results |

### Embedding New Sessions

```bash
# Embed all sessions (skips already-embedded)
npm run session:embed

# Check embedding statistics
npm run session:stats
```

### `docs/` Folder: Human-Focused Documentation

**Purpose**: Human-readable guides and project-specific references

**Contains**:
- `OLLAMA_WORKFLOW.md` - When to use local LLM vs Claude
- `projects/<project>/` - Project-specific documentation

**How to Use**:
- Read `OLLAMA_WORKFLOW.md` for local LLM guidance
- Check project docs for schemas, API references, deployment configs

### When to Create Files (Rare Exceptions)

**Project-Specific Technical Docs** (Keep in `docs/projects/<project>/`):
- ✅ Database schemas
- ✅ API endpoint documentation
- ✅ Deployment configurations

**NEVER Create:**
- ❌ Session summaries (already in embeddings)
- ❌ Knowledge documentation (search sessions instead)
- ❌ Conceptual guides (explain in conversation, let sessions capture it)

## Code Quality Enforcement

Workspace hooks enforce code quality and security standards:

| Hook | Type | Trigger | Action |
|------|------|---------|--------|
| `block-as-any` | **Block** | `as any` casts | Prevents type system escape |
| `block-hardcoded-secrets` | **Block** | API keys, passwords in code | Prevents secret commits |
| `warn-any-type` | Warn | `: any`, `<any>`, `any[]` | Suggests specific types |
| `warn-debug-code` | Warn | `console.log`, `debugger` | Reminds to remove debug code |
| `warn-foreach` | Warn | `.forEach()` calls | Suggests `for...of` |
| `warn-interface-prefix` | Warn | `interface IFoo` | Suggests modern naming |

Hooks are configured in `.claude/hooks/` and travel with the workspace repo.

## Self-Improving Agent System

This workspace includes an autonomous self-improvement loop based on ExpeL, Voyager, Reflexion, and MemGPT research. The system reviews sessions, extracts rules from successes/failures, generates skills from novel tasks, and updates CLAUDE.md — all auto-applied via git commits and revertable with `git revert`.

**Mode**: Configured in `scripts/self-improvement/config.json` (default: `autonomous`)

**Commands**:
- `/improve` — Force manual insight extraction
- `/review-improvements` — Show auto-applied rules and pending proposals
- `/apply-improvements` — Apply pending proposals
- `/approve-skill` — Promote a skill candidate

**NPM Scripts**:
```bash
npm run self:stats           # Show rule/reflection statistics
npm run self:maintenance     # Run full maintenance cycle
npm run session:score        # Score session chunks (required for insights)
npm run self:extract-insights # Extract rules from session pairs
npm run self:generate-reflections # Generate failure reflections
npm run self:propose-skills  # Scan for novel skill candidates
npm run self:prune           # Remove stale rules
npm run self:review          # Review current state
npm run self:apply           # Apply pending proposals
```

**Safety**: All changes are atomic git commits (`chore(self-improve): ...`). Revert any change with `git revert <hash>`. Max 30 active rules, 60-day staleness pruning, Claude CLI validation gate. The system cannot edit its own hooks, settings, or security config.

## Learned Rules
<!-- AUTO-MANAGED by self-improvement system. Do not edit manually. -->
<!-- Rule: zjim5wo9 | Reinforced: 0 | Last: 2026-02-03 -->
- When debugging TypeScript type errors, read tsconfig.json first
<!-- Rule: uvagqabv | Reinforced: 0 | Last: 2026-02-03 -->
- Prefer for...of over .forEach() for better readability and break support
<!-- Rule: mxvx8m2g | Reinforced: 0 | Last: 2026-02-03 -->
- Always ensure that you understand the implications of commands like git reset and git revert before executing them.
<!-- Rule: hucbah4s | Reinforced: 0 | Last: 2026-02-03 -->
- Always verify completion of all required steps in a pattern before moving on to the next phase of analysis or implementation.
<!-- Rule: gr565yqn | Reinforced: 0 | Last: 2026-02-03 -->
- Ensure all operations align with the system's supported capabilities before execution.
<!-- Rule: ulty507o | Reinforced: 0 | Last: 2026-02-03 -->
- When debugging hooks, examine actual hook script content and settings configuration rather than relying on truncated or corrupted output
<!-- Rule: mxvgwyxy | Reinforced: 0 | Last: 2026-02-03 -->
- Verify tool output is complete and readable before drawing conclusions; base64-encoded or binary data indicates wrong file type or encoding issue
<!-- Rule: mcg38g8x | Reinforced: 0 | Last: 2026-02-03 -->
- Include concrete examples (regex patterns, JSON configs) alongside explanatory text to make documentation immediately usable
<!-- Rule: ombpbsu8 | Reinforced: 0 | Last: 2026-02-03 -->
- Configuration documentation should show complete, copy-pasteable examples with realistic option values and clear structure
<!-- Rule: t7qaxyg3 | Reinforced: 0 | Last: 2026-02-03 -->
- When encountering corrupted/garbled output, immediately investigate the source (encoding, hooks, plugins) rather than attempting to interpret meaningless data
<!-- Rule: fsiyg08m | Reinforced: 0 | Last: 2026-02-03 -->
- Ensure session chunks capture semantic meaning (what was accomplished) rather than system internals (signature hashes, hook debugging)
<!-- Rule: 1n77h474 | Reinforced: 0 | Last: 2026-02-03 -->
- Document command workflows with clear structure (numbered steps, categorized outputs) rather than mid-conversation context that references unclear prior state
<!-- Rule: 71g5qbky | Reinforced: 0 | Last: 2026-02-03 -->
- High-value chunks are self-contained with enough context to be useful standalone; low-value chunks depend on missing conversation context
<!-- Rule: vdw30cfl | Reinforced: 0 | Last: 2026-02-03 -->
- Session chunks should contain the distilled output/knowledge, not the raw LLM reasoning traces or cryptographic signatures from API responses
<!-- Rule: yefa7gcu | Reinforced: 0 | Last: 2026-02-03 -->
- When documenting systems, include purpose, configuration options, and practical use cases rather than raw data dumps
<!-- Rule: qqm6774s | Reinforced: 0 | Last: 2026-02-03 -->
- Successful chunks explain the "why" and "how" of system behavior (trigger conditions, input formats, file naming conventions) while failed chunks show only status output without actionable context
<!-- Rule: ex09td3n | Reinforced: 0 | Last: 2026-02-03 -->
- Avoid logging repetitive status checks that show no change; instead capture state transitions or meaningful events that provide debugging value
<!-- Rule: jgxt90yw | Reinforced: 0 | Last: 2026-02-03 -->
- When debugging container workflows, trace the full data flow architecture first (input paths, output paths, job queuing) before checking container status or logs
<!-- Rule: 5inlxptr | Reinforced: 0 | Last: 2026-02-03 -->
- Verify that job queuing mechanisms have actually created work items before assuming containers will process them automatically

## Before You Start

**IMPORTANT**: This workspace uses a **session memory approach**:
- **DO NOT create documentation files** unless essential
- Session conversations are automatically embedded for search
- Search past sessions for context: `npm run hybrid:search "topic"`
- Share information through conversation, not files

Read the relevant reference docs in `.claude/reference/` when needed:

| File | When to Read |
|------|--------------|
| `coding-patterns.md` | Writing new code (TypeScript, general patterns) |
| `anti-patterns.md` | Before code review or PR (AI-generated issues) |
| `error-handling.md` | Implementing error handling |
| `testing-patterns.md` | Writing or refactoring tests |
| `bug-investigation.md` | Debugging complex issues |

These are not automatically loaded - reference them when you need deep expertise.

### Session Memory Quick Reference

**Search Past Sessions**:
```bash
# Semantic search
npm run session:search "error handling patterns"

# Hybrid search (semantic + entities)
npm run hybrid:search "React authentication"

# Tiered search (recent sessions weighted higher)
npm run tiered:search "database migrations"
```

**Manage Embeddings**:
```bash
# Embed new sessions
npm run session:embed

# View statistics
npm run session:stats

# Tiered memory maintenance
npm run tiered:maintenance
```

## Configuration

Settings are organized by scope:

- **Workspace** (`.claude/settings.json`) - Team-shared defaults (committed to git)
  - Extended thinking configuration
  - Hook configurations
  - Plugin settings
  - Workspace permissions

- **User** (`.claude/settings.local.json`) - Your personal overrides (gitignored)
  - Personal thinking token limits
  - Developer-specific tweaks
  - Local environment preferences

- **Optional Global** (`~/.claude/settings.json`) - Cross-project preferences (optional)
  - Personal preferences that apply to ALL projects
  - Not required for ai-workspace to function
  - Only create if you need cross-project settings
