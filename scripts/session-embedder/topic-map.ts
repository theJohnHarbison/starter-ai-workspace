#!/usr/bin/env ts-node
/**
 * Topic Map Visualizer
 *
 * Creates a topic map / word cloud from session content showing:
 * - Key terms and concepts (sized by frequency)
 * - Topic clusters and relationships
 * - Filterable by entity type (tools, concepts, decisions)
 *
 * Usage: npm run session:topics
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../.claude/visualizations');
const SESSIONS_DIR = path.join(__dirname, '../../.claude/logs/sessions');
const SEARCH_LOG_PATH = path.join(__dirname, '../../.claude/logs/search-log.jsonl');

// Entity types we extract
type EntityType = 'tool' | 'concept' | 'decision' | 'file' | 'action' | 'technology' | 'pattern' | 'search-query';

interface SearchLogEntry {
  timestamp: string;
  source: string;
  query: string;
  resultsCount: number;
  topScore: number;
  topSessionId: string;
  durationMs: number;
}

function loadSearchLog(): SearchLogEntry[] {
  try {
    if (!fs.existsSync(SEARCH_LOG_PATH)) return [];
    const content = fs.readFileSync(SEARCH_LOG_PATH, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function extractSearchTerms(
  searchLog: SearchLogEntry[],
  terms: Map<string, ExtractedTerm>
): void {
  // Count query frequency
  const queryCounts = new Map<string, number>();
  for (const entry of searchLog) {
    const q = entry.query.toLowerCase().trim();
    queryCounts.set(q, (queryCounts.get(q) || 0) + 1);
  }

  // Extract individual words from queries
  const wordCounts = new Map<string, number>();
  Array.from(queryCounts.entries()).forEach(([query, count]) => {
    const words = query.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + count);
    }
  });

  // Add frequent search words as search-query terms
  Array.from(wordCounts.entries()).forEach(([word, count]) => {
    if (count >= 2) {
      const key = word.toLowerCase();
      if (terms.has(key)) {
        terms.get(key)!.count += count;
      } else {
        terms.set(key, {
          term: word,
          type: 'search-query',
          count,
          sessions: new Set(),
          contexts: [`Searched ${count} times`],
        });
      }
    }
  });

  // Add full queries that were searched 2+ times
  Array.from(queryCounts.entries()).forEach(([query, count]) => {
    if (count >= 2 && query.split(/\s+/).length >= 2) {
      const key = `search:${query}`;
      terms.set(key, {
        term: query,
        type: 'search-query',
        count,
        sessions: new Set(),
        contexts: [`Searched ${count} times`],
      });
    }
  });
}

interface ExtractedTerm {
  term: string;
  type: EntityType;
  count: number;
  sessions: Set<string>;
  contexts: string[];
}

interface TopicCluster {
  name: string;
  terms: string[];
  weight: number;
}

// Common programming/tech terms to extract
const TOOL_PATTERNS = [
  // Languages
  /\b(typescript|javascript|python|rust|golang|java|c\+\+|ruby|php|swift|kotlin)\b/gi,
  // Frameworks/Libraries
  /\b(react|vue|angular|svelte|next\.?js|nuxt|express|fastapi|django|flask|spring|rails)\b/gi,
  /\b(node\.?js|deno|bun)\b/gi,
  // Databases
  /\b(postgres(?:ql)?|mysql|mongodb|redis|sqlite|supabase|prisma|drizzle|sequelize)\b/gi,
  // Tools
  /\b(docker|kubernetes|k8s|terraform|ansible|jenkins|github|gitlab|vercel|netlify|aws|gcp|azure)\b/gi,
  /\b(npm|yarn|pnpm|pip|cargo|maven|gradle)\b/gi,
  /\b(webpack|vite|esbuild|rollup|parcel|turbopack)\b/gi,
  /\b(jest|vitest|mocha|pytest|cypress|playwright)\b/gi,
  /\b(eslint|prettier|biome|husky)\b/gi,
  /\b(git|vim|vscode|neovim|emacs)\b/gi,
  // AI/ML
  /\b(ollama|openai|anthropic|claude|gpt-?[34]|llama|langchain|llamaindex)\b/gi,
  /\b(qdrant|pinecone|weaviate|chroma|milvus)\b/gi,
  // Specific libraries
  /\b(lodash|axios|fetch|zod|yup|tanstack|trpc|graphql|rest)\b/gi,
];

const CONCEPT_PATTERNS = [
  // Patterns
  /\b(dependency injection|inversion of control|singleton|factory|observer|strategy|decorator)\b/gi,
  /\b(mvc|mvvm|flux|redux|state management|event sourcing|cqrs)\b/gi,
  /\b(microservices?|monolith|serverless|edge computing|cdn)\b/gi,
  /\b(rest(?:ful)?|graphql|grpc|websocket|sse|polling)\b/gi,
  // Concepts
  /\b(authentication|authorization|oauth|jwt|session|cookie|token)\b/gi,
  /\b(embedding|vector|semantic search|rag|retrieval|chunking)\b/gi,
  /\b(caching|memoization|lazy loading|code splitting|tree shaking)\b/gi,
  /\b(ci\/cd|continuous integration|continuous deployment|devops|gitops)\b/gi,
  /\b(tdd|bdd|unit test|integration test|e2e|testing)\b/gi,
  /\b(refactor(?:ing)?|debugging|profiling|optimization)\b/gi,
  /\b(async|await|promise|callback|event loop|concurrency)\b/gi,
  /\b(type safety|type inference|generics|interfaces?|schemas?)\b/gi,
  /\b(hooks?|components?|props?|state|context|effects?)\b/gi,
  /\b(api|endpoint|route|middleware|controller|service|repository)\b/gi,
  /\b(validation|sanitization|error handling|logging|monitoring)\b/gi,
];

const ACTION_PATTERNS = [
  /\b(npm (?:install|run|build|test|publish))\b/gi,
  /\b(git (?:commit|push|pull|merge|rebase|checkout|branch|clone))\b/gi,
  /\b(docker (?:build|run|compose|push|pull))\b/gi,
  /\b(deploy(?:ed|ing|ment)?|migrat(?:e|ed|ing|ion))\b/gi,
  /\b(creat(?:e|ed|ing)|implement(?:ed|ing)?|fix(?:ed|ing)?|updat(?:e|ed|ing)|refactor(?:ed|ing)?)\b/gi,
];

// Stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'we', 'they', 'he', 'she',
  'my', 'your', 'our', 'their', 'his', 'her', 'me', 'us', 'them', 'what', 'which',
  'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
  'if', 'else', 'elif', 'while', 'until', 'unless', 'return', 'true', 'false', 'null',
  'undefined', 'const', 'let', 'var', 'function', 'class', 'interface', 'type',
  'import', 'export', 'default', 'from', 'require', 'module', 'new', 'delete',
  'file', 'files', 'code', 'line', 'lines', 'change', 'changes', 'use', 'using', 'used',
  'need', 'needs', 'want', 'wants', 'like', 'make', 'makes', 'get', 'gets', 'set', 'sets',
  'add', 'adds', 'remove', 'removes', 'update', 'updates', 'can', 'way', 'ways',
  'thing', 'things', 'something', 'anything', 'nothing', 'everything',
]);

/**
 * Extract text content from a session file
 */
