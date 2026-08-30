import type {
  ArchitectureLayer,
  ArchitecturePlan,
  CapabilityStack,
  Conflict,
  OriginalComponent,
} from '../types.js';
import { CapabilityGraph } from '../graph/capability-graph.js';
import { capabilityName } from '../capability/taxonomy.js';

/**
 * Integration Architect.
 *
 * Turns a Best Capability Stack into a plan for ONE plugin: dependencies
 * normalized, duplicates already gone, conflicts resolved, workflow redesigned
 * around the goal rather than around the shape of the source projects.
 *
 * This deliberately does not concatenate the source plugins. Rule 24.
 */

export interface ArchitectOptions {
  pluginName: string;
  displayName?: string;
  description?: string;
}

export function designArchitecture(stack: CapabilityStack, opts: ArchitectOptions): ArchitecturePlan {
  const graph = new CapabilityGraph();
  const selected = stack.entries.map((e) => e.capabilityId);

  const conflicts = resolveConflicts(stack.conflicts, stack);
  const normalizedDependencies = normalizeDependencies(stack);
  const layers = buildLayers(stack, selected);
  const originalComponents = designOriginalLayer(stack, graph, selected);
  const workflow = designWorkflow(selected, graph);

  const unifiedConfig: ArchitecturePlan['unifiedConfig'] = {
    baseUrl: {
      type: 'string',
      description: 'URL the verification capabilities run against. Required before any browser-backed check.',
    },
    viewports: {
      type: 'string[]',
      description: 'Viewport list used by responsive and screenshot capabilities, so every capability measures the same sizes.',
      default: ['360x800', '768x1024', '1440x900'],
    },
    evidenceStandard: {
      type: 'string',
      description: 'Minimum evidence class a capability result must reach before it is reported as a fact.',
      default: stack.goal.evidenceStandard,
    },
    failOn: {
      type: 'string',
      description: 'Severity at which the verification workflow stops and reports failure.',
      default: 'high',
    },
  };

  return {
    pluginName: opts.pluginName,
    displayName: opts.displayName ?? opts.pluginName,
    description:
      opts.description ??
      `Goal-optimized plugin covering ${selected.length} selected capabilities for: ${stack.goal.goal}`,
    layers,
    originalComponents,
    workflow,
    unifiedConfig,
    normalizedDependencies,
    conflicts,
    stack,
  };
}

/**
 * Conflict Resolver. Every conflict gets an explicit resolution; a conflict
 * that cannot be resolved automatically stays `resolved: false` and is
 * surfaced in the report rather than swallowed.
 */
export function resolveConflicts(conflicts: Conflict[], stack: CapabilityStack): Conflict[] {
  const selectedRepos = new Set(stack.entries.map((e) => e.capability.sourceRepository));
  return conflicts.map((c) => {
    // A conflict the detector already resolved stays resolved. Re-deciding it
    // here discarded the detector's reasoning — a runtime version floor was
    // being re-reported as an unresolvable major clash.
    if (c.resolved) return c;

    const survivors = c.parties.filter((p) => selectedRepos.has(p));
    if (survivors.length <= 1) {
      return {
        ...c,
        resolution:
          survivors.length === 1
            ? `Resolved by selection: only ${survivors[0]} entered the stack, so the collision on "${c.subject}" no longer exists.`
            : `Resolved by selection: none of the colliding sources entered the stack.`,
        resolved: true,
      };
    }
    if (c.kind === 'incompatible-dependency') {
      return {
        ...c,
        resolution: `Unresolved automatically: "${c.subject}" is needed at incompatible majors by ${survivors.join(' and ')}. A human must pin one major or drop a capability.`,
        resolved: false,
      };
    }
    return {
      ...c,
      resolution: `Namespaced under the generated plugin: "${c.subject}" is re-exposed once, owned by the orchestration layer, and the source-specific variants are not re-emitted.`,
      resolved: true,
    };
  });
}

