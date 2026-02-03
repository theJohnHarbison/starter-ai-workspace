/**
 * Shared Ollama helper for the self-improvement system.
 * Uses raw HTTP fetch (no npm dependency) to match hook script patterns.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const LLM_MODEL = 'qwen2.5-coder:7b';
const EMBED_MODEL = 'nomic-embed-text';

/**
 * Check if Ollama is reachable.
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generate text from a prompt using the local LLM.
 */
export async function generate(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.maxTokens ?? 500,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama generate failed: ${res.statusText}`);
  }

  const data = await res.json() as { response: string };
  return data.response.trim();
}

/**
 * Generate an embedding vector for the given text.
 */
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embed failed: ${res.statusText}`);
  }

  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
