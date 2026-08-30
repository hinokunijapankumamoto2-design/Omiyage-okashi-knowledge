import type { NearMiss, Relation, RelationKind } from '../types.js';
import { loadTaxonomy } from '../capability/taxonomy.js';

/**
 * Capability Graph.
 *
 * Independent implementation. The *idea* of a prerequisite graph with combo
 * unlocks and near-miss detection is acknowledged prior art (zz-plant/ambit,
 * MIT, read 2026-08-30) and is recorded in PROVENANCE.md. No Ambit code was
 * read or copied; the direction here is inverted - Ambit asks what the current
 * environment can do, this asks what should be acquired for a goal.
 */
export class CapabilityGraph {
  private readonly rels: Relation[];

  constructor(extra: Relation[] = []) {
    this.rels = [...loadTaxonomy().relations, ...extra];
  }

  all(): Relation[] {
    return this.rels;
  }

  of(kind: RelationKind): Relation[] {
    return this.rels.filter((r) => r.kind === kind);
  }

  /** Direct prerequisites of a capability. */
  prerequisites(capabilityId: string): string[] {
    const out = new Set<string>();
    for (const r of this.of('REQUIRES')) {
      if (r.from.includes(capabilityId)) out.add(r.to);
    }
    return [...out];
  }

  /** Transitive prerequisite closure, cycle-safe. */
  prerequisiteClosure(capabilityIds: string[]): string[] {
    const seen = new Set<string>(capabilityIds);
    const queue = [...capabilityIds];
    while (queue.length) {
      const cur = queue.shift() as string;
      for (const pre of this.prerequisites(cur)) {
        if (!seen.has(pre)) {
          seen.add(pre);
          queue.push(pre);
        }
      }
    }
    return [...seen];
  }

  complements(capabilityId: string): string[] {
    const out = new Set<string>();
    for (const r of this.of('COMPLEMENTS')) {
      if (r.from.includes(capabilityId)) out.add(r.to);
      if (r.to === capabilityId) for (const f of r.from) out.add(f);
    }
    out.delete(capabilityId);
    return [...out];
  }

  alternatives(capabilityId: string): string[] {
    const out = new Set<string>();
    for (const r of this.of('ALTERNATIVE_TO')) {
      if (r.from.includes(capabilityId)) out.add(r.to);
      if (r.to === capabilityId) for (const f of r.from) out.add(f);
    }
    out.delete(capabilityId);
    return [...out];
  }

  conflicts(capabilityId: string): string[] {
    const out = new Set<string>();
    for (const r of this.of('CONFLICTS_WITH')) {
      if (r.from.includes(capabilityId)) out.add(r.to);
      if (r.to === capabilityId) for (const f of r.from) out.add(f);
    }
    return [...out];
  }

  /** Capabilities that become possible once every member of `from` is held. */
  unlocked(have: string[]): string[] {
    const held = new Set(have);
    return this.of('UNLOCKS')
      .filter((r) => r.from.every((f) => held.has(f)))
      .map((r) => r.to)
      .filter((t) => !held.has(t));
  }

  /**
   * Near-miss detection: an UNLOCKS combo that is 1..maxDistance capabilities
   * short. This is what turns "we have three tools" into "add one more and you
   * get automated visual regression".
   */
  nearMisses(have: string[], maxDistance = 2): NearMiss[] {
    const held = new Set(have);
    const out: NearMiss[] = [];
    for (const r of this.of('UNLOCKS')) {
      if (held.has(r.to)) continue;
      const missing = r.from.filter((f) => !held.has(f));
      if (missing.length === 0) continue; // already unlocked, not a near miss
      if (missing.length > maxDistance) continue;
      out.push({
        unlocks: r.to,
        have: r.from.filter((f) => held.has(f)),
        missing,
        distance: missing.length,
      });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  /** Simple text rendering for reports. */
  render(scope?: string[]): string {
    const inScope = (id: string) => !scope || scope.includes(id);
    const lines: string[] = [];
    for (const r of this.rels) {
      if (!r.from.some(inScope) && !inScope(r.to)) continue;
      lines.push(`${r.from.join(' + ')} --${r.kind}--> ${r.to}${r.note ? `   # ${r.note}` : ''}`);
    }
    return lines.join('\n');
  }
}
