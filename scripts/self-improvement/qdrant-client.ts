/**
 * Shared Qdrant helper for the self-improvement system.
 * Manages the 'reflections' collection and queries 'session-embeddings'.
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const REFLECTIONS_COLLECTION = 'reflections';
const SESSIONS_COLLECTION = 'session-embeddings';
const VECTOR_SIZE = 384;

/**
 * Ensure a Qdrant collection exists, creating it if needed.
 */
async function ensureCollection(name: string): Promise<void> {
  const res = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (!res.ok) {
    const createRes = await fetch(`${QDRANT_URL}/collections/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create collection ${name}: ${createRes.statusText}`);
    }
  }
}

/**
 * Convert a string ID to a numeric hash for Qdrant.
 */
function stringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Check if Qdrant is reachable.
 */
export async function isQdrantAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Store a reflection in the reflections collection.
 */
export async function storeReflection(
  id: string,
  embedding: number[],
  payload: Record<string, unknown>
): Promise<void> {
  await ensureCollection(REFLECTIONS_COLLECTION);

  const res = await fetch(`${QDRANT_URL}/collections/${REFLECTIONS_COLLECTION}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      points: [{
        id: stringToId(id),
        vector: embedding,
        payload: { ...payload, id },
      }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to store reflection: ${res.statusText}`);
  }
}

/**
 * Search reflections by embedding vector.
 */
export async function searchReflections(
  embedding: number[],
  topK: number = 3,
  scoreThreshold: number = 0.6
): Promise<Array<{ payload: Record<string, unknown>; score: number }>> {
  await ensureCollection(REFLECTIONS_COLLECTION);

  const res = await fetch(`${QDRANT_URL}/collections/${REFLECTIONS_COLLECTION}/points/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector: embedding,
      limit: topK,
      with_payload: true,
      score_threshold: scoreThreshold,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json() as { result: Array<{ payload: Record<string, unknown>; score: number }> };
  return data.result;
}

/**
 * Search session embeddings by vector with optional quality filter.
 */
export async function searchSessions(
  embedding: number[],
  topK: number = 10,
  qualityFilter?: { min?: number; max?: number }
): Promise<Array<{ payload: Record<string, unknown>; score: number }>> {
  const filter: Record<string, unknown> = {};

  if (qualityFilter) {
    const must: Array<Record<string, unknown>> = [];
    if (qualityFilter.min !== undefined) {
      must.push({ key: 'quality_score', range: { gte: qualityFilter.min } });
    }
    if (qualityFilter.max !== undefined) {
      must.push({ key: 'quality_score', range: { lte: qualityFilter.max } });
    }
    if (must.length > 0) {
      filter.must = must;
    }
  }

  const body: Record<string, unknown> = {
    vector: embedding,
    limit: topK,
    with_payload: true,
  };
  if (Object.keys(filter).length > 0) {
    body.filter = filter;
  }

  const res = await fetch(`${QDRANT_URL}/collections/${SESSIONS_COLLECTION}/points/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];

  const data = await res.json() as { result: Array<{ payload: Record<string, unknown>; score: number }> };
  return data.result;
}

/**
 * Scroll through all points in session-embeddings with optional filter.
 */
export async function scrollSessions(
  filter?: Record<string, unknown>,
  limit: number = 100
): Promise<Array<{ id: number | string; payload: Record<string, unknown> }>> {
  const points: Array<{ id: number | string; payload: Record<string, unknown> }> = [];
  let offset: string | number | null = null;

  while (true) {
    const body: Record<string, unknown> = { limit, with_payload: true };
    if (offset !== null) body.offset = offset;
    if (filter) body.filter = filter;

    const res = await fetch(`${QDRANT_URL}/collections/${SESSIONS_COLLECTION}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;

    const data = await res.json() as { result: { points: Array<{ id: number | string; payload: Record<string, unknown> }>; next_page_offset?: string | number } };
    points.push(...data.result.points);

    if (!data.result.next_page_offset) break;
    offset = data.result.next_page_offset;
  }

  return points;
}

/**
 * Get reflections collection stats.
 */
export async function getReflectionStats(): Promise<{ count: number }> {
  try {
    await ensureCollection(REFLECTIONS_COLLECTION);
    const res = await fetch(`${QDRANT_URL}/collections/${REFLECTIONS_COLLECTION}`);
    if (!res.ok) return { count: 0 };
    const data = await res.json() as { result: { points_count: number } };
    return { count: data.result.points_count };
  } catch {
    return { count: 0 };
  }
}
