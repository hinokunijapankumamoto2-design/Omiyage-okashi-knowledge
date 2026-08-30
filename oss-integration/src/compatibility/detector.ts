import type { Capability, Conflict, DuplicateGroup, RepositoryProfile, SelectionAxis } from '../types.js';
import { evidenceRank } from '../evidence/engine.js';

/**
 * Duplicate Detector and Conflict Detector.
 *
 * Duplicates are resolved to one winner per capability (rule 18/22): a stack
 * that carries three screenshot skills is a bundle, not an integration.
 */

export interface CandidateView {
  repositoryId: string;
  capability: Capability;
  score: number;
  blocked: boolean;
}

export function detectDuplicates(candidates: CandidateView[]): DuplicateGroup[] {
  const byCapability = new Map<string, CandidateView[]>();
  for (const c of candidates) {
    const list = byCapability.get(c.capability.capabilityId) ?? [];
    list.push(c);
    byCapability.set(c.capability.capabilityId, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const [capabilityId, members] of byCapability) {
    if (members.length < 2) continue;
    const usable = members.filter((m) => !m.blocked);
    const pool = usable.length > 0 ? usable : members;
    const { winner, axis, reason } = pickWinner(pool);
    groups.push({
      capabilityId,
      members: members.map((m) => m.repositoryId),
      winner: winner.repositoryId,
      axis,
      reason,
    });
  }
  return groups;
}

/**
 * Winner selection walks the comparison axes in order and stops at the first
 * that separates the candidates, so the reported axis is the one that actually
 * decided the outcome.
 */
export function pickWinner(pool: CandidateView[]): { winner: CandidateView; axis: SelectionAxis; reason: string } {
  const sorted = [...pool];

  const byEvidence = maxBy(sorted, (c) => evidenceRank(c.capability.evidence.class));
  if (byEvidence.unique) {
    return {
      winner: byEvidence.item,
      axis: 'BEST_EVIDENCE',
      reason: `Strongest evidence class (${byEvidence.item.capability.evidence.class}) among ${pool.length} candidates.`,
    };
  }

  const byCompat = maxBy(sorted, (c) => (c.capability.licenseStatus === 'REUSE_WITH_CONDITIONS' ? 2 : c.capability.licenseStatus === 'REFERENCE_ONLY' ? 1 : 0));
  if (byCompat.unique) {
    return {
      winner: byCompat.item,
      axis: 'BEST_COMPATIBILITY',
      reason: `Least restrictive licence posture (${byCompat.item.capability.licenseStatus}) among tied-evidence candidates.`,
    };
  }

  const byScore = maxBy(sorted, (c) => c.score);
  if (byScore.unique) {
    return {
      winner: byScore.item,
      axis: 'BEST_INTEGRATION_VALUE',
      reason: `Highest Scout Score (${byScore.item.score.toFixed(2)}) among candidates tied on evidence and licence.`,
    };
  }

  const fallback = sorted.slice().sort((a, b) => a.repositoryId.localeCompare(b.repositoryId))[0] as CandidateView;
  return {
    winner: fallback,
    axis: 'BEST_REFERENCE',
    reason: 'Candidates were indistinguishable on every axis; picked deterministically by id so the run is reproducible.',
  };
}

function maxBy<T>(items: T[], key: (t: T) => number): { item: T; unique: boolean } {
  let best = items[0] as T;
  let bestKey = key(best);
  let ties = 0;
  for (const item of items.slice(1)) {
    const k = key(item);
    if (k > bestKey) {
      best = item;
      bestKey = k;
      ties = 0;
    } else if (k === bestKey) {
      ties++;
    }
  }
  return { item: best, unique: ties === 0 };
}

/** Conflict Detector (rule 23). */
export function detectConflicts(repos: RepositoryProfile[]): Conflict[] {
  const conflicts: Conflict[] = [];

  conflicts.push(...collide(repos, (r) => r.surface.commands, 'command-namespace', 'command'));
  conflicts.push(...collide(repos, (r) => r.surface.hooks, 'duplicate-hook', 'hook'));
  conflicts.push(...collide(repos, (r) => r.surface.agents, 'overlapping-agent', 'agent'));
  conflicts.push(...collide(repos, (r) => r.surface.mcpServers, 'duplicated-mcp-responsibility', 'MCP server'));
  conflicts.push(...collide(repos, (r) => r.surface.configKeys, 'configuration-conflict', 'config key'));
  conflicts.push(...collide(repos, (r) => r.surface.writesPaths, 'filesystem-conflict', 'write path'));
  conflicts.push(...collide(repos, (r) => r.surface.envVars, 'environment-conflict', 'environment variable'));

  // Incompatible dependency: same package pinned to different major versions.
  const versionsByPkg = new Map<string, Map<string, string[]>>();
  for (const r of repos) {
    for (const dep of r.dependencies) {
      const [name, version] = splitDep(dep);
      const byVersion = versionsByPkg.get(name) ?? new Map<string, string[]>();
      const holders = byVersion.get(version) ?? [];
      holders.push(r.id);
      byVersion.set(version, holders);
      versionsByPkg.set(name, byVersion);
    }
  }
  for (const [pkg, byVersion] of versionsByPkg) {
    const majors = new Set([...byVersion.keys()].filter((v) => v !== '*').map(majorOf));
    if (majors.size > 1) {
      conflicts.push({
        kind: 'incompatible-dependency',
        subject: pkg,
        parties: [...new Set([...byVersion.values()].flat())],
        detail: `"${pkg}" is required at incompatible majors: ${[...byVersion.keys()].join(', ')}.`,
        resolution: 'Pin one major in the generated plugin and record the drop; do not vendor both.',
        resolved: false,
      });
    }
  }

  // Runtime conflict: a stack that spans mutually exclusive runtimes.
  const runtimes = new Set(repos.map((r) => r.kind));
  if (runtimes.has('mcp-server') && repos.filter((r) => r.kind === 'mcp-server').length > 1) {
    conflicts.push({
      kind: 'runtime-conflict',
      subject: 'multiple MCP servers',
      parties: repos.filter((r) => r.kind === 'mcp-server').map((r) => r.id),
      detail: 'More than one MCP server would be started for overlapping responsibilities.',
      resolution: 'Select one MCP server per responsibility; the others become alternatives, not co-installs.',
      resolved: false,
    });
  }

  return conflicts;
}

function collide(
  repos: RepositoryProfile[],
  pick: (r: RepositoryProfile) => string[],
  kind: Conflict['kind'],
  label: string,
): Conflict[] {
  const owners = new Map<string, string[]>();
  for (const r of repos) {
    for (const name of pick(r)) {
      const list = owners.get(name) ?? [];
      list.push(r.id);
      owners.set(name, list);
    }
  }
  const out: Conflict[] = [];
  for (const [name, ids] of owners) {
    if (ids.length < 2) continue;
    out.push({
      kind,
      subject: name,
      parties: ids,
      detail: `${ids.length} sources declare the same ${label} "${name}".`,
      resolution: `Keep the winning source's ${label} and drop or namespace the rest.`,
      resolved: false,
    });
  }
  return out;
}

function splitDep(dep: string): [string, string] {
  const at = dep.lastIndexOf('@');
  if (at > 0) return [dep.slice(0, at), dep.slice(at + 1)];
  return [dep, '*'];
}

function majorOf(version: string): string {
  const m = /(\d+)/.exec(version);
  return m?.[1] ?? version;
}
