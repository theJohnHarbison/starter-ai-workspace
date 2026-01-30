# Track Command Execution

Monitor shell commands executed during sessions for workflow analysis and knowledge extraction.

## Event
PostToolUse

## Pattern
```
toolName: Bash
```

## Purpose
Track command executions to:
1. Capture workflow patterns (e.g., test → commit → push)
2. Identify frequently used commands
3. Detect productivity patterns
4. Support session summary generation
5. Document common command sequences as knowledge

## Action

### 1. Log Command Execution
Append to `.claude/logs/sessions/command-history.json`:

```json
{
  "timestamp": "ISO-8601",
  "sessionId": "current-session-id",
  "command": "npm run worker:start",
  "commandType": "npm|git|docker|npx|node|other",
  "exitCode": "0|1|null",
  "duration": "milliseconds",
  "workingDirectory": "relative/path",
  "context": {
    "sequenceNumber": "tool call number",
    "promptSummary": "first 100 chars of user prompt",
    "previousCommand": "previous command in sequence"
  }
}
```

### 2. Categorize Commands

Group commands by type for analysis:

**Git Commands**:
- `git status`, `git add`, `git commit`, `git push`, `git branch`, etc.
- Track git workflow patterns

**Package Management**:
- `npm install`, `npm run`, `yarn add`, etc.
- Track dependency changes

**Testing Commands**:
- `npm test`, `jest`, `npm run test`, etc.
- Track testing frequency

**Build Commands**:
- `npm run build`, `tsc`, `webpack`, etc.
- Track build frequency

**Docker Commands**:
- `docker build`, `docker run`, `docker compose`, etc.
- Track containerization workflow

**Development Tools**:
- `npx`, `node`, `ts-node`, etc.
- Track tool usage patterns

### 3. Detect Command Sequences

Identify common workflow patterns:

**Test-Driven Development**:
```
1. Edit file
2. npm test
3. Edit file (fix)
4. npm test (pass)
5. git add
6. git commit
```

**Feature Development**:
```
1. git checkout -b feature/xyz
2. Edit files
3. npm run build
4. npm test
5. git add .
6. git commit -m "..."
7. git push
```

**Debugging Workflow**:
```
1. npm start (fail)
2. Read error logs
3. Edit file
4. npm start (success)
```

### 4. Track Important Commands

Flag commands for special attention:

```json
{
  "importantCommands": [
    {
      "command": "git commit",
      "count": 3,
      "messages": [
        "feat: Add new feature",
        "fix: Fix bug",
        "docs: Update documentation"
      ],
      "significance": "Completed work units"
    },
    {
      "command": "npm install",
      "count": 2,
      "packages": ["new-package-1", "new-package-2"],
      "significance": "Dependency changes"
    },
    {
      "command": "git push",
      "count": 1,
      "branch": "main",
      "significance": "Published changes"
    }
  ]
}
```

### 5. Generate Command Summary

At session end, summarize command usage:

```
Command Summary:
- Total commands: 45
- Git commands: 8 (add: 3, commit: 3, push: 1, status: 1)
- NPM commands: 12 (install: 2, run: 10)
- Node commands: 5 (ts-node: 5)
- Docker commands: 0

Most Used:
1. npm run worker:start (5x)
2. git add (3x)
3. git commit (3x)

Workflow Pattern Detected: Feature Development
- Edited files → Build → Test → Commit → Push
```

## Integration with Knowledge Extraction

Command execution data enhances extraction by:

1. **Workflow documentation**: Capture common command sequences
2. **Tool usage patterns**: Which tools are used together
3. **Productivity insights**: Command frequency and timing
4. **Session context**: What was actually done (not just discussed)
5. **Knowledge nodes**: "Workflow: Testing and Committing Changes"

## Example Script

```bash
#!/bin/bash
# Location: .claude/hooks/scripts/track-commands.sh

# Parse command from Bash tool input
COMMAND="${1:-unknown}"
EXIT_CODE="${2:-null}"
DURATION="${3:-null}"

# Get session context
SESSION_FILE=".claude/logs/sessions/active-session.json"
if [ ! -f "$SESSION_FILE" ]; then
  echo "No active session"
  exit 0
fi

SESSION_ID=$(jq -r '.sessionId' "$SESSION_FILE")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
WORKING_DIR=$(pwd)

# Categorize command
COMMAND_TYPE="other"
case "$COMMAND" in
  git*) COMMAND_TYPE="git" ;;
  npm*|yarn*|pnpm*) COMMAND_TYPE="npm" ;;
  docker*) COMMAND_TYPE="docker" ;;
  npx*) COMMAND_TYPE="npx" ;;
  node*|ts-node*) COMMAND_TYPE="node" ;;
  jest*|test*) COMMAND_TYPE="test" ;;
esac

# Create log directories
mkdir -p .claude/logs/sessions

# Log command
LOG_FILE=".claude/logs/sessions/command-history.json"
cat >> "$LOG_FILE" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "sessionId": "${SESSION_ID}",
  "command": "${COMMAND}",
  "commandType": "${COMMAND_TYPE}",
  "exitCode": "${EXIT_CODE}",
  "duration": ${DURATION},
  "workingDirectory": "${WORKING_DIR}"
}
EOF

# Track important commands
if [[ "$COMMAND" == git\ commit* ]] || [[ "$COMMAND" == git\ push* ]] || [[ "$COMMAND" == npm\ install* ]]; then
  IMPORTANT_LOG=".claude/logs/sessions/important-commands.log"
  echo "[${TIMESTAMP}] ${COMMAND_TYPE}: ${COMMAND}" >> "$IMPORTANT_LOG"
fi

echo "✓ Tracked command: $COMMAND_TYPE"
```

## Configuration

Enable in `.claude/settings.json`:

```json
{
  "commandTracking": {
    "enabled": true,
    "trackAll": false,
    "trackTypes": ["git", "npm", "docker", "npx"],
    "detectWorkflowPatterns": true,
    "flagImportantCommands": true,
    "importantPatterns": [
      "git commit",
      "git push",
      "npm install",
      "docker build",
      "npm run deploy"
    ]
  }
}
```

## Use Cases

### 1. Session Summary
"Executed 45 commands: primarily git workflow (8) and npm scripts (12)"

### 2. Workflow Documentation
Extract pattern: "Test-Driven Development Workflow" from repeated test → edit → test sequences

### 3. Productivity Analysis
"High git activity (8 commands) indicates feature development or bug fixing session"

### 4. Tool Usage Insights
"Frequently uses ts-node for script execution - consider documenting this pattern"

### 5. Knowledge Extraction
Create knowledge node: "Workflow: Git Feature Branch Development" from detected sequence

## Privacy

- Command strings captured (may contain sensitive args)
- Consider filtering sensitive patterns (passwords, tokens)
- Local logging only
- Can be disabled or filtered in settings

## Security Considerations

**Sensitive Command Detection**:
- Filter out commands containing passwords, tokens, API keys
- Redact environment variables in command strings
- Skip logging for sensitive operations (e.g., `aws configure`)

**Example Filter Patterns**:
```regex
# Skip these patterns:
- .*password.*
- .*token.*
- .*secret.*
- .*api[_-]key.*
- curl.*--header.*Authorization
```

## Notes

- This is a **logging-only hook** (non-blocking)
- Complements git history tracking
- Used by session-end-tracking for metrics
- Integrates with workflow pattern detection
- Can be filtered for privacy/security
