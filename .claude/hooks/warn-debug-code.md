---
name: warn-debug-code
enabled: true
event: file
pattern: "console\\.(log|debug|info)|debugger\\b"
glob: "*.{ts,js,tsx,jsx}"
action: warn
---

**Debug code detected** - Remove before committing:
- `console.log()` statements
- `debugger` statements

Use proper logging libraries for production code.