function extractSessionText(sessionPath: string): { text: string; sessionId: string; date: string } {
  const content = fs.readFileSync(sessionPath, 'utf8');
  const sessionData = JSON.parse(content);
  const sessionId = path.basename(sessionPath, '.json');

  const parts: string[] = [];

  if (sessionData.messages && Array.isArray(sessionData.messages)) {
    for (const msg of sessionData.messages) {
      if (msg.message?.role && msg.message?.content) {
        const content = typeof msg.message.content === 'string'
          ? msg.message.content
          : JSON.stringify(msg.message.content);

        if (!msg.isMeta && content && content.length > 10) {
          parts.push(content);
        }
      } else if (msg.role && msg.content) {
        parts.push(msg.content);
      }
    }
  }

  const date = sessionData.exportedAt || sessionData.startTime || sessionData.timestamp || new Date().toISOString();

  return { text: parts.join('\n\n'), sessionId, date };
}

/**
 * Extract terms from text using pattern matching
 */
function extractTerms(
  text: string,
  sessionId: string,
  existingTerms: Map<string, ExtractedTerm>
): void {
  // Extract tools
  for (const pattern of TOOL_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const term = match[1].toLowerCase();
      addTerm(existingTerms, term, 'tool', sessionId, getContext(text, match.index));
    }
  }

  // Extract concepts
  for (const pattern of CONCEPT_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const term = match[1].toLowerCase();
      addTerm(existingTerms, term, 'concept', sessionId, getContext(text, match.index));
    }
  }

  // Extract actions
  for (const pattern of ACTION_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const term = match[1].toLowerCase();
      addTerm(existingTerms, term, 'action', sessionId, getContext(text, match.index));
    }
  }

  // Extract camelCase and PascalCase identifiers (potential components, functions)
  const identifierPattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
  let match;
  while ((match = identifierPattern.exec(text)) !== null) {
    const term = match[1];
    // Only include if it appears multiple times
    if ((text.match(new RegExp(`\\b${term}\\b`, 'g'))?.length || 0) > 2) {
      addTerm(existingTerms, term, 'pattern', sessionId, getContext(text, match.index));
    }
  }
}

