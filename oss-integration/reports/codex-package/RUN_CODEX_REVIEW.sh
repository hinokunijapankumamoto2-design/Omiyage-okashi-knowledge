#!/usr/bin/env bash
# Runs the four independent reviews once Codex has network access and auth.
#
# Prerequisites, both currently unmet in the sandbox this was authored in:
#   1. Egress to api.openai.com (or auth.openai.com for the ChatGPT flow)
#   2. Credentials — `codex login`, or `printenv OPENAI_API_KEY | codex login --with-api-key`
#
# Verify first:  codex login status
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="reports/codex-package/out"; mkdir -p "$OUT"

codex login status

run () { # name, prompt-file
  echo "=== $1 ==="
  codex exec --skip-git-repo-check "$(cat "reports/codex-package/$2")" > "$OUT/$1.md" 2>&1 || true
  echo "  -> $OUT/$1.md"
}

run standard      REVIEW_BRIEF.md
run adversarial   PROMPT_ADVERSARIAL.md
run benchmark     PROMPT_BENCHMARK_AUDIT.md
run sec-lic-prov  PROMPT_SEC_LIC_PROV.md

echo
echo "Four transcripts in $OUT. Every finding must then be independently"
echo "reproduced before any fix: Codex can be wrong too."
