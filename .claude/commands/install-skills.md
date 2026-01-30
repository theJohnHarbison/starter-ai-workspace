---
name: install-skills
description: Install community skills for this workspace
---

# Install Community Skills

This workspace uses a minimal set of community skills to fill specific gaps.

## Run Installation

**Windows (PowerShell):**
```powershell
.\scripts\install-skills.ps1
```

**macOS/Linux (Bash):**
```bash
./scripts/install-skills.sh
```

## Skills Installed

| Skill | Purpose |
|-------|---------|
| **systematic-debugging** | 4-phase root cause analysis methodology |
| **test-driven-development** | Red-green-refactor enforcement |
| **mcp-builder** | Build new MCP server integrations |

## Optional Skills

Install these only when needed:

```bash
# Playwright E2E testing
npx skills add anthropics/webapp-testing

# Build new custom skills
npx skills add anthropics/skill-creator

# Security auditing
npx claude-plugins install security-guidance
```

## Verification

After installation, start a new Claude Code session to verify skills are loaded.
