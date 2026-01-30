---
name: warn-sensitive-files
enabled: true
event: file
action: warn
conditions:
  file_path:
    regex_match: \.env$|\.env\.|credentials|secrets
---

🔐 **Sensitive file detected**

You're editing a file that may contain sensitive data.

**Security Checklist**:
- [ ] Ensure credentials are not hardcoded
- [ ] Use environment variables for secrets
- [ ] Verify this file is in `.gitignore`
- [ ] Consider using a secrets manager

**For .env files**:
```gitignore
# Add to .gitignore
.env
.env.local
.env.*.local
```

**Better practices**:
- Use environment variables: `process.env.API_KEY`
- Use secret managers: AWS Secrets Manager, Azure Key Vault
- Never commit tokens, passwords, or API keys

**This is an additional layer** - the `block-hardcoded-secrets` hook will still catch content-level issues.
