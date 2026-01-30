#!/bin/bash
# Install Community Skills for ai-workspace
# Run this script after cloning the repository to install community skills

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
INSTALLED_DIR="$WORKSPACE_DIR/.claude/skills/.installed"

echo "=== Installing Community Skills ==="
echo "Only installing skills that fill genuine gaps in the workspace."
echo ""

# Create installed directory if needed
mkdir -p "$INSTALLED_DIR"

# Function to install skills from a GitHub repo
install_from_github() {
    local repo="$1"
    shift
    local skills=("$@")

    local tmp_dir=$(mktemp -d)
    echo "Cloning $repo..."

    if git clone --depth 1 "https://github.com/$repo.git" "$tmp_dir" 2>/dev/null; then
        for skill in "${skills[@]}"; do
            if [ -d "$tmp_dir/skills/$skill" ]; then
                cp -r "$tmp_dir/skills/$skill" "$INSTALLED_DIR/"
                echo "  ✓ Installed: $skill"
            else
                echo "  ✗ Not found: $skill"
            fi
        done
        rm -rf "$tmp_dir"
        return 0
    else
        rm -rf "$tmp_dir"
        return 1
    fi
}

# Install from obra/superpowers
echo ""
echo "[1/2] Installing from obra/superpowers..."
install_from_github "obra/superpowers" "systematic-debugging" "test-driven-development" || {
    echo "Warning: Failed to install from obra/superpowers"
}

# Install from anthropics/skills
echo ""
echo "[2/2] Installing from anthropics/skills..."
install_from_github "anthropics/skills" "mcp-builder" || {
    echo "Warning: Failed to install from anthropics/skills"
}

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Installed skills:"
echo "  - systematic-debugging: Use when debugging issues (4-phase root cause analysis)"
echo "  - test-driven-development: Use when writing tests (red-green-refactor)"
echo "  - mcp-builder: Use when creating MCP servers"
echo ""
echo "Optional skills (install when needed):"
echo "  npx skills add anthropics/webapp-testing    # Playwright E2E testing"
echo "  npx skills add anthropics/skill-creator     # Build new skills"
echo "  npx claude-plugins install security-guidance # Security audits"
echo ""
echo "To verify skills are loaded, start a new Claude Code session."
