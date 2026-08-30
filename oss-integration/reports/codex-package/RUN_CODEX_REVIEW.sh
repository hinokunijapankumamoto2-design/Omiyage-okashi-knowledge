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

# --- GATE 1: baseline -------------------------------------------------------
# TWO checks, both required. HEAD must be the review-package commit, AND the
# product source tree must still hash to what it hashed at the frozen product
# baseline. Neither alone is sufficient: matching HEAD says nothing about the
# source, and a matching hash says nothing about which evidence Codex will read.
# A failure here is a hard stop, never a warning.
jq_field () { node -e "process.stdout.write(String(require('$HERE/BASELINE.json')$1))" 2>/dev/null || echo unknown; }
SOURCE_BASELINE_SHA="$(jq_field .source_baseline_commit)"
REVIEW_PACKAGE_TAG="$(jq_field .review_package_tag)"
EXPECTED_TREE_HASH="$(jq_field .source_tree_hashes.working_tree_content.value)"
EXPECTED_PKG_HASH="$(jq_field .review_package_content_hash)"
CURRENT_SHA="$(git rev-parse --verify --quiet HEAD 2>/dev/null || true)"
[ -n "$CURRENT_SHA" ] || CURRENT_SHA=unknown
# Hash file CONTENT, not the index: 'git ls-files -s' reports staged blobs, so an
# uncommitted edit to product source would slip past the gate unnoticed.
TREE_HASH="$(git ls-files -z src data schemas tests package.json tsconfig.json 2>/dev/null | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1 || echo unknown)"
PKG_HASH="$(cd "$HERE" && find . -type f ! -name BASELINE.json | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -d' ' -f1 || echo unknown)"
# The expected review-package commit comes from the tag when the clone has it,
# otherwise from an explicit operator assertion. A commit cannot contain its own
# SHA, so it cannot be recorded in BASELINE.json. If neither source is available
# the gate FAILS - it never falls through to "whatever HEAD happens to be".
REVIEW_PACKAGE_SHA="$(git rev-parse --verify --quiet "$REVIEW_PACKAGE_TAG^{commit}" 2>/dev/null || true)"
[ -n "$REVIEW_PACKAGE_SHA" ] || REVIEW_PACKAGE_SHA=unknown
REVIEW_PACKAGE_SOURCE=tag
if [ "$REVIEW_PACKAGE_SHA" = unknown ] && [ -n "${CODEX_REVIEW_PACKAGE_COMMIT:-}" ]; then
  REVIEW_PACKAGE_SHA="$(git rev-parse --verify --quiet "${CODEX_REVIEW_PACKAGE_COMMIT}^{commit}" 2>/dev/null || true)"
  [ -n "$REVIEW_PACKAGE_SHA" ] || REVIEW_PACKAGE_SHA=unknown
  REVIEW_PACKAGE_SOURCE=env
fi

BASELINE_GATE=FAIL
if [ "$SOURCE_BASELINE_SHA" = unknown ] || [ "$REVIEW_PACKAGE_TAG" = unknown ] || \
   [ "$EXPECTED_TREE_HASH" = unknown ] || [ "$EXPECTED_PKG_HASH" = unknown ]; then
  echo "ERROR: BASELINE_GATE_FAILED - INCOMPLETE_LOCK" >&2
  echo "  BASELINE.json is missing source_baseline_commit / review_package_tag /" >&2
  echo "  source_tree_hashes.working_tree_content.value / review_package_content_hash." >&2
  echo "  Refusing to guess." >&2
  exit 4
fi
if [ "$REVIEW_PACKAGE_SHA" = unknown ]; then
  echo "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_TAG_MISSING" >&2
  echo "  tag not found in this clone: $REVIEW_PACKAGE_TAG" >&2
  echo "  Either fetch it:      git fetch --tags" >&2
  echo "  or create it locally: git tag $REVIEW_PACKAGE_TAG <commit>" >&2
  echo "  or assert it:         CODEX_REVIEW_PACKAGE_COMMIT=<commit> $0" >&2
  echo "  The commit you name must be the one you intend Codex to review." >&2
  exit 4
fi
if [ "$CURRENT_SHA" != "$REVIEW_PACKAGE_SHA" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - REVIEW_PACKAGE_MISMATCH" >&2
  echo "  HEAD                     $CURRENT_SHA" >&2
  echo "  $REVIEW_PACKAGE_TAG  $REVIEW_PACKAGE_SHA" >&2
  echo "  Check out the tagged review-package commit, or re-lock BASELINE.json" >&2
  echo "  deliberately. This script will not review a commit it was not built for." >&2
  exit 4
fi
if [ "$TREE_HASH" != "$EXPECTED_TREE_HASH" ]; then
  echo "ERROR: BASELINE_GATE_FAILED - SOURCE_TREE_MISMATCH" >&2
  echo "  product source hash   $TREE_HASH" >&2
  echo "  frozen at $SOURCE_BASELINE_SHA  $EXPECTED_TREE_HASH" >&2
  echo "  Product code differs from the frozen v0.1 baseline. Findings would not" >&2
  echo "  apply to the released product. Not a warning - stopping." >&2
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
echo "  source baseline   $SOURCE_BASELINE_SHA (product source hash matches)"
echo "  review package    $REVIEW_PACKAGE_SHA (= HEAD, via $REVIEW_PACKAGE_SOURCE $REVIEW_PACKAGE_TAG)"
echo "  package content   $PKG_HASH"

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
  "review_package_commit": "$REVIEW_PACKAGE_SHA",
  "review_package_tag": "$REVIEW_PACKAGE_TAG",
  "review_package_identity_source": "$REVIEW_PACKAGE_SOURCE",
  "review_package_content_hash": "$PKG_HASH",
  "baseline_gate": "$BASELINE_GATE",
  "codex_version": "$CODEX_VERSION",
  "review_package_version": "1.1.0",
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
