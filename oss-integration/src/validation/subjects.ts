import type { ArchitecturePlan, RepositoryProfile } from '../types.js';
import type { AnalyzedRepo, ScoutResult } from '../pipeline.js';
import type { BenchmarkSubject } from './benchmark.js';
import { dataPath, readJson } from '../util/io.js';

/**
 * Benchmark subject construction.
 *
 * Every subject is measured by the SAME rules. The v0.1 implementation did not
 * do this: it charged the integrated plugin for each upstream project while
 * charging every original exactly 1, ignoring the originals' own runtime
 * requirements. That asymmetry is corrected here, and the correction is
 * recorded in data/benchmark-metrics.json under `install-actions`.
 *
 * A fourth baseline is added: `originals-union`, all the originals installed
 * together. That is the realistic alternative to an integrated plugin, so it is
 * the honest counterfactual for any cost metric.
 */

interface ExternalRuntime {
  id: string;
  triggeredBy: string[];
  why: string;
}

interface MetricsFile {
  externalRuntimes: ExternalRuntime[];
}

let runtimesCache: ExternalRuntime[] | null = null;

export function externalRuntimes(): ExternalRuntime[] {
  if (!runtimesCache) runtimesCache = readJson<MetricsFile>(dataPath('benchmark-metrics.json')).externalRuntimes;
  return runtimesCache;
}

/**
 * Install actions for a set of required sources, counted identically for every
 * subject: one for the subject's own package, plus one per distinct external
 * runtime that needs a separate manual install step. Transitive library
 * dependencies are not counted, because the user does not install them by hand.
 */
export function countInstallActions(sources: RepositoryProfile[], ownPackages = 1): {
  actions: number;
  runtimes: string[];
} {
  const names = new Set<string>();
  for (const s of sources) {
    names.add(s.name.toLowerCase());
    for (const dep of s.dependencies) {
      names.add(stripVersion(dep).toLowerCase());
    }
  }
  const hit = externalRuntimes().filter((rt) => rt.triggeredBy.some((t) => names.has(t.toLowerCase())));
  return { actions: ownPackages + hit.length, runtimes: hit.map((r) => r.id) };
}

function stripVersion(dep: string): string {
  const at = dep.lastIndexOf('@');
  return at > 0 ? dep.slice(0, at) : dep;
}

function isDegraded(securityStatus: string, licenseStatus: string): boolean {
  // Pre-registered definition: security not PASS, or licence LEGAL_REVIEW/BLOCK.
  return securityStatus !== 'PASS' || licenseStatus === 'LEGAL_REVIEW' || licenseStatus === 'BLOCK';
}

function countFindings(repos: AnalyzedRepo[]): number {
  return repos.reduce(
    (n, r) => n + r.security.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length,
    0,
  );
}

function duplicateImplementations(entries: { capabilityId: string }[]): number {
  const seen = new Set<string>();
  let extra = 0;
  for (const e of entries) {
    if (seen.has(e.capabilityId)) extra++;
    else seen.add(e.capabilityId);
  }
  return extra;
}

export interface SubjectSet {
  subjects: BenchmarkSubject[];
  integratedName: string;
  unionName: string;
}

export function buildSubjects(scout: ScoutResult, plan: ArchitecturePlan): SubjectSet {
  const subjects: BenchmarkSubject[] = [];

  // --- each original alone -------------------------------------------------
  for (const r of scout.supplied) {
    const usable = r.score.blocked ? [] : r.capabilities.filter((c) => c.confidence > 0);
    const install = countInstallActions([r.profile]);
    subjects.push({
      name: r.profile.id,
      capabilities: usable.map((c) => c.capabilityId),
      degraded: usable.filter((c) => isDegraded(c.securityStatus, c.licenseStatus)).map((c) => c.capabilityId),
      securityFindings: countFindings([r]),
      integrationDebt: scout.stack.conflicts.filter((c) => c.parties.includes(r.profile.id)).length,
      installActions: install.actions,
      installRuntimes: install.runtimes,
      // Its own package is the one project involved.
      upstreamProjects: 1,
    });
  }

  // --- all the originals installed together --------------------------------
  const unionName = 'originals-union';
  if (scout.supplied.length > 1) {
    const usable = scout.supplied.flatMap((r) =>
      r.score.blocked ? [] : r.capabilities.filter((c) => c.confidence > 0),
    );
    const unionCaps = [...new Set(usable.map((c) => c.capabilityId))];
    // Installing every original also inherits every conflict between them.
    const unionInstall = countInstallActions(
      scout.supplied.map((r) => r.profile),
      scout.supplied.length,
    );
    subjects.push({
      name: unionName,
      capabilities: unionCaps,
      degraded: [...new Set(usable.filter((c) => isDegraded(c.securityStatus, c.licenseStatus)).map((c) => c.capabilityId))],
      securityFindings: countFindings(scout.supplied),
      integrationDebt: scout.stack.conflicts.length + duplicateOverlap(scout),
      installActions: unionInstall.actions,
      installRuntimes: unionInstall.runtimes,
      upstreamProjects: scout.supplied.length,
      // Each original is one project; the union involves all of them.
    });
  }

  // --- the generated plugin ------------------------------------------------
  const selected = plan.stack.entries;
  const unlocked = scout.graph.unlocked(selected.map((e) => e.capabilityId));
  const upstreamIds = new Set(
    selected.filter((e) => e.origin !== 'original').map((e) => e.capability.sourceRepository),
  );
  const upstreamProfiles = [...scout.supplied, ...scout.discovered]
    .filter((r) => upstreamIds.has(r.profile.id))
    .map((r) => r.profile);
  const install = countInstallActions(upstreamProfiles);

  subjects.push({
    name: plan.pluginName,
    capabilities: [...selected.map((e) => e.capabilityId), ...unlocked],
    degraded: selected
      .filter((e) => isDegraded(e.capability.securityStatus, e.capability.licenseStatus))
      .map((e) => e.capabilityId),
    securityFindings: countFindings(
      [...scout.supplied, ...scout.discovered].filter((r) => upstreamIds.has(r.profile.id)),
    ),
    integrationDebt: plan.conflicts.filter((c) => !c.resolved).length + duplicateImplementations(selected),
    installActions: install.actions,
    installRuntimes: install.runtimes,
    // The generated plugin itself, plus every upstream project it orchestrates.
    upstreamProjects: 1 + upstreamIds.size,
  });

  return { subjects, integratedName: plan.pluginName, unionName };
}

/** Capabilities supplied by more than one original, which a union would carry twice. */
function duplicateOverlap(scout: ScoutResult): number {
  const counts = new Map<string, number>();
  for (const r of scout.supplied) {
    if (r.score.blocked) continue;
    for (const c of new Set(r.capabilities.filter((x) => x.confidence > 0).map((x) => x.capabilityId))) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.values()].filter((n) => n > 1).reduce((a, n) => a + (n - 1), 0);
}
