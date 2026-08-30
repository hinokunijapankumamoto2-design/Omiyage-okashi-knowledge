import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Evidence, EvidenceBasis, RepositoryProfile, SignalPresence } from '../types.js';
import { emptySurface } from '../types.js';
import { classifyEvidence } from '../evidence/engine.js';
import { dataPath, projectRoot, readJson } from '../util/io.js';

/**
 * Repository Analyzer.
 *
 * Resolution order for a repository reference:
 *   1. a local fixture   (deterministic, offline, used by the acceptance tests)
 *   2. the seed registry (discovery pointers read from public repo pages)
 *   3. the live GitHub API (only when explicitly enabled)
 *   4. an honest UNKNOWN stub
 *
 * Rule 9: a capability is never settled from the README alone. `inspected`
 * records which artifact kinds were actually available, and the evidence
 * engine grades the result from that list.
 */

export interface RegistryEntry {
  id: string;
  url: string;
  owner: string;
  name: string;
  kind: RepositoryProfile['kind'];
  description: string;
  licenseSpdx: string;
  licenseEvidenceBasis: EvidenceBasis[];
  latestRelease: string;
  lastMeaningfulUpdate: string;
  documentation: SignalPresence;
  tests: SignalPresence;
  stars: number | null;
  primaryCapability: string;
  secondaryCapabilities: string[];
  evidenceBasis: EvidenceBasis[];
  referenceOnlyByPolicy?: boolean;
  strength: string[];
  limitations: string[];
  dependencies: string[];
  runtime: string[];
  declaredTools?: string[];
  dataProvenance: string[];
}

interface OssRegistryFile {
  version: string;
  researchDate: string;
  researchMethod: string;
  entries: RegistryEntry[];
}

let registryCache: OssRegistryFile | null = null;

export function loadOssRegistry(): OssRegistryFile {
  if (!registryCache) registryCache = readJson<OssRegistryFile>(dataPath('oss-registry.json'));
  return registryCache;
}

export interface AnalyzerOptions {
  /** Directories searched for fixture profiles. */
  fixtureDirs?: string[];
  /** Allow network calls to api.github.com. Off by default so runs are reproducible. */
  live?: boolean;
  githubToken?: string;
}

