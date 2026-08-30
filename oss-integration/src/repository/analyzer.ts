import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Evidence, EvidenceBasis, RepositoryProfile, SignalPresence } from '../types.js';
import { emptySurface } from '../types.js';
import { classifyEvidence } from '../evidence/engine.js';
import { dataPath, projectRoot, readJson } from '../util/io.js';
import { fetchLiveRepository, type FetchAttempt, type LiveFetchOptions } from './live-fetch.js';

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
  /**
   * Fetch real artifacts over the network. Off by default so runs are
   * reproducible. When on, live facts take precedence over the seed registry
   * for everything the fetch could establish; the registry still supplies the
   * capability mapping, which is a curated judgement the network cannot give.
   */
  live?: boolean;
  liveOptions?: LiveFetchOptions;
}

/** Records what a live run actually retrieved, for LIVE_REPOSITORY_REPORT.md. */
export const liveAttemptLog = new Map<string, FetchAttempt[]>();

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

/**
 * Live analysis. Facts come from the network; the capability mapping, when the
 * repository is one we have curated, comes from the seed registry. Which is
 * which is recorded in `dataProvenance` so the two are never confused.
 */
async function fromLive(
  ref: { owner: string; name: string; id: string; url: string },
  entry: RegistryEntry | undefined,
  opts: AnalyzerOptions,
): Promise<RepositoryProfile> {
  const { profile, attempts } = await fetchLiveRepository(ref, opts.liveOptions ?? {});
  liveAttemptLog.set(ref.id, attempts);

  if (!entry) return profile;

  // Merge: live wins on every verifiable fact, the registry supplies only the
  // capability mapping and the qualitative notes it was curated for.
  return {
    ...profile,
    kind: entry.kind,
    description: profile.description === 'UNKNOWN' ? entry.description : profile.description,
    primaryCapability: entry.primaryCapability,
    secondaryCapabilities: entry.secondaryCapabilities,
    surface: {
      ...profile.surface,
      mcpServers: entry.kind === 'mcp-server' ? [entry.name] : [],
      commands: entry.declaredTools ?? [],
    },
    dataProvenance: [
      ...profile.dataProvenance,
      `capability mapping (primary "${entry.primaryCapability}") taken from the curated seed registry, NOT from the live fetch`,
    ],
  };
}

export async function analyzeRepository(ref: string, opts: AnalyzerOptions = {}): Promise<RepositoryProfile> {
  const parsed = parseRepoRef(ref);
  if (!parsed) throw new Error(`Not a recognisable GitHub repository reference: "${ref}"`);

  const fixture = findFixture(parsed.id, opts.fixtureDirs ?? defaultFixtureDirs());
  if (fixture) return fixture;

  const reg = loadOssRegistry();
  const entry = reg.entries.find((e) => e.id === parsed.id);

  if (opts.live) {
    try {
      return await fromLive(parsed, entry, opts);
    } catch (err) {
      // A failed live run must not silently fall back to weaker seed data
      // dressed up as a live result; say what happened instead.
      if (entry) {
        const seeded = fromRegistry(entry, reg.researchDate);
        return {
          ...seeded,
          dataProvenance: [
            ...seeded.dataProvenance,
            `LIVE FETCH FAILED (${(err as Error).message}); fell back to seed-registry data. This profile is NOT live-verified.`,
          ],
        };
      }
      return unknownStub(parsed, `Live fetch failed: ${(err as Error).message}`);
    }
  }

  if (entry) return fromRegistry(entry, reg.researchDate);

  return unknownStub(
    parsed,
    'Not found in fixtures or the seed registry, and live lookup was not enabled (pass --live). Nothing is assumed about this repository.',
  );
}

/** Evidence for the profile as a whole, derived from what was inspected. */
export function profileEvidence(repo: RepositoryProfile): Evidence {
  const basis: EvidenceBasis[] = [];
  if (repo.inspected.includes('tests') || repo.inspected.includes('executable-test')) basis.push('executable-test');
  if (repo.inspected.includes('source') || repo.inspected.includes('license-file')) basis.push('source-inspection');
  if (repo.inspected.includes('example')) basis.push('reproducible-example');
  if (repo.inspected.includes('README') || repo.inspected.includes('repository-landing-page')) {
    basis.push('official-documentation');
  }
  if (repo.inspected.includes('package-metadata')) basis.push('official-documentation');
  if (repo.lastMeaningfulUpdate !== 'UNKNOWN') basis.push('maintainer-activity');
  if (repo.stars !== null) basis.push('social-popularity');
  return classifyEvidence([...new Set(basis)], [`Inspected: ${repo.inspected.join(', ') || 'nothing'}.`]);
}
