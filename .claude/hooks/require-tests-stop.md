---
name: require-tests-run
enabled: false  # Disabled by default - enable per-project for strict test enforcement
event: stop
action: block
conditions:
  transcript:
    not_contains: npm test|pytest|cargo test|dotnet test
---

**Tests not detected in transcript!**

Before stopping, please run tests to verify your changes work correctly.

**Supported test commands**:
- `npm test` - Node.js/JavaScript
- `pytest` - Python
- `cargo test` - Rust
- `dotnet test` - .NET

**Why this hook is disabled by default**:
- Allows exploratory work without test requirements
- Prevents workflow disruption during research/debugging
- Lets you choose when to enforce testing discipline

**When to enable**:
1. **Production branches** - Ensure quality for main/master
2. **Critical projects** - Enforce testing for high-stakes code
3. **Team standards** - Maintain testing discipline across contributors
4. **CI/CD workflows** - Require tests before deployment

**How to enable**:
```markdown
# Edit this file and change:
enabled: true
```

**Per-project configuration**:
Create project-specific hook in `.claude/hooks/require-tests-stop-<project>.md`

Note: This hook blocks stopping if no test commands appear in the transcript.
Enable this rule only when you want strict test enforcement.
