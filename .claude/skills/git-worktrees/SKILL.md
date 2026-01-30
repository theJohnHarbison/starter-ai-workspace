# Git Worktrees Guide for Parallel Development

**Last Updated**: 2025-11-20
**Purpose**: Enable multiple features to be developed in parallel without branch conflicts

---

## What are Git Worktrees?

Git worktrees allow you to work on multiple branches simultaneously with separate working directories. Instead of switching branches back and forth (which loses your changes temporarily), each worktree is a complete, isolated workspace.

**Before Worktrees**:
```
git checkout feature/auth          # Lose uncommitted changes
# Work on auth
git add . && git commit
git checkout develop
# Work on develop
git checkout feature/qr-codes      # Back to QR
```

**With Worktrees**:
```
# Terminal 1: work on auth
terminal-1 % cd ../my-project-auth
terminal-1 % npm start

# Terminal 2: work on QR codes
terminal-2 % cd ../my-project-qr
terminal-2 % npm run lint

# Terminal 3: work on game screen
terminal-3 % cd ../my-project-game
terminal-3 % npm run type-check
```

---

## Why Worktrees for This Project?

**Phase 1 has parallel tasks**:
- 1.1 Firebase Auth (blocker, must be first)
- 1.2 Pod Service (blocker, depends on 1.1)
- 1.3 QR Generation (can start after 1.2)
- 1.4 QR Scanning (can start after 1.2)
- 1.5 Game Screen (can start after 1.1, 1.2, 1.4)
- 1.6 Real-time Sync (can start after 1.5)
- 1.7 Transaction Log (can start after 1.2, 1.6)

**Benefits**:
- ✅ No context switching (branch toggling)
- ✅ No lost work from uncommitted changes
- ✅ Run tests on multiple branches simultaneously
- ✅ Merge to develop without losing work
- ✅ Multiple terminals working at once

---

## Setup: Create Your Worktrees

### Prerequisites

```bash
cd /path/to/my-project
git fetch --all                    # Ensure all branches are current
npm install                        # Install base dependencies
```

### Create Worktree for Each Feature

Naming convention: `../my-project-[feature-name]`

**Create worktree directories**:

```bash
# 1. Start with develop (base branch)
git worktree add ../my-project-develop develop

# 2. Feature branches (after 1.1 complete)
git worktree add ../my-project-auth feature/firebase-auth
git worktree add ../my-project-pods feature/pod-service
git worktree add ../my-project-qr feature/qr-codes
git worktree add ../my-project-game feature/game-screen
git worktree add ../my-project-sync feature/realtime-sync
```

**Verify setup**:

```bash
git worktree list
# Output:
# /Users/you/my-project                   25a97f9 [develop]
# /Users/you/my-project-develop           25a97f9 [develop]
# /Users/you/my-project-auth              abc1234 [feature/firebase-auth]
# /Users/you/my-project-pods              def5678 [feature/pod-service]
# ... etc
```

---

## Workflow: Developing in Parallel

### Daily Setup

Open separate terminals for each task you're working on:

```bash
# Terminal 1: Main repo (develop)
cd ~/Repos/my-project
git status

# Terminal 2: Auth feature
cd ~/Repos/my-project-auth
npm start

# Terminal 3: Game screen feature
cd ~/Repos/my-project-game
npm run type-check

# Terminal 4: Utilities/testing
cd ~/Repos/my-project-develop
npm run lint
```

### Working on a Feature

Example: Working on Firebase Auth (1.1)

```bash
# Terminal 2: Auth feature
cd ~/Repos/my-project-auth
git status                         # Check current state

# Make your changes
# Edit src/services/firebase/config.ts
# Edit src/services/firebase/auth.ts
# Add tests

# Commit frequently
git add src/services/firebase/auth.ts
git commit -m "feat: Add anonymous auth sign-in

- Task: 1.1_Firebase_Authentication
- Implements signInAnonymously() function
- Stores device ID in user document"

git add src/hooks/useAuth.ts
git commit -m "feat: Create useAuth hook

- Task: 1.1_Firebase_Authentication
- Loads device ID and initializes auth
- Returns user, deviceId, loading, error"

# When feature is complete
git push origin feature/firebase-auth
```

### Handling Shared Code Changes

When Task 1.2 (Pod Service) needs Auth from Task 1.1:

**Scenario**: Auth branch is complete and merged to develop. Pod branch needs to use auth.

