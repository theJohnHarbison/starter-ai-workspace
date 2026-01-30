#!/usr/bin/env node
/**
 * Log session end and generate summary
 */
const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), '.claude/logs/sessions');
const sessionFile = path.join(logsDir, 'active-session.json');
const activityLog = path.join(logsDir, 'activity.log');
const fileModsFile = path.join(logsDir, 'file-modifications.jsonl');
const commandsFile = path.join(logsDir, 'command-history.jsonl');

const timestamp = new Date().toISOString();

try {
  // Read active session
  if (!fs.existsSync(sessionFile)) {
    // No active session - silent exit
    process.exit(0);
  }

  const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const sessionId = session.sessionId;

  // Calculate session duration
  const startTime = new Date(session.startTime);
  const endTime = new Date(timestamp);
  const durationMs = endTime - startTime;
  const durationMin = Math.floor(durationMs / 60000);

  // Count file modifications
  let fileModCount = 0;
  if (fs.existsSync(fileModsFile)) {
    const lines = fs.readFileSync(fileModsFile, 'utf8').split('\n').filter(l => l.trim());
    fileModCount = lines.length;
  }

  // Count commands
  let commandCount = 0;
  if (fs.existsSync(commandsFile)) {
    const lines = fs.readFileSync(commandsFile, 'utf8').split('\n').filter(l => l.trim());
    commandCount = lines.length;
  }

  // Generate summary
  const summary = {
    ...session,
    endTime: timestamp,
    duration: { ms: durationMs, minutes: durationMin },
    stats: {
      fileModifications: fileModCount,
      commandsExecuted: commandCount
    },
    status: 'completed'
  };

  // Save session summary
  const summaryFile = path.join(logsDir, `${sessionId}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  // Append to activity log
  fs.appendFileSync(activityLog, `[${timestamp}] SESSION_END ${sessionId} duration:${durationMin}min files:${fileModCount} commands:${commandCount}\n`);

  // Clear active session
  fs.unlinkSync(sessionFile);

  // Silent - no console output
} catch (error) {
  // Silent failure - hooks should not output anything
}

process.exit(0);
