---
name: review-improvements
description: Review auto-applied rules, pending proposals, and skill candidates
---

# Self-Improvement: Review

Show the current state of the self-improvement system.

## Steps

1. **Review rules and proposals**: Run `npx ts-node scripts/self-improvement/proposal-manager.ts review`
2. **Show statistics**: Run `npx ts-node scripts/self-improvement/reinforcement-tracker.ts stats`
3. **Show recent git history**: Run `git log --oneline -10 --grep="self-improve"` to see recent auto-applied changes
4. **Summarize**: Present findings to the user with actionable options (apply pending, prune stale, revert specific changes)

$ARGUMENTS
