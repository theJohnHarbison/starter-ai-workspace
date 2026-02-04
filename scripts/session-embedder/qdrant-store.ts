import * as fs from 'fs';
import * as path from 'path';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'session-embeddings';
const VECTOR_SIZE = 384; // bge-small-en-v1.5 dimensions

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
        // Ignore read errors
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

export interface VectorEntry {
  id: string;
  session_id: string;
  chunk_text: string;
  embedding: number[];
  metadata: {
    date: string;
    files?: string[];
    tools?: string[];
    chunk_index: number;
  };
}

export class QdrantVectorStore {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if collection exists
      const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);

      if (!response.ok) {
        // Create collection
        await this.createCollection();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Qdrant:', error);
      throw error;
    }
  }

  private async createCollection(): Promise<void> {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create collection: ${response.statusText}`);
    }
  }

  async addEntry(entry: VectorEntry): Promise<void> {
    await this.initialize();

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: this.stringToId(entry.id),
            vector: entry.embedding,
            payload: {
              id: entry.id,
              session_id: entry.session_id,
              date: entry.metadata.date,
              chunk_index: entry.metadata.chunk_index,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add entry: ${response.statusText}`);
    }
  }

  async addBatch(entries: VectorEntry[]): Promise<void> {
    await this.initialize();

    const points = entries.map(entry => ({
      id: this.stringToId(entry.id),
      vector: entry.embedding,
      payload: {
        id: entry.id,
        session_id: entry.session_id,
        date: entry.metadata.date,
        chunk_index: entry.metadata.chunk_index,
      },
    }));

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add batch: ${response.statusText} - ${errorText}`);
    }
  }

  async search(queryEmbedding: number[], topK: number = 10): Promise<Array<VectorEntry & { score: number }>> {
    await this.initialize();

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json() as any;

    return data.result.map((item: any) => ({
      id: item.payload.id,
      session_id: item.payload.session_id,
      chunk_text: "", // Text is not stored in Qdrant, just ID is used for lookup
      embedding: item.vector || [],
      metadata: {
        date: item.payload.date,
        chunk_index: item.payload.chunk_index,
      },
      score: item.score,
    }));
  }

  async hasSession(sessionId: string): Promise<boolean> {
    await this.initialize();

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: new Array(VECTOR_SIZE).fill(0),
        limit: 1,
        filter: {
          must: [
            {
              key: 'session_id',
              match: {
                value: sessionId,
              },
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Filter search failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.result.length > 0;
  }

  async getStats(): Promise<any> {
    await this.initialize();

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);

    if (!response.ok) {
      throw new Error(`Failed to get stats: ${response.statusText}`);
    }

    const data = await response.json() as any;

    return {
      model: 'bge-small-en-v1.5',
      dimensions: VECTOR_SIZE,
      total_sessions: 'N/A', // Would need separate query to count unique sessions
      total_chunks: data.result.points_count,
      storage_size_mb: (data.result.points_count * VECTOR_SIZE * 4 / 1024 / 1024).toFixed(2),
      qdrant_status: 'healthy',
    };
  }

  async getAllSessions(): Promise<string[]> {
    await this.initialize();

    // This is an expensive operation, might need optimization for large datasets
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?limit=10000`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to get all points: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const sessions = new Set<string>();

    data.result.points.forEach((point: any) => {
      if (point.payload?.session_id) {
        sessions.add(point.payload.session_id);
      }
    });

    return Array.from(sessions);
  }

  private stringToId(str: string): number {
    // Convert string to numeric ID using hash (safe uint64 range)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
    }
    // Convert to positive number and keep within safe integer range
    return Math.abs(hash >>> 0); // Use unsigned right shift to get positive 32-bit int
  }
}
