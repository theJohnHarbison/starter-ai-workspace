# Hook: Export Conversation Transcript

## Type
`SessionEnd`

## Purpose
Automatically export complete conversation transcripts when a Claude Code session ends (including `/clear` command), enabling knowledge extraction and workflow analysis.

## Handles Both Exit and /clear

This single hook handles:
- **Normal exit**: Session ends naturally → exports as `conversation-{sessionId}.json`
- **/clear command**: User clears conversation → exports as `conversation-{sessionId}-clear-{timestamp}.json`

The hook inspects the `reason` field to determine which event triggered it.

## Behavior

### Trigger
- Runs when Claude Code session ends
- Receives session metadata and transcript path from Claude Code

### Input (from Claude Code)
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../session-id.jsonl",
  "cwd": "/working/directory",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "exit"  // or "clear", "logout", "prompt_input_exit", "other"
}
```

**Reason Values**:
- `"exit"` - Normal session end
- `"clear"` - User ran `/clear` command
- `"logout"` - User logged out
- `"prompt_input_exit"` - Exit via prompt
- `"other"` - Other termination

### Processing
1. Reads JSONL transcript file from `transcript_path`
2. Parses all conversation entries
3. Analyzes message types (user, assistant, tool calls)
4. Creates structured export with metadata

### Output Files

**Normal Exit**: `.claude/logs/sessions/conversation-{sessionId}.json`
**After /clear**: `.claude/logs/sessions/conversation-{sessionId}-clear-{timestamp}.json`
```json
{
  "sessionId": "session-123",
  "exportReason": "clear",  // or "exit", "logout", etc.
  "exportedAt": "2025-12-19T03:30:00.000Z",
  "workingDirectory": "/workspace",
  "metadata": {
    "totalMessages": 150,
    "userMessages": 25,
    "assistantMessages": 100,
    "toolCalls": 25
  },
  "messages": [
    {
      "role": "user",
      "content": "Help me implement a feature",
      "timestamp": "..."
    },
    {
      "role": "assistant",
      "content": "I'll help with that...",
      "type": "text"
    },
    {
      "type": "tool_use",
      "name": "Read",
      "input": { "file_path": "..." }
    }
  ]
}
```

**Summary**: `.claude/logs/sessions/summary-{sessionId}.json`
- Lightweight version with first 5 user prompts (truncated)
- First 10 tool calls
- Metadata only

## Configuration

### Timeout
- Set to 10000ms (10 seconds)
- Allows processing of large transcripts

### Error Handling
- Silent failures (no stdout/stderr)
- Debug logs written to `.claude/logs/export-conversation-debug.log`
- Never blocks session end

## Use Cases

### Knowledge Extraction
- Parse conversations for workflow patterns
- Extract problem-solving approaches
- Identify common use cases

### Workflow Analysis
- Understand tool usage patterns
- Analyze conversation flow
- Track decision-making processes

### Documentation
- Generate documentation from conversations
- Create how-to guides from actual sessions
- Build knowledge base from real interactions

## Integration

### Session Embeddings
Conversation exports are embedded for semantic search:
```bash
# Embed all sessions (including newly exported)
npm run session:embed

# Search for content from conversations
npm run hybrid:search "topic from conversation"
```

### Post-Session Analysis
Sessions are automatically available for search after embedding.

## Limitations

- Transcript only available at SessionEnd (not real-time)
- Large conversations may take time to process
- Hook timeout may limit very long sessions (adjust if needed)

## Troubleshooting

### No conversation files created
1. Check if transcript_path is provided in hook input
2. Verify transcript file exists at that path
3. Check debug log: `.claude/logs/export-conversation-debug.log`

### Partial conversation data
- Transcript may be truncated if session was interrupted
- Check for parsing errors in debug log

### Hook timeout
- Increase timeout in `.claude/settings.json` if needed
- Default 10s should handle most conversations
