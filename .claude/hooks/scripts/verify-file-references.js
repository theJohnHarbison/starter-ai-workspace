#!/usr/bin/env node
/**
 * Post-tool hook: Verify file references in generated code.
 *
 * When Claude writes or edits files, this hook checks for import/require
 * statements and file path references that point to non-existent files.
 * Warns about potential hallucinated paths.
 *
 * Based on arXiv 2601.22984 (PIES taxonomy): Fabrication is the #1 root
 * cause of agent failures, and hallucinated file paths are the coding
 * equivalent of the paper's "Claim Hallucination" category.
 */

const fs = require('fs');
const path = require('path');

function main() {
  try {
    const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
    const result = JSON.parse(process.env.CLAUDE_TOOL_RESULT || '{}');

    // Only check Write and Edit tool results
    const toolName = process.env.CLAUDE_TOOL_NAME || '';
    if (!['Write', 'Edit'].includes(toolName)) return;

    const filePath = input.file_path || input.filePath;
    if (!filePath) return;

    // Only check code files
    const ext = path.extname(filePath).toLowerCase();
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    if (!codeExts.includes(ext)) return;

    // Read the file that was just written/edited
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return; // File might not exist yet in some edge cases
    }

    const fileDir = path.dirname(filePath);
    const warnings = [];

    // Check relative imports/requires
    const importPattern = /(?:import|require)\s*\(?['"](\.[^'"]+)['"]\)?/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];

      // Resolve the import path
      const resolved = path.resolve(fileDir, importPath);

      // Check with common extensions
      const candidates = [
        resolved,
        resolved + '.ts',
        resolved + '.tsx',
        resolved + '.js',
        resolved + '.jsx',
        resolved + '/index.ts',
        resolved + '/index.js',
      ];

      const exists = candidates.some(c => fs.existsSync(c));
      if (!exists) {
        warnings.push(`Import target not found: "${importPath}" (resolved to ${resolved})`);
      }
    }

    if (warnings.length > 0) {
      const output = {
        decision: 'warn',
        reason: `[verify-file-references] Potential hallucinated paths detected:\n${warnings.map(w => `  - ${w}`).join('\n')}\n\nVerify these imports exist before proceeding.`,
      };
      console.log(JSON.stringify(output));
    }
  } catch {
    // Silent failure - don't block workflow on hook errors
  }
}

main();