/** Dependency Normalization: one entry per package, with who needs it. */
export function normalizeDependencies(stack: CapabilityStack): ArchitecturePlan['normalizedDependencies'] {
  const byName = new Map<string, Set<string>>();
  for (const entry of stack.entries) {
    for (const dep of entry.capability.dependencies) {
      const name = dep.includes('@') && dep.lastIndexOf('@') > 0 ? dep.slice(0, dep.lastIndexOf('@')) : dep;
      const set = byName.get(name) ?? new Set<string>();
      set.add(entry.capability.sourceRepository);
      byName.set(name, set);
    }
  }
  return [...byName.entries()]
    .map(([name, requiredBy]) => ({
      name,
      requiredBy: [...requiredBy].sort(),
      resolution:
        requiredBy.size > 1
          ? 'Shared: declared once at the plugin level instead of once per capability.'
          : 'Single consumer: declared as an optional peer of that capability only.',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildLayers(stack: CapabilityStack, selected: string[]): ArchitectureLayer[] {
  const byCategory = new Map<string, string[]>();
  for (const entry of stack.entries) {
    const list = byCategory.get(entry.capability.category) ?? [];
    list.push(entry.capabilityId);
    byCategory.set(entry.capability.category, list);
  }

  const layers: ArchitectureLayer[] = [];

  layers.push({
    name: 'Orchestration',
    responsibility:
      'Route a request to the right capability, sequence verification after implementation, and degrade explicitly when a capability is unavailable.',
    capabilities: [],
    components: [
      { kind: 'skill', name: 'capability-router' },
      { kind: 'config', name: 'plugin config' },
    ],
  });

  const designCaps = [...(byCategory.get('design') ?? []), ...(byCategory.get('implementation') ?? [])];
  if (designCaps.length > 0) {
    layers.push({
      name: 'Build',
      responsibility: 'Produce and modify the artifact the goal is about.',
      capabilities: designCaps,
      components: [{ kind: 'skill', name: 'build-surface' }],
    });
  }

  const verifyCaps = [
    ...(byCategory.get('automation') ?? []),
    ...(byCategory.get('verification') ?? []),
  ];
  if (verifyCaps.length > 0) {
    layers.push({
      name: 'Verify',
      responsibility: 'Turn claims about the artifact into measured facts.',
      capabilities: verifyCaps,
      components: [
        { kind: 'skill', name: 'verification-runner' },
        { kind: 'agent', name: 'verification-agent' },
      ],
    });
  }

  const judgeCaps = [...(byCategory.get('quality') ?? []), ...(byCategory.get('security') ?? [])];
  if (judgeCaps.length > 0) {
    layers.push({
      name: 'Judge',
      responsibility: 'Review the measured facts against the goal and report defects with evidence.',
      capabilities: judgeCaps,
      components: [{ kind: 'agent', name: 'review-agent' }],
    });
  }

  layers.push({
    name: 'Evidence',
    responsibility:
      'Record, per capability, what was measured versus what was assumed, so the plugin output can be trusted or challenged.',
    capabilities: selected.filter((c) => !layers.some((l) => l.capabilities.includes(c))),
    components: [
      { kind: 'skill', name: 'evidence-ledger' },
      { kind: 'doc', name: 'PROVENANCE.md' },
    ],
  });

  return layers;
}

/**
 * Original Layer Designer.
 *
 * Rule 25: originality is not the objective. A component is only added when a
 * concrete integration problem in *this* stack demands it, and each one records
 * what justified it.
 */
export function designOriginalLayer(
  stack: CapabilityStack,
  graph: CapabilityGraph,
  selected: string[],
): OriginalComponent[] {
  const out: OriginalComponent[] = [];

  if (selected.length > 1) {
    out.push({
      id: 'capability-router',
      name: 'Capability Router',
      rationale:
        'The selected capabilities come from independent projects with no shared entry point. Without a router the user has to know which source tool answers which request, which is exactly the cost integration is supposed to remove.',
      justifiedBy: [`${selected.length} capabilities drawn from ${new Set(stack.entries.map((e) => e.capability.sourceRepository)).size} sources`],
    });
  }

  const unresolved = stack.conflicts.filter((c) => !c.resolved);
  const namespaced = stack.conflicts.filter((c) => c.kind === 'command-namespace' || c.kind === 'duplicate-hook');
  if (namespaced.length > 0 || unresolved.length > 0) {
    out.push({
      id: 'namespace-guard',
      name: 'Namespace Guard',
      rationale:
        'Sources collided on names that the host resolves globally. The guard owns the single public surface and refuses to re-emit a source-specific duplicate.',
      justifiedBy: namespaced.map((c) => `${c.kind}: ${c.subject} (${c.parties.join(', ')})`),
    });
  }

  const degraded = stack.entries.filter(
    (e) => e.capability.licenseStatus === 'REFERENCE_ONLY' || e.capability.securityStatus !== 'PASS',
  );
  if (degraded.length > 0 || stack.rejected.length > 0) {
    out.push({
      id: 'evidence-ledger',
      name: 'Evidence Ledger',
      rationale:
        'Some capabilities entered the stack as concept references or with a non-clean gate result. The ledger keeps that distinction visible at runtime instead of letting the plugin present every result as equally verified.',
      justifiedBy: [
        ...degraded.map((e) => `${e.capabilityId} from ${e.capability.sourceRepository}: licence=${e.capability.licenseStatus}, security=${e.capability.securityStatus}`),
        ...stack.rejected.map((r) => `rejected ${r.candidate}: ${r.reason}`),
      ],
    });
  }

  const nearMisses = graph.nearMisses(selected);
  if (nearMisses.length > 0) {
    out.push({
      id: 'unlock-advisor',
      name: 'Unlock Advisor',
      rationale:
        'The stack sits one or two capabilities away from a larger capability. The advisor reports the specific missing piece instead of silently shipping the weaker workflow.',
      justifiedBy: nearMisses.map((n) => `${n.missing.join(' + ')} would unlock ${n.unlocks}`),
    });
  }

  return out;
}

function designWorkflow(selected: string[], graph: CapabilityGraph): string[] {
  // Topological-ish ordering: prerequisites first, then dependants.
  const ordered: string[] = [];
  const remaining = new Set(selected);
  let guard = 0;
  while (remaining.size > 0 && guard++ < 100) {
    let progressed = false;
    for (const cap of [...remaining]) {
      const pre = graph.prerequisites(cap).filter((p) => remaining.has(p));
      if (pre.length === 0) {
        ordered.push(cap);
        remaining.delete(cap);
        progressed = true;
      }
    }
    if (!progressed) {
      // Cycle or unsatisfiable ordering: emit the rest deterministically.
      for (const cap of [...remaining].sort()) ordered.push(cap);
      break;
    }
  }

  const steps = ordered.map((c, i) => `${i + 1}. ${capabilityName(c)} (${c})`);
  const unlocked = graph.unlocked(selected);
  for (const u of unlocked) {
    steps.push(`${steps.length + 1}. ${capabilityName(u)} (${u}) - unlocked by the combination above, not sourced separately`);
  }
  return steps;
}
