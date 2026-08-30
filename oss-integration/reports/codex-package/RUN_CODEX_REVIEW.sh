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
BASELINE_MISMATCH=false
if [ "$BASELINE_SHA" != "unknown" ] && [ "$CURRENT_SHA" != "$BASELINE_SHA" ]; then
  BASELINE_MISMATCH=true
  echo "WARNING: BASELINE_MISMATCH" >&2
  echo "         working tree is at $CURRENT_SHA; package was built for $BASELINE_SHA." >&2
  echo "         Findings are recorded against the CURRENT commit and must be" >&2
  echo "         diffed against the baseline before being acted on." >&2
fi

# --- reviews ---------------------------------------------------------------
# Every review starts NOT_RUN and only becomes PASS on a clean exit, so an
# interrupted run can never be mistaken for a complete one.
STATUS_standard=NOT_RUN
STATUS_adversarial=NOT_RUN
STATUS_benchmark=NOT_RUN
STATUS_seclicprov=NOT_RUN
FAILED=0

run_review () {
  local key="$1" name="$2" prompt_file="$3"
  echo
  echo "=== $name ==="
  # --skip-git-repo-check so the review also works from an exported copy.
  if codex exec --skip-git-repo-check "$(cat "$HERE/$prompt_file")" > "$OUT/$name.md" 2>&1; then
    printf -v "STATUS_$key" PASS
    echo "  wrote $OUT/$name.md"
  else
    printf -v "STATUS_$key" FAILED
    FAILED=$((FAILED + 1))
    # Mark the transcript itself, so a partial result is never read as a
    # finished review by someone opening the file directly.
    { echo "<!-- STATUS: INCOMPLETE - this review did not finish. Do not read it as a completed review. -->";
      echo; cat "$OUT/$name.md"; } > "$OUT/$name.md.tmp" && mv "$OUT/$name.md.tmp" "$OUT/$name.md"
    echo "  FAILED - transcript marked INCOMPLETE at $OUT/$name.md" >&2
  fi
}

run_review standard    standard-review                     REVIEW_BRIEF.md
run_review adversarial adversarial-review                  PROMPT_ADVERSARIAL.md
run_review benchmark   benchmark-audit                     PROMPT_BENCHMARK_AUDIT.md
run_review seclicprov  security-license-provenance-audit   PROMPT_SEC_LIC_PROV.md

# --- run metadata (never contains a credential) ----------------------------
TREE_HASH="$(git ls-files -s src data schemas tests package.json tsconfig.json 2>/dev/null | sha256sum | cut -d' ' -f1 || echo unknown)"
OVERALL=COMPLETE
[ "$FAILED" -eq 0 ] || OVERALL=INCOMPLETE
cat > "$OUT/RUN_METADATA.json" <<META
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "$OVERALL",
  "git_commit": "$CURRENT_SHA",
  "baseline_git_commit": "$BASELINE_SHA",
  "baseline_mismatch": $BASELINE_MISMATCH,
  "codex_version": "$CODEX_VERSION",
  "review_package_version": "1.0.0",
  "benchmark_policy_version": "v0.1.1",
  "source_tree_hash": "$TREE_HASH",
  "runner_type": "bash",
  "runner": "RUN_CODEX_REVIEW.sh",
  "platform": "$(uname -s) $(uname -r) $(uname -m)",
  "reviews": {
    "standard": "$STATUS_standard",
    "adversarial": "$STATUS_adversarial",
    "benchmark": "$STATUS_benchmark",
    "security_license_provenance": "$STATUS_seclicprov"
  },
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
