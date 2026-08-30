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
  via: 'registry' | 'github-search';
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
      const found = await searchGithub(capabilityId, opts);
      if (found.length > 0) {
        for (const id of found.slice(0, maxPer)) {
          hits.push({ repositoryId: id, capabilityId, isPrimary: false, via: 'github-search' });
        }
        stillMissing.splice(stillMissing.indexOf(capabilityId), 1);
        notes.push(`GitHub search supplied candidates for "${capabilityId}".`);
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

async function searchGithub(capabilityId: string, opts: DiscoveryOptions): Promise<string[]> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'oss-integration/0.1',
  };
  const token = opts.githubToken ?? process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const q = encodeURIComponent(`${capabilityId.replace(/-/g, ' ')} in:name,description,readme`);
  try {
    const res = await fetch(`https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=5`, { headers });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: { full_name: string }[] };
    return (json.items ?? []).map((i) => i.full_name);
  } catch {
    return [];
  }
}
