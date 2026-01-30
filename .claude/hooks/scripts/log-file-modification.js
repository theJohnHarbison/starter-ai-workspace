#!/usr/bin/env node
/**
 * Log file modifications from PostToolUse (Write|Edit)
 */
const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), '.claude/logs/sessions');
const logFile = path.join(logsDir, 'file-modifications.jsonl');
const sessionFile = path.join(logsDir, 'active-session.json');

// Read session ID from active session file
let sessionId = 'unknown';
try {
  if (fs.existsSync(sessionFile)) {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    sessionId = sessionData.sessionId || 'unknown';
  }
} catch (err) {
  // Session file not readable
}

// Try to get file info from stdin (Claude Code passes tool context here)
let toolName = 'unknown';
let filePath = 'unknown';
let toolInput = null;

try {
  // Read from stdin if available
  const stdinBuffer = [];
  const chunk = process.stdin.read();
  if (chunk) {
    stdinBuffer.push(chunk);
    const stdinData = Buffer.concat(stdinBuffer).toString();

    // Try to parse as JSON (Claude Code hook context)
    try {
      toolInput = JSON.parse(stdinData);
      toolName = toolInput.toolName || toolInput.tool || 'unknown';
      filePath = toolInput.file_path || toolInput.filePath || toolInput.input?.file_path || 'unknown';
    } catch {
      // Not JSON, might be a file path
      filePath = stdinData.trim() || 'unknown';
    }
  }
} catch (err) {
  // Stdin not available
}

// Fallback to environment or args (check HOOK_* from settings.json env mapping)
if (toolName === 'unknown') {
  toolName = process.env.HOOK_TOOL_NAME || process.env.TOOL_NAME || 'unknown';
}
if (filePath === 'unknown') {
  filePath = process.env.HOOK_FILE_PATH || process.env.FILE_PATH || process.argv[2] || 'unknown';
}

const logEntry = {
  timestamp: new Date().toISOString(),
  tool: toolName,
  filePath: filePath,
  sessionId: sessionId
};

// Ensure logs directory exists and append to log file (silently fail if there are any issues)
try {
  fs.mkdirSync(logsDir, { recursive: true });
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
} catch (err) {
  // Don't output anything - hooks should be silent
}

process.exit(0);
