#!/usr/bin/env node
/**
 * Export conversation before auto-compact runs
 *
 * PreCompact hook fires before context compaction (auto or manual).
 * This captures the full conversation before it gets summarized.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function exportBeforeCompact() {
  try {
    // Read hook input from stdin (JSON format)
    const stdinBuffer = [];

    for await (const chunk of process.stdin) {
      stdinBuffer.push(chunk);
    }

    if (stdinBuffer.length === 0) {
      return;
    }

    const stdinData = Buffer.concat(stdinBuffer).toString();
    const hookInput = JSON.parse(stdinData);

    const transcriptPath = hookInput.transcript_path;
    const sessionId = hookInput.session_id || 'unknown';
    const trigger = hookInput.trigger || 'auto'; // 'auto' or 'manual'

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
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
      exportReason: `pre-compact-${trigger}`,
      exportedAt: new Date().toISOString(),
      workingDirectory: hookInput.cwd || process.cwd(),
      compactTrigger: trigger,
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

    // Use timestamp to allow multiple compacts per session
    const timestamp = Date.now();
    const conversationFile = path.join(logsDir, `conversation-${sessionId}-compact-${timestamp}.json`);
    fs.writeFileSync(conversationFile, JSON.stringify(conversationExport, null, 2));

    // Log the export
    const activityLog = path.join(logsDir, 'activity.log');
    fs.appendFileSync(activityLog,
      `[${new Date().toISOString()}] PRE_COMPACT session:${sessionId} trigger:${trigger} messages:${conversation.length}\n`
    );

  } catch (error) {
    // Silent failure - log to debug file
    const debugLog = path.join(process.cwd(), '.claude/logs/export-compact-debug.log');
    try {
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] ERROR: ${error.message}\n${error.stack}\n\n`);
    } catch (e) {
      // Can't even log the error - give up
    }
  }
}

exportBeforeCompact().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(0);
});
