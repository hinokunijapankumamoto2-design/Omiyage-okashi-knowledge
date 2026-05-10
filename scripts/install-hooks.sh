#!/usr/bin/env bash
# .git/hooks/pre-commit を scripts/pre-commit-no-secrets.sh にリンクする。
# 一度だけリポジトリルートで実行: bash scripts/install-hooks.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_TARGET="$REPO_ROOT/.git/hooks/pre-commit"
HOOK_SRC="$REPO_ROOT/scripts/pre-commit-no-secrets.sh"

chmod +x "$HOOK_SRC"

if [ -e "$HOOK_TARGET" ] && [ ! -L "$HOOK_TARGET" ]; then
  echo "[install-hooks] 既存の $HOOK_TARGET を $HOOK_TARGET.bak に退避します"
  mv "$HOOK_TARGET" "$HOOK_TARGET.bak"
fi

ln -sf "$HOOK_SRC" "$HOOK_TARGET"
echo "[install-hooks] pre-commit を有効化しました: $HOOK_TARGET -> $HOOK_SRC"