function addTerm(
  terms: Map<string, ExtractedTerm>,
  term: string,
  type: EntityType,
  sessionId: string,
  context: string
): void {
  const key = term.toLowerCase();

  if (STOP_WORDS.has(key) || key.length < 2) return;

  if (terms.has(key)) {
    const existing = terms.get(key)!;
    existing.count++;
    existing.sessions.add(sessionId);
    if (existing.contexts.length < 3 && context && !existing.contexts.includes(context)) {
      existing.contexts.push(context);
    }
  } else {
    terms.set(key, {
      term,
      type,
      count: 1,
      sessions: new Set([sessionId]),
      contexts: context ? [context] : [],
    });
  }
}

function getContext(text: string, index: number, radius: number = 50): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.substring(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Extract noun phrases using simple heuristics
 */
function extractNounPhrases(text: string, sessionId: string, terms: Map<string, ExtractedTerm>): void {
  // Common technical noun phrase patterns
  const patterns = [
    /\b((?:api|web|app|user|data|state|error|event|file|config|request|response)\s+\w+)\b/gi,
    /\b(\w+\s+(?:service|controller|component|handler|manager|factory|provider|hook|context|store))\b/gi,
    /\b(\w+\s+(?:pattern|approach|strategy|method|technique|solution|implementation))\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const phrase = match[1].toLowerCase().trim();
      if (phrase.split(/\s+/).length >= 2 && phrase.length < 40) {
        addTerm(terms, phrase, 'concept', sessionId, '');
      }
    }
  }
}

/**
 * Generate HTML visualization
 */
