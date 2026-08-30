import type { Evidence, EvidenceBasis, RepositoryProfile, SignalPresence } from '../types.js';
import { emptySurface } from '../types.js';
import { classifyEvidence } from '../evidence/engine.js';
import { extractTgz, type TarEntry } from './tar.js';

/**
 * Live repository fetcher.
 *
 * Two sources are used, both fetched at runtime:
 *   - raw.githubusercontent.com — LICENCE, README and package.json straight
 *     from the repository.
 *   - registry.npmjs.org — published metadata (version, licence, dependencies,
 *     install scripts, publish time) and the published tarball, which gives
 *     the security gate REAL source to scan instead of nothing.
 *
 * The GitHub REST API is deliberately not required: it is unreachable from
 * some networks (including this project's CI sandbox), and everything below
 * can be established without it. What cannot be established is recorded as
 * UNKNOWN — never inferred, never defaulted.
 *
 * Every fetch is best-effort and independently recorded in `attempts`, so a
 * report can state exactly what was and was not retrieved.
 */

const RAW = 'https://raw.githubusercontent.com';
const NPM = 'https://registry.npmjs.org';

const DEFAULT_BRANCH_CANDIDATES = ['main', 'master'];
const LICENSE_PATHS = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'];
const README_PATHS = ['README.md', 'readme.md', 'README.rst', 'README'];

export interface FetchAttempt {
  what: string;
  url: string;
  ok: boolean;
  detail: string;
}

export interface LiveFetchOptions {
  timeoutMs?: number;
  maxTarballBytes?: number;
  maxScanFiles?: number;
  maxFileBytes?: number;
  /** Injected in tests so the live path can be exercised without a network. */
  fetchImpl?: typeof fetch;
}

export interface LiveFetchResult {
  profile: RepositoryProfile;
  attempts: FetchAttempt[];
}

interface Ctx {
  owner: string;
  name: string;
  id: string;
  url: string;
  opts: Required<Omit<LiveFetchOptions, 'fetchImpl'>> & { fetchImpl: typeof fetch };
  attempts: FetchAttempt[];
}

