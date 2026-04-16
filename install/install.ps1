# install.ps1 - Omiyage-okashi-knowledge セットアップスクリプト (Windows)
#
# 使い方:
#   PowerShell を管理者で開き、本リポジトリのルートで実行:
#   .\install\install.ps1 -VaultPath "C:\Users\xxx\Documents\OmiyageVault"

param(
    [Parameter(Mandatory=$true)]
    [string]$VaultPath,

    [string]$Language = "ja"
)

$ErrorActionPreference = "Stop"
$Today = Get-Date -Format "yyyy-MM-dd"
$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== Omiyage-okashi-knowledge Setup ===" -ForegroundColor Cyan
Write-Host "Vault Path: $VaultPath"
Write-Host "Language:   $Language"
Write-Host ""

# Step 1: Vault フォルダ作成
Write-Host "[1/6] Vault フォルダを作成..." -ForegroundColor Green
@("raw", "wiki", "outputs") | ForEach-Object {
    $dir = Join-Path $VaultPath $_
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  作成: $dir"
    } else {
        Write-Host "  既存: $dir (スキップ)"
    }
}

# Step 2: CLAUDE.md 配置
Write-Host "[2/6] CLAUDE.md を配置..." -ForegroundColor Green
$claudeMdSrc = Join-Path $RepoRoot "templates\CLAUDE.md.template"
$claudeMdDst = Join-Path $VaultPath "CLAUDE.md"
$content = Get-Content $claudeMdSrc -Raw
$langFull = if ($Language -eq "ja") { "日本語" } else { "English" }
$content = $content -replace "\{\{VAULT_PATH\}\}", $VaultPath
$content = $content -replace "\{\{LANGUAGE\}\}", $langFull
Set-Content -Path $claudeMdDst -Value $content -Encoding UTF8
Write-Host "  配置: $claudeMdDst"

# Step 3: mistakes.md 配置
Write-Host "[3/6] mistakes.md を配置..." -ForegroundColor Green
$mistakesSrc = Join-Path $RepoRoot "templates\mistakes.md.template"
$mistakesDst = Join-Path $VaultPath "mistakes.md"
$content = Get-Content $mistakesSrc -Raw
$content = $content -replace "\{\{CREATED_DATE\}\}", $Today
Set-Content -Path $mistakesDst -Value $content -Encoding UTF8
Write-Host "  配置: $mistakesDst"

# Step 4: INDEX.md 配置
Write-Host "[4/6] wiki/INDEX.md を配置..." -ForegroundColor Green
$indexSrc = Join-Path $RepoRoot "templates\INDEX.md.template"
$indexDst = Join-Path $VaultPath "wiki\INDEX.md"
Copy-Item $indexSrc $indexDst -Force
Write-Host "  配置: $indexDst"

# Step 5: スキル登録
Write-Host "[5/6] スキルをユーザー階層に登録..." -ForegroundColor Green
$skillsBase = "$env:USERPROFILE\.claude\skills"
if (-not (Test-Path $skillsBase)) {
    New-Item -ItemType Directory -Path $skillsBase -Force | Out-Null
}
Copy-Item -Path (Join-Path $RepoRoot "skills\second-brain") -Destination $skillsBase -Recurse -Force
Copy-Item -Path (Join-Path $RepoRoot "skills\reflection-notes") -Destination $skillsBase -Recurse -Force
Write-Host "  配置: $skillsBase\second-brain"
Write-Host "  配置: $skillsBase\reflection-notes"

# Step 6: knowledge-config.json 作成
Write-Host "[6/6] 設定ファイルを作成..." -ForegroundColor Green
$configPath = "$env:USERPROFILE\.claude\knowledge-config.json"
$config = @{
    vault_path = $VaultPath
    language = $Language
    created_at = $Today
} | ConvertTo-Json -Depth 5
Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Host "  作成: $configPath"

Write-Host ""
Write-Host "=== セットアップ完了 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "  1. $env:USERPROFILE\.claude\settings.json に Stop Hook を追加"
Write-Host "     (templates\settings.json.template を参考に、既存設定とマージ)"
Write-Host "  2. Obsidian を起動し、Vault として開く: $VaultPath"
Write-Host "  3. Claude Code を起動し、/second-brain を実行"
Write-Host ""
