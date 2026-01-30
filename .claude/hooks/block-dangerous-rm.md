---
name: block-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
action: block
---

⚠️ **Dangerous rm command detected!**

This command could delete important files. Please:
- Verify the path is correct
- Consider using a safer approach
- Make sure you have backups

**Safer alternatives**:
```bash
# Move to trash instead (if available)
trash path/to/dir

# Or delete with confirmation
rm -ri path/to/dir

# Or use explicit paths (never wildcard with -rf)
rm -rf /explicit/full/path
```

**Prevention tip**: Always double-check paths before running `rm -rf`