export async function fetchLiveRepository(
  ref: { owner: string; name: string; id: string; url: string },
  options: LiveFetchOptions = {},
): Promise<LiveFetchResult> {
  const ctx: Ctx = {
    ...ref,
    attempts: [],
    opts: {
      timeoutMs: options.timeoutMs ?? 20_000,
      maxTarballBytes: options.maxTarballBytes ?? 8 * 1024 * 1024,
      maxScanFiles: options.maxScanFiles ?? 60,
      maxFileBytes: options.maxFileBytes ?? 1024 * 1024,
      fetchImpl: options.fetchImpl ?? fetch,
    },
  };

  const artifacts: Record<string, string> = {};
  const inspected: string[] = [];
  const provenance: string[] = [];

  // 1. Existence and default branch, established by probing for a README.
  const branch = await resolveBranch(ctx, artifacts, inspected, provenance);

  // 2. Licence text.
  let licenseText: string | null = null;
  if (branch) {
    for (const path of LICENSE_PATHS) {
      const got = await getText(ctx, `${RAW}/${ctx.owner}/${ctx.name}/${branch}/${path}`, `licence:${path}`);
      if (got !== null) {
        licenseText = got;
        artifacts[path] = got;
        inspected.push('license-file');
        provenance.push(`${RAW}/${ctx.owner}/${ctx.name}/${branch}/${path}`);
        break;
      }
    }
  }

  // 3. Repository package.json.
  let repoPkg: PkgJson | null = null;
  if (branch) {
    const raw = await getText(ctx, `${RAW}/${ctx.owner}/${ctx.name}/${branch}/package.json`, 'package.json');
    if (raw !== null) {
      artifacts['package.json'] = raw;
      inspected.push('package-metadata');
      provenance.push(`${RAW}/${ctx.owner}/${ctx.name}/${branch}/package.json`);
      repoPkg = safeJson<PkgJson>(raw);
    }
  }

  // 4. npm registry: published metadata plus the tarball, which is the only
  //    route to real source without the GitHub tree API.
  const npmName = repoPkg?.name;
  const npm = npmName ? await fetchNpm(ctx, npmName) : null;
  if (npm) provenance.push(`${NPM}/${npmName}`);

  let tarEntries: TarEntry[] = [];
  let tarPaths: string[] = [];
  if (npm?.tarball) {
    const got = await getBuffer(ctx, npm.tarball, 'published tarball');
    if (got) {
      try {
        const extracted = extractTgz(got, {
          maxEntries: ctx.opts.maxScanFiles,
          maxFileBytes: ctx.opts.maxFileBytes,
          readExtensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.sh', '.bash', '.yml', '.yaml'],
        });
        tarEntries = extracted.entries;
        tarPaths = extracted.paths;
        inspected.push('source');
        provenance.push(`${npm.tarball} (${extracted.paths.length} files, ${extracted.entries.length} read)`);
        for (const e of tarEntries) artifacts[`npm:${e.path}`] = e.text;
        ctx.attempts.push({
          what: 'tarball extraction',
          url: npm.tarball,
          ok: true,
          detail: `${extracted.paths.length} files in archive, ${extracted.entries.length} decoded for scanning${extracted.truncated ? ' (truncated at the scan cap)' : ''}`,
        });
      } catch (err) {
        ctx.attempts.push({
          what: 'tarball extraction',
          url: npm.tarball,
          ok: false,
          detail: (err as Error).message,
        });
      }
    }
  }

  // 5. Derive the fields, and only the fields, that the fetches support.
  const licenseSpdx = resolveLicense(repoPkg, npm, licenseText);
  const licenseBasis: EvidenceBasis[] = [];
  if (licenseText) licenseBasis.push('source-inspection');
  if (repoPkg?.license || npm?.license) licenseBasis.push('official-documentation');

  const tests = detectTests(tarPaths, repoPkg, npm);

  return {
    profile: {
      id: ctx.id,
      url: ctx.url,
      owner: ctx.owner,
      name: ctx.name,
      description: npm?.description ?? repoPkg?.description ?? 'UNKNOWN',
      kind: 'unknown',
      licenseSpdx,
      licenseEvidence: classifyEvidence(licenseBasis, [
        licenseText
          ? 'Licence file fetched from the repository and matched against known licence texts.'
          : repoPkg?.license || npm?.license
            ? 'Licence read from package metadata; no licence file was fetched.'
            : 'No licence file and no licence field were retrieved.',
      ]),
      latestRelease: npm?.version ?? 'UNKNOWN',
      lastMeaningfulUpdate: npm?.modified ?? 'UNKNOWN',
      documentation: artifacts['README.md'] || artifacts['readme.md'] ? 'PRESENT' : 'UNKNOWN',
      tests,
      dependencies: npm?.dependencies ?? Object.keys(repoPkg?.dependencies ?? {}),
      architecture: 'UNKNOWN',
      installation: npm?.installScripts.length
        ? `npm install ${npmName} (declares install script(s): ${npm.installScripts.join(', ')})`
        : npmName
          ? `npm install ${npmName}`
          : 'UNKNOWN',
      primaryCapability: 'UNKNOWN',
      secondaryCapabilities: [],
      // Stars are not fetched: the API that serves them is unavailable here,
      // and popularity is worth at most 5% of the score anyway.
      stars: null,
      inspected: [...new Set(inspected)],
      artifacts,
      surface: emptySurface(),
      source: 'live-github',
      capturedAt: new Date().toISOString().slice(0, 10),
      dataProvenance: provenance,
    },
    attempts: ctx.attempts,
  };

}

function detectTests(paths: string[], pkg: PkgJson | null, meta: NpmMeta | null): SignalPresence {
  if (paths.some(isTestPath)) return 'PRESENT';
  const script = pkg?.scripts?.test ?? meta?.testScript;
  if (script && !/no test specified/i.test(script)) return 'PRESENT';
  // npm tarballs routinely exclude tests, so their absence here proves nothing.
  return 'UNKNOWN';
}

function isTestPath(p: string): boolean {
  return /(^|\/)(test|tests|__tests__|spec)\//i.test(p) || /\.(test|spec)\.[cm]?[jt]s$/i.test(p);
}

