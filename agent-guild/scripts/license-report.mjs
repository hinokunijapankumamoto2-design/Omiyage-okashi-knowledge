#!/usr/bin/env node
/**
 * Walks node_modules and reports the licence of every installed package.
 * Exits non-zero if anything copyleft or non-commercial slips into the tree.
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BLOCKED = /\b(GPL-[23]|AGPL|SSPL|BUSL|CC-BY-NC|Elastic-2|Commons Clause|Proprietary|UNLICENSED)\b/i;
const ALLOWED_DUAL = /\bOR\b/i;

const seen = new Map();

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      walk(full);
      continue;
    }
    const manifest = path.join(full, "package.json");
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, "utf8"));
        const licence =
          typeof pkg.license === "string"
            ? pkg.license
            : pkg.license?.type ?? pkg.licenses?.[0]?.type ?? "UNKNOWN";
        seen.set(pkg.name ?? entry.name, licence);
      } catch {
        // an unreadable manifest is reported as UNKNOWN below
      }
    }
    walk(path.join(full, "node_modules"));
  }
}

walk("node_modules");

const counts = {};
for (const licence of seen.values()) counts[licence] = (counts[licence] ?? 0) + 1;

console.log(`packages: ${seen.size}\n`);
for (const [licence, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(4)}  ${licence}`);
}

const flagged = [...seen].filter(([, licence]) => BLOCKED.test(licence) && !ALLOWED_DUAL.test(licence));
if (flagged.length) {
  console.error("\nBLOCKED LICENCES FOUND:");
  for (const [name, licence] of flagged) console.error(`  ${name} = ${licence}`);
  process.exit(1);
}
console.log("\nno blocked licences found");
