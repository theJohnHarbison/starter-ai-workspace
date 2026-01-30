#!/usr/bin/env node
/**
 * Log command executions from PostToolUse (Bash)
 */
const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), '.claude/logs/sessions');
const logFile = path.join(logsDir, 'command-history.jsonl');
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

// Hooks don't receive tool context - just log that a Bash command was executed
// We can't get the actual command due to hook limitations
const command = 'bash-command-executed';

const logEntry = {
  timestamp: new Date().toISOString(),
  command: command,
  sessionId: sessionId,
  cwd: process.cwd(),
  exitCode: process.env.HOOK_EXIT_CODE || process.env.EXIT_CODE || null,
  toolName: 'Bash'
};

// Ensure logs directory exists and append to log file (silently fail if there are any issues)
try {
  fs.mkdirSync(logsDir, { recursive: true });
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
} catch (err) {
  // Don't output anything - hooks should be silent
}

process.exit(0);
