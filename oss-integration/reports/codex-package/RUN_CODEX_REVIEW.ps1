#!/usr/bin/env pwsh
#
# Runs the four independent Codex reviews and writes them to reports/codex-results/.
# Identical review content to RUN_CODEX_REVIEW.sh - same four prompt files, same
# four output names, same order, same metadata.
#
# READ-ONLY with respect to the project: it does not build, install, modify any
# tracked file, or change global environment. It writes only into
# reports/codex-results/.
#
# Authentication is EXTERNAL by design. This script never reads, writes, prints
# or stores a credential, and never falls back to an API key on its own. Log in
# beforehand with `codex login`, or if you prefer a key:
#   $env:OPENAI_API_KEY | codex login --with-api-key

$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path (Join-Path $Here '..') '..')
$Out  = Join-Path $Root 'reports/codex-results'
Set-Location $Root

# --- pre-flight ------------------------------------------------------------
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: CODEX_CONNECTION_UNAVAILABLE" -ForegroundColor Red
    Write-Host "  codex CLI not found. Install with: npm install -g @openai/codex"
    exit 2
}

$CodexVersion = (codex --version 2>&1 | Out-String).Trim()
Write-Host "codex: $CodexVersion"

$LoginStatus = (codex login status 2>&1 | Out-String).Trim()
if ($LoginStatus -match '(?i)not logged in') {
    Write-Host "ERROR: CODEX_NOT_AUTHENTICATED" -ForegroundColor Red
    Write-Host "  codex login status reported: $LoginStatus"
    Write-Host "  Run 'codex login' first. This script will not fall back to an API key."
    exit 3
}
Write-Host $LoginStatus

New-Item -ItemType Directory -Force -Path $Out | Out-Null

$Baseline = (Get-Content -Raw (Join-Path $Here 'BASELINE.json') | ConvertFrom-Json)
$BaselineSha = $Baseline.BASELINE_GIT_COMMIT
$CurrentSha = (git rev-parse HEAD 2>$null | Out-String).Trim()
if (-not $CurrentSha) { $CurrentSha = 'unknown' }
if ($BaselineSha -and $CurrentSha -ne $BaselineSha) {
    Write-Warning "working tree is at $CurrentSha but the review package was built for $BaselineSha."
    Write-Warning "         Findings will be recorded against the CURRENT commit."
}

# --- reviews ---------------------------------------------------------------
$script:Failed = 0
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
        $script:Failed++
    }
}

Invoke-Review 'standard-review'                   'REVIEW_BRIEF.md'
Invoke-Review 'adversarial-review'                'PROMPT_ADVERSARIAL.md'
Invoke-Review 'benchmark-audit'                   'PROMPT_BENCHMARK_AUDIT.md'
Invoke-Review 'security-license-provenance-audit' 'PROMPT_SEC_LIC_PROV.md'

# --- run metadata (never contains a credential) ----------------------------
$TreeHash = 'unknown'
try {
    $listing = (git ls-files -s src data schemas tests package.json tsconfig.json | Out-String)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($listing))
    $TreeHash = -join ($bytes | ForEach-Object { $_.ToString('x2') })
} catch { }

[ordered]@{
    timestamp                = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    git_commit               = $CurrentSha
    baseline_git_commit      = $BaselineSha
    codex_version            = $CodexVersion
    review_package_version   = '1.0.0'
    benchmark_policy_version = 'v0.1.1'
    source_tree_hash         = $TreeHash
    runner                   = 'RUN_CODEX_REVIEW.ps1'
    reviews_failed           = $script:Failed
} | ConvertTo-Json | Set-Content -Path (Join-Path $Out 'RUN_METADATA.json')

Write-Host ""
Write-Host "wrote $(Join-Path $Out 'RUN_METADATA.json')"
Write-Host "Four transcripts in reports/codex-results/."
Write-Host "Next: node reports/codex-package/import-codex-results.mjs, then return"
Write-Host "CODEX_REVIEW_REPORT.md to Claude Code. Every finding must be independently"
Write-Host "reproduced and classified before any fix - Codex can be wrong too."
if ($script:Failed -gt 0) { exit 1 }
