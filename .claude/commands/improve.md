---
name: improve
description: Force a manual insight extraction run from session history
---

# Self-Improvement: Extract Insights

Run the ExpeL-style insight extraction pipeline to find patterns in past sessions.

## Steps

1. **Check prerequisites**: Verify Qdrant is running (`docker-compose ps`)
2. **Run extraction**: Execute `npx ts-node scripts/self-improvement/insight-extractor.ts`
3. **Show results**: Display any new rules that were extracted and applied
4. **Review**: Run `npx ts-node scripts/self-improvement/proposal-manager.ts review` to show the current state

If you want to preview without applying changes, add `--dry-run`:
`npx ts-node scripts/self-improvement/insight-extractor.ts --dry-run`

$ARGUMENTS
