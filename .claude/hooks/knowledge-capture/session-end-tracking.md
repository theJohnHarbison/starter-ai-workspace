---
name: session-end-tracking
event: SessionEnd
enabled: true
---

Evaluate session and queue knowledge extraction if valuable.

**Action**: Calculate session score and queue extraction job

```bash
node .claude/hooks/knowledge-capture/scripts/session-end.js
```

**Service Management**: Stop service if auto-started

```bash
node .claude/hooks/knowledge-capture/scripts/stop-service-if-auto.js
```
