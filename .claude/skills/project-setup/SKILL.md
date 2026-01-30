---
name: project-setup
description: Session protocol, problem-solving approach (OODA loop), working principles, and communication standards. Use at session start and when planning development tasks.
---

# Project Setup & Workflow

## Session Start Protocol

**At the beginning of EVERY session:**

### 1. Check for UPDATE.md
- If exists: Read it for inter-session thoughts/decisions
- Process all items in UPDATE.md
- Delete UPDATE.md when done (never commit this file)

### 2. Review Recent Commits
- Run `git pull` to get latest changes
- Run `git log --oneline -10` to see recent work
- Check for other contributors' changes

### 3. Project Management
- We use **GitHub Issues only** (no project board)
- Reference issues in commits: `git commit -m "Fix bug #25"`
- Use issue labels and milestones for organization

---

## Problem-Solving Approach (OODA Loop)

Use systematic problem-solving for all development tasks:

1. **OBSERVE** - Understand the requirement and existing code
   - Use Glob/Grep to explore the codebase efficiently
   - Read only relevant files and sections
   - Identify patterns and structure

2. **ORIENT** - Relate to best practices and patterns
   - Connect observations to Unity/C# standards
   - Consider maintainability and scalability
   - Evaluate trade-offs

3. **DECIDE** - Choose the most efficient approach
   - Select the minimal viable change
   - Plan small, testable steps
   - Consider token budget impact

4. **ACT** - Execute with small, focused steps
   - Make incremental changes
   - Test and verify
   - Re-evaluate after each action

---

## Working Principles

### Code Changes
- **Prefer small, incremental changes** over large rewrites
- **Edit existing files** rather than creating new ones unless necessary
- **Maintain consistency** with existing code style and patterns
- **Re-evaluate after each action** to ensure you're on track

### Tool Usage
- **Use specialized tools** instead of bash when possible:
  - `Read` for reading files (not cat/head/tail)
  - `Edit` for editing files (not sed/awk)
  - `Write` for creating files (not echo/heredoc)
  - `Glob` for finding files by pattern (not find/ls)
  - `Grep` for searching file contents (not grep/rg commands)
- **Reserve bash** exclusively for actual system commands (git, npm, Unity builds)
- **Never use bash echo** or command-line tools to communicate with the user

### Budget Management
- **Use Glob/Grep** for searching before reading files
- **Read only necessary sections** when possible (use offset/limit parameters)
- **Avoid reading large generated files** (Library/, Temp/, obj/, Logs/)
- **Use TodoWrite** for planning to avoid redundant work and track progress
- **Batch related operations** when possible
- **Prefer targeted searches** over broad file reads

### Task Management
- **Use TodoWrite tool frequently** to plan and track work
- Break complex tasks into smaller, manageable steps
- Mark todos as in_progress when starting a task
- Mark todos as completed immediately after finishing (don't batch completions)
- Only mark tasks complete when fully accomplished (no partial completions)
- Keep exactly ONE task in_progress at any time

---

## Communication Style

- Be concise and direct (CLI-friendly output)
- Use GitHub-flavored markdown for formatting
- No emojis unless explicitly requested
- Reference code with `file_path:line_number` pattern
- Prioritize technical accuracy over validation
- Output communication directly (never use bash echo)

### File References
When referencing code, use the pattern `file_path:line_number`:

Example:
```
The singleton pattern is implemented in Assets/Scripts/Core/GameManager.cs:15
```

This allows easy navigation to source locations.

---

## Memory & Context Notes

### User Preferences
- Solo dev, limited token budget → Keep prompts focused
- No graphics skills → Use primitives, label clearly with text
- No Unity experience but knows C# → Explain Unity-specific patterns
- Wants proof of life ASAP → MVP first, polish later
- Idle game fan → Prioritize offline progression mechanic early

### Design Philosophy
- **Start simple, expand complexity**: Workers are just efficiency numbers now, add depth later
- **Level-based progression over sandbox**: Structure teaches mechanics better for mobile
- **Respect original game's depth**: Keep systems like research, safety zones, conveyor belts as future roadmap items

### GitHub Workflow
**Reference issues in commits**: `git commit -m "Fix bug #25"`
**Close issues with PRs**: `Fixes #25` or `Closes #25`
**Link issues in code**: Reference at top of files with comments
