#!/usr/bin/env node
/**
 * Session Start Hook (Cross-Platform)
 *
 * Runs on Claude Code session start:
 * 1. Validates environment (dependencies, directories)
 * 2. Starts required services (if applicable)
 * 3. Creates session tracking file
 * 4. Provides knowledge system status
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
// 1. Environment Validation
// =============================================================================

function validateEnvironment() {
  const issues = [];
  const warnings = [];

  // Check node_modules
  const nodeModules = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    issues.push('Dependencies not installed. Run: npm install');
  }

  // Check critical deps
  const criticalDeps = ['typescript', 'ts-node'];
  for (const dep of criticalDeps) {
    if (!fs.existsSync(path.join(nodeModules, dep))) {
      issues.push(`Missing ${dep}. Run: npm install`);
    }
  }

  // Check workspace-mcp if it exists
  const mcpDir = path.join(ROOT, 'extensions/workspace-mcp');
  if (fs.existsSync(path.join(mcpDir, 'package.json'))) {
    if (!fs.existsSync(path.join(mcpDir, 'node_modules'))) {
      warnings.push('Workspace MCP deps missing. Run: cd extensions/workspace-mcp && npm install');
    }
  }

  // Ensure required directories exist
  const requiredDirs = [
    '.claude/logs/sessions',
    '.claude/vector-store',
    '.claude/services',
    'agent/_knowledge'
  ];
  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  return { issues, warnings };
}

// =============================================================================
// 2. Service Management
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

function saveRunningServices(data) {
  const servicesFile = path.join(ROOT, '.claude/services/running.json');
  fs.writeFileSync(servicesFile, JSON.stringify(data, null, 2));
}

function cleanupOrphanedServices() {
  const running = getRunningServices();
  const cleaned = [];

  for (const service of running.services || []) {
    // Check if process is still alive
    try {
      if (service.pid) {
        process.kill(service.pid, 0); // Check if process exists
        // Process still running, keep it
      }
    } catch (e) {
      // Process is dead, mark for cleanup
      cleaned.push(service.name);
    }
  }

  if (cleaned.length > 0) {
    running.services = (running.services || []).filter(s => !cleaned.includes(s.name));
    saveRunningServices(running);
    log.info(`Cleaned up orphaned services: ${cleaned.join(', ')}`);
  }

  return cleaned;
}

// =============================================================================
// 3. Knowledge System Status
// =============================================================================

function getKnowledgeStatus() {
  const status = {
    vectorStore: { exists: false, sizeMB: 0, chunks: 0 },
    knowledgeGraph: { exists: false, nodes: 0 },
    pendingJobs: 0
  };

  // Check vector store
  const vectorFile = path.join(ROOT, '.claude/vector-store/embeddings.json');
  if (fs.existsSync(vectorFile)) {
    try {
      const stats = fs.statSync(vectorFile);
      status.vectorStore.exists = true;
      status.vectorStore.sizeMB = parseFloat((stats.size / (1024 * 1024)).toFixed(1));

      const data = JSON.parse(fs.readFileSync(vectorFile, 'utf-8'));
      status.vectorStore.chunks = data.chunks?.length || 0;
    } catch (e) { /* ignore */ }
  }

  // Check knowledge graph
  const kgIndex = path.join(ROOT, 'agent/_knowledge/index.json');
  if (fs.existsSync(kgIndex)) {
    try {
      const index = JSON.parse(fs.readFileSync(kgIndex, 'utf-8'));
      status.knowledgeGraph.exists = true;
      status.knowledgeGraph.nodes = Object.keys(index.nodes || {}).length;
    } catch (e) { /* ignore */ }
  }

  // Check pending jobs
  const jobsDir = path.join(ROOT, 'agent/_knowledge/_jobs');
  if (fs.existsSync(jobsDir)) {
    try {
      const jobs = fs.readdirSync(jobsDir).filter(f => f.endsWith('.json'));
      status.pendingJobs = jobs.length;
    } catch (e) { /* ignore */ }
  }

  return status;
}

// =============================================================================
// Main Session Start
// =============================================================================

function startSession() {
  console.log('\n');

  // 1. Validate environment
  const { issues, warnings } = validateEnvironment();

  if (issues.length > 0) {
    console.log(`${colors.red}=== Environment Issues ===${colors.reset}`);
    for (const issue of issues) {
      log.error(issue);
    }
    console.log(`\n${colors.yellow}Please fix the issues above.${colors.reset}\n`);
    // Don't exit - let the session continue but warn clearly
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      log.warn(warning);
    }
  }

  // 2. Cleanup orphaned services from previous sessions
  cleanupOrphanedServices();

  // 3. Create session tracking
  const logsDir = path.join(ROOT, '.claude/logs/sessions');
  fs.mkdirSync(logsDir, { recursive: true });

  const sessionId = `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const startTime = new Date().toISOString();

  const sessionData = {
    sessionId,
    startTime,
    environment: {
      issues: issues.length,
      warnings: warnings.length
    },
    metrics: {
      toolCalls: 0,
      filesRead: 0,
      filesModified: 0,
      gitCommits: 0
    }
  };

  fs.writeFileSync(
    path.join(logsDir, 'active-session.json'),
    JSON.stringify(sessionData, null, 2)
  );

  // Log to activity log
  const activityLog = `[${startTime}] SESSION_START ${sessionId}\n`;
  fs.appendFileSync(path.join(logsDir, 'activity.log'), activityLog);

  log.ok(`Session ${sessionId.slice(0, 20)}... started`);

  // 4. Show knowledge system status
  const kStatus = getKnowledgeStatus();
  if (kStatus.vectorStore.exists || kStatus.knowledgeGraph.exists) {
    log.dim(`  Vector store: ${kStatus.vectorStore.chunks} chunks (${kStatus.vectorStore.sizeMB}MB)`);
    log.dim(`  Knowledge graph: ${kStatus.knowledgeGraph.nodes} nodes`);
    if (kStatus.pendingJobs > 0) {
      log.info(`  ${kStatus.pendingJobs} pending extraction jobs`);
    }
  } else {
    log.dim('  Knowledge system empty - will populate with session data');
  }

  // 5. Reminder about ORIENT step
  console.log(`\n${colors.cyan}Remember: Query knowledge before starting work:${colors.reset}`);
  console.log(`  knowledge-graph retrieve --tags "your-topic"`);
  console.log(`  npm run hybrid:search "your query"\n`);

  return sessionData;
}

// Run
if (require.main === module) {
  try {
    startSession();
  } catch (error) {
    log.error(`Session start failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { startSession, validateEnvironment, getKnowledgeStatus };
