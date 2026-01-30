---
name: warn-any-type
enabled: true
event: file
pattern: ":\\s*any\\b|<any>|any\\[\\]"
glob: "*.ts"
action: warn
---

**`any` type usage** - Consider using more specific types:
- `unknown` for truly unknown values with type guards
- Union types for multiple possible types
- Generics for flexible but type-safe code
