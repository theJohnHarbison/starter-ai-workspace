# Workspace Skills

This directory contains Claude Code skills for the ai-workspace.

## Skill Types

| Type | Location | Tracked in Git | Updates |
|------|----------|----------------|---------|
| **Custom** | `.claude/skills/<name>/` | Yes | Manual |
| **Installed** | `.claude/skills/.installed/` | No | Via install script |

## Custom Skills (Portable)

These skills are workspace-specific and fully portable:

| Skill | Purpose |
|-------|---------|
| `architecture-reference` | Project architecture guide for game development |
| `godot-standards` | GDScript patterns for Godot 4.x |
| `unity-standards` | C# patterns for Unity |
| `project-setup` | Session initialization protocol |
| `compliance-and-consent` | Privacy and consent patterns |
| `react-typescript-standards` | React + TypeScript patterns |
| `swe-csharp` | C#/.NET development expertise |
| `swe-frontend` | Frontend development expertise (React/Next.js) |
| `ops-generalist` | DevOps/infrastructure expertise |
| `agent-creator` | Meta-skill for creating agents and skills |

## Installed Skills (Community)

Run `./scripts/install-skills.sh` (or `.ps1` on Windows) to install community skills:

| Skill | Purpose |
|-------|---------|
| `systematic-debugging` | 4-phase root cause analysis methodology |
| `test-driven-development` | Red-green-refactor enforcement |
| `mcp-builder` | Build new MCP server integrations |

**Optional skills (install when needed):**
```bash
npx skills add anthropics/webapp-testing    # Playwright E2E testing
npx skills add anthropics/skill-creator     # Build new skills
npx claude-plugins install security-guidance # Security audits
```

## Skill Structure

Each skill directory contains:
```
skill-name/
├── SKILL.md           # Main instructions (required, <500 lines recommended)
├── patterns.md        # Detailed patterns reference (loaded on demand)
├── examples.md        # Usage examples (loaded on demand)
└── scripts/           # Utility scripts (executed, not loaded into context)
```

## Creating New Skills

1. Create directory: `.claude/skills/my-skill/`
2. Create `SKILL.md` with YAML frontmatter:

```yaml
---
name: my-skill
description: What it does and when to use it. Be specific about triggers.
---

# My Skill

[Instructions here - keep under 500 lines]
```

3. Claude auto-detects on next session

## Best Practices

- **Keep SKILL.md under 500 lines** - Use progressive disclosure for larger content
- **Write clear descriptions** - Include both "what it does" AND "when to use it"
- **Use progressive disclosure** - Put detailed reference in separate files
- **Test with `/skill-creator`** - Use the skill-creator command to validate

## Archived Roles

Legacy role guides (more verbose, human-focused documentation) are archived in:
`docs/reference/legacy-roles/`

These are not auto-loaded but available for reference when needed.
