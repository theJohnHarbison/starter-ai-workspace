import * as fs from 'fs';
import * as path from 'path';
import { Ollama } from 'ollama';
import { QdrantVectorStore } from './qdrant-store';

function logSearch(source: string, query: string, resultsCount: number, topScore: number, topSessionId: string, durationMs: number) {
  try {
    const logDir = path.join(__dirname, '../../.claude/logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'search-log.jsonl');
    const entry = { timestamp: new Date().toISOString(), source, query, resultsCount, topScore, topSessionId, durationMs };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch {}
}

const OLLAMA_MODEL = 'nomic-embed-text';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

async function search(query: string, topK: number = 5) {
  const startTime = Date.now();
  console.log(`Searching for: "${query}"\n`);

  const ollama = new Ollama({ host: OLLAMA_HOST });
  const vectorStore = new QdrantVectorStore();

  const response = await ollama.embeddings({
    model: OLLAMA_MODEL,
    prompt: query,
  });

  const queryEmbedding = response.embedding;

  const results = await vectorStore.search(queryEmbedding, topK);

  if (results.length === 0) {
    logSearch('search', query, 0, 0, '', Date.now() - startTime);
    console.log('No results found.');
    return;
  }

  logSearch('search', query, results.length, results[0].score, results[0].session_id, Date.now() - startTime);

  console.log(`Found ${results.length} results:\n`);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const score = (result.score * 100).toFixed(1);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Result ${i + 1} - Score: ${score}% - Session: ${result.session_id}`);
    console.log(`Date: ${result.metadata.date}`);
    console.log(`Chunk: ${result.metadata.chunk_index + 1}`);
    console.log(`${'='.repeat(80)}`);

    const preview = result.chunk_text.length > 500
      ? result.chunk_text.substring(0, 500) + '...'
      : result.chunk_text;

    console.log(preview);
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Session Search');
    console.log('');
    console.log('Usage:');
    console.log('  npm run search "your query here"');
    console.log('  npm run search "your query" 10         - Return top 10 results');
    console.log('');
    console.log('Examples:');
    console.log('  npm run search "how did I implement Supabase realtime?"');
    console.log('  npm run search "React hooks with TypeScript"');
    console.log('  npm run search "database schema decisions"');
    return;
  }

  const query = args[0];
  const topK = args[1] ? parseInt(args[1], 10) : 5;

  await search(query, topK);
}

if (require.main === module) {
  main().catch(console.error);
}
