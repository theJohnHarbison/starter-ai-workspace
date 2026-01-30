import * as fs from 'fs';
import * as path from 'path';
import { QdrantVectorStore } from './qdrant-store';
import { VectorStoreManager, VectorEntry } from './vector-store';
import chalk from 'chalk';

/**
 * Find workspace root by looking for .claude directory
 */
function findWorkspaceRoot(): string {
  if (process.env.WORKSPACE_ROOT) {
    return process.env.WORKSPACE_ROOT;
  }

  let current = process.cwd();

  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) {
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
        // Ignore
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

async function migrateToQdrant() {
  const workspaceRoot = findWorkspaceRoot();
  const jsonStorePath = path.join(workspaceRoot, '.claude', 'vector-store', 'sessions.json');

  console.log(chalk.cyan('\n🔄 Migrating Vector Store from JSON to Qdrant\n'));

  // Check if JSON store exists
  if (!fs.existsSync(jsonStorePath)) {
    console.log(chalk.yellow('⚠️  No existing JSON vector store found, skipping migration\n'));
    return;
  }

  try {
    // Load JSON store
    console.log(chalk.blue('📖 Loading JSON vector store...'));
    const jsonStoreManager = new VectorStoreManager(jsonStorePath);
    const stats = jsonStoreManager.getStats();
    console.log(chalk.green(`   ✓ Loaded ${stats.total_chunks} chunks from JSON\n`));

    // Initialize Qdrant
    console.log(chalk.blue('🗄️  Initializing Qdrant vector store...'));
    const qdrantStore = new QdrantVectorStore();
    await qdrantStore.initialize();
    console.log(chalk.green('   ✓ Qdrant ready\n'));

    // Get all sessions from JSON store and migrate
    console.log(chalk.blue('📤 Migrating embeddings to Qdrant...'));

    // We need to read the JSON file directly to access all entries
    const jsonContent = fs.readFileSync(jsonStorePath, 'utf8');
    const jsonStore = JSON.parse(jsonContent);
    const entries: VectorEntry[] = jsonStore.entries || [];

    if (entries.length === 0) {
      console.log(chalk.yellow('   No entries to migrate\n'));
      return;
    }

    // Batch process entries with validation
    const batchSize = 100;
    let skipped = 0;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, Math.min(i + batchSize, entries.length));

      // Validate entries before sending
      const validEntries = batch.filter(entry => {
        // Check for missing or invalid embeddings
        if (!entry.embedding || !Array.isArray(entry.embedding) || entry.embedding.length !== 768) {
          skipped++;
          return false;
        }
        // Check for empty chunk text
        if (!entry.chunk_text || entry.chunk_text.trim().length === 0) {
          skipped++;
          return false;
        }
        return true;
      });

      if (validEntries.length > 0) {
        await qdrantStore.addBatch(validEntries);
      }

      const percentage = Math.floor((Math.min(i + batchSize, entries.length) / entries.length) * 100);
      console.log(chalk.gray(`   ${percentage}% (${Math.min(i + batchSize, entries.length)}/${entries.length})`));
    }

    if (skipped > 0) {
      console.log(chalk.yellow(`   ⚠️  Skipped ${skipped} invalid entries`));
    }

    console.log(chalk.green(`\n   ✓ Successfully migrated ${entries.length} entries\n`));

    // Verify migration
    console.log(chalk.blue('✓ Verifying migration...'));
    const qdrantStats = await qdrantStore.getStats();
    console.log(chalk.green(`   Qdrant now contains: ${qdrantStats.total_chunks} chunks\n`));

    // Create backup of JSON store
    const backupPath = jsonStorePath.replace('.json', '.backup.json');
    fs.copyFileSync(jsonStorePath, backupPath);
    console.log(chalk.cyan(`💾 Backed up JSON store to: ${backupPath}\n`));

    console.log(chalk.green.bold('✨ Migration complete!\n'));
    console.log(chalk.cyan('Next steps:'));
    console.log('  1. Test that searches work: npm run hybrid:search "test query"');
    console.log('  2. If everything works, delete the JSON backup when you\'re confident');
    console.log(`  3. You can now safely delete: ${jsonStorePath}\n`);

  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error);
    process.exit(1);
  }
}

migrateToQdrant().catch(console.error);
