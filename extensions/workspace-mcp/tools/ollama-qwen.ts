/**
 * Ollama Qwen Tool
 *
 * Provides access to the Qwen2.5-Coder model running in Ollama for code generation,
 * explanations, and other coding tasks.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const ollamaQwenTool: Tool = {
  name: 'ollama-qwen',
  description: `Query the Qwen2.5-Coder model running in Ollama for code generation, explanations, and analysis.

The Qwen2.5-Coder model is optimized for:
- Code generation and completion
- Technical explanations
- Code reviews and refactoring suggestions
- Debugging assistance
- Architecture discussions

Responses are generated locally (no external API calls).`,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The prompt or question to send to Qwen',
      },
      temperature: {
        type: 'number',
        description: 'Temperature for sampling (0.0-2.0, default: 0.7). Lower = more deterministic, higher = more creative',
        default: 0.7,
        minimum: 0,
        maximum: 2,
      },
      context_length: {
        type: 'number',
        description: 'Number of tokens to generate (default: 2048, max: 8192)',
        default: 2048,
        minimum: 100,
        maximum: 8192,
      },
    },
    required: ['prompt'],
  },
};

export async function executeOllamaQwen(args: Record<string, unknown>): Promise<string> {
  const prompt = String(args.prompt || '');
  const temperature = Number(args.temperature) || 0.7;
  const contextLength = Number(args.context_length) || 2048;

  if (!prompt) {
    return 'Error: prompt is required';
  }

  try {
    // Call Ollama API
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder:7b',
        prompt: prompt,
        stream: false,
        temperature: Math.max(0, Math.min(2, temperature)),
        num_predict: contextLength,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { response?: string };
    const result = data.response?.trim();

    if (!result) {
      return 'Error: No response from Qwen model';
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `Qwen query failed: ${errorMsg}

Troubleshooting:
- Ensure Ollama is running: docker-compose ps
- Check model is loaded: curl http://localhost:11434/api/tags
- Verify Ollama is accessible on http://localhost:11434`;
  }
}
