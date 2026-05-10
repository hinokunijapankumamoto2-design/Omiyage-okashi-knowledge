#!/usr/bin/env bash
# pre-commit hook: 鍵ファイル / 鍵らしき値の誤コミットを止める
# 設置: scripts/install-hooks.sh で .git/hooks/pre-commit へリンクされる
set -euo pipefail

# 1. .env そのものを止める（複数ブランチでgitignoreが緩い事故対策）
if git diff --cached --name-only | grep -E '(^|/)\.env$' >/dev/null; then
  echo "[pre-commit] .env をコミットしようとしています。中止します。" >&2
  exit 1
fi

# 2. ステージ済みファイル中の AMIVOICE_APPKEY=<実値> 検出
#    .env.example の空値（AMIVOICE_APPKEY=）は許可
staged=$(git diff --cached --name-only --diff-filter=AM)
fail=0
for f in $staged; do
  [ -f "$f" ] || continue
  case "$f" in
    *.env.example) continue ;;
  esac
  if git diff --cached -- "$f" | grep -E '^\+.*AMIVOICE_APPKEY=[^[:space:]<]' | grep -v 'AMIVOICE_APPKEY=$' >/dev/null; then
    echo "[pre-commit] $f に APPKEY 実値の追加を検出しました。" >&2
    fail=1
  fi
  # 3. JWT/長い英数字トークンの検出（保険）
  if git diff --cached -- "$f" | grep -E '^\+.*[A-Za-z0-9_-]{40,}' | grep -iE '(appkey|api[_-]?key|token|secret)' >/dev/null; then
    echo "[pre-commit] $f に鍵らしき長い文字列を検出しました。" >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "[pre-commit] 鍵を含む可能性があるためコミットを止めました。修正後に再実行してください。" >&2
  echo "             誤検知の場合は --no-verify ではなくパターンを見直してください。" >&2
  exit 1
fi

exit 0
