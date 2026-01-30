---
name: debug
description: Systematic debugging using 4-phase root cause analysis
---

# Systematic Debugging Mode

Before proposing ANY fix, follow this rigorous methodology:

## Phase 1: REPRODUCE

- Confirm the issue exists and is reproducible
- Document exact steps to reproduce
- Identify the expected vs actual behavior
- Note any error messages or logs

## Phase 2: ISOLATE

- Narrow down to the smallest reproducing case
- Identify which component/function is failing
- Rule out environmental factors
- Create a minimal test case if possible

## Phase 3: HYPOTHESIZE

List at least 3 potential root causes with likelihood:

| Hypothesis | Likelihood | Evidence Needed |
|------------|------------|-----------------|
| ... | High/Med/Low | What would confirm this |

## Phase 4: TEST & VERIFY

For each hypothesis (starting with most likely):
1. Design a test to validate/invalidate
2. Execute the test
3. Document findings
4. If confirmed, proceed to fix
5. If not, move to next hypothesis

## Only THEN: Fix

Once root cause is confirmed:
1. Implement the fix
2. Verify the fix resolves the issue
3. Check for regressions
4. Add test to prevent recurrence

---

Apply this methodology to: $ARGUMENTS
