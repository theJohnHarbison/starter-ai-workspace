import * as fs from 'fs';
import * as path from 'path';
import { Ollama } from 'ollama';
import { SessionChunker } from './chunker';
import { VectorEntry } from './vector-store';
import { QdrantVectorStore } from './qdrant-store';
import { QdrantBackupManager } from './qdrant-backup';
import { generateTopicMap } from './topic-map';
import chalk from 'chalk';

const OLLAMA_MODEL = 'nomic-embed-text';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_BACKUP_PATH = process.env.EMBEDDING_BACKUP_PATH || './backups';

/**
 * Find workspace root by looking for .claude directory
 */
function findWorkspaceRoot(): string {
  // Try environment variable first
  if (process.env.WORKSPACE_ROOT) {
    return process.env.WORKSPACE_ROOT;
  }

  let current = process.cwd();

  // Walk up directory tree looking for .claude directory
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) {
      return current;
    }
    if (fs.existsSync(path.join(current, '.claude', 'vector-store'))) {
      return current;
    }
    if (fs.existsSync(path.join(current, 'package.json'))) {
      try {
        const pkgPath = path.join(current, 'package.json');
        const content = fs.readFileSync(pkgPath, 'utf8');
        if (content.includes('"name": "ai-workspace"')) {
          return current;
        }
      } catch {
        // Ignore read errors
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

// Lazy initialization of workspace root
let cachedWorkspaceRoot: string | null = null;
function getWorkspaceRoot(): string {
  if (!cachedWorkspaceRoot) {
    cachedWorkspaceRoot = findWorkspaceRoot();
  }
  return cachedWorkspaceRoot;
}

// For backward compatibility, create a getter
const WORKSPACE_ROOT_OBJ = { get value() { return getWorkspaceRoot(); } };
const WORKSPACE_ROOT = getWorkspaceRoot();

/**
 * Progress tracker for embedding operations
 */
class ProgressTracker {
  private startTime: number;
  private total: number;
  private current: number;
  private label: string;

  constructor(label: string, total: number) {
    this.label = label;
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
  }

  increment(): void {
    this.current++;
    this.render();
  }

  skip(): void {
    this.current++;
    this.render();
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private render(): void {
    const percentage = Math.floor((this.current / this.total) * 100);
    const elapsed = Date.now() - this.startTime;
    const barWidth = 30;
    const filledWidth = Math.floor((this.current / this.total) * barWidth);
    const emptyWidth = barWidth - filledWidth;

    const bar = chalk.green('█'.repeat(filledWidth)) + chalk.gray('░'.repeat(emptyWidth));
    const counter = chalk.cyan(`${this.current}/${this.total}`);
    const percent = chalk.yellow(`${percentage}%`);
    const time = chalk.gray(`[${this.formatTime(elapsed)}]`);

    // Clear line and write progress
    process.stdout.write(`\r${this.label}: ${bar} ${counter} ${percent} ${time}`);

    // Add newline when complete
    if (this.current === this.total) {
      console.log('');
    }
  }
}

export class SessionEmbedder {
  private ollama: Ollama;
  private chunker: SessionChunker;
  private vectorStore: QdrantVectorStore;

  constructor() {
    this.ollama = new Ollama({ host: OLLAMA_HOST });
    this.chunker = new SessionChunker();
    this.vectorStore = new QdrantVectorStore();
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: OLLAMA_MODEL,
        prompt: text,
      });

      return response.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async embedSession(sessionPath: string): Promise<void> {
    const sessionId = path.basename(sessionPath, '.json');

    if (await this.vectorStore.hasSession(sessionId)) {
      console.log(chalk.gray(`⚠️  Session ${sessionId} already embedded, skipping...`));
      return;
    }

    console.log(chalk.blue(`\n📝 Embedding session: ${chalk.bold(sessionId)}`));

    const sessionContent = fs.readFileSync(sessionPath, 'utf8');
    const sessionData = JSON.parse(sessionContent);

    const text = this.extractSessionText(sessionData);
    const chunks = this.chunker.chunkSession(text);

    console.log(chalk.gray(`   Found ${chunks.length} chunks to process`));

    const entries: VectorEntry[] = [];
    const progress = new ProgressTracker(`   Processing chunks`, chunks.length);

    for (const chunk of chunks) {
      // Skip empty chunks
      if (!chunk.text || chunk.text.trim().length < 10) {
        progress.skip();
        continue;
      }

      const embedding = await this.embedText(chunk.text);

      const entry: VectorEntry = {
        id: `${sessionId}-chunk-${chunk.index}`,
        session_id: sessionId,
        chunk_text: chunk.text,
        embedding,
        metadata: {
          date: sessionData.exportedAt || sessionData.startTime || sessionData.timestamp || new Date().toISOString(),
          chunk_index: chunk.index,
        },
      };

      entries.push(entry);
      progress.increment();
    }

    if (entries.length > 0) {
      await this.vectorStore.addBatch(entries);
      console.log(chalk.green(`   ✅ Embedded ${entries.length} chunks successfully\n`));
    } else {
      console.log(chalk.yellow(`   ⚠️  No valid chunks to embed (all chunks were too small)\n`));
    }
  }

  private extractSessionText(sessionData: any): string {
    const parts: string[] = [];

    if (sessionData.messages && Array.isArray(sessionData.messages)) {
      for (const msg of sessionData.messages) {
        // Handle Claude Code session format
        if (msg.message && msg.message.role && msg.message.content) {
          const role = msg.message.role;
          const content = typeof msg.message.content === 'string'
            ? msg.message.content
            : JSON.stringify(msg.message.content);

          // Skip meta messages and empty content
          if (!msg.isMeta && content && content.length > 10) {
            parts.push(`[${role}]: ${content}`);
          }
        }
        // Handle standard message format
        else if (msg.role && msg.content) {
          parts.push(`[${msg.role}]: ${msg.content}`);
        }
      }
    } else if (sessionData.conversation) {
      parts.push(JSON.stringify(sessionData.conversation, null, 2));
    } else if (typeof sessionData === 'string') {
      parts.push(sessionData);
    } else {
      parts.push(JSON.stringify(sessionData, null, 2));
    }

    return parts.join('\n\n');
  }

  async embedSessionsInDirectory(dirPath: string, backupPath?: string): Promise<void> {
    console.log(chalk.cyan(`\n🔍 Scanning directory: ${dirPath}`));

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

    console.log(chalk.cyan(`📊 Found ${chalk.bold(String(files.length))} session files to process\n`));

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fullPath = path.join(dirPath, file);

      console.log(chalk.gray(`─────────────────────────────────────────────────────────────────────`));
      console.log(chalk.magenta(`[${i + 1}/${files.length}] Processing: ${file}`));

      try {
        const sessionId = path.basename(file, '.json');
        const wasAlreadyEmbedded = await this.vectorStore.hasSession(sessionId);

        await this.embedSession(fullPath);

        if (wasAlreadyEmbedded) {
          skipped++;
        } else {
          processed++;
        }
      } catch (error) {
        errors++;
        console.error(chalk.red(`   ❌ Error embedding ${file}:`), error);
      }
    }

    console.log(chalk.gray(`─────────────────────────────────────────────────────────────────────`));

    const stats = await this.vectorStore.getStats();
    console.log(chalk.green.bold('\n✨ Embedding complete!\n'));
    console.log(chalk.cyan('📈 Summary:'));
    console.log(`   Sessions processed: ${chalk.green(String(processed))}`);
    console.log(`   Sessions skipped:   ${chalk.yellow(String(skipped))}`);
    console.log(`   Errors:             ${errors > 0 ? chalk.red(String(errors)) : chalk.green('0')}`);
    console.log(chalk.cyan('\n📊 Vector Store Statistics:'));
    console.log(`   Total sessions:     ${chalk.bold(String(stats.total_sessions))}`);
    console.log(`   Total chunks:       ${chalk.bold(String(stats.total_chunks))}`);
    console.log(`   Storage size:       ${chalk.bold(stats.storage_size_mb + ' MB')}`);

    // Perform backup if path is provided
    if (backupPath) {
      try {
        const backupManager = new QdrantBackupManager(backupPath);
        await backupManager.backup();
      } catch (error) {
        console.error(chalk.red('⚠️  Backup failed (embedding was successful):'), error);
      }
    }

    // Regenerate topic map visualization
    console.log(chalk.cyan('\n🗺️  Regenerating topic map visualization...'));
    try {
      await generateTopicMap({ silent: true });
      console.log(chalk.green('✅ Topic map updated: .claude/visualizations/topic-map.html'));
    } catch (error) {
      console.error(chalk.red('⚠️  Topic map generation failed:'), error);
    }

    console.log('');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const embedder = new SessionEmbedder();
  const backupPath = process.env.EMBEDDING_BACKUP_PATH || DEFAULT_BACKUP_PATH;

  if (command === 'embed') {
    const sessionPath = args[1];
    const doBackup = args.includes('--backup');

    if (!sessionPath || sessionPath.startsWith('--')) {
      const defaultPath = path.join(WORKSPACE_ROOT, '.claude', 'logs', 'sessions');
      await embedder.embedSessionsInDirectory(defaultPath, doBackup ? backupPath : undefined);
    } else if (fs.existsSync(sessionPath) && fs.statSync(sessionPath).isDirectory()) {
      await embedder.embedSessionsInDirectory(sessionPath, doBackup ? backupPath : undefined);
    } else if (fs.existsSync(sessionPath)) {
      await embedder.embedSession(sessionPath);
    } else {
      console.error(`Error: Path not found: ${sessionPath}`);
      process.exit(1);
    }
  } else if (command === 'stats') {
    const vectorStore = new QdrantVectorStore();
    const stats = await vectorStore.getStats();
    console.log('Vector Store Statistics:');
    console.log(`  Model: ${stats.model}`);
    console.log(`  Dimensions: ${stats.dimensions}`);
    console.log(`  Total sessions: ${stats.total_sessions}`);
    console.log(`  Total chunks: ${stats.total_chunks}`);
    console.log(`  Storage size: ${stats.storage_size_mb} MB`);
    if (stats.qdrant_status) {
      console.log(`  Status: ${stats.qdrant_status}`);
    }
  } else {
    console.log('Session Embedder');
    console.log('');
    console.log('Usage:');
    console.log('  npm run embed                    - Embed all sessions');
    console.log('  npm run embed <dir>              - Embed all sessions in directory');
    console.log('  npm run embed <session.json>     - Embed single session');
    console.log('  npm run embed stats              - Show vector store statistics');
    console.log('');
    console.log('Options:');
    console.log('  --backup                         - Backup vector store after embedding');
    console.log('');
    console.log('Environment:');
    console.log(`  EMBEDDING_BACKUP_PATH            - Custom backup path (default: ${DEFAULT_BACKUP_PATH})`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