```bash
# Terminal 3: Pod feature
cd ~/Repos/my-project-pods

# Update from develop (which now has merged auth)
git rebase origin/develop
# or
git pull --rebase origin develop

# Resolve conflicts if any
git status
# Fix conflicts in editor
git add .
git rebase --continue

# Continue development with latest auth code
git push -f origin feature/pod-service
```

---

## Best Practices

### 1. Keep Worktrees Fresh

```bash
# Weekly: Update all worktrees from origin
cd ~/Repos/my-project
git fetch --all

for dir in ../my-project-*; do
  cd "$dir"
  git pull
  echo "Updated $(basename $dir)"
done
```

### 2. Commit Often, Push Regularly

```bash
# In each worktree, commit when you have working code
git add .
git commit -m "Clear message

- Task: X.x_Task_Name
- What was changed
- Why it was changed"

# Push when ready for review
git push origin [branch]
```

### 3. Reference Tasks in Commits

Every commit should reference the task:

```bash
git commit -m "feat: Add pod creation endpoint

- Task: 1.2_Pod_Service_Architecture
- Implements createPod() service function
- Generates short code and stores in Firestore
- Fixes #15"
```

### 4. Merge Early, Rebase Often

When a dependency is complete and merged:

```bash
# In dependent worktree
cd ~/Repos/my-project-game
git rebase origin/develop           # Get latest changes
# Test that your code still works
npm run type-check
npm run lint
# Push with force (safe since you own the branch)
git push -f origin feature/game-screen
```

### 5. Clean Up Merged Worktrees

When a feature is merged to develop:

```bash
# Delete the worktree (both local and remote)
git worktree remove ../my-project-auth
git push origin --delete feature/firebase-auth

# Verify
git worktree list
```

---

## Workflow: Task Sequence

### Phase 1 Development Timeline

**Week 1: Foundation**

```
Terminal 1: Main repo (monitor)
Terminal 2: Auth feature (1.1) - START HERE
  └─ Complete, merge, notify team

Terminal 3: Pod Service (1.2) - WAIT FOR 1.1 MERGE
  └─ Start after auth merged
  └─ Complete, merge

Terminal 4: QR Generation (1.3) - WAIT FOR 1.2 MERGE
Terminal 5: QR Scanning (1.4) - WAIT FOR 1.2 MERGE
```

**Week 2: Features**

```
Terminal 2: Game Screen (1.5) - WAIT FOR 1.4 MERGE
Terminal 3: Real-time Sync (1.6) - WAIT FOR 1.5 MERGE
Terminal 4: Transaction Log (1.7) - WAIT FOR 1.6 MERGE
```

**Week 3: Testing & Polish**

```
Terminal 1: Integration testing (all features)
Terminal 2: Android testing
Terminal 3: Web testing
Terminal 4: Bug fixes and refinement
```

---

## Common Scenarios

### Scenario 1: Quick Fix on Develop

You find a bug in develop while working on a feature:

```bash
# Terminal 1: Main repo
cd ~/Repos/my-project
git checkout -b bugfix/small-issue
# Fix the bug
git commit -m "fix: Small issue

- Task: Hotfix
- Description"
git push origin bugfix/small-issue

# Create PR, merge, then update all worktrees
git fetch --all

# In each worktree
cd ~/Repos/my-project-[feature]
git rebase origin/develop
git push -f origin [branch]
```

### Scenario 2: Dependency Block

You're working on Feature B but it depends on Feature A. Feature A has a bug preventing you from finishing B:

```bash
# Option 1: Create temporary worktree to fix bug in A
cd ~/Repos/my-project-auth
git commit -am "wip: Current work"
git checkout -b bugfix/auth-issue
# Fix the bug
git commit -m "fix: Auth issue needed for game-screen"
git push origin bugfix/auth-issue

# Back in B's worktree
cd ~/Repos/my-project-game
git rebase origin/develop    # Get the fix
# Now you can continue

# Option 2: Ask the person working on A to fix it
# (Preferred for team environments)
```

### Scenario 3: Merge Conflict

You're rebasing and hit a conflict:

```bash
# During rebase
git rebase origin/develop
# CONFLICT: merge conflict in src/store/slices/authSlice.ts
git status

# Fix conflicts manually
# Edit the file, resolve conflicts, keep what you need

git add src/store/slices/authSlice.ts
git rebase --continue

# Or abort if you need to reconsider
git rebase --abort
```

### Scenario 4: Lost Work (Oops)

You deleted files by accident:

