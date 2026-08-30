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

# --- GATE 1: baseline -------------------------------------------------------
# TWO checks, both required. HEAD must be the review-package commit, AND the
# product source tree must still hash to what it hashed at the frozen product
# baseline. Neither alone is sufficient: matching HEAD says nothing about the
# source, and a matching hash says nothing about which evidence Codex will read.
# A failure here is a hard stop, never a warning.
function Get-Sha256Hex([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
    return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

$Baseline = (Get-Content -Raw (Join-Path $Here 'BASELINE.json') | ConvertFrom-Json)
$SourceBaselineSha = $Baseline.source_baseline_commit
$ReviewPackageTag  = $Baseline.review_package_tag
$ExpectedTreeHash  = $Baseline.source_tree_hashes.working_tree_content.value
$ExpectedPkgHash   = $Baseline.review_package_content_hash
$CurrentSha = (git rev-parse HEAD 2>$null | Out-String).Trim()
if (-not $CurrentSha) { $CurrentSha = 'unknown' }

# Hash file CONTENT, not the index: 'git ls-files -s' reports staged blobs, so an
# uncommitted edit to product source would slip past the gate unnoticed.
# Same construction as the bash runner.
$TreeHash = 'unknown'
try {
    $files = (git ls-files src data schemas tests package.json tsconfig.json | Out-String) -split "`r?`n" |
        Where-Object { $_ } |
        Sort-Object -Culture ([System.Globalization.CultureInfo]::InvariantCulture)
    $lines = $files | ForEach-Object {
        "$((Get-FileHash (Join-Path $Root $_) -Algorithm SHA256).Hash.ToLower())  $_"
    }
    $TreeHash = Get-Sha256Hex (($lines -join "`n") + "`n")
} catch { }

# Same construction as the bash runner: sha256 over the per-file sha256sum
# listing of reports/codex-package/, sorted by path, excluding BASELINE.json.
$PkgHash = 'unknown'
try {
    $lines = Get-ChildItem -Path $Here -Recurse -File |
        Where-Object { $_.Name -ne 'BASELINE.json' } |
        ForEach-Object {
            $rel = './' + ($_.FullName.Substring($Here.Length + 1) -replace '\\', '/')
            [PSCustomObject]@{ Path = $rel; Hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower() }
        } |
        Sort-Object -Property Path -Culture ([System.Globalization.CultureInfo]::InvariantCulture) |
        ForEach-Object { "$($_.Hash)  $($_.Path)" }
    $PkgHash = Get-Sha256Hex (($lines -join "`n") + "`n")
} catch { }

$ReviewPackageSha = 'unknown'
if ($ReviewPackageTag) {
    $resolved = (git rev-parse "$ReviewPackageTag^{commit}" 2>$null | Out-String).Trim()
    if ($resolved) { $ReviewPackageSha = $resolved }
}

$BaselineGate = 'FAIL'
if ((-not $SourceBaselineSha) -or (-not $ReviewPackageTag) -or
    (-not $ExpectedTreeHash) -or (-not $ExpectedPkgHash)) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - INCOMPLETE_LOCK" -ForegroundColor Red
    Write-Host "  BASELINE.json is missing source_baseline_commit / review_package_tag /"
    Write-Host "  source_tree_hashes.working_tree_content.value / review_package_content_hash."
    Write-Host "  Refusing to guess."
    exit 4
}
if ($ReviewPackageSha -eq 'unknown') {
    Write-Host "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_TAG_MISSING" -ForegroundColor Red
    Write-Host "  tag not found in this clone: $ReviewPackageTag"
    Write-Host "  Fetch tags with: git fetch --tags"
    exit 4
}
if ($CurrentSha -ne $ReviewPackageSha) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_MISMATCH" -ForegroundColor Red
    Write-Host "  HEAD                     $CurrentSha"
    Write-Host "  $ReviewPackageTag  $ReviewPackageSha"
    Write-Host "  Check out the tagged review-package commit, or re-lock BASELINE.json"
    Write-Host "  deliberately. This script will not review a commit it was not built for."
    exit 4
}
if ($TreeHash -ne $ExpectedTreeHash) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - SOURCE_TREE_MISMATCH" -ForegroundColor Red
    Write-Host "  product source hash   $TreeHash"
    Write-Host "  frozen at $SourceBaselineSha  $ExpectedTreeHash"
    Write-Host "  Product code differs from the frozen v0.1 baseline. Findings would not"
    Write-Host "  apply to the released product. Not a warning - stopping."
    exit 4
}
if ($PkgHash -ne $ExpectedPkgHash) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_CONTENT_MISMATCH" -ForegroundColor Red
    Write-Host "  review package hash   $PkgHash"
    Write-Host "  recorded              $ExpectedPkgHash"
    Write-Host "  The evidence Codex would read is not the evidence that was locked."
    exit 4
}
$BaselineGate = 'PASS'
Write-Host "GATE 1 baseline: PASS"
Write-Host "  source baseline   $SourceBaselineSha (product source hash matches)"
Write-Host "  review package    $ReviewPackageSha (= HEAD, tag $ReviewPackageTag)"
Write-Host "  package content   $PkgHash"

# --- GATE 2: Codex host -----------------------------------------------------
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
Write-Host "GATE 2 codex host: PASS"

# --- GATE 3: review package -------------------------------------------------
$Missing = @()
foreach ($f in @('REVIEW_BRIEF.md','PROMPT_ADVERSARIAL.md','PROMPT_BENCHMARK_AUDIT.md',
                 'PROMPT_SEC_LIC_PROV.md','FINDING_SCHEMA.md','POST_CODEX_INSTRUCTIONS.md',
                 'evidence/claims-to-audit.md','evidence/evidence-classification.md',
                 'evidence/benchmark-evidence.md','evidence/security-evidence.md',
                 'evidence/license-evidence.md','evidence/provenance-evidence.md')) {
    if (-not (Test-Path (Join-Path $Here $f))) { $Missing += $f }
}
if ($Missing.Count -gt 0) {
    Write-Host "ERROR: REVIEW_PACKAGE_INCOMPLETE" -ForegroundColor Red
    foreach ($f in $Missing) { Write-Host "  missing: $f" }
    exit 5
}
Write-Host "GATE 3 review package: PASS"

New-Item -ItemType Directory -Force -Path $Out | Out-Null

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
$Overall = if ($script:Failed -eq 0) { 'COMPLETE' } else { 'INCOMPLETE' }
$Arch = if ([System.Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
[ordered]@{
    timestamp                = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    status                   = $Overall
    git_commit               = $CurrentSha
    source_baseline_commit   = $SourceBaselineSha
    review_package_commit    = $ReviewPackageSha
    review_package_tag       = $ReviewPackageTag
    review_package_content_hash = $PkgHash
    baseline_gate            = $BaselineGate
    codex_version            = $CodexVersion
    review_package_version   = '1.1.0'
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
