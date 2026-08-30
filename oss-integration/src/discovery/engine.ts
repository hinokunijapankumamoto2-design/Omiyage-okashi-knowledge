import type { RepositoryProfile } from '../types.js';
import { analyzeRepository, loadOssRegistry, type AnalyzerOptions } from '../repository/analyzer.js';

/**
 * Global Discovery Engine.
 *
 * Given the capabilities a goal still lacks, find candidate repositories that
 * claim to supply them.
 *
 * v0.1 searches the seed registry (data/oss-registry.json), whose entries were
 * read from public repository pages on a recorded date. With `--live` it also
 * queries the GitHub search API. It does not maintain a crawl or an index -
 * rule 43 puts a massive GitHub index out of scope for this version.
 */

export interface DiscoveryHit {
  repositoryId: string;
  capabilityId: string;
  isPrimary: boolean;
  via: 'registry' | 'live-search';
}

export interface DiscoveryResult {
  hits: DiscoveryHit[];
  profiles: RepositoryProfile[];
  /** Capabilities no candidate was found for. Reported, never quietly dropped. */
  stillMissing: string[];
  notes: string[];
}

export interface DiscoveryOptions extends AnalyzerOptions {
  /** Repository ids already under consideration, so we do not re-suggest them. */
  exclude?: string[];
  maxPerCapability?: number;
}

export async function discoverForCapabilities(
  missing: string[],
  opts: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const exclude = new Set(opts.exclude ?? []);
  const maxPer = opts.maxPerCapability ?? 3;
  const registry = loadOssRegistry();
  const notes: string[] = [
    `Registry seeded ${registry.researchDate}: ${registry.researchMethod}`,
  ];

  const hits: DiscoveryHit[] = [];
  const stillMissing: string[] = [];

  for (const capabilityId of missing) {
    const primary = registry.entries.filter((e) => e.primaryCapability === capabilityId && !exclude.has(e.id));
    const secondary = registry.entries.filter(
      (e) => e.secondaryCapabilities.includes(capabilityId) && !exclude.has(e.id),
    );
    const chosen = [
      ...primary.map((e) => ({ e, isPrimary: true })),
      ...secondary.map((e) => ({ e, isPrimary: false })),
    ].slice(0, maxPer);

    if (chosen.length === 0) {
      stillMissing.push(capabilityId);
      continue;
    }
    for (const { e, isPrimary } of chosen) {
      hits.push({ repositoryId: e.id, capabilityId, isPrimary, via: 'registry' });
    }
  }

  if (opts.live && stillMissing.length > 0) {
    for (const capabilityId of [...stillMissing]) {
      const found = await searchLive(capabilityId, opts);
      if (found.length > 0) {
        for (const id of found.slice(0, maxPer)) {
          hits.push({ repositoryId: id, capabilityId, isPrimary: false, via: 'live-search' });
        }
        stillMissing.splice(stillMissing.indexOf(capabilityId), 1);
        notes.push(`Live npm-registry search supplied candidates for "${capabilityId}"; their capability mapping is UNKNOWN because nothing curated it.`);
      }
    }
  } else if (stillMissing.length > 0) {
    notes.push(
      'Live GitHub search was not enabled, so discovery was limited to the seed registry. Missing capabilities below are "not found in the seed registry", not "do not exist".',
    );
  }

  const ids = [...new Set(hits.map((h) => h.repositoryId))];
  const profiles = await Promise.all(ids.map((id) => analyzeRepository(id, opts)));

  return { hits, profiles, stillMissing, notes };
}

/**
 * Live discovery.
 *
 * The GitHub search API is not reachable from every network this runs on (it
 * is blocked in this project's sandbox), so live discovery searches the npm
 * registry instead and maps hits back to their GitHub repository. A capability
 * that neither the seed registry nor this search can supply stays MISSING -
 * it is never filled with a guess.
 */
async function searchLive(capabilityId: string, opts: DiscoveryOptions): Promise<string[]> {
  const text = capabilityId.replace(/-/g, ' ');
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=5`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'oss-integration/0.1 (+discovery)' },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      objects?: { package?: { links?: { repository?: string } } }[];
    };
    const ids: string[] = [];
    for (const o of json.objects ?? []) {
      const repo = o.package?.links?.repository;
      const m = repo ? /github\.com\/([^/]+)\/([^/#?]+)/i.exec(repo) : null;
      if (m && m[1] && m[2]) ids.push(`${m[1]}/${m[2].replace(/\.git$/, '')}`);
    }
    return [...new Set(ids)];
  } catch {
    return [];
  }
}