interface PkgJson {
  name?: string;
  description?: string;
  license?: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface NpmMeta {
  version: string;
  license: string | null;
  description: string | null;
  dependencies: string[];
  installScripts: string[];
  testScript: string | null;
  tarball: string | null;
  modified: string | null;
}

async function fetchNpm(ctx: Ctx, pkgName: string): Promise<NpmMeta | null> {
  const url = `${NPM}/${pkgName.replace(/\//g, '%2f')}`;
  const raw = await getText(ctx, url, `npm metadata for ${pkgName}`);
  if (raw === null) return null;
  const json = safeJson<{
    'dist-tags'?: Record<string, string>;
    versions?: Record<string, PkgJson & { dist?: { tarball?: string } }>;
    time?: Record<string, string>;
    description?: string;
  }>(raw);
  if (!json) return null;

  const latest = json['dist-tags']?.latest;
  const v = latest ? json.versions?.[latest] : undefined;
  if (!latest || !v) return null;

  const scripts = v.scripts ?? {};
  return {
    version: latest,
    license: typeof v.license === 'string' ? v.license : null,
    description: v.description ?? json.description ?? null,
    dependencies: Object.keys(v.dependencies ?? {}),
    installScripts: ['preinstall', 'install', 'postinstall'].filter((s) => scripts[s]),
    testScript: scripts.test ?? null,
    tarball: v.dist?.tarball ?? null,
    modified: json.time?.modified?.slice(0, 10) ?? null,
  };
}

async function resolveBranch(
  ctx: Ctx,
  artifacts: Record<string, string>,
  inspected: string[],
  provenance: string[],
): Promise<string | null> {
  for (const branch of DEFAULT_BRANCH_CANDIDATES) {
    for (const path of README_PATHS) {
      const url = `${RAW}/${ctx.owner}/${ctx.name}/${branch}/${path}`;
      const text = await getText(ctx, url, `README on ${branch}`);
      if (text !== null) {
        artifacts[path === 'readme.md' ? 'readme.md' : 'README.md'] = text;
        inspected.push('README');
        provenance.push(url);
        ctx.attempts.push({
          what: 'default branch',
          url,
          ok: true,
          detail: `resolved to "${branch}" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default`,
        });
        return branch;
      }
    }
  }
  ctx.attempts.push({
    what: 'default branch',
    url: `${RAW}/${ctx.owner}/${ctx.name}/{main,master}/README.md`,
    ok: false,
    detail: 'No README on main or master. Repository existence is UNKNOWN from this route.',
  });
  return null;
}

/**
 * Licence resolution, strongest source first. A licence file that matches a
 * known text outranks a self-declared metadata field.
 */
export function resolveLicense(pkg: PkgJson | null, npm: NpmMeta | null, licenseText: string | null): string {
  const fromText = licenseText ? spdxFromText(licenseText) : null;
  if (fromText) return fromText;
  const declared = pkg?.license ?? npm?.license ?? null;
  if (declared && /^[A-Za-z0-9.+-]+$/.test(declared)) return declared;
  return 'UNKNOWN';
}

/** Conservative licence-text matcher: only well-known, unambiguous markers. */
export function spdxFromText(text: string): string | null {
  const t = text.slice(0, 4000);
  if (/Apache License\s*\n?\s*Version 2\.0/i.test(t)) return 'Apache-2.0';
  if (/Mozilla Public License Version 2\.0/i.test(t)) return 'MPL-2.0';
  if (/GNU LESSER GENERAL PUBLIC LICENSE\s*\n?\s*Version 3/i.test(t)) return 'LGPL-3.0-only';
  if (/GNU AFFERO GENERAL PUBLIC LICENSE\s*\n?\s*Version 3/i.test(t)) return 'AGPL-3.0-only';
  if (/GNU GENERAL PUBLIC LICENSE\s*\n?\s*Version 3/i.test(t)) return 'GPL-3.0-only';
  if (/Permission is hereby granted, free of charge/i.test(t) && /MIT/i.test(t.slice(0, 300))) return 'MIT';
  if (/Permission is hereby granted, free of charge/i.test(t)) return 'MIT';
  if (/Redistribution and use in source and binary forms/i.test(t)) {
    return /Neither the name/i.test(t) ? 'BSD-3-Clause' : 'BSD-2-Clause';
  }
  if (/Permission to use, copy, modify, and(\/or)? distribute this software/i.test(t)) return 'ISC';
  return null;
}

async function getText(ctx: Ctx, url: string, what: string): Promise<string | null> {
  try {
    const res = await ctx.opts.fetchImpl(url, {
      signal: AbortSignal.timeout(ctx.opts.timeoutMs),
      headers: { 'user-agent': 'oss-integration/0.1 (+live-fetch)' },
    });
    if (!res.ok) {
      ctx.attempts.push({ what, url, ok: false, detail: `HTTP ${res.status}` });
      return null;
    }
    const text = await res.text();
    ctx.attempts.push({ what, url, ok: true, detail: `${text.length} bytes` });
    return text;
  } catch (err) {
    ctx.attempts.push({ what, url, ok: false, detail: (err as Error).message });
    return null;
  }
}

async function getBuffer(ctx: Ctx, url: string, what: string): Promise<Buffer | null> {
  try {
    const res = await ctx.opts.fetchImpl(url, {
      signal: AbortSignal.timeout(ctx.opts.timeoutMs),
      headers: { 'user-agent': 'oss-integration/0.1 (+live-fetch)' },
    });
    if (!res.ok) {
      ctx.attempts.push({ what, url, ok: false, detail: `HTTP ${res.status}` });
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > ctx.opts.maxTarballBytes) {
      ctx.attempts.push({
        what,
        url,
        ok: false,
        detail: `archive is ${buf.byteLength} bytes, over the ${ctx.opts.maxTarballBytes} byte cap; not downloaded into the scanner`,
      });
      return null;
    }
    ctx.attempts.push({ what, url, ok: true, detail: `${buf.byteLength} bytes` });
    return buf;
  } catch (err) {
    ctx.attempts.push({ what, url, ok: false, detail: (err as Error).message });
    return null;
  }
}

function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
