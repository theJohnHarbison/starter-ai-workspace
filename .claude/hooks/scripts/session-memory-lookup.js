#!/usr/bin/env node

/**
 * UserPromptSubmit hook: Auto-query session knowledge graph
 * Searches Qdrant for relevant past session context and outputs it via stdout.
 */

const fs = require('fs');
const pathMod = require('path');

const OLLAMA_URL = 'http://localhost:11434';
const QDRANT_URL = 'http://localhost:6333';
const COLLECTION = 'session-embeddings';
const MODEL = 'nomic-embed-text';
const TOP_K = 3;
const SIMILARITY_THRESHOLD = 0.65;
const MAX_PREVIEW_CHARS = 300;

function logSearch(query, results, durationMs) {
  try {
    const logDir = pathMod.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = pathMod.join(logDir, 'search-log.jsonl');
    const entry = {
      timestamp: new Date().toISOString(),
      source: 'hook',
      query,
      resultsCount: results.length,
      topScore: results.length > 0 ? results[0].score : 0,
      topSessionId: results.length > 0 ? (results[0].payload?.session_id || '') : '',
      durationMs,
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch {}
}

const SKIP_PATTERNS = [
  /^.{0,19}$/,                    // < 20 chars
  /^(yes|no|ok|sure|thanks|y|n|k)\.?$/i,
  /^(hi|hello|hey|howdy|greetings)\.?$/i,
  /^\/\w/,                        // slash commands
  /^(commit|push|pull|merge|rebase)$/i,
  /^(continue|go ahead|do it|proceed|looks good|lgtm)\.?$/i,
];

async function main() {
  const prompt = process.env.USER_PROMPT;
  if (!prompt) return;

  // Skip trivial prompts
  const trimmed = prompt.trim();
  if (SKIP_PATTERNS.some(p => p.test(trimmed))) return;

  const startTime = Date.now();
  try {
    // Embed the query
    const embedRes = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: trimmed }),
      signal: AbortSignal.timeout(3000),
    });
    if (!embedRes.ok) return;
    const { embedding } = await embedRes.json();
    if (!embedding) return;

    // Search Qdrant
    const searchRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: embedding,
        limit: TOP_K,
        with_payload: true,
        score_threshold: SIMILARITY_THRESHOLD,
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!searchRes.ok) return;
    const { result } = await searchRes.json();
    if (!result || result.length === 0) {
      logSearch(trimmed, [], Date.now() - startTime);
      return;
    }

    logSearch(trimmed, result, Date.now() - startTime);

    // Search reflections collection too
    let reflections = [];
    try {
      const refRes = await fetch(`${QDRANT_URL}/collections/reflections/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: embedding,
          limit: 2,
          with_payload: true,
          score_threshold: 0.7,
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (refRes.ok) {
        const refData = await refRes.json();
        reflections = refData.result || [];
      }
    } catch {} // Silently ignore if reflections collection doesn't exist

    // Format output
    const lines = ['<session-memory>', `Found ${result.length} relevant past session(s):`, ''];
    for (const hit of result) {
      const score = Math.round(hit.score * 100);
      const payload = hit.payload || {};
      const date = payload.session_date || payload.date || 'unknown date';
      let text = payload.text || payload.content || '';
      if (text.length > MAX_PREVIEW_CHARS) {
        text = text.slice(0, MAX_PREVIEW_CHARS) + '...';
      }
      lines.push(`[${score}% match | ${date}]`);
      lines.push(text);
      lines.push('');
    }
    // Add reflections if any
    if (reflections.length > 0) {
      lines.push('Past failure reflections:');
      lines.push('');
      for (const ref of reflections) {
        const score = Math.round(ref.score * 100);
        const p = ref.payload || {};
        lines.push(`[${score}% match | reflection]`);
        lines.push(`Failure: ${p.failure_description || ''}`);
        lines.push(`Root cause: ${p.root_cause || ''}`);
        lines.push(`Prevention: ${p.prevention_rule || ''}`);
        lines.push('');
      }
    }

    lines.push('</session-memory>');
    console.log(lines.join('\n'));
  } catch {
    // Silently exit on any error (services down, timeout, etc.)
  }
}

main();
