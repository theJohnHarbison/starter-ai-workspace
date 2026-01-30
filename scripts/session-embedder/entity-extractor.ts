/**
 * Entity Extractor
 *
 * Extracts entities from session chunks using Ollama LLM.
 * Based on research:
 * - GraphRAG Survey (arXiv:2408.08921): Entity extraction for knowledge graphs
 * - A-Mem (arXiv:2502.12110): Autonomous attribute-based organization
 *
 * Entity Types:
 * - tools: npm packages, CLI tools, frameworks, libraries
 * - concepts: programming concepts, patterns, methodologies
 * - decisions: architectural decisions, technology choices
 * - files: file paths, directories mentioned
 * - actions: operations performed
 */

import { Ollama } from 'ollama';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || 'qwen2.5-coder:7b';

export type EntityType = 'tool' | 'concept' | 'decision' | 'file' | 'action';

export interface Entity {
  type: EntityType;
  name: string;
  context: string;  // Brief context of how it was mentioned
  confidence: number;  // 0-1 confidence score
  mentions: number;  // Number of times mentioned
}

export interface ExtractionResult {
  entities: Entity[];
  summary: string;
  topics: string[];
  extractedAt: string;
}

// Prompt template for entity extraction
const EXTRACTION_PROMPT = `You are an entity extraction system analyzing software development conversations.

Extract entities from the following text and return them in JSON format.

Entity types to extract:
1. tools - npm packages, CLI tools, frameworks, libraries (e.g., "react", "docker", "typescript")
2. concepts - programming concepts, patterns, methodologies (e.g., "dependency injection", "GraphRAG", "tiered memory")
3. decisions - architectural or technology choices made (e.g., "use PostgreSQL instead of MongoDB")
4. files - file paths or directories mentioned (e.g., "src/components/Button.tsx")
5. actions - operations performed (e.g., "npm install", "git commit")

Return ONLY valid JSON in this exact format:
{
  "entities": [
    {"type": "tool", "name": "react", "context": "used for building UI", "confidence": 0.95},
    {"type": "concept", "name": "hooks", "context": "React hooks for state management", "confidence": 0.9}
  ],
  "summary": "Brief 1-sentence summary of what this text is about",
  "topics": ["topic1", "topic2"]
}

Rules:
- confidence should be 0.0-1.0 based on how clearly the entity was mentioned
- Each entity should have unique name (case-insensitive)
- Limit to top 15 most relevant entities
- summary should be max 100 characters
- topics should be 2-5 high-level categories

TEXT TO ANALYZE:
---
{text}
---

Respond with ONLY the JSON, no explanation or markdown:`;

export class EntityExtractor {
  private ollama: Ollama;
  private model: string;
  private cache: Map<string, ExtractionResult>;

  constructor(model?: string) {
    this.ollama = new Ollama({ host: OLLAMA_HOST });
    this.model = model || EXTRACTION_MODEL;
    this.cache = new Map();
  }

  /**
   * Extract entities from text using LLM
   */
  async extract(text: string, useCache: boolean = true): Promise<ExtractionResult> {
    // Check cache first
    const cacheKey = this.hashText(text);
    if (useCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Truncate very long texts
    const maxLength = 4000;
    const truncatedText = text.length > maxLength
      ? text.substring(0, maxLength) + '... [truncated]'
      : text;

    const prompt = EXTRACTION_PROMPT.replace('{text}', truncatedText);

    try {
      const response = await this.ollama.generate({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Low temperature for consistent extraction
          num_predict: 1000,
        },
      });

      const result = this.parseResponse(response.response);

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Entity extraction error:', error);

      // Return fallback extraction
      return this.fallbackExtraction(text);
    }
  }