/** Accepts a full GitHub URL or a bare `owner/name`. */
export function parseRepoRef(ref: string): { owner: string; name: string; id: string; url: string } | null {
  const trimmed = ref.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const urlMatch = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)/i.exec(trimmed);
  const slugMatch = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(trimmed);
  const m = urlMatch ?? slugMatch;
  if (!m || !m[1] || !m[2]) return null;
  const owner = m[1];
  const name = m[2];
  return { owner, name, id: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` };
}

function defaultFixtureDirs(): string[] {
  return [resolve(projectRoot(), 'tests', 'fixtures', 'repos')];
}

function findFixture(id: string, dirs: string[]): RepositoryProfile | null {
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const profile = readJson<RepositoryProfile>(resolve(dir, file));
      if (profile.id === id) return normalizeProfile(profile);
    }
  }
  return null;
}

function normalizeProfile(p: RepositoryProfile): RepositoryProfile {
  return {
    ...p,
    surface: { ...emptySurface(), ...(p.surface ?? {}) },
    artifacts: p.artifacts ?? {},
    inspected: p.inspected ?? [],
    dependencies: p.dependencies ?? [],
    secondaryCapabilities: p.secondaryCapabilities ?? [],
    dataProvenance: p.dataProvenance ?? [],
  };
}

function fromRegistry(entry: RegistryEntry, researchDate: string): RepositoryProfile {
  const inspected = ['repository-landing-page'];
  return {
    id: entry.id,
    url: entry.url,
    owner: entry.owner,
    name: entry.name,
    description: entry.description,
    kind: entry.kind,
    licenseSpdx: entry.licenseSpdx,
    licenseEvidence: classifyEvidence(entry.licenseEvidenceBasis, [
      `Licence transcribed from ${entry.url} on ${researchDate}.`,
    ]),
    latestRelease: entry.latestRelease,
    lastMeaningfulUpdate: entry.lastMeaningfulUpdate,
    documentation: entry.documentation,
    tests: entry.tests,
    dependencies: entry.dependencies,
    architecture: 'UNKNOWN',
    installation: 'UNKNOWN',
    primaryCapability: entry.primaryCapability,
    secondaryCapabilities: entry.secondaryCapabilities,
    stars: entry.stars,
    inspected,
    artifacts: {},
    surface: {
      ...emptySurface(),
      mcpServers: entry.kind === 'mcp-server' ? [entry.name] : [],
      commands: entry.declaredTools ?? [],
    },
    source: 'registry-seed',
    capturedAt: researchDate,
    dataProvenance: entry.dataProvenance,
  };
}

function unknownStub(ref: { owner: string; name: string; id: string; url: string }, why: string): RepositoryProfile {
  return {
    id: ref.id,
    url: ref.url,
    owner: ref.owner,
    name: ref.name,
    description: 'UNKNOWN',
    kind: 'unknown',
    licenseSpdx: 'UNKNOWN',
    licenseEvidence: classifyEvidence([], [why]),
    latestRelease: 'UNKNOWN',
    lastMeaningfulUpdate: 'UNKNOWN',
    documentation: 'UNKNOWN',
    tests: 'UNKNOWN',
    dependencies: [],
    architecture: 'UNKNOWN',
    installation: 'UNKNOWN',
    primaryCapability: 'UNKNOWN',
    secondaryCapabilities: [],
    stars: null,
    inspected: [],
    artifacts: {},
    surface: emptySurface(),
    source: 'live-github',
    capturedAt: 'UNKNOWN',
    dataProvenance: [why],
  };
}

/** Live GitHub metadata fetch. Any failure degrades to an UNKNOWN stub. */
async function fromLiveGithub(
  ref: { owner: string; name: string; id: string; url: string },
  token?: string,
): Promise<RepositoryProfile> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'oss-integration/0.1',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.name}`, { headers });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${ref.id}`);
  const json = (await res.json()) as {
    description?: string | null;
    license?: { spdx_id?: string | null } | null;
    pushed_at?: string;
    stargazers_count?: number;
    topics?: string[];
  };

  const spdx = json.license?.spdx_id;
  const licenseSpdx = !spdx || spdx === 'NOASSERTION' ? (spdx ?? 'UNKNOWN') : spdx;

  let readme = '';
  const readmeRes = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.name}/readme`, {
    headers: { ...headers, accept: 'application/vnd.github.raw' },
  });
  if (readmeRes.ok) readme = await readmeRes.text();

  const inspected = ['package-metadata'];
  if (readme) inspected.push('README');

  return {
    id: ref.id,
    url: ref.url,
    owner: ref.owner,
    name: ref.name,
    description: json.description ?? 'UNKNOWN',
    kind: 'unknown',
    licenseSpdx,
    licenseEvidence: classifyEvidence(['official-documentation'], [
      'Licence read from the GitHub repository metadata API.',
    ]),
    latestRelease: 'UNKNOWN',
    lastMeaningfulUpdate: json.pushed_at ? json.pushed_at.slice(0, 10) : 'UNKNOWN',
    documentation: readme ? 'PRESENT' : 'UNKNOWN',
    tests: 'UNKNOWN',
    dependencies: [],
    architecture: 'UNKNOWN',
    installation: 'UNKNOWN',
    primaryCapability: 'UNKNOWN',
    secondaryCapabilities: [],
    stars: json.stargazers_count ?? null,
    inspected,
    artifacts: readme ? { 'README.md': readme } : {},
    surface: emptySurface(),
    source: 'live-github',
    capturedAt: new Date().toISOString().slice(0, 10),
    dataProvenance: [`https://api.github.com/repos/${ref.id} fetched at runtime`],
  };
}

export async function analyzeRepository(ref: string, opts: AnalyzerOptions = {}): Promise<RepositoryProfile> {
  const parsed = parseRepoRef(ref);
  if (!parsed) throw new Error(`Not a recognisable GitHub repository reference: "${ref}"`);

  const fixture = findFixture(parsed.id, opts.fixtureDirs ?? defaultFixtureDirs());
  if (fixture) return fixture;

  const reg = loadOssRegistry();
  const entry = reg.entries.find((e) => e.id === parsed.id);
  if (entry) return fromRegistry(entry, reg.researchDate);

  if (opts.live) {
    try {
      return await fromLiveGithub(parsed, opts.githubToken ?? process.env.GITHUB_TOKEN);
    } catch (err) {
      return unknownStub(parsed, `Live GitHub lookup failed: ${(err as Error).message}`);
    }
  }

  return unknownStub(
    parsed,
    'Not found in fixtures or the seed registry, and live lookup was not enabled (pass --live). Nothing is assumed about this repository.',
  );
}

/** Evidence for the profile as a whole, derived from what was inspected. */
export function profileEvidence(repo: RepositoryProfile): Evidence {
  const basis: EvidenceBasis[] = [];
  if (repo.inspected.includes('tests') || repo.inspected.includes('executable-test')) basis.push('executable-test');
  if (repo.inspected.includes('source')) basis.push('source-inspection');
  if (repo.inspected.includes('example')) basis.push('reproducible-example');
  if (repo.inspected.includes('README') || repo.inspected.includes('repository-landing-page')) {
    basis.push('official-documentation');
  }
  if (repo.inspected.includes('package-metadata')) basis.push('official-documentation');
  if (repo.lastMeaningfulUpdate !== 'UNKNOWN') basis.push('maintainer-activity');
  if (repo.stars !== null) basis.push('social-popularity');
  return classifyEvidence([...new Set(basis)], [`Inspected: ${repo.inspected.join(', ') || 'nothing'}.`]);
}
