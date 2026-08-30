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

# --- GATE 1: baseline (content-addressed) -----------------------------------
# Integrity is proved by CONTENT, not by a commit SHA and not by a tag.
#   - A commit cannot contain its own SHA, so a recorded SHA is self-referential.
#   - Tag pushes are rejected by repository permissions, so a tag cannot be
#     required: a fresh clone would fail through no fault of its own.
# Both hashes come from hash-manifest.mjs - ONE implementation shared with the
# PowerShell runner, so the two cannot drift. A failure here is a hard stop.
MANIFEST="$HERE/REVIEW_PACKAGE_MANIFEST.json"
if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - MANIFEST_MISSING" >&2
  echo "  expected $MANIFEST" >&2
  exit 4
fi
m_field () { node -e "process.stdout.write(String(require('$MANIFEST')$1))" 2>/dev/null || true; }
SOURCE_BASELINE_SHA="$(m_field .source_baseline_commit)"
EXPECTED_SRC_HASH="$(m_field .source_baseline_content_hash)"
EXPECTED_PKG_HASH="$(m_field .review_package_content_hash)"

SRC_HASH="$(node "$HERE/hash-manifest.mjs" source 2>/dev/null || true)"
PKG_HASH="$(node "$HERE/hash-manifest.mjs" package 2>/dev/null || true)"

CURRENT_SHA="$(git rev-parse --verify --quiet HEAD 2>/dev/null || true)"
[ -n "$CURRENT_SHA" ] || CURRENT_SHA=unknown

# Optional provenance signal only. Its absence NEVER fails the gate.
REVIEW_PACKAGE_TAG="$(m_field .review_package_tag)"
TAG_SHA=""
[ -n "$REVIEW_PACKAGE_TAG" ] && TAG_SHA="$(git rev-parse --verify --quiet "$REVIEW_PACKAGE_TAG^{commit}" 2>/dev/null || true)"
if [ -z "$TAG_SHA" ]; then TAG_STATE=ABSENT
elif [ "$TAG_SHA" = "$CURRENT_SHA" ]; then TAG_STATE=PRESENT_MATCHES_HEAD
else TAG_STATE=PRESENT_DIFFERENT_COMMIT; fi

BASELINE_GATE=FAIL
if [ -z "$EXPECTED_SRC_HASH" ] || [ -z "$EXPECTED_PKG_HASH" ] || [ -z "$SOURCE_BASELINE_SHA" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - INCOMPLETE_MANIFEST" >&2
  echo "  REVIEW_PACKAGE_MANIFEST.json is missing source_baseline_commit /" >&2
  echo "  source_baseline_content_hash / review_package_content_hash." >&2
  echo "  Refusing to guess." >&2
  exit 4
fi
if [ -z "$SRC_HASH" ] || [ -z "$PKG_HASH" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - HASH_COMPUTATION_FAILED" >&2
  echo "  hash-manifest.mjs produced no output. Node.js is required." >&2
  exit 4
fi
if [ "$SRC_HASH" != "$EXPECTED_SRC_HASH" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - SOURCE_TREE_MISMATCH" >&2
  echo "  product source hash   $SRC_HASH" >&2
  echo "  frozen at $SOURCE_BASELINE_SHA  $EXPECTED_SRC_HASH" >&2
  echo "  Product code differs from the frozen v0.1 baseline - committed or not." >&2
  echo "  Findings would not apply to the released product. Not a warning." >&2
  exit 4
fi
if [ "$PKG_HASH" != "$EXPECTED_PKG_HASH" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_CONTENT_MISMATCH" >&2
  echo "  review package hash   $PKG_HASH" >&2
  echo "  recorded              $EXPECTED_PKG_HASH" >&2
  echo "  The evidence Codex would read is not the evidence that was locked." >&2
  exit 4
fi
BASELINE_GATE=PASS
echo "GATE 1 baseline: PASS"
echo "  source baseline   $SOURCE_BASELINE_SHA"
echo "  source content    $SRC_HASH"
echo "  package content   $PKG_HASH"
echo "  HEAD              $CURRENT_SHA (provenance only)"
echo "  tag               $TAG_STATE (optional provenance signal)"

# --- GATE 2: Codex host -----------------------------------------------------
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
echo "GATE 2 codex host: PASS"

# --- GATE 3: review package -------------------------------------------------
MISSING=""
for f in REVIEW_BRIEF.md PROMPT_ADVERSARIAL.md PROMPT_BENCHMARK_AUDIT.md \
         PROMPT_SEC_LIC_PROV.md FINDING_SCHEMA.md POST_CODEX_INSTRUCTIONS.md \
         evidence/claims-to-audit.md evidence/evidence-classification.md \
         evidence/benchmark-evidence.md evidence/security-evidence.md \
         evidence/license-evidence.md evidence/provenance-evidence.md; do
  [ -f "$HERE/$f" ] || MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
  echo "ERROR: REVIEW_PACKAGE_INCOMPLETE" >&2
  for f in $MISSING; do echo "  missing: $f" >&2; done
  exit 5
fi
echo "GATE 3 review package: PASS"

mkdir -p "$OUT"

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
OVERALL=COMPLETE
[ "$FAILED" -eq 0 ] || OVERALL=INCOMPLETE
cat > "$OUT/RUN_METADATA.json" <<META
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "$OVERALL",
  "git_commit": "$CURRENT_SHA",
  "source_baseline_commit": "$SOURCE_BASELINE_SHA",
  "source_content_hash": "$SRC_HASH",
  "review_package_content_hash": "$PKG_HASH",
  "review_package_tag_state": "$TAG_STATE",
  "baseline_gate": "$BASELINE_GATE",
  "codex_version": "$CODEX_VERSION",
  "review_package_version": "1.1.0",
  "benchmark_policy_version": "v0.1.1",
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
