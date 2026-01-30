#!/usr/bin/env node
/**
 * Session End Hook (Cross-Platform)
 *
 * Runs on Claude Code session end (/clear or exit):
 * 1. Stops all running services
 * 2. Saves session summary
 * 3. Queues extraction if session was valuable
 * 4. Cleans up temporary files
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

const log = {
  ok: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  dim: (msg) => console.log(`${colors.dim}${msg}${colors.reset}`)
};

// =============================================================================
// 1. Service Cleanup
// =============================================================================

function getRunningServices() {
  const servicesFile = path.join(ROOT, '.claude/services/running.json');
  if (fs.existsSync(servicesFile)) {
    try {
      return JSON.parse(fs.readFileSync(servicesFile, 'utf-8'));
    } catch (e) {
      return { services: [] };
    }
  }
  return { services: [] };
}

function stopAllServices() {
  const running = getRunningServices();
  const stopped = [];
  const failed = [];

  for (const service of running.services || []) {
    try {
      if (service.pid) {
        // Try to kill the process using spawnSync (safer than exec)
        if (process.platform === 'win32') {
          const result = spawnSync('taskkill', ['/PID', String(service.pid), '/F'], {
            stdio: 'pipe',
            shell: false
          });
          // Process killed or already dead
          stopped.push(service.name);
        } else {
          try {
            process.kill(service.pid, 'SIGTERM');
            stopped.push(service.name);
          } catch (e) {
            // Process might already be dead
            stopped.push(service.name);
          }
        }
      }
    } catch (e) {
      failed.push(service.name);
    }
  }

  // Clear the services file
  const servicesFile = path.join(ROOT, '.claude/services/running.json');
  fs.writeFileSync(servicesFile, JSON.stringify({ services: [], lastCleanup: new Date().toISOString() }, null, 2));

  return { stopped, failed };
}

// =============================================================================
// 2. Temporary File Cleanup
// =============================================================================

function cleanupTempFiles() {
  const cleaned = [];

  // Clean up old validation files
  const validationFile = path.join(ROOT, '.claude/logs/last-validation.json');
  if (fs.existsSync(validationFile)) {
    try {
      fs.unlinkSync(validationFile);
      cleaned.push('last-validation.json');
    } catch (e) { /* ignore */ }
  }

  // Clean up old session logs (keep last 50)
  const logsDir = path.join(ROOT, '.claude/logs/sessions');
  if (fs.existsSync(logsDir)) {
    try {
      const sessionFiles = fs.readdirSync(logsDir)
        .filter(f => f.startsWith('session-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          mtime: fs.statSync(path.join(logsDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Remove sessions older than the 50th
      const toRemove = sessionFiles.slice(50);
      for (const file of toRemove) {
        fs.unlinkSync(file.path);
        cleaned.push(file.name);
      }
    } catch (e) { /* ignore */ }
  }

  return cleaned;
}

// =============================================================================
// 3. Session Summary
// =============================================================================

function endSession() {
  console.log('\n');

  const logsDir = path.join(ROOT, '.claude/logs/sessions');
  const activeSessionFile = path.join(logsDir, 'active-session.json');

  if (!fs.existsSync(activeSessionFile)) {
    log.warn('No active session found');
    return;
  }

  const sessionData = JSON.parse(fs.readFileSync(activeSessionFile, 'utf-8'));
  const sessionId = sessionData.sessionId;
  const startTime = new Date(sessionData.startTime);
  const endTime = new Date();

  // Calculate duration
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationSec = Math.floor(durationMs / 1000);
  const durationMin = Math.floor(durationSec / 60);

  // Use metrics from session tracking
  const toolCalls = sessionData.metrics?.toolCalls || 0;
  const filesRead = sessionData.metrics?.filesRead || 0;
  const filesModified = sessionData.metrics?.filesModified || 0;

  // Calculate session value score
  let score = 0;
  if (durationSec > 1800) score += 15;  // >30 min
  if (toolCalls > 20) score += 10;  // >20 tools
  if (filesModified > 3) score += 15;  // >3 files
  if (filesRead > 10) score += 10;  // >10 files read

  const extractionRecommended = score >= 60;

  // Save session summary
  const sessionSummary = {
    ...sessionData,
    endTime: endTime.toISOString(),
    duration: durationSec,
    durationFormatted: durationMin > 0 ? `${durationMin}m ${durationSec % 60}s` : `${durationSec}s`,
    score: {
      value: score,
      extractionRecommended
    }
  };

  const sessionFile = path.join(logsDir, `${sessionId}.json`);
  fs.writeFileSync(sessionFile, JSON.stringify(sessionSummary, null, 2));

  const activityLog = `[${endTime.toISOString()}] SESSION_END ${sessionId} duration:${durationSec}s score:${score}\n`;
  fs.appendFileSync(path.join(logsDir, 'activity.log'), activityLog);

  log.ok(`Session completed (${sessionSummary.durationFormatted})`);
  log.dim(`  Score: ${score}/50 | Files modified: ${filesModified} | Tool calls: ${toolCalls}`);

  // Queue extraction if recommended
  if (extractionRecommended) {
    const jobsDir = path.join(ROOT, 'agent/_knowledge/_jobs');
    fs.mkdirSync(jobsDir, { recursive: true });

    const jobId = `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const job = {
      jobId,
      type: 'session-extraction',
      status: 'queued',
      priority: 'high',
      sessionId,
      sessionFile,
      created: endTime.toISOString(),
      score
    };

    fs.writeFileSync(
      path.join(jobsDir, `${jobId}.json`),
      JSON.stringify(job, null, 2)
    );

    log.info(`Extraction queued: ${jobId}`);
  }

  // Stop all services
  const { stopped, failed } = stopAllServices();
  if (stopped.length > 0) {
    log.ok(`Stopped services: ${stopped.join(', ')}`);
  }
  if (failed.length > 0) {
    log.warn(`Failed to stop: ${failed.join(', ')}`);
  }

  // Cleanup temp files
  const cleaned = cleanupTempFiles();
  if (cleaned.length > 0) {
    log.dim(`  Cleaned ${cleaned.length} temp files`);
  }

  // Clean up active session
  try {
    fs.unlinkSync(activeSessionFile);
  } catch (e) { /* ignore */ }

  console.log('');
}

// Run
if (require.main === module) {
  try {
    endSession();
  } catch (error) {
    log.error(`Session end failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { endSession, stopAllServices, cleanupTempFiles };
