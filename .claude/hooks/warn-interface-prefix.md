---
name: warn-interface-prefix
enabled: true
event: file
pattern: "interface I[A-Z]"
glob: "*.ts"
action: warn
---

**Interface `I` prefix detected** - Modern TypeScript doesn't use Hungarian notation.

Use descriptive names without prefixes:
- ❌ `interface IUser`
- ✅ `interface User`
