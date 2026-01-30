---
name: warn-foreach
enabled: true
event: file
pattern: "\\.forEach\\("
glob: "*.{ts,js,tsx,jsx}"
action: warn
---

**`.forEach()` usage** - Consider using `for...of` instead:

```typescript
// ❌ forEach (no break/continue/return/await support)
items.forEach((item) => processItem(item));

// ✅ for...of (full control flow support)
for (const item of items) {
    processItem(item);
}
```

Use `map`/`filter`/`reduce` only for transformations, not side effects.