  /**
   * Parse LLM response to structured format
   */
  private parseResponse(response: string): ExtractionResult {
    try {
      // Clean up response - remove markdown if present
      let cleaned = response.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate and normalize entities
      const entities: Entity[] = (parsed.entities || [])
        .map((e: any) => ({
          type: this.normalizeEntityType(e.type),
          name: String(e.name || '').toLowerCase().trim(),
          context: String(e.context || '').substring(0, 200),
          confidence: Math.max(0, Math.min(1, parseFloat(e.confidence) || 0.5)),
          mentions: 1,
        }))
        .filter((e: Entity) => e.name.length > 0);

      return {
        entities: this.deduplicateEntities(entities),
        summary: String(parsed.summary || '').substring(0, 200),
        topics: (parsed.topics || []).map((t: any) => String(t).toLowerCase()),
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Failed to parse extraction response:', error);
      return {
        entities: [],
        summary: '',
        topics: [],
        extractedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Normalize entity type to valid enum
   */
  private normalizeEntityType(type: string): EntityType {
    const normalized = String(type).toLowerCase().trim();

    const mapping: Record<string, EntityType> = {
      tool: 'tool',
      tools: 'tool',
      package: 'tool',
      library: 'tool',
      framework: 'tool',
      concept: 'concept',
      concepts: 'concept',
      pattern: 'concept',
      methodology: 'concept',
      decision: 'decision',
      decisions: 'decision',
      choice: 'decision',
      file: 'file',
      files: 'file',
      path: 'file',
      directory: 'file',
      action: 'action',
      actions: 'action',
      operation: 'action',
    };

    return mapping[normalized] || 'concept';
  }

  /**
   * Deduplicate entities by name
   */
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Map<string, Entity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.name}`;

      if (seen.has(key)) {
        // Merge by taking higher confidence and incrementing mentions
        const existing = seen.get(key)!;
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        existing.mentions++;
      } else {
        seen.set(key, { ...entity });
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Simple hash for caching
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Fallback extraction using regex patterns (no LLM needed)
   */
  private fallbackExtraction(text: string): ExtractionResult {
    const entities: Entity[] = [];

    // Extract npm packages (common pattern)
    const npmPattern = /(?:npm|yarn|pnpm)\s+(?:install|add|i)\s+([\w@/-]+)/gi;
    let match;
    while ((match = npmPattern.exec(text)) !== null) {
      entities.push({
        type: 'tool',
        name: match[1].toLowerCase(),
        context: 'npm package installation',
        confidence: 0.9,
        mentions: 1,
      });
    }

    // Extract file paths
    const filePattern = /(?:^|[\s'"(])((?:\.\/|\.\.\/|\/)?(?:[\w-]+\/)*[\w.-]+\.[a-z]{1,5})(?:[\s'")]|$)/gim;
    while ((match = filePattern.exec(text)) !== null) {
      entities.push({
        type: 'file',
        name: match[1],
        context: 'file reference',
        confidence: 0.7,
        mentions: 1,
      });
    }

    // Extract git operations
    const gitPattern = /git\s+([\w-]+)(?:\s+[\w-]+)?/gi;
    while ((match = gitPattern.exec(text)) !== null) {
      entities.push({
        type: 'action',
        name: `git ${match[1]}`,
        context: 'git operation',
        confidence: 0.85,
        mentions: 1,
      });
    }

    // Extract common tools mentioned
    const toolKeywords = [
      'docker', 'kubernetes', 'react', 'vue', 'angular', 'typescript', 'javascript',
      'python', 'rust', 'golang', 'node', 'npm', 'yarn', 'pnpm', 'webpack', 'vite',
      'postgres', 'mysql', 'mongodb', 'redis', 'supabase', 'prisma', 'drizzle',
    ];

    for (const tool of toolKeywords) {
      if (text.toLowerCase().includes(tool)) {
        entities.push({
          type: 'tool',
          name: tool,
          context: 'mentioned in conversation',
          confidence: 0.6,
          mentions: 1,
        });
      }
    }

    return {
      entities: this.deduplicateEntities(entities),
      summary: 'Extracted via fallback patterns',
      topics: [],
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract entities from multiple chunks and merge
   */
  async extractBatch(chunks: string[]): Promise<ExtractionResult> {
    const allEntities: Entity[] = [];
    const allTopics = new Set<string>();
    const summaries: string[] = [];

    for (const chunk of chunks) {
      const result = await this.extract(chunk);
      allEntities.push(...result.entities);
      result.topics.forEach(t => allTopics.add(t));
      if (result.summary) {
        summaries.push(result.summary);
      }
    }

    // Merge and deduplicate
    const mergedEntities = this.deduplicateEntities(allEntities);

    return {
      entities: mergedEntities.sort((a, b) => b.confidence - a.confidence).slice(0, 20),
      summary: summaries[0] || '',
      topics: Array.from(allTopics).slice(0, 10),
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton
let defaultExtractor: EntityExtractor | null = null;

export function getDefaultExtractor(): EntityExtractor {
  if (!defaultExtractor) {
    defaultExtractor = new EntityExtractor();
  }
  return defaultExtractor;
}
