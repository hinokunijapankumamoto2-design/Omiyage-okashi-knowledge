#!/usr/bin/env pwsh
#
# Runs the four independent Codex reviews and writes them to reports/codex-results/.
# Identical review content to RUN_CODEX_REVIEW.sh - same four prompt files, same
# four output names, same order.
#
# Authentication is EXTERNAL by design. This script never reads, writes, prints
# or stores a credential. Log in beforehand with `codex login` (ChatGPT
# subscription) or `$env:OPENAI_API_KEY | codex login --with-api-key`.
#
# It is read-only with respect to the project: it does not build, install,
# modify tracked files, or change global environment.

$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path (Join-Path $Here '..') '..')
$Out  = Join-Path $Root 'reports/codex-results'
Set-Location $Root

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    Write-Error "codex CLI not found. Install with: npm install -g @openai/codex"
    exit 1
}

Write-Host "codex: $(codex --version)"
$status = (codex login status 2>&1) -join "`n"
if ($status -match '(?i)not logged in') {
    Write-Error "Not logged in. Run 'codex login' first (no credential is stored by this script)."
    exit 1
}
Write-Host $status

New-Item -ItemType Directory -Force -Path $Out | Out-Null

function Invoke-Review {
    param([string]$Name, [string]$PromptFile)
    Write-Host ""
    Write-Host "=== $Name ==="
    $prompt = Get-Content -Raw (Join-Path $Here $PromptFile)
    $target = Join-Path $Out "$Name.md"
    # --skip-git-repo-check so the review also works from an exported copy.
    codex exec --skip-git-repo-check $prompt *>&1 | Set-Content -Path $target
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  wrote $target"
    } else {
        Write-Warning "  FAILED - transcript (including the error) kept at $target"
    }
}

Invoke-Review 'standard-review'                   'REVIEW_BRIEF.md'
Invoke-Review 'adversarial-review'                'PROMPT_ADVERSARIAL.md'
Invoke-Review 'benchmark-audit'                   'PROMPT_BENCHMARK_AUDIT.md'
Invoke-Review 'security-license-provenance-audit' 'PROMPT_SEC_LIC_PROV.md'

Write-Host ""
Write-Host "Four transcripts in reports/codex-results/."
Write-Host "Next: return them to Claude Code. Every finding must be independently"
Write-Host "reproduced and classified before any fix - Codex can be wrong too."