function generateHTML(terms: Map<string, ExtractedTerm>, totalSessions: number, searchLogCount: number = 0): string {
  // Convert to array and sort by count
  const termArray = Array.from(terms.values())
    .filter(t => t.count >= 3) // Only show terms that appear at least 3 times
    .sort((a, b) => b.count - a.count);

  // Group by type
  const byType = new Map<EntityType, ExtractedTerm[]>();
  for (const term of termArray) {
    if (!byType.has(term.type)) {
      byType.set(term.type, []);
    }
    byType.get(term.type)!.push(term);
  }

  // Calculate stats
  const stats = {
    totalTerms: termArray.length,
    totalSessions,
    byType: Object.fromEntries(
      Array.from(byType.entries()).map(([type, terms]) => [type, terms.length])
    ),
  };

  // Prepare word cloud data
  const maxCount = Math.max(...termArray.map(t => t.count));
  const wordCloudData = termArray.slice(0, 200).map(t => ({
    text: t.term,
    size: Math.max(12, Math.min(80, 12 + (t.count / maxCount) * 68)),
    count: t.count,
    sessions: t.sessions.size,
    type: t.type,
    contexts: t.contexts.slice(0, 2),
  }));

  // Type colors
  const typeColors: Record<EntityType, string> = {
    tool: '#3b82f6',
    concept: '#10b981',
    decision: '#f59e0b',
    file: '#6366f1',
    action: '#ec4899',
    technology: '#8b5cf6',
    pattern: '#14b8a6',
    'search-query': '#f97316',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Topic Map</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 24px 32px;
      border-bottom: 1px solid #334155;
    }
    .header h1 {
      font-size: 1.75rem;
      margin-bottom: 8px;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header p { color: #94a3b8; font-size: 0.95rem; }

    .stats-bar {
      display: flex;
      gap: 32px;
      padding: 16px 32px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      flex-wrap: wrap;
    }
    .stat {
      display: flex;
      flex-direction: column;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f8fafc;
    }
    .stat-label {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .controls {
      padding: 16px 32px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-group {
      display: flex;
      gap: 8px;
    }
    .filter-btn {
      padding: 6px 14px;
      border: 1px solid #334155;
      background: transparent;
      color: #94a3b8;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: #334155;
      color: #f8fafc;
    }
    .filter-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }
    .search-box {
      flex: 1;
      max-width: 300px;
    }
    .search-box input {
      width: 100%;
      padding: 8px 14px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .search-box input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .main-content {
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 0;
      height: calc(100vh - 200px);
    }

    .word-cloud-container {
      padding: 32px;
      overflow: auto;
    }
    .word-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: center;
    }
    .word {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .word:hover {
      transform: scale(1.1);
      background: rgba(255,255,255,0.1);
    }
    .word.selected {
      background: rgba(59, 130, 246, 0.3);
      outline: 2px solid #3b82f6;
    }

    .sidebar {
      background: #1e293b;
      border-left: 1px solid #334155;
      padding: 24px;
      overflow-y: auto;
    }
    .sidebar h2 {
      font-size: 1rem;
      color: #94a3b8;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .term-detail {
      display: none;
    }
    .term-detail.active {
      display: block;
    }
    .term-name {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .term-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }
    .term-meta span {
      color: #94a3b8;
      font-size: 0.9rem;
    }
    .term-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .context-list {
      margin-top: 16px;
    }
    .context-item {
      background: #0f172a;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 0.85rem;
      color: #cbd5e1;
      line-height: 1.5;
    }

    .top-terms {
      margin-top: 24px;
    }
    .top-term-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #334155;
    }
    .top-term-item:last-child {
      border-bottom: none;
    }
    .top-term-name {
      flex: 1;
      color: #f8fafc;
    }
    .top-term-count {
      color: #64748b;
      font-size: 0.85rem;
    }
    .top-term-bar {
      width: 60px;
      height: 4px;
      background: #334155;
      border-radius: 2px;
      margin-left: 12px;
      overflow: hidden;
    }
    .top-term-bar-fill {
      height: 100%;
      background: #3b82f6;
      border-radius: 2px;
    }

    .legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-left: auto;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: #94a3b8;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧠 Session Topic Map</h1>
    <p>Knowledge extracted from ${totalSessions} Claude Code sessions</p>
  </div>

  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value">${stats.totalTerms}</span>
      <span class="stat-label">Unique Terms</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.totalSessions}</span>
      <span class="stat-label">Sessions Analyzed</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.byType.tool || 0}</span>
      <span class="stat-label">Tools</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.byType.concept || 0}</span>
      <span class="stat-label">Concepts</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.byType.action || 0}</span>
      <span class="stat-label">Actions</span>
    </div>
    <div class="stat">
      <span class="stat-value">${searchLogCount}</span>
      <span class="stat-label">Searches</span>
    </div>
  </div>

  <div class="controls">
    <div class="filter-group">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="tool">Tools</button>
      <button class="filter-btn" data-filter="concept">Concepts</button>
      <button class="filter-btn" data-filter="action">Actions</button>
      <button class="filter-btn" data-filter="pattern">Patterns</button>
      <button class="filter-btn" data-filter="search-query">Searches</button>
    </div>
    <div class="search-box">
      <input type="text" id="search" placeholder="Search terms..." />
    </div>
    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background: #3b82f6"></span>Tool</div>
      <div class="legend-item"><span class="legend-dot" style="background: #10b981"></span>Concept</div>
      <div class="legend-item"><span class="legend-dot" style="background: #ec4899"></span>Action</div>
      <div class="legend-item"><span class="legend-dot" style="background: #14b8a6"></span>Pattern</div>
      <div class="legend-item"><span class="legend-dot" style="background: #f97316"></span>Search</div>
    </div>
  </div>

  <div class="main-content">
    <div class="word-cloud-container">
      <div class="word-cloud" id="wordCloud"></div>
    </div>

    <div class="sidebar">
      <div id="defaultView">
        <h2>Top Terms</h2>
        <div class="top-terms" id="topTerms"></div>
      </div>
      <div class="term-detail" id="termDetail">
        <h2>Term Details</h2>
        <div class="term-name" id="detailName"></div>
        <div class="term-meta">
          <span id="detailType" class="term-type"></span>
          <span id="detailCount"></span>
          <span id="detailSessions"></span>
        </div>
        <div class="context-list" id="detailContexts"></div>
      </div>
    </div>
  </div>

  <script>
    const wordData = ${JSON.stringify(wordCloudData)};
    const typeColors = ${JSON.stringify(typeColors)};

    let currentFilter = 'all';
    let searchQuery = '';
    let selectedTerm = null;

    function renderWordCloud() {
      const container = document.getElementById('wordCloud');
      container.innerHTML = '';

      const filtered = wordData.filter(w => {
        if (currentFilter !== 'all' && w.type !== currentFilter) return false;
        if (searchQuery && !w.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });

      filtered.forEach(word => {
        const span = document.createElement('span');
        span.className = 'word' + (selectedTerm === word.text ? ' selected' : '');
        span.textContent = word.text;
        span.style.fontSize = word.size + 'px';
        span.style.color = typeColors[word.type] || '#94a3b8';
        span.dataset.term = word.text;
        span.addEventListener('click', () => selectTerm(word));
        container.appendChild(span);
      });
    }

    function selectTerm(word) {
      selectedTerm = word.text;
      renderWordCloud();

      document.getElementById('defaultView').style.display = 'none';
      const detail = document.getElementById('termDetail');
      detail.classList.add('active');

      document.getElementById('detailName').textContent = word.text;
      document.getElementById('detailType').textContent = word.type;
      document.getElementById('detailType').style.background = typeColors[word.type];
      document.getElementById('detailType').style.color = 'white';
      document.getElementById('detailCount').textContent = word.count + ' mentions';
      document.getElementById('detailSessions').textContent = word.sessions + ' sessions';

      const contextsDiv = document.getElementById('detailContexts');
      contextsDiv.innerHTML = word.contexts.length > 0
        ? word.contexts.map(c => '<div class="context-item">...' + c + '...</div>').join('')
        : '<div class="context-item">No context snippets available</div>';
    }

    function renderTopTerms() {
      const container = document.getElementById('topTerms');
      const maxCount = wordData[0]?.count || 1;

      container.innerHTML = wordData.slice(0, 20).map(w => \`
        <div class="top-term-item">
          <span class="top-term-name" style="color: \${typeColors[w.type]}">\${w.text}</span>
          <span class="top-term-count">\${w.count}</span>
          <div class="top-term-bar">
            <div class="top-term-bar-fill" style="width: \${(w.count / maxCount) * 100}%"></div>
          </div>
        </div>
      \`).join('');
    }

    // Event listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderWordCloud();
      });
    });

    document.getElementById('search').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderWordCloud();
    });

    // Initial render
    renderWordCloud();
    renderTopTerms();
  </script>
</body>
</html>`;
}

/**
 * Generate topic map from sessions
 * Can be called programmatically or run as CLI
 */
export async function generateTopicMap(options?: { silent?: boolean }): Promise<void> {
  const silent = options?.silent ?? false;

  if (!silent) {
    console.log('\n🧠 Session Topic Map Generator\n');
    console.log('=' .repeat(50));
  }

  // Check if sessions directory exists
  if (!fs.existsSync(SESSIONS_DIR)) {
    if (!silent) console.error(`❌ Sessions directory not found: ${SESSIONS_DIR}`);
    return;
  }

  // Get all session files
  const sessionFiles = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(SESSIONS_DIR, f));

  if (!silent) console.log(`📂 Found ${sessionFiles.length} session files`);

  // Extract terms from all sessions
  const terms = new Map<string, ExtractedTerm>();
  let processed = 0;

  if (!silent) console.log('\n🔍 Extracting terms from sessions...');

  for (const sessionFile of sessionFiles) {
    try {
      const { text, sessionId } = extractSessionText(sessionFile);
      extractTerms(text, sessionId, terms);
      extractNounPhrases(text, sessionId, terms);
      processed++;

      if (!silent && processed % 50 === 0) {
        process.stdout.write(`\r   Processed ${processed}/${sessionFiles.length} sessions...`);
      }
    } catch (error) {
      // Skip files that fail to parse
    }
  }

  // Load and integrate search activity log
  const searchLog = loadSearchLog();
  if (searchLog.length > 0) {
    extractSearchTerms(searchLog, terms);
    if (!silent) console.log(`\n🔎 Integrated ${searchLog.length} search log entries`);
  }

  if (!silent) {
    console.log(`\r   Processed ${processed}/${sessionFiles.length} sessions    `);
    console.log(`\n📊 Extracted ${terms.size} unique terms`);
    console.log('\n📝 Generating visualization...');
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const html = generateHTML(terms, sessionFiles.length, searchLog.length);
  const outputPath = path.join(OUTPUT_DIR, 'topic-map.html');
  fs.writeFileSync(outputPath, html);

  if (!silent) {
    console.log(`\n✅ Topic map saved to:\n   ${outputPath}`);
    console.log(`\n🌐 Open in browser to explore your knowledge topics!`);
    console.log(`   file://${outputPath.replace(/\\/g, '/')}`);
  }

  // Also save raw data
  const dataPath = path.join(OUTPUT_DIR, 'topic-data.json');
  const termArray = Array.from(terms.values())
    .filter(t => t.count >= 3)
    .map(t => ({
      ...t,
      sessions: Array.from(t.sessions),
    }))
    .sort((a, b) => b.count - a.count);

  fs.writeFileSync(dataPath, JSON.stringify({
    terms: termArray,
    totalSessions: sessionFiles.length,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  if (!silent) console.log(`   Data also saved to: ${dataPath}\n`);
}

// CLI entry point
if (require.main === module) {
  generateTopicMap().catch(console.error);
}
