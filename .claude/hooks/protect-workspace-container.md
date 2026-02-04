---
name: protect-workspace-container
enabled: true
event: bash
pattern: (docker-compose\s+down|docker\s+rm.*\bqdrant\b|docker\s+volume\s+rm\s+qdrant_data)
action: block
---

**CRITICAL: Attempting to delete ai-workspace infrastructure!**

This command would delete critical components of the workspace:
- **Qdrant** - Vector database with session embeddings
- **Session memory** - All past conversations and semantic search capability

## DO NOT PROCEED without:

### 1. Create a Backup BEFORE making changes
```bash
# From ai-workspace directory
npm run session:backup
```

### 2. If you MUST delete this container:

**Step-by-step safe deletion**:
```bash
# 1. Backup Qdrant data first

# 2. ONLY THEN can you proceed
docker-compose down --remove-orphans

# 3. Restart to verify everything works
docker-compose up -d
npm run session:stats  # Verify data is intact
```

### 3. What happens if you delete without backup:
- All session embeddings are LOST
- Session search capability DISABLED
- Historical conversation context LOST FOREVER

## Critical Files & Locations:

| Component | Location |
|-----------|----------|
| Qdrant embeddings | Docker volume `qdrant_data` |
| Backup cache | `backups/` directory |

## Safe Alternative: Restart Instead
```bash
# If you just need to restart/refresh:
docker-compose restart qdrant
docker-compose logs -f  # Monitor startup

# NO DATA LOSS - service restarts cleanly
```

**Remember**: This workspace represents accumulated knowledge from your sessions. Treat it with care.
