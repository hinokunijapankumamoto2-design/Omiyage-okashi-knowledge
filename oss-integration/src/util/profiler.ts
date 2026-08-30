/**
 * Minimal phase profiler.
 *
 * Exists so that "where does the time go" is answered by measurement rather
 * than by intuition. Rule: no optimization lands without a profile entry
 * showing what it targeted.
 */
export interface PhaseSample {
  phase: string;
  ms: number;
  count: number;
}

export class Profiler {
  private readonly totals = new Map<string, { ms: number; count: number }>();

  async time<T>(phase: string, fn: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      return await fn();
    } finally {
      this.record(phase, performance.now() - started);
    }
  }

  timeSync<T>(phase: string, fn: () => T): T {
    const started = performance.now();
    try {
      return fn();
    } finally {
      this.record(phase, performance.now() - started);
    }
  }

  record(phase: string, ms: number): void {
    const cur = this.totals.get(phase) ?? { ms: 0, count: 0 };
    cur.ms += ms;
    cur.count += 1;
    this.totals.set(phase, cur);
  }

  merge(other: Profiler): void {
    for (const s of other.samples()) {
      const cur = this.totals.get(s.phase) ?? { ms: 0, count: 0 };
      cur.ms += s.ms;
      cur.count += s.count;
      this.totals.set(s.phase, cur);
    }
  }

  samples(): PhaseSample[] {
    return [...this.totals.entries()]
      .map(([phase, v]) => ({ phase, ms: Math.round(v.ms * 10) / 10, count: v.count }))
      .sort((a, b) => b.ms - a.ms);
  }

  totalMs(): number {
    return Math.round([...this.totals.values()].reduce((a, v) => a + v.ms, 0) * 10) / 10;
  }

  render(): string {
    const total = this.totalMs();
    const rows = this.samples().map(
      (s) => `| ${s.phase} | ${s.ms} | ${total === 0 ? 0 : Math.round((s.ms / total) * 1000) / 10}% | ${s.count} |`,
    );
    return ['| Phase | ms | % | calls |', '| --- | --- | --- | --- |', ...rows].join('\n');
  }
}
