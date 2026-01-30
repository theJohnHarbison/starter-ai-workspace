#!/usr/bin/env node
/**
 * Setup Ollama Models
 *
 * Pulls required models for the workspace via Ollama's HTTP API.
 * Run after docker-compose up -d to ensure models are available.
 *
 * Usage: npm run setup:models
 */

const http = require('http');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODELS = [
  { name: 'nomic-embed-text', purpose: 'Session memory embeddings' },
  { name: 'qwen2.5-coder:7b', purpose: 'Code analysis and generation' },
];

function pullModel(modelName) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/pull', OLLAMA_HOST);

    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let lastStatus = '';

      res.on('data', (chunk) => {
        // Ollama streams JSON responses, one per line
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status && data.status !== lastStatus) {
              lastStatus = data.status;
              if (data.status === 'success') {
                console.log(`  ✓ ${modelName} ready`);
              } else if (data.total && data.completed) {
                const pct = Math.round((data.completed / data.total) * 100);
                process.stdout.write(`\r  ↓ ${modelName}: ${data.status} ${pct}%   `);
              } else {
                process.stdout.write(`\r  ↓ ${modelName}: ${data.status}   `);
              }
            }
          } catch (e) {
            // Ignore JSON parse errors for partial chunks
          }
        }
      });

      res.on('end', () => {
        console.log(''); // New line after progress
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Failed to pull ${modelName}: HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to connect to Ollama: ${err.message}`));
    });

    req.write(JSON.stringify({ name: modelName }));
    req.end();
  });
}

async function checkOllama() {
  return new Promise((resolve) => {
    const url = new URL('/api/tags', OLLAMA_HOST);

    http.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function main() {
  console.log('');
  console.log('Setting up Ollama models...');
  console.log('');

  // Check if Ollama is running
  const ollamaAvailable = await checkOllama();
  if (!ollamaAvailable) {
    console.error('✗ Ollama is not running');
    console.error('');
    console.error('Start it with: docker-compose up -d');
    console.error('Then run this script again: npm run setup:models');
    process.exit(1);
  }

  console.log('✓ Ollama is running');
  console.log('');

  // Pull each model
  for (const model of MODELS) {
    console.log(`Pulling ${model.name} (${model.purpose})...`);
    try {
      await pullModel(model.name);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  }

  console.log('');
  console.log('✓ All models ready');
  console.log('');
}

main();
