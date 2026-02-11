#!/usr/bin/env node
/**
 * Skill Suggestion Hook
 * Suggests relevant skills based on the user's prompt
 *
 * Triggered on: UserPromptSubmit
 */

const SKILL_TRIGGERS = {
  // Debugging methodology
  'systematic-debugging': [
    'error', 'bug', 'broken', 'not working', 'fails', 'crash', 'exception',
    'debug', 'troubleshoot', 'investigate', 'root cause'
  ],

  // Test-driven development
  'test-driven-development': [
    'test', 'tdd', 'spec', 'coverage', 'unit test', 'integration test',
    'testing', 'write tests', 'add tests'
  ],

  // Security
  'security-guidance': [
    'auth', 'password', 'token', 'secret', 'injection', 'xss', 'csrf',
    'security', 'vulnerability', 'sanitize', 'validate'
  ],

  // C# development
  'swe-csharp': [
    '.cs', 'csharp', 'c#', 'dotnet', '.net', 'unity', 'entity framework',
    'asp.net', 'nuget'
  ],

  // Frontend development
  'swe-frontend': [
    'react', 'next.js', 'nextjs', 'component', 'frontend', 'typescript',
    'jsx', 'tsx', 'tailwind', 'css'
  ],

  // Godot/GDScript
  'godot-standards': [
    'godot', 'gdscript', '.gd', 'scene', 'node2d', 'node3d'
  ],

  // Unity
  'unity-standards': [
    'unity', 'monobehaviour', 'scriptableobject', 'prefab', 'gameobject'
  ],

  // MCP development
  'mcp-builder': [
    'mcp server', 'mcp tool', 'model context protocol', 'create mcp'
  ],

  // Compliance
  'compliance-and-consent': [
    'gdpr', 'ccpa', 'compliance', 'consent', 'privacy', 'cookie', 'analytics'
  ]
};

// Get user prompt from environment or stdin
const prompt = (process.env.USER_PROMPT || '').toLowerCase();

if (!prompt) {
  process.exit(0);
}

const suggestions = [];

for (const [skill, triggers] of Object.entries(SKILL_TRIGGERS)) {
  if (triggers.some(trigger => prompt.includes(trigger))) {
    suggestions.push(skill);
  }
}

if (suggestions.length > 0 && suggestions.length <= 3) {
  // Only show suggestions if there are 1-3 matches (avoid noise)
  console.log(`\u{1F4A1} Suggested skills: ${suggestions.join(', ')}`);

  // Log value event
  try {
    const { logValueEvent } = require('./value-logger');
    logValueEvent('skill_suggestion', suggestions.length, {
      skills: suggestions,
    });
  } catch {}
}

process.exit(0);
