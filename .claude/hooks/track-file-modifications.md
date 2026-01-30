# Track File Modifications

Monitor file creation, modification, and deletion for knowledge extraction context.

## Event
PostToolUse

## Pattern
```
toolName: (Write|Edit)
```

## Purpose
Track which files are modified during a session to:
1. Provide context for knowledge extraction
2. Identify frequently modified files (hot spots)
3. Detect refactoring patterns
4. Support session summary generation

## Action

### 1. Log File Modification
Append to `.claude/logs/sessions/file-modifications.json`:

```json
{
  "timestamp": "ISO-8601",
  "sessionId": "current-session-id",
  "operation": "write|edit",
  "filePath": "relative/path/to/file.ts",
  "fileExtension": ".ts",
  "fileSize": "bytes (if available)",
  "tool": "Write|Edit",
  "context": {
    "promptSummary": "first 100 chars of user prompt",
    "sequenceNumber": "tool call number in session",
    "gitBranch": "current branch",
    "projectContext": "detected project name"
  }
}
```

### 2. Update Session State
Maintain `.claude/logs/sessions/active-modifications.json`:

```json
{
  "sessionId": "session-abc123",
  "files": {
    "modified": [
      {
        "path": "src/index.ts",
        "firstModified": "ISO-8601",
        "lastModified": "ISO-8601",
        "modificationCount": 3,
        "operations": ["edit", "edit", "write"]
      }
    ],
    "created": [
      {
        "path": "src/new-file.ts",
        "createdAt": "ISO-8601",
        "size": "bytes"
      }
    ]
  },
  "stats": {
    "totalModifications": 15,
    "uniqueFiles": 4,
    "newFiles": 1,
    "editedFiles": 3
  }
}
```

### 3. Detect Modification Patterns

Identify common patterns for knowledge extraction:

**Refactoring Pattern**:
- Multiple edits to same file in quick succession
- Paired modifications (e.g., interface + implementation)
- Cross-file changes (import updates after rename)

**Feature Development Pattern**:
- New file creation followed by edits
- Test file + implementation file
- Configuration + code changes

**Bug Fix Pattern**:
- Single file focus
- Edit → Read → Edit cycle
- Test file modification

### 4. Hot Spot Detection

Track files modified frequently across sessions:

```json
{
  "hotSpots": [
    {
      "filePath": "src/core/processor.ts",
      "modificationCount": 15,
      "lastModified": "ISO-8601",
      "sessions": ["session-1", "session-2", "session-3"],
      "averageModsPerSession": 5,
      "flaggedForReview": true,
      "reason": "High churn rate - may need refactoring"
    }
  ]
}
```

## Integration with Knowledge Extraction

File modification data enhances extraction by:

1. **Context enrichment**: What was modified provides context for why
2. **Pattern detection**: Workflow patterns emerge from file change sequences
3. **Hot spot analysis**: Frequently changed files may need documentation
4. **Session scoring**: More file modifications = higher extraction value
5. **Refactoring documentation**: Capture refactoring patterns as knowledge

## Example Script

```bash
#!/bin/bash
# Location: .claude/hooks/scripts/track-modifications.sh

# Parse tool use result from stdin or args
TOOL_NAME="${1:-unknown}"
FILE_PATH="${2:-unknown}"
OPERATION="${3:-unknown}"

# Get session context
SESSION_FILE=".claude/logs/sessions/active-session.json"
if [ ! -f "$SESSION_FILE" ]; then
  echo "No active session"
  exit 0
fi

SESSION_ID=$(jq -r '.sessionId' "$SESSION_FILE")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "no-git")

# Create log directories
mkdir -p .claude/logs/sessions

# Log modification
LOG_FILE=".claude/logs/sessions/file-modifications.json"
cat >> "$LOG_FILE" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "sessionId": "${SESSION_ID}",
  "operation": "${OPERATION}",
  "filePath": "${FILE_PATH}",
  "tool": "${TOOL_NAME}",
  "context": {
    "gitBranch": "${GIT_BRANCH}"
  }
}
EOF

# Update active modifications state
STATE_FILE=".claude/logs/sessions/active-modifications.json"

# Initialize if doesn't exist
if [ ! -f "$STATE_FILE" ]; then
  echo "{\"sessionId\":\"${SESSION_ID}\",\"files\":{\"modified\":[],\"created\":[]},\"stats\":{\"totalModifications\":0}}" > "$STATE_FILE"
fi

# Increment modification count
jq --arg file "$FILE_PATH" \
   --arg timestamp "$TIMESTAMP" \
   --arg operation "$OPERATION" \
   '.stats.totalModifications += 1 |
    .files.modified += [{path: $file, lastModified: $timestamp, operation: $operation}]' \
   "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

echo "✓ Tracked modification: $FILE_PATH"
```

## Configuration

Enable in `.claude/settings.json`:

```json
{
  "fileTracking": {
    "enabled": true,
    "trackCreations": true,
    "trackEdits": true,
    "detectPatterns": true,
    "hotSpotThreshold": 10
  }
}
```

## Use Cases

### 1. Session Summary Generation
"Modified 4 files across 2 modules, implementing new confidence threshold feature"

### 2. Knowledge Extraction Context
"This concept was developed while refactoring the knowledge worker (3 files modified)"

### 3. Hot Spot Analysis
"processor.ts has been modified 15 times in the last 7 days - consider documenting common patterns"

### 4. Refactoring Documentation
"Detected refactoring pattern: Move validation logic from processor to dedicated validator"

## Privacy

- All file paths are relative to workspace root
- No file contents captured (only paths)
- Local logging only
- Can be disabled in settings

## Notes

- This is a **logging-only hook** (non-blocking)
- Complements existing git tracking
- Used by session-end-tracking for metrics
- Integrates with knowledge extraction orchestrator
