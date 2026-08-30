#!/usr/bin/env node
// Canonical content hasher for the Codex review baseline gate.
//
// ONE implementation, called by both RUN_CODEX_REVIEW.sh and .ps1, so the two
// runners cannot drift: cross-platform parity is structural, not asserted.
//
// Canonicalization rules (fixed - changing any of these changes every hash):
//   1. Paths are repo-relative, POSIX separators, UTF-8.
//   2. Paths sorted by their UTF-8 bytes (not locale collation).
//   3. File bytes hashed exactly as stored - no line-ending translation,
//      no encoding conversion, no trailing-newline normalisation.
//   4. No timestamps, permissions, ownership, inode or other fs metadata.
//   5. Per-file line: "<sha256-hex>  <path>\n"; tree hash = sha256 of the
//      concatenation of those lines, UTF-8.
//   6. Excluded files are dropped BEFORE sorting, so exclusion cannot depend
//      on ordering.
//
// Usage: node hash-manifest.mjs <source|package|both> [--json]

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');

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

const toPosix = (p) => p.split(sep).join('/');

function walk (abs, out) {
  if (!existsSync(abs)) return out;
  const st = statSync(abs);
  if (st.isFile()) { out.push(abs); return out; }
  if (!st.isDirectory()) return out;
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.git') continue;
    walk(join(abs, name), out);
  }
  return out;
}

export function hashTree (roots) {
  const files = [];
  for (const r of roots) walk(join(ROOT, r), files);

  const entries = files
    .map((abs) => ({ path: toPosix(relative(ROOT, abs)), abs }))
    .filter((e) => !EXCLUDED.includes(e.path));

  // Sort by UTF-8 bytes, never by locale.
  entries.sort((a, b) => Buffer.from(a.path, 'utf8').compare(Buffer.from(b.path, 'utf8')));

  const lines = entries.map((e) => {
    const digest = createHash('sha256').update(readFileSync(e.abs)).digest('hex');
    return `${digest}  ${e.path}\n`;
  });

  return {
    hash: createHash('sha256').update(Buffer.from(lines.join(''), 'utf8')).digest('hex'),
    files: entries.map((e) => e.path),
    count: entries.length,
  };
}

const entry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (entry) {
  const what = process.argv[2] || 'both';
  const asJson = process.argv.includes('--json');
  const source = hashTree(SOURCE_PATHS);
  const pkg = hashTree(PACKAGE_PATHS);
  if (asJson) {
    process.stdout.write(JSON.stringify({
      source_content_hash: source.hash,
      source_file_count: source.count,
      review_package_content_hash: pkg.hash,
      review_package_file_count: pkg.count,
      review_package_files: pkg.files,
      excluded_files: EXCLUDED,
      hash_algorithm: 'SHA-256',
    }, null, 2) + '\n');
  } else if (what === 'source') process.stdout.write(source.hash);
  else if (what === 'package') process.stdout.write(pkg.hash);
  else process.stdout.write(`${source.hash}\n${pkg.hash}\n`);
}
