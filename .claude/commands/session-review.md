---
name: session-review
description: End-of-session review that summarizes work and suggests CLAUDE.md improvements
---

# Session Review

Review the current session and produce actionable improvements. Follow these steps:

## 1. Session Summary

Summarize what was accomplished this session:
- What tasks were completed?
- What files were modified?
- What problems were solved?
- What was left unfinished?

## 2. Pattern Analysis

Identify patterns from this session:

### What worked well
- Approaches that succeeded on the first attempt
- Tool usage patterns that were efficient
- Prompting strategies that produced good results

### What didn't work
- Approaches that required multiple attempts or backtracking
- Tool-calling mistakes that were repeated
- Misunderstandings or wrong assumptions

## 3. CLAUDE.md Improvement Suggestions

Based on the session, suggest specific additions or changes to CLAUDE.md:

| Section | Suggestion | Rationale |
|---------|-----------|-----------|
| (which section) | (exact text to add/change) | (why this helps future sessions) |

Focus on:
- **Tool-calling corrections**: Did Claude repeatedly make the same tool mistake? Add a rule.
- **Workflow patterns**: Did a workflow emerge that should be documented?
- **Anti-patterns**: Did something fail that should be warned against?
- **Missing context**: Was there knowledge the session needed but didn't have?

## 4. Task Inventory

Check for any work that should be tracked:
- Are there unfinished items that need task files in `agent/_tasks/`?
- Were any decisions made that should be recorded?
- Are there follow-up actions needed?

## 5. Commit Check

Verify session cleanliness:
- Run `git status` to check for uncommitted changes
- Flag any unstaged work that should be committed before session ends

---

Review this session now. $ARGUMENTS
