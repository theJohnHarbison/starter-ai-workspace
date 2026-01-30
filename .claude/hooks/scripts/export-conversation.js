#!/usr/bin/env node
/**
 * Export conversation transcript from SessionEnd hook
 *
 * Hook input provides transcript_path pointing to JSONL conversation file.
 * This script reads that file and saves a structured version for knowledge extraction.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function exportConversation() {
  try {
    // Read hook input from stdin (JSON format)
    const stdinBuffer = [];

    // Wait for stdin data
    for await (const chunk of process.stdin) {
      stdinBuffer.push(chunk);
    }

    if (stdinBuffer.length === 0) {
      // No input provided - exit silently
      return;
    }

    const stdinData = Buffer.concat(stdinBuffer).toString();
    const hookInput = JSON.parse(stdinData);

    const transcriptPath = hookInput.transcript_path;
    const sessionId = hookInput.session_id || 'unknown';
    const reason = hookInput.reason || 'exit';

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      // No transcript file - exit silently
      return;
    }

    // Read and parse JSONL transcript
    const conversation = [];
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          conversation.push(entry);
        } catch (e) {
          // Skip invalid lines
        }
      }
    }

    // Analyze conversation
    const userMessages = conversation.filter(e => e.role === 'user');
    const assistantMessages = conversation.filter(e => e.role === 'assistant');
    const toolCalls = conversation.filter(e => e.type === 'tool_use');

    // Structure for knowledge extraction
    const conversationExport = {
      sessionId: sessionId,
      exportReason: reason, // 'exit', 'clear', 'logout', etc.
      exportedAt: new Date().toISOString(),
      workingDirectory: hookInput.cwd || process.cwd(),
      metadata: {
        totalMessages: conversation.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        toolCalls: toolCalls.length
      },
      messages: conversation
    };

    // Save to sessions directory
    const logsDir = path.join(process.cwd(), '.claude/logs/sessions');
    fs.mkdirSync(logsDir, { recursive: true });

    // Use different naming for /clear vs normal exit
    const suffix = reason === 'clear' ? `-clear-${Date.now()}` : '';
    const conversationFile = path.join(logsDir, `conversation-${sessionId}${suffix}.json`);
    fs.writeFileSync(conversationFile, JSON.stringify(conversationExport, null, 2));

    // Also create a lightweight summary
    const summaryFile = path.join(logsDir, `summary-${sessionId}${suffix}.json`);
    const summary = {
      sessionId: sessionId,
      exportReason: reason,
      exportedAt: conversationExport.exportedAt,
      metadata: conversationExport.metadata,
      userPrompts: userMessages.slice(0, 5).map(m => ({
        content: (m.content && typeof m.content === 'string')
          ? m.content.substring(0, 200)
          : '[complex content]',
        timestamp: m.timestamp
      })),
      toolCallSummary: toolCalls.slice(0, 10).map(t => ({
        toolName: t.name,
        id: t.id
      }))
    };
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  } catch (error) {
    // Silent failure - hooks should not output to stdout/stderr
    // Optionally log to a debug file for troubleshooting
    const debugLog = path.join(process.cwd(), '.claude/logs/export-conversation-debug.log');
    try {
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] ERROR: ${error.message}\n${error.stack}\n\n`);
    } catch (e) {
      // Can't even log the error - give up
    }
  }
}

// Run the export
exportConversation().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(0);
});