```bash
# Worktrees are safe - your work is in git
git status                  # See what's deleted
git checkout -- .          # Restore everything

# Or if you committed
git log                     # Find the commit
git reset --hard [commit]  # Go back to known good state
```

---

## Useful Scripts

### Watch All Worktrees Status

Create `watch-worktrees.sh`:

```bash
#!/bin/bash
echo "=== Worktree Status ==="
git worktree list

echo ""
echo "=== Uncommitted Changes ==="
for dir in $(git worktree list | grep -v detached | awk '{print $1}'); do
  cd "$dir"
  uncommitted=$(git status --short | wc -l)
  branch=$(git rev-parse --abbrev-ref HEAD)
  echo "$branch: $uncommitted changes"
  cd -
done
```

**Usage**:
```bash
chmod +x watch-worktrees.sh
./watch-worktrees.sh
```

### Update All Worktrees

Create `update-all.sh`:

```bash
#!/bin/bash
echo "Fetching latest..."
git fetch --all

for dir in $(git worktree list | grep -v detached | awk '{print $1}'); do
  cd "$dir"
  branch=$(git rev-parse --abbrev-ref HEAD)
  echo "Updating $branch..."
  git pull --rebase origin $branch || git rebase origin/develop
done
```

### Commit Across Worktrees

Create `commit-all.sh`:

```bash
#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: ./commit-all.sh <message>"
  exit 1
fi

for dir in $(git worktree list | grep -v detached | awk '{print $1}'); do
  cd "$dir"
  branch=$(git rev-parse --abbrev-ref HEAD)
  if git status --short | grep -q .; then
    echo "Committing in $branch..."
    git add .
    git commit -m "$1"
  fi
done
```

---

## Troubleshooting

### Worktree Won't Delete

```bash
# Force remove
git worktree remove --force ../my-project-auth

# Clean up pruned references
git worktree prune
```

### Lost Worktree Path

```bash
# List all worktrees (find missing)
git worktree list

# If a path is missing but git thinks it exists
git worktree repair
```

### Can't Push (Branch Locked)

```bash
# Worktree is using the branch - use different worktree or close editor
# Make sure no code editor is actively editing files

git push origin feature/firebase-auth
```

### Merge Conflicts During Rebase

```bash
# Check which file has conflict
git status

# Open editor, resolve conflicts manually
# Look for <<<<<<< ======= >>>>>>>

# After resolving
git add .
git rebase --continue
```

---

## Git Worktree Cheat Sheet

| Command | Purpose |
|---------|---------|
| `git worktree list` | Show all worktrees |
| `git worktree add ../path feature/branch` | Create new worktree |
| `git worktree remove ../path` | Delete worktree |
| `git worktree repair` | Fix broken worktrees |
| `git worktree lock ../path --reason "why"` | Lock worktree (prevent deletion) |
| `git worktree unlock ../path` | Unlock worktree |

---

## When to Use Worktrees vs. Branches

**Use Worktrees When**:
- Working on multiple features in parallel
- Need to run tests on multiple branches simultaneously
- Switching contexts frequently
- Want to preserve uncommitted work

**Use Branches When**:
- Single feature at a time
- Don't need active editor open on multiple branches
- Simpler workflow (CI/CD handles testing)

---

## Tips for Success

1. **One task per worktree** - Don't mix features in one worktree
2. **Commit frequently** - Saves work, makes rebasing easier
3. **Push regularly** - Backup to remote, easier to recover from mistakes
4. **Test before rebasing** - Ensure tests pass on your branch first
5. **Communicate blocking tasks** - Let team know if you need a feature completed
6. **Review code early** - Create PR as soon as you have working code
7. **Keep worktrees clean** - Delete after merged, don't pile them up
8. **Use descriptive commit messages** - Reference tasks, explain why

---

## Next: Starting Phase 1

1. **Create worktree for 1.1 Auth**:
   ```bash
   git worktree add ../my-project-auth feature/firebase-auth
   cd ../my-project-auth
   ```

2. **Start implementing** (see 1.1_Firebase_Authentication.md)

3. **Open second terminal** for reference/running tests:
   ```bash
   cd ~/Repos/my-project
   ```

4. **After 1.1 complete**, create worktrees for 1.2, 1.3, 1.4

5. **Update TASK_SUMMARY.md** as features complete

---

## See Also

- **1.1_Firebase_Authentication.md** - First task to complete
- **TASK_SUMMARY.md** - Overall progress tracking
- **CLAUDE.md** - Development workflow

