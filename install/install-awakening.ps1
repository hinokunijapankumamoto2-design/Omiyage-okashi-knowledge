# install-awakening.ps1 - 覚醒モード セットアップスクリプト (Windows)
#
# 覚醒モードを全プロジェクト共通（ユーザー階層 ~/.claude/）に導入する。
# Vault は不要。単体で実行できる。
#
# 使い方:
#   PowerShell を開き、本リポジトリのルートで実行:
#   .\install\install-awakening.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ClaudeDir = "$env:USERPROFILE\.claude"

Write-Host "=== 覚醒モード Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: 覚醒スキルをユーザー階層に登録
Write-Host "[1/2] awakening スキルをユーザー階層に登録..." -ForegroundColor Green
$skillsBase = Join-Path $ClaudeDir "skills"
if (-not (Test-Path $skillsBase)) {
    New-Item -ItemType Directory -Path $skillsBase -Force | Out-Null
}
Copy-Item -Path (Join-Path $RepoRoot "skills\awakening") -Destination $skillsBase -Recurse -Force
Write-Host "  配置: $skillsBase\awakening"

# Step 2: 常駐ポリシーをユーザー共通 CLAUDE.md に追記（重複追記はしない）
Write-Host "[2/2] 常駐ポリシーを $ClaudeDir\CLAUDE.md に追記..." -ForegroundColor Green
$policySrc = Join-Path $RepoRoot "templates\global-CLAUDE.md.template"
$claudeMd = Join-Path $ClaudeDir "CLAUDE.md"
$marker = "Personal Claude Code Operating Policy（覚醒モード）"

$policy = Get-Content $policySrc -Raw
if ((Test-Path $claudeMd) -and ((Get-Content $claudeMd -Raw) -match [regex]::Escape($marker))) {
    Write-Host "  既に導入済みのためスキップ: $claudeMd"
} else {
    if (Test-Path $claudeMd) {
        Add-Content -Path $claudeMd -Value "`n---`n" -Encoding UTF8
        Add-Content -Path $claudeMd -Value $policy -Encoding UTF8
        Write-Host "  追記: $claudeMd"
    } else {
        if (-not (Test-Path $ClaudeDir)) {
            New-Item -ItemType Directory -Path $ClaudeDir -Force | Out-Null
        }
        Set-Content -Path $claudeMd -Value $policy -Encoding UTF8
        Write-Host "  新規作成: $claudeMd"
    }
}

Write-Host ""
Write-Host "=== 覚醒モード導入完了 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "動作確認:" -ForegroundColor Yellow
Write-Host "  1. 任意のプロジェクトで Claude Code を起動"
Write-Host "  2. 「覚醒」と入力 → 覚醒手順が発動すればOK"
Write-Host "  3. 複雑なタスクを依頼 → 自動でブリーフィングが提示されればOK"
Write-Host ""
