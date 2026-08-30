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

# --- GATE 1: baseline (content-addressed) -----------------------------------
# Integrity is proved by CONTENT, not by a commit SHA and not by a tag.
#   - A commit cannot contain its own SHA, so a recorded SHA is self-referential.
#   - Tag pushes are rejected by repository permissions, so a tag cannot be
#     required: a fresh clone would fail through no fault of its own.
# Both hashes come from hash-manifest.mjs - ONE implementation shared with the
# bash runner, so the two cannot drift. A failure here is a hard stop.
$ManifestPath = Join-Path $Here 'REVIEW_PACKAGE_MANIFEST.json'
if (-not (Test-Path $ManifestPath)) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - MANIFEST_MISSING" -ForegroundColor Red
    Write-Host "  expected $ManifestPath"
    exit 4
}
$Manifest = (Get-Content -Raw $ManifestPath | ConvertFrom-Json)
$SourceBaselineSha = $Manifest.source_baseline_commit
$ExpectedSrcHash   = $Manifest.source_baseline_content_hash
$ExpectedPkgHash   = $Manifest.review_package_content_hash
$ReviewPackageTag  = $Manifest.review_package_tag

$Hasher = Join-Path $Here 'hash-manifest.mjs'
$SrcHash = (node $Hasher source 2>$null | Out-String).Trim()
$PkgHash = (node $Hasher package 2>$null | Out-String).Trim()

$CurrentSha = (git rev-parse --verify --quiet HEAD 2>$null | Out-String).Trim()
if (-not $CurrentSha) { $CurrentSha = 'unknown' }

# Optional provenance signal only. Its absence NEVER fails the gate.
$TagSha = ''
if ($ReviewPackageTag) {
    $TagSha = (git rev-parse --verify --quiet "$ReviewPackageTag^{commit}" 2>$null | Out-String).Trim()
}
if (-not $TagSha) { $TagState = 'ABSENT' }
elseif ($TagSha -eq $CurrentSha) { $TagState = 'PRESENT_MATCHES_HEAD' }
else { $TagState = 'PRESENT_DIFFERENT_COMMIT' }

$BaselineGate = 'FAIL'
if ((-not $ExpectedSrcHash) -or (-not $ExpectedPkgHash) -or (-not $SourceBaselineSha)) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - INCOMPLETE_MANIFEST" -ForegroundColor Red
    Write-Host "  REVIEW_PACKAGE_MANIFEST.json is missing source_baseline_commit /"
    Write-Host "  source_baseline_content_hash / review_package_content_hash."
    Write-Host "  Refusing to guess."
    exit 4
}
if ((-not $SrcHash) -or (-not $PkgHash)) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - HASH_COMPUTATION_FAILED" -ForegroundColor Red
    Write-Host "  hash-manifest.mjs produced no output. Node.js is required."
    exit 4
}
if ($SrcHash -ne $ExpectedSrcHash) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - SOURCE_TREE_MISMATCH" -ForegroundColor Red
    Write-Host "  product source hash   $SrcHash"
    Write-Host "  frozen at $SourceBaselineSha  $ExpectedSrcHash"
    Write-Host "  Product code differs from the frozen v0.1 baseline - committed or not."
    Write-Host "  Findings would not apply to the released product. Not a warning."
    exit 4
}
if ($PkgHash -ne $ExpectedPkgHash) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_CONTENT_MISMATCH" -ForegroundColor Red
    Write-Host "  review package hash   $PkgHash"
    Write-Host "  recorded              $ExpectedPkgHash"
    Write-Host "  The evidence Codex would read is not the evidence that was locked."
    exit 4
}
# File-set integrity. Hashes cover TRACKED files only, so an untracked file
# dropped into a scoped directory would otherwise be read by Codex without ever
# entering the hash. That is exactly the silent gap this check closes.
$FsBad = (node $Hasher fileset 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - FILE_SET_CHECK_FAILED" -ForegroundColor Red
    Write-Host "  hash-manifest.mjs could not report file-set integrity."
    exit 4
}
if ($FsBad) {
    Write-Host "ERROR: BASELINE_GATE_FAILED - FILE_SET_MISMATCH" -ForegroundColor Red
    foreach ($line in ($FsBad -split "`r?`n")) { Write-Host "  $line" }
    Write-Host "  A tracked file is missing, or an untracked file sits inside a scoped"
    Write-Host "  directory. Untracked files are not hashed, so Codex could read content"
    Write-Host "  that was never locked. Remove it or commit it, then re-lock."
    exit 4
}

$BaselineGate = 'PASS'
Write-Host "GATE 1 baseline: PASS"
Write-Host "  source baseline   $SourceBaselineSha"
Write-Host "  source content    $SrcHash"
Write-Host "  package content   $PkgHash"
Write-Host "  HEAD              $CurrentSha (provenance only)"
Write-Host "  tag               $TagState (optional provenance signal)"
Write-Host "  file set          clean (no missing tracked, no untracked in scope)"

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
    source_content_hash      = $SrcHash
    review_package_content_hash = $PkgHash
    review_package_tag_state = $TagState
    baseline_gate            = $BaselineGate
    codex_version            = $CodexVersion
    review_package_version   = '1.1.0'
    benchmark_policy_version = 'v0.1.1'
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
