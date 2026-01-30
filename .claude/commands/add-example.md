---
description: "Add a file or directory as an example to the workspace"
usage: "/project:add-example <source_path> [example_name]"
---

# Add Example to Workspace

Add a file or directory as an example to the workspace for reference and reuse.

## Arguments
- `source_path` - Path to the file or directory to add as example
- `example_name` - Optional name for the example (defaults to basename)

!./scripts/add-example

## Examples

Add a file:
```bash
./scripts/add-example /path/to/my-feature.md
./scripts/add-example ./local-file.py python-example
```

Add a directory:
```bash
./scripts/add-example /path/to/project-dir project-structure
```

## Features
- 🔗 Creates symbolic links to preserve original files
- 📊 Creates metadata for tracking
- 📁 Supports both files and directories
- 📋 Lists all current examples
- ⚡ Auto-detection of file/directory type

The examples are stored in `agent/_examples/` and can be referenced by other team members or used as templates for new work.

Usage: `/project:add-example <source_path> [name]`