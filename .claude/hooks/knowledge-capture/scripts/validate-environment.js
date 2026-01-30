#!/usr/bin/env node
/**
 * Environment Validation Script
 *
 * Validates that the workspace environment is properly configured.
 * Runs on session start to catch missing dependencies early.
 *
 * Checks:
 * 1. Required Node.js version
 * 2. Dependencies installed (node_modules exists)
 * 3. TypeScript compilation status
 * 4. Required directories exist
 * 5. Ollama availability (optional)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = process.cwd();

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const log = {
  ok: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`)
};

const issues = [];
const warnings = [];

// Check 1: Node.js version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major < 18) {
    issues.push({
      check: 'Node.js version',
      current: version,
      required: '>=18.0.0',
      fix: 'Install Node.js 18 or later from https://nodejs.org/'
    });
    log.error(`Node.js ${version} is too old (need >=18)`);
  } else {
    log.ok(`Node.js ${version}`);
  }
}

// Check 2: Dependencies installed
function checkDependencies() {
  const nodeModules = path.join(ROOT, 'node_modules');

  if (!fs.existsSync(nodeModules)) {
    issues.push({
      check: 'Dependencies',
      current: 'Not installed',
      required: 'node_modules directory',
      fix: 'Run: npm install'
    });
    log.error('Dependencies not installed');
    return;
  }

  // Check for critical dependencies
  const criticalDeps = ['typescript', 'ts-node'];
  const missing = criticalDeps.filter(dep =>
    !fs.existsSync(path.join(nodeModules, dep))
  );

  if (missing.length > 0) {
    issues.push({
      check: 'Critical dependencies',
      current: `Missing: ${missing.join(', ')}`,
      required: criticalDeps.join(', '),
      fix: 'Run: npm install'
    });
    log.error(`Missing dependencies: ${missing.join(', ')}`);
  } else {
    log.ok('Dependencies installed');
  }

  // Check workspace-mcp dependencies
  const mcpNodeModules = path.join(ROOT, 'extensions/workspace-mcp/node_modules');
  if (fs.existsSync(path.join(ROOT, 'extensions/workspace-mcp/package.json'))) {
    if (!fs.existsSync(mcpNodeModules)) {
      warnings.push({
        check: 'Workspace MCP dependencies',
        current: 'Not installed',
        fix: 'Run: cd extensions/workspace-mcp && npm install'
      });
      log.warn('Workspace MCP dependencies not installed');
    } else {
      log.ok('Workspace MCP dependencies installed');
    }
  }
}

// Check 3: Required directories
function checkDirectories() {
  const required = [
    '.claude/logs/sessions',
    '.claude/vector-store',
    'agent/_knowledge'
  ];

  const missing = [];
  for (const dir of required) {
    const fullPath = path.join(ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log.info(`Created directory: ${dir}`);
    }
  }
  log.ok('Required directories exist');
}

// Check 4: Ollama availability (optional but recommended)
function checkOllama() {
  const http = require('http');

  // Try HTTP API first (works when Ollama runs as a service)
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/api/version', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const version = JSON.parse(data);
          log.ok(`Ollama available (v${version.version || 'unknown'})`);

          // Check for embedding model using API
          checkOllamaModels().then(resolve);
        } catch (e) {
          log.ok('Ollama available');
          resolve();
        }
      });
    });

    req.on('error', () => {
      // Fall back to CLI check
      try {
        const result = spawnSync('ollama', ['list'], {
          stdio: 'pipe',
          timeout: 5000,
          shell: true
        });

        if (result.status === 0) {
          log.ok('Ollama available');
          checkOllamaModelsCLI(result.stdout?.toString() || '');
        } else {
          warnings.push({
            check: 'Ollama',
            current: 'Not running',
            fix: 'Start Ollama or install from https://ollama.ai/'
          });
          log.warn('Ollama not available (optional for embeddings)');
        }
      } catch (error) {
        warnings.push({
          check: 'Ollama',
          current: 'Not installed',
          fix: 'Install from https://ollama.ai/'
        });
        log.warn('Ollama not installed (optional for embeddings)');
      }
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
    });
  });
}

// Check models via HTTP API
function checkOllamaModels() {
  const http = require('http');

  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/api/tags', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const models = result.models || [];
          const modelNames = models.map(m => m.name);

          // Check for embedding model (nomic-embed-text)
          const hasEmbedModel = modelNames.some(n => n.includes('nomic-embed-text'));
          if (!hasEmbedModel) {
            warnings.push({
              check: 'Ollama model',
              current: 'nomic-embed-text not found',
              fix: 'Run: ollama pull nomic-embed-text'
            });
            log.warn('Embedding model nomic-embed-text not installed');
          }
        } catch (e) {
          // Ignore model check errors
        }
        resolve();
      });
    });

    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

// Check models via CLI (fallback)
function checkOllamaModelsCLI(output) {
  if (!output.includes('nomic-embed-text')) {
    warnings.push({
      check: 'Ollama model',
      current: 'nomic-embed-text not found',
      fix: 'Run: ollama pull nomic-embed-text'
    });
    log.warn('Embedding model nomic-embed-text not installed');
  }
}

// Check 5: Vector store health
function checkVectorStore() {
  const vectorStore = path.join(ROOT, '.claude/vector-store/sessions.json');

  if (fs.existsSync(vectorStore)) {
    try {
      const stats = fs.statSync(vectorStore);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
      log.ok(`Vector store: ${sizeMB}MB`);
    } catch (e) {
      log.warn('Vector store exists but cannot read stats');
    }
  } else {
    log.info('Vector store empty (run npm run session:embed to populate)');
  }
}

// Check 6: Session logs directory
function checkSessionLogs() {
  const sessionsDir = path.join(ROOT, '.claude/logs/sessions');

  if (fs.existsSync(sessionsDir)) {
    try {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      log.ok(`Session logs: ${files.length} sessions exported`);
    } catch (e) {
      log.warn('Session logs directory exists but cannot read');
    }
  } else {
    log.info('No session logs yet (sessions are exported automatically)');
  }
}

// Main validation
async function validate() {
  console.log('\n=== AI Workspace Environment Check ===\n');

  checkNodeVersion();
  checkDependencies();
  checkDirectories();
  await checkOllama();
  checkVectorStore();
  checkSessionLogs();

  console.log('\n');

  // Report issues
  if (issues.length > 0) {
    console.log(`${colors.red}=== ${issues.length} Issue(s) Found ===${colors.reset}\n`);
    for (const issue of issues) {
      console.log(`${colors.red}${issue.check}${colors.reset}`);
      console.log(`  Current: ${issue.current}`);
      console.log(`  Required: ${issue.required}`);
      console.log(`  ${colors.cyan}Fix: ${issue.fix}${colors.reset}\n`);
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    console.log(`${colors.yellow}=== ${warnings.length} Warning(s) ===${colors.reset}\n`);
    for (const warning of warnings) {
      console.log(`${colors.yellow}${warning.check}${colors.reset}`);
      if (warning.current) console.log(`  Current: ${warning.current}`);
      console.log(`  ${colors.cyan}Fix: ${warning.fix}${colors.reset}\n`);
    }
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}Environment ready!${colors.reset}\n`);
  } else if (issues.length === 0) {
    console.log(`${colors.green}Environment ready${colors.reset} (with ${warnings.length} optional warnings)\n`);
  } else {
    console.log(`${colors.red}Please fix the issues above before continuing.${colors.reset}\n`);
    process.exit(1);
  }

  // Return validation result as JSON for hook consumption
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    timestamp: new Date().toISOString()
  };
}

// Run if executed directly
if (require.main === module) {
  validate().then(result => {
    // Save result for other scripts to consume
    const resultFile = path.join(ROOT, '.claude/logs/last-validation.json');
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Validation error:', err);
    process.exit(1);
  });
}

module.exports = { validate };
