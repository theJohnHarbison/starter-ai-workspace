---
name: session-start-tracking
event: start
enabled: true
---

Track session start for knowledge extraction eligibility.

**Action**: Initialize session tracking

```bash
node .claude/hooks/knowledge-capture/scripts/session-start.js
```

**Service Management**: Auto-start extraction service if needed

```bash
node .claude/hooks/knowledge-capture/scripts/start-service-if-needed.js
```
