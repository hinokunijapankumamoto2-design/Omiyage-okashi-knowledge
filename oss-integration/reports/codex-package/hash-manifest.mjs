#!/usr/bin/env node
// Canonical content hasher for the Codex review baseline gate.  MODEL v2.
//
// ONE implementation, called by both RUN_CODEX_REVIEW.sh and .ps1, so the two
// runners cannot drift.
//
// ---------------------------------------------------------------------------
// v1 -> v2: why the model changed
//
// v1 hashed RAW WORKING-TREE BYTES. That is not portable. This repository has
// no .gitattributes and sets no core.autocrlf, so Git for Windows applies its
// default core.autocrlf=true and checks text files out with CRLF, while Linux
// checks the same commit out with LF. Measured on the same commit:
//   src/types.ts   autocrlf=false 12009 bytes, 0 CRLF
//                  autocrlf=true  12455 bytes, 446 CRLF
// and the v1 source hash differed accordingly:
//   autocrlf=false 3da63a6b...fb56a6
//   autocrlf=true  a8debd75...9769ab
// So a Windows reviewer would have failed the gate on an untouched checkout.
//
// v2 hashes GIT-CANONICAL CONTENT instead: `git hash-object --path=<path>`
// applies the same clean filters and text attributes Git would apply when
// storing the file, yielding the blob id. That is identical on every platform
// for identical repository content, and it still changes for any real edit -
// including an unstaged one, because the working-tree file is what is hashed.
// A file marked -text or binary is NOT normalised, because Git does not
// normalise it either; the blob id is byte-exact for those.
//
// v1 is retained in REVIEW_PACKAGE_MANIFEST.json as a superseded record.
// ---------------------------------------------------------------------------
//
// Canonicalization rules (fixed - changing any of these changes every hash):
//   1. Paths are repo-relative, POSIX separators, UTF-8.
//   2. Paths sorted by their UTF-8 bytes (not locale collation).
//   3. Per-file value is the Git blob id of the working-tree file, computed
//      with `git hash-object --path=<path> -- <path>` so attributes apply.
//   4. No timestamps, permissions, ownership or other fs metadata.
//   5. Per-file line: "<blob-id>  <path>\n"; tree hash = sha256 of the
//      concatenation of those lines, UTF-8.
//   6. Excluded files are dropped BEFORE sorting.
//   7. Only files tracked by git are hashed, so an untracked stray file cannot
//      change the hash - file-set integrity is reported separately.
//
// Usage: node hash-manifest.mjs <source|package|both|fileset> [--json]
//   fileset -> prints one offending entry per line, empty output = clean

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');

export const MODEL_VERSION = 'v2';
export const HASH_INPUT = 'GIT_CANONICAL_CONTENT';

// Product source. Review documentation is excluded by construction.
export const SOURCE_PATHS = [
  'src', 'data', 'schemas', 'skills', 'tests', 'generated', 'examples',
  'benchmark', 'package.json', 'package-lock.json', 'tsconfig.json',
];

// Artifacts actually handed to Codex.
export const PACKAGE_PATHS = [
  'reports/codex-package',
  'reports/codex-results/README.md',
  'CODEX_HANDOFF_REPORT.md',
  'CODEX_REVIEW_REPORT.md',
  'FINAL_RELEASE_REPORT.md',
];

// Self-reference guard: a manifest cannot contain its own hash.
export const EXCLUDED = [
  'reports/codex-package/BASELINE.json',
  'reports/codex-package/REVIEW_PACKAGE_MANIFEST.json',
];

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

function trackedFiles (roots) {
  // -z keeps paths intact when they contain spaces or unusual bytes.
  const out = git(['ls-files', '-z', '--', ...roots]);
  return out.split('\0').filter(Boolean).map((p) => p.split(sep).join('/'));
}

export function hashTree (roots) {
  const paths = trackedFiles(roots)
    .filter((p) => !EXCLUDED.includes(p))
    .filter((p) => existsSync(join(ROOT, p)));

  paths.sort((a, b) => Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8')));

  const lines = paths.map((p) => {
    // --path applies this path's gitattributes/clean filters, so CRLF and LF
    // checkouts of identical repository content produce the same blob id.
    // execFile, not a shell, so no interpolation of the path.
    const blob = git(['hash-object', `--path=${p}`, '--', p]).trim();
    return `${blob}  ${p}\n`;
  });

  return {
    hash: createHash('sha256').update(Buffer.from(lines.join(''), 'utf8')).digest('hex'),
    files: paths,
    count: paths.length,
  };
}

// File-set integrity: tracked-but-missing, and untracked files sitting inside
// the scoped directories. Neither changes the hash, so both are reported.
export function fileSetIntegrity (roots) {
  const tracked = trackedFiles(roots).filter((p) => !EXCLUDED.includes(p));
  const missing = tracked.filter((p) => !existsSync(join(ROOT, p)));
  const untracked = git(['ls-files', '-z', '--others', '--exclude-standard', '--', ...roots])
    .split('\0').filter(Boolean).map((p) => p.split(sep).join('/'))
    .filter((p) => !EXCLUDED.includes(p));
  return { missing, untracked };
}

const entry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (entry) {
  const what = process.argv[2] || 'both';
  const source = hashTree(SOURCE_PATHS);
  const pkg = hashTree(PACKAGE_PATHS);
  if (process.argv.includes('--json') || what === 'files') {
    const si = fileSetIntegrity(SOURCE_PATHS);
    const pi = fileSetIntegrity(PACKAGE_PATHS);
    process.stdout.write(JSON.stringify({
      model_version: MODEL_VERSION,
      hash_input: HASH_INPUT,
      line_ending_sensitive: false,
      hash_algorithm: 'SHA-256 over git blob ids',
      source_content_hash: source.hash,
      source_file_count: source.count,
      review_package_content_hash: pkg.hash,
      review_package_file_count: pkg.count,
      review_package_files: pkg.files,
      excluded_files: EXCLUDED,
      file_set_integrity: {
        source_missing: si.missing,
        source_untracked: si.untracked,
        package_missing: pi.missing,
        package_untracked: pi.untracked,
      },
    }, null, 2) + '\n');
  } else if (what === 'fileset') {
    // One offending entry per line; empty output means clean. Both runners
    // consume this identically, so neither needs its own JSON parsing.
    const out = [];
    for (const [scope, roots] of [['source', SOURCE_PATHS], ['package', PACKAGE_PATHS]]) {
      const { missing, untracked } = fileSetIntegrity(roots);
      for (const p of missing) out.push(`${scope}_missing: ${p}`);
      for (const p of untracked) out.push(`${scope}_untracked: ${p}`);
    }
    process.stdout.write(out.length ? out.join('\n') + '\n' : '');
  } else if (what === 'source') process.stdout.write(source.hash);
  else if (what === 'package') process.stdout.write(pkg.hash);
  else process.stdout.write(`${source.hash}\n${pkg.hash}\n`);
}
