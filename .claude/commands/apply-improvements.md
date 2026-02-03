---
name: apply-improvements
description: Apply pending self-improvement proposals (rules and skills)
---

# Self-Improvement: Apply Pending

Apply all pending proposals that have been staged for review.

## Steps

1. **Preview**: Run `npx ts-node scripts/self-improvement/proposal-manager.ts apply --dry-run` to show what would be applied
2. **Confirm with user**: Show the preview and ask if they want to proceed
3. **Apply**: Run `npx ts-node scripts/self-improvement/proposal-manager.ts apply` to apply and git-commit changes
4. **Verify**: Run `git log --oneline -5` to confirm the commit was created

$ARGUMENTS
