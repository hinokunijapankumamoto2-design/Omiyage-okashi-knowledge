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
$BaselineMismatch = $false
if ($BaselineSha -and $CurrentSha -ne $BaselineSha) {
    $BaselineMismatch = $true
    Write-Warning "BASELINE_MISMATCH"
    Write-Warning "         working tree is at $CurrentSha; package was built for $BaselineSha."
    Write-Warning "         Findings are recorded against the CURRENT commit and must be"
    Write-Warning "         diffed against the baseline before being acted on."
}

# --- reviews ---------------------------------------------------------------
# Every review starts NOT_RUN and only becomes PASS on a clean exit, so an
# interrupted run can never be mistaken for a complete one.
$script:Failed = 0
$script:Status = [ordered]@{
    standard                    = 'NOT_RUN'
    adversarial                 = 'NOT_RUN'
    benchmark                   = 'NOT_RUN'
    security_license_provenance = 'NOT_RUN'
}

function Invoke-Review {
    param([string]$Key, [string]$Name, [string]$PromptFile)
    Write-Host ""
    Write-Host "=== $Name ==="
    $prompt = Get-Content -Raw (Join-Path $Here $PromptFile)
    $target = Join-Path $Out "$Name.md"
    # --skip-git-repo-check so the review also works from an exported copy.
    codex exec --skip-git-repo-check $prompt *>&1 | Set-Content -Path $target
    if ($LASTEXITCODE -eq 0) {
        $script:Status[$Key] = 'PASS'
        Write-Host "  wrote $target"
    } else {
        $script:Status[$Key] = 'FAILED'
        $script:Failed++
        # Mark the transcript itself, so a partial result is never read as a
        # finished review by someone opening the file directly.
        $body = Get-Content -Raw $target
        Set-Content -Path $target -Value ("<!-- STATUS: INCOMPLETE - this review did not finish. Do not read it as a completed review. -->`n`n" + $body)
        Write-Warning "  FAILED - transcript marked INCOMPLETE at $target"
    }
}

Invoke-Review 'standard'                    'standard-review'                   'REVIEW_BRIEF.md'
Invoke-Review 'adversarial'                 'adversarial-review'                'PROMPT_ADVERSARIAL.md'
Invoke-Review 'benchmark'                   'benchmark-audit'                   'PROMPT_BENCHMARK_AUDIT.md'
Invoke-Review 'security_license_provenance' 'security-license-provenance-audit' 'PROMPT_SEC_LIC_PROV.md'

# --- run metadata (never contains a credential) ----------------------------
$TreeHash = 'unknown'
try {
    $listing = (git ls-files -s src data schemas tests package.json tsconfig.json | Out-String)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($listing))
    $TreeHash = -join ($bytes | ForEach-Object { $_.ToString('x2') })
} catch { }

$Overall = if ($script:Failed -eq 0) { 'COMPLETE' } else { 'INCOMPLETE' }
$Arch = if ([System.Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
[ordered]@{
    timestamp                = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    status                   = $Overall
    git_commit               = $CurrentSha
    baseline_git_commit      = $BaselineSha
    baseline_mismatch        = $BaselineMismatch
    codex_version            = $CodexVersion
    review_package_version   = '1.0.0'
    benchmark_policy_version = 'v0.1.1'
    source_tree_hash         = $TreeHash
    runner_type              = 'powershell'
    runner                   = 'RUN_CODEX_REVIEW.ps1'
    platform                 = "$([System.Environment]::OSVersion.VersionString) $Arch"
    reviews                  = $script:Status
    reviews_failed           = $script:Failed
} | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $Out 'RUN_METADATA.json')

Write-Host ""
Write-Host "wrote $(Join-Path $Out 'RUN_METADATA.json')"
Write-Host "Four transcripts in reports/codex-results/."
Write-Host "Next: node reports/codex-package/import-codex-results.mjs, then return"
Write-Host "CODEX_REVIEW_REPORT.md to Claude Code. Every finding must be independently"
Write-Host "reproduced and classified before any fix - Codex can be wrong too."
if ($script:Failed -gt 0) { exit 1 }
