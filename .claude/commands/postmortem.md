---
name: postmortem
description: Backward attribution analysis for multi-step task failures
---

# Postmortem: Root Cause Attribution

When a multi-step task or sub-agent pipeline fails, trace backward from the failure point to identify the true root cause. Do NOT just fix the symptom — find the originating mistake.

Based on MAPPA (arXiv 2601.23228) backward attribution and PIES taxonomy (arXiv 2601.22984) failure classification.

## Phase 1: Identify the Failure Point

- What error or unexpected result occurred?
- At which step in the process did it manifest?
- What was the expected vs actual outcome?

## Phase 2: Classify the Failure (PIES Taxonomy)

Determine which category the failure falls into:

| Category | Type | Description | Example |
|----------|------|-------------|---------|
| **Action Hallucination** | Explicit Planning | Wrong action taken, wrong tool used | Edited wrong file, used non-existent API |
| **Restriction Neglect** | Implicit Planning | Ignored a constraint | Ignored "don't modify X", missed version requirement |
| **Claim Hallucination** | Explicit Summarization | Fabricated information | Invented a function signature, wrong package name |
| **Noise Domination** | Implicit Summarization | Missed relevant info | Read a file but overlooked the key section |

## Phase 3: Backward Attribution

Trace backward through the action chain. For each upstream step, evaluate:

| Step | Action Taken | Could This Have Caused the Failure? | Responsibility (0-10) |
|------|-------------|--------------------------------------|----------------------|
| N (failure) | ... | This is where the error manifested | — |
| N-1 | ... | Did this produce bad input for step N? | ? |
| N-2 | ... | Did this set up wrong assumptions? | ? |
| ... | ... | ... | ... |

**Key principle**: The step where the error *manifests* is often NOT the step that *caused* it. A missing file error in step 5 may be caused by step 2 failing to generate that file.

## Phase 4: Root Cause Statement

Provide:
1. **Root cause**: Which step and what specific mistake
2. **Propagation path**: How the error cascaded to the failure point
3. **Contributing factors**: What made the error hard to catch earlier
4. **Fix**: Address the root cause, not just the symptom
5. **Prevention**: What check or verification would have caught this earlier

## Phase 5: Process Improvement

Suggest one of:
- A new hook or validation step to catch this class of error
- A CLAUDE.md rule to prevent recurrence
- A verification gate for the specific pipeline step that failed

---

Analyze this failure: $ARGUMENTS
