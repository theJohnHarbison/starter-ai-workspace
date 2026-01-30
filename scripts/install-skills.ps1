# Install Community Skills for ai-workspace
# Run this script after cloning the repository to install community skills

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceDir = Split-Path -Parent $ScriptDir
$InstalledDir = Join-Path $WorkspaceDir ".claude\skills\.installed"

Write-Host "=== Installing Community Skills ===" -ForegroundColor Cyan
Write-Host "Only installing skills that fill genuine gaps in the workspace."
Write-Host ""

# Create installed directory if needed
if (-not (Test-Path $InstalledDir)) {
    New-Item -ItemType Directory -Path $InstalledDir -Force | Out-Null
}

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

function Install-FromGitHub {
    param(
        [string]$Repo,
        [string[]]$Skills
    )

    $TempDir = Join-Path $env:TEMP "skills-install-$(Get-Random)"

    Write-Host "Cloning $Repo..."

    try {
        git clone --depth 1 "https://github.com/$Repo.git" $TempDir 2>$null

        foreach ($Skill in $Skills) {
            $SkillPath = Join-Path $TempDir "skills\$Skill"
            if (Test-Path $SkillPath) {
                Copy-Item -Path $SkillPath -Destination $InstalledDir -Recurse -Force
                Write-Host "  + Installed: $Skill" -ForegroundColor Green
            } else {
                Write-Host "  - Not found: $Skill" -ForegroundColor Yellow
            }
        }

        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        return $true
    } catch {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        return $false
    }
}

# Install from obra/superpowers
Write-Host ""
Write-Host "[1/2] Installing from obra/superpowers..." -ForegroundColor Yellow
if (-not (Install-FromGitHub -Repo "obra/superpowers" -Skills @("systematic-debugging", "test-driven-development"))) {
    Write-Host "Warning: Failed to install from obra/superpowers" -ForegroundColor Yellow
}

# Install from anthropics/skills
Write-Host ""
Write-Host "[2/2] Installing from anthropics/skills..." -ForegroundColor Yellow
if (-not (Install-FromGitHub -Repo "anthropics/skills" -Skills @("mcp-builder"))) {
    Write-Host "Warning: Failed to install from anthropics/skills" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Installed skills:"
Write-Host "  - systematic-debugging: Use when debugging issues (4-phase root cause analysis)"
Write-Host "  - test-driven-development: Use when writing tests (red-green-refactor)"
Write-Host "  - mcp-builder: Use when creating MCP servers"
Write-Host ""
Write-Host "Optional skills (install when needed):"
Write-Host "  npx skills add anthropics/webapp-testing    # Playwright E2E testing"
Write-Host "  npx skills add anthropics/skill-creator     # Build new skills"
Write-Host "  npx claude-plugins install security-guidance # Security audits"
Write-Host ""
Write-Host "To verify skills are loaded, start a new Claude Code session."
