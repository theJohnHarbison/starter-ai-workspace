---
name: synthesize-runbook
description: Synthesize multiple documentation sources into a condensed operational runbook
---

# Synthesize Runbook

Create a condensed operational runbook from multiple documentation sources.

Based on Anthropic Security Engineering team pattern: feed multiple doc sources, produce focused operational guides.

## Input

The user will provide either:
- A topic/title and list of source files to synthesize
- A topic/title and the runbook will search for relevant sources

## Process

### 1. Gather Sources
- Read all specified source files
- If no files specified, search the codebase and session memory for relevant content
- Identify the key procedures, commands, and decision points

### 2. Extract Operational Content
From each source, extract:
- **Commands**: Exact CLI commands, API calls, scripts to run
- **Decision points**: If-then conditions, troubleshooting branches
- **Prerequisites**: What must be true before starting
- **Validation steps**: How to verify each step succeeded
- **Common errors**: Known failure modes and their fixes

### 3. Produce the Runbook

Write a markdown runbook with this structure:

```markdown
# Runbook: [Topic]

## Quick Reference
[Most common commands/actions - the "cheat sheet"]

## Prerequisites
[What must be set up/running/configured before starting]

## Procedure
### Step 1: [Action]
[Exact commands with copy-paste-ready code blocks]
**Verify**: [How to confirm this step worked]

### Step 2: [Action]
...

## Troubleshooting
### Problem: [Symptom]
**Cause**: [Why this happens]
**Fix**: [Exact steps to resolve]

## References
[Links back to source documents]
```

### 4. Quality Checks
- Every command should be copy-paste ready
- Every step should have a verification check
- Troubleshooting should cover the most common failure modes
- The runbook should be self-contained (reader shouldn't need to reference sources)

---

Synthesize a runbook for: $ARGUMENTS
