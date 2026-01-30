---
name: commit
description: Create a conventional commit with proper formatting and co-author attribution
---

# Conventional Commit Workflow

Create a git commit following conventional commits format. Follow these steps:

## 1. Analyze Changes

Run `git status` and `git diff --staged` to understand what's being committed.

## 2. Categorize the Change

Select the appropriate type:
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build, etc.)
- **style**: Formatting, missing semicolons, etc. (no code change)

## 3. Write Commit Message

Format:
```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

Rules:
- Subject line: max 72 characters, imperative mood ("Add feature" not "Added feature")
- Scope: optional, indicates what part of codebase (e.g., `api`, `ui`, `auth`)
- Body: explain WHY, not WHAT (the diff shows what)
- Always include co-author attribution

## 4. Stage and Commit

If changes aren't staged, suggest what should be staged based on the user's intent.

$ARGUMENTS
