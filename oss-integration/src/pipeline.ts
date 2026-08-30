import type {
  Capability,
  CapabilityStack,
  GoalSpec,
  HealthAssessment,
  LicenseAssessment,
  RepositoryProfile,
  ScoutScore,
  SecurityAssessment,
} from './types.js';
import { normalizeGoal, type GoalInput } from './goal/engine.js';
import { analyzeRepository, type AnalyzerOptions } from './repository/analyzer.js';
import { extractWithGates } from './capability/extractor.js';
import { assessHealth } from './health/engine.js';
import { scoutScore } from './scoring/scout-score.js';
import { CapabilityGraph } from './graph/capability-graph.js';
import { computeGap } from './gap/engine.js';
import { detectConflicts, detectDuplicates, type CandidateView } from './compatibility/detector.js';
import { discoverForCapabilities } from './discovery/engine.js';
import { selectStack } from './integration/selector.js';
import { optimizeStack, type OptimizeResult } from './integration/optimizer.js';

/**
 * OSS Scout pipeline.
 *
 * goal -> analyse -> extract -> gate -> score -> gap -> discover -> gap again
 *      -> duplicates -> conflicts -> Best Capability Stack
 */

export interface AnalyzedRepo {
  profile: RepositoryProfile;
  capabilities: Capability[];
  license: LicenseAssessment;
  security: SecurityAssessment;
  health: HealthAssessment;
  score: ScoutScore;
}

export interface ScoutResult {
  goal: GoalSpec;
  supplied: AnalyzedRepo[];
  discovered: AnalyzedRepo[];
  stack: CapabilityStack;
  graph: CapabilityGraph;
  discoveryNotes: string[];
  /** Capabilities required by the goal that nothing at all could supply. */
  unresolved: string[];
  /** What the stack optimizer consolidated, and how many install sources it saved. */
  optimization: OptimizeResult;
}

export interface ScoutOptions extends AnalyzerOptions {
  knownVulnerable?: string[];
  /** Skip the discovery step (used by `analyze`, which is single-repository). */
  skipDiscovery?: boolean;
}

export async function runScout(input: GoalInput, opts: ScoutOptions = {}): Promise<ScoutResult> {
  const goal = normalizeGoal(input);
  const graph = new CapabilityGraph();

  const suppliedProfiles = await Promise.all(
    goal.userSuppliedOss.map((ref) => analyzeRepository(ref, opts)),
  );
  // First pass with no competitor context, so the gap can be computed. Scores
  // are recomputed below once the full candidate field is known.
  let supplied = suppliedProfiles.map((p) => analyze(p, goal, opts, new Map()));

  // Capabilities held after the gates. A BLOCKed source holds nothing.
  const held = (repos: AnalyzedRepo[]) =>
    repos.flatMap((r) =>
      r.score.blocked ? [] : r.capabilities.filter((c) => c.confidence > 0).map((c) => c.capabilityId),
    );

  const firstGap = computeGap(goal.requiredCapabilities, held(supplied), graph);

  let discovered: AnalyzedRepo[] = [];
  const discoveryNotes: string[] = [];
  let unresolved: string[] = firstGap.missing;

  if (!opts.skipDiscovery && firstGap.missing.length > 0) {
    // Near-miss capabilities are worth closing even when they are only one
    // step from a much larger capability, so they join the search.
    const nearMissTargets = firstGap.nearMisses.flatMap((n) => n.missing);
    const wanted = [...new Set([...firstGap.missing, ...nearMissTargets])];
    const result = await discoverForCapabilities(wanted, {
      ...opts,
      exclude: suppliedProfiles.map((p) => p.id),
    });
    discoveryNotes.push(...result.notes);
    discovered = result.profiles.map((p) => analyze(p, goal, opts, new Map()));
    unresolved = result.stillMissing.filter((c) => goal.requiredCapabilities.includes(c));
  }

  // Differentiation is only meaningful against the full candidate field, so
  // rescore everything now that discovery has run.
  const competitors = countCompetitors([...supplied, ...discovered]);
  supplied = supplied.map((r) => analyze(r.profile, goal, opts, competitors));
  discovered = discovered.map((r) => analyze(r.profile, goal, opts, competitors));

  const toViews = (repos: AnalyzedRepo[]): CandidateView[] =>
    repos.flatMap((r) =>
      r.capabilities.map((c) => ({
        repositoryId: r.profile.id,
        capability: c,
        score: r.score.total,
        blocked: r.score.blocked || c.confidence === 0,
      })),
    );

  const suppliedViews = toViews(supplied);
  const discoveredViews = toViews(discovered);

  const duplicates = detectDuplicates([...suppliedViews, ...discoveredViews]);
  const conflicts = detectConflicts([...suppliedProfiles, ...discovered.map((d) => d.profile)]);
  const finalGap = computeGap(goal.requiredCapabilities, [...held(supplied), ...held(discovered)], graph);

  const selected = selectStack({
    goal,
    supplied: suppliedViews,
    discovered: discoveredViews,
    duplicates,
    conflicts,
    gaps: finalGap,
  });

  // Stack optimization: selection is per-capability and can scatter the stack
  // across more projects than it needs. This consolidates without weakening
  // evidence, and records every move.
  const optimization = optimizeStack(selected, [...suppliedViews, ...discoveredViews]);

  return {
    goal,
    supplied,
    discovered,
    stack: optimization.stack,
    graph,
    discoveryNotes,
    unresolved,
    optimization,
  };
}

/** How many candidates supply each capability, used by the Differentiation axis. */
function countCompetitors(repos: AnalyzedRepo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of repos) {
    for (const c of new Set(r.capabilities.map((x) => x.capabilityId))) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

function analyze(
  profile: RepositoryProfile,
  goal: GoalSpec,
  opts: ScoutOptions,
  competitors: Map<string, number>,
): AnalyzedRepo {
  const { capabilities, license, security } = extractWithGates(profile, {
    commercialUse: goal.commercialUse,
    knownVulnerable: opts.knownVulnerable ?? [],
  });
  const health = assessHealth(profile);
  const graph = new CapabilityGraph();
  const unlocks = graph.unlocked(capabilities.map((c) => c.capabilityId));
  // "Others supplying my primary capability", so a sole supplier scores highest.
  const primary = profile.primaryCapability;
  const competitorCount = primary === 'UNKNOWN' ? 0 : Math.max(0, (competitors.get(primary) ?? 1) - 1);
  const score = scoutScore({
    goal,
    repo: profile,
    capabilities,
    license,
    security,
    health,
    competitorCount,
    unlocks,
  });
  return { profile, capabilities, license, security, health, score };
}
