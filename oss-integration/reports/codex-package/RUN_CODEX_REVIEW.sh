#!/usr/bin/env bash
#
# Runs the four independent Codex reviews and writes them to reports/codex-results/.
#
# Authentication is EXTERNAL by design. This script never reads, writes, prints
# or stores a credential. Log in beforehand with `codex login` (ChatGPT
# subscription) or `printenv OPENAI_API_KEY | codex login --with-api-key`.
#
# It is read-only with respect to the project: it does not build, install,
# modify tracked files, or change global environment.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/reports/codex-results"
cd "$ROOT"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found. Install with: npm install -g @openai/codex" >&2
  exit 1
fi

echo "codex: $(codex --version)"
if ! codex login status >/dev/null 2>&1 || codex login status 2>&1 | grep -qi "not logged in"; then
  echo "Not logged in. Run 'codex login' first (no credential is stored by this script)." >&2
  exit 1
fi
codex login status

mkdir -p "$OUT"

run_review () {
  local name="$1" prompt_file="$2"
  echo
  echo "=== $name ==="
  # --skip-git-repo-check so the review also works from an exported copy.
  if codex exec --skip-git-repo-check "$(cat "$HERE/$prompt_file")" > "$OUT/$name.md" 2>&1; then
    echo "  wrote $OUT/$name.md"
  else
    echo "  FAILED — transcript (including the error) kept at $OUT/$name.md" >&2
  fi
}

run_review standard-review                     REVIEW_BRIEF.md
run_review adversarial-review                  PROMPT_ADVERSARIAL.md
run_review benchmark-audit                     PROMPT_BENCHMARK_AUDIT.md
run_review security-license-provenance-audit   PROMPT_SEC_LIC_PROV.md

echo
echo "Four transcripts in reports/codex-results/."
echo "Next: return them to Claude Code. Every finding must be independently"
echo "reproduced and classified before any fix — Codex can be wrong too."
