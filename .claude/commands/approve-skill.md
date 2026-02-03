---
name: approve-skill
description: Promote a skill candidate to .claude/skills/
---

# Self-Improvement: Approve Skill

Promote a proposed skill candidate to the active skills directory.

## Steps

1. **List candidates**: If no skill name given, list available candidates from `scripts/self-improvement/skill-candidates/`
2. **Show details**: Read the candidate JSON and display the proposed SKILL.md content
3. **Approve**: Run `npx ts-node scripts/self-improvement/skill-generator.ts approve <name>` to promote
4. **Verify**: Confirm the skill was created in `.claude/skills/<name>/SKILL.md` and committed to git

$ARGUMENTS
