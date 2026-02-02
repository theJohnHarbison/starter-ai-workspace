# Local LLM Workflow (Ollama)

## Overview
This document outlines how to use the local Ollama instance to optimize token usage and offload computational work from Claude's primary model.

## Ollama Service Setup

Ollama runs via Docker (see `docker-compose.yml`) or can be installed natively from https://ollama.ai/. If installed natively, ensure it's running before using the workspace.

## Available Models

**Local LLM**: `qwen2.5-coder:7b`
- **Size**: ~4.7 GB
- **Quantization**: Q4_K_M (4-bit quantized, optimized for local running)
- **Specialization**: Code analysis, refactoring, generation
- **Parameter Count**: 7.6B parameters

**Embeddings**: `nomic-embed-text`
- **Size**: ~274 MB
- **Use for**: Session memory semantic search

## Token-Efficient Workflow Strategy

### Core Principle
- **Local model handles**: Analysis, reasoning, code generation, decision-making
- **Claude handles**: Execution, coordination, file modifications, complex problem-solving

### Division of Labor

| Task | Who | Why |
|------|-----|-----|
| Code analysis & refactoring suggestions | Local model | Token-free thinking |
| Syntax checking & pattern identification | Local model | Fast, local-only |
| Generating code snippets | Local model | No token cost |
| Applying changes to files | Claude | Requires tool access |
| Complex problem-solving | Claude | Better reasoning capability |
| Architecture & design decisions | Claude | Requires broader context |
| Coordination & workflow | Claude | Orchestrates overall task |

### When to Use Local Model (Scope-Based Routing)

The primary routing criterion is **scope** (narrow vs broad context), not perceived difficulty. A "hard" task with narrow scope works locally; an "easy" task requiring broad context needs Claude.

**Route to Ollama when:**
- Task is scoped to a single function or file
- Output format can be strictly defined (JSON schema, specific template)
- Code-to-code transformation (refactoring, translation, boilerplate)
- Structured analysis with clear input/output contract

**Route to Claude when:**
- Task requires understanding relationships across multiple files
- Open-ended analysis or ambiguous requirements
- Architectural reasoning or design decisions
- Requires project history or broad codebase context

**Decompose when possible:**
If a task seems to need Claude but has narrow sub-components, decompose it. Route each sub-task individually — Ollama handles the structured pieces, Claude synthesizes the results.

### Reliability: Retry-with-Validation

Local models produce better results with stochastic generation and retry:

1. Use **temperature 0.75** (not 0) for generation tasks
2. **Validate output** after each attempt (JSON parse, syntax check, length bounds)
3. **Retry up to 3x** on validation failure
4. This pattern brings effective quality from ~78% to 95%+ (per SLM research)

Single deterministic calls (temperature 0) often fail where retry-with-validation succeeds.

### Structured Input/Output

Always provide structured context to Ollama, not raw natural language:

```json
{
  "task": "review_function",
  "language": "typescript",
  "function_name": "processPayment",
  "code": "...",
  "output_format": {
    "issues": [{"severity": "string", "description": "string", "line": "number"}],
    "suggestions": [{"description": "string"}]
  }
}
```

Imposing structure on both input and output improves quality and reduces output length.

### Legacy Complexity-Based Reference

**Ollama sweet spot:**
- Code snippets < 100 lines
- Syntax validation and code style feedback
- Refactoring suggestions for isolated functions
- Comment/docstring generation
- Quick code review feedback on specific sections
- Generate boilerplate code
- Explain existing code logic

**Claude required:**
- Complex multi-file refactoring
- Architecture decisions
- Debugging complex issues
- Full system design
- Performance optimization analysis
- Security implications

## Workflow Pattern

### Example: Token-Efficient Refactoring

```
1. Claude reads the target file (minimal overhead)
2. Local model analyzes the code and generates optimized version
3. Claude parses the suggestion
4. Claude applies the changes using Edit/Write tools
5. Result: Cognitive work is free, execution is minimal-cost
```

### Example: Code Generation

```
1. User requests: "Generate a utility function for X"
2. Claude routes to local model (code generation task)
3. Local model generates the function
4. Claude validates and applies it to the codebase
5. Claude handles integration/context concerns
```

## Configuration Details

### API Endpoints
- **Chat Completion**: OpenAI-compatible API
- **Direct Run**: Ollama run endpoint
- **Both methods available** via MCP

### Model Management
Available commands:
- `list` - See installed models
- `show` - Get model details
- `pull` - Download new models
- `run` - Execute inference
- `chat_completion` - OpenAI-compatible interface

## Token Usage Optimization

### Expected Savings
- **Analysis-heavy tasks**: 40-60% token reduction
- **Code generation**: 70-80% token reduction
- **Code review/feedback**: 50-70% token reduction
- **Complex reasoning**: 0% savings (use Claude)

### Cost Calculation
```
Traditional approach:
- Claude analyzes: 2000 tokens
- Claude generates: 1500 tokens
- Claude executes: 500 tokens
= 4000 tokens total

Optimized approach:
- Local model analyzes: 0 tokens (free)
- Local model generates: 0 tokens (free)
- Claude executes: 500 tokens
= 500 tokens total

Savings: 87.5%
```

## Best Practices

1. **Monitor Service Status**: Ensure Ollama service is running before tasks
2. **Use for Batch Work**: Running multiple analysis/generation tasks yields best ROI
3. **Fallback Available**: If local model is unavailable, Claude handles the full task
4. **Quality Check**: Claude validates local model output before applying
5. **Context Awareness**: Local model works on isolated code, Claude maintains system context

## Troubleshooting

### Service Not Running
```bash
# Check status
Get-Service -Name Ollama | Select Status

# Start service
Start-Service -Name Ollama

# Enable auto-start if needed
Set-Service -Name Ollama -StartupType Automatic
```

### Model Issues
- **Model not available**: Use `mcp__ollama__pull` to download
- **Performance issues**: Check Windows Task Manager for resource usage
- **Timeout issues**: Local model may be overloaded, fall back to Claude

## Integration with Development Workflow

### Current Projects
- Use local Ollama for code analysis, refactoring, and generation across all workspace projects

### Future Model Options
If you add additional models:
- Consider performance vs. capability trade-offs
- Update this document with new model guidance
- Adjust task routing accordingly

---

**Last Updated**: 2026-02-02
**Maintained By**: Development team
**Related**: See CLAUDE.md for workspace guidance
