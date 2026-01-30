---
name: block-hardcoded-secrets
enabled: true
event: file
pattern: "(api[_-]?key|password|secret|token)\\s*=\\s*['\"][a-zA-Z0-9]{10,}"
glob: "*.{ts,js,py,cs,json}"
action: block
---

**Hardcoded secret detected** - Never commit secrets to the repository.

Use environment variables or secure vaults instead:
- Node.js: `process.env.API_KEY`
- Python: `os.environ.get('API_KEY')`
- C#: `Environment.GetEnvironmentVariable("API_KEY")`
