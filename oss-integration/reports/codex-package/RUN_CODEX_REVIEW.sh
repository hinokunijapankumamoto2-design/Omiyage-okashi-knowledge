#!/usr/bin/env bash
#
# Runs the four independent Codex reviews and writes them to reports/codex-results/.
#
# READ-ONLY with respect to the project: it does not build, install, modify any
# tracked file, or change global environment. It writes only into
# reports/codex-results/.
#
# Authentication is EXTERNAL by design. This script never reads, writes, prints
# or stores a credential, and never falls back to an API key on its own. Log in
# beforehand with `codex login`, or if you prefer a key:
#   printenv OPENAI_API_KEY | codex login --with-api-key

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/reports/codex-results"
cd "$ROOT"

# --- pre-flight ------------------------------------------------------------
if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: CODEX_CONNECTION_UNAVAILABLE" >&2
  echo "  codex CLI not found. Install with: npm install -g @openai/codex" >&2
  exit 2
fi

CODEX_VERSION="$(codex --version 2>&1 || echo unknown)"
echo "codex: $CODEX_VERSION"

LOGIN_STATUS="$(codex login status 2>&1 || true)"
if printf '%s' "$LOGIN_STATUS" | grep -qi "not logged in"; then
  echo "ERROR: CODEX_NOT_AUTHENTICATED" >&2
  echo "  codex login status reported: $LOGIN_STATUS" >&2
  echo "  Run 'codex login' first. This script will not fall back to an API key." >&2
  exit 3
fi
echo "$LOGIN_STATUS"

mkdir -p "$OUT"

BASELINE_SHA="$(node -e "process.stdout.write(require('$HERE/BASELINE.json').BASELINE_GIT_COMMIT)" 2>/dev/null || echo unknown)"
CURRENT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
if [ "$BASELINE_SHA" != "unknown" ] && [ "$CURRENT_SHA" != "$BASELINE_SHA" ]; then
  echo "WARNING: working tree is at $CURRENT_SHA but the review package was built for $BASELINE_SHA." >&2
  echo "         Findings will be recorded against the CURRENT commit." >&2
fi

# --- reviews ---------------------------------------------------------------
FAILED=0
run_review () {
  local name="$1" prompt_file="$2"
  echo
  echo "=== $name ==="
  # --skip-git-repo-check so the review also works from an exported copy.
  if codex exec --skip-git-repo-check "$(cat "$HERE/$prompt_file")" > "$OUT/$name.md" 2>&1; then
    echo "  wrote $OUT/$name.md"
  else
    echo "  FAILED - transcript (including the error) kept at $OUT/$name.md" >&2
    FAILED=$((FAILED + 1))
  fi
}

run_review standard-review                     REVIEW_BRIEF.md
run_review adversarial-review                  PROMPT_ADVERSARIAL.md
run_review benchmark-audit                     PROMPT_BENCHMARK_AUDIT.md
run_review security-license-provenance-audit   PROMPT_SEC_LIC_PROV.md

# --- run metadata (never contains a credential) ----------------------------
TREE_HASH="$(git ls-files -s src data schemas tests package.json tsconfig.json 2>/dev/null | sha256sum | cut -d' ' -f1 || echo unknown)"
cat > "$OUT/RUN_METADATA.json" <<META
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$CURRENT_SHA",
  "baseline_git_commit": "$BASELINE_SHA",
  "codex_version": "$CODEX_VERSION",
  "review_package_version": "1.0.0",
  "benchmark_policy_version": "v0.1.1",
  "source_tree_hash": "$TREE_HASH",
  "runner": "RUN_CODEX_REVIEW.sh",
  "reviews_failed": $FAILED
}
META
echo
echo "wrote $OUT/RUN_METADATA.json"
echo "Four transcripts in reports/codex-results/."
echo "Next: node reports/codex-package/import-codex-results.mjs, then return"
echo "CODEX_REVIEW_REPORT.md to Claude Code. Every finding must be independently"
echo "reproduced and classified before any fix - Codex can be wrong too."
[ "$FAILED" -eq 0 ] || exit 1
