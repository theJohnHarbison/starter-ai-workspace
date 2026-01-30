---
name: pr-review
description: Comprehensive pull request review with structured feedback
---

# Pull Request Review

Perform a thorough code review with structured feedback.

## Review Process

### 1. Understand Context

- Read the PR description and linked issues
- Understand the intent and scope of changes
- Check if the approach aligns with project architecture

### 2. Review Checklist

#### Code Quality
- [ ] Code follows project conventions and style guides
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] No hardcoded values that should be configurable
- [ ] No commented-out code or debug statements

#### Architecture
- [ ] Changes fit within existing architecture
- [ ] No unnecessary coupling introduced
- [ ] Appropriate separation of concerns
- [ ] No over-engineering for the scope

#### Testing
- [ ] Tests cover the changes appropriately
- [ ] Tests are meaningful (not just for coverage)
- [ ] Edge cases are considered
- [ ] No flaky test patterns

#### Security
- [ ] No secrets or credentials exposed
- [ ] Input validation where needed
- [ ] No SQL injection, XSS, or other vulnerabilities
- [ ] Authentication/authorization properly handled

#### Performance
- [ ] No obvious performance issues
- [ ] Database queries are efficient
- [ ] No unnecessary re-renders (for frontend)

### 3. Feedback Format

For each issue found:

```
**[SEVERITY]** File:Line - Brief description

Explanation of the issue and why it matters.

Suggested fix (if applicable):
\`\`\`
code suggestion
\`\`\`
```

Severity levels:
- **BLOCKER**: Must fix before merge
- **MAJOR**: Should fix, significant issue
- **MINOR**: Nice to fix, not critical
- **NIT**: Style/preference, optional

---

Review: $ARGUMENTS
