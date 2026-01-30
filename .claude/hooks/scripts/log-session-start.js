#!/usr/bin/env node
/**
 * Log session start
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const logsDir = path.join(process.cwd(), '.claude/logs/sessions');
const sessionFile = path.join(logsDir, 'active-session.json');
const activityLog = path.join(logsDir, 'activity.log');

// Generate session ID
const sessionId = `session-${Date.now()}`;
const timestamp = new Date().toISOString();

async function getGitContext() {
  let gitBranch = 'unknown';
  let gitStatus = 'unknown';

  try {
    const branchResult = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    gitBranch = branchResult.stdout.trim();

    const statusResult = await execFileAsync('git', ['status', '--porcelain']);
    gitStatus = statusResult.stdout.trim() ? 'dirty' : 'clean';
  } catch (e) {
    // Not in git repo or git not available
  }

  return { gitBranch, gitStatus };
}

(async () => {
  try {
    const { gitBranch, gitStatus } = await getGitContext();

    const sessionData = {
      sessionId,
      startTime: timestamp,
      workingDirectory: process.cwd(),
      gitBranch,
      gitStatus,
      status: 'active'
    };

    // Ensure logs directory exists
    fs.mkdirSync(logsDir, { recursive: true });

    // Write active session
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));

    // Append to activity log
    fs.appendFileSync(activityLog, `[${timestamp}] SESSION_START ${sessionId} ${process.cwd()} branch:${gitBranch}\n`);

    // Silent - no console output
    process.exit(0);
  } catch (err) {
    // Silent failure - hooks should not output anything
    process.exit(0);
  }
})();
