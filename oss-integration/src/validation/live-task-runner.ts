import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import type { ExecutedResult } from './benchmark.js';
import { projectRoot } from '../util/io.js';

/**
 * Real task runner.
 *
 * Executes the benchmark tasks against a real page in a real browser, using
 * real implementations of each capability. This is what turns Output Quality,
 * Execution Time and Reliability from NOT_VERIFIED into measurements.
 *
 * Honest scope, stated plainly so the report cannot overclaim:
 *   - The browser, the rendering, the accessibility engine, the pixel diff and
 *     the timings are all real.
 *   - The PAGE is a fixture served from localhost, not a remote production
 *     site. Remote sites are not reachable from this sandbox, and a page that
 *     changes under us would make the benchmark unreproducible.
 *   - Every subject runs the SAME implementations against the SAME page at the
 *     SAME viewports. The only thing that differs between subjects is which
 *     capabilities they hold, which is exactly the variable under test.
 */

const require_ = createRequire(import.meta.url);

export interface LiveTask {
  id: string;
  name: string;
  requires: string[];
}

export interface TaskOutcome {
  taskId: string;
  status: 'passed' | 'failed' | 'errored' | 'not-attempted';
  ms: number;
  detail: string;
  /** Artifacts that back the result, cited by the rubric. */
  evidence: Record<string, string | number>;
}

export interface SubjectRun {
  subject: string;
  outcomes: TaskOutcome[];
  totalMs: number;
  rubric: RubricScore[];
  executed: ExecutedResult;
}

export interface RubricScore {
  id: string;
  name: string;
  score: number | null;
  max: number;
  evidence: string;
}

export const ALL_CAPABILITIES = new Set([
  'browser-automation', 'screenshot-capture', 'accessibility-audit', 'performance-audit',
  'image-comparison', 'visual-regression', 'responsive-design', 'frontend-implementation',
  'visual-design', 'testing', 'visual-review',
]);

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
];

/** Measurements collected once per run; every subject reads from the same set. */
interface PageFacts {
  title: string;
  h1Count: number;
  headingOrderOk: boolean;
  ctaPresent: boolean;
  cardCount: number;
  axeViolations: number;
  axeSerious: number;
  axeRuleIds: string[];
  perViewport: {
    name: string;
    horizontalOverflow: boolean;
    contentWidth: number;
    screenshotBytes: number;
  }[];
  domContentLoadedMs: number;
  loadMs: number;
  diffRatio: number;
  screenshotCount: number;
}

export async function startSite(): Promise<{ server: Server; url: string }> {
  const html = readFileSync(resolve(projectRoot(), 'tests', 'fixtures', 'site', 'index.html'), 'utf8');
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/` };
}

/**
 * Drives a real browser and collects what the given capability set implies.
 *
 * Collection is capability-gated so that per-subject execution time is a real
 * measurement of that subject's work. Collecting everything once and sharing it
 * would make every subject's time identical and meaningless.
 */
export async function collectPageFacts(url: string, held: Set<string> = ALL_CAPABILITIES): Promise<PageFacts> {
  const { chromium } = require_('playwright') as typeof import('playwright');
  const axePath = require_.resolve('axe-core/axe.min.js');
  const axeSource = readFileSync(axePath, 'utf8');
  const pixelmatch = (require_('pixelmatch') as { default?: unknown }).default ?? require_('pixelmatch');
  const { PNG } = require_('pngjs') as typeof import('pngjs');

  // Playwright's bundled-browser version may not match what the host has
  // installed. OSS_CHROMIUM_PATH lets the caller point at an existing binary
  // rather than downloading a second copy.
  const explicitPath = process.env.OSS_CHROMIUM_PATH;
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
    ...(explicitPath ? { executablePath: explicitPath } : {}),
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load' });

    const structure = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map((h) => Number(h.tagName[1]));
      let ordered = true;
      for (let i = 1; i < headings.length; i++) {
        if ((headings[i] as number) - (headings[i - 1] as number) > 1) ordered = false;
      }
      return {
        title: document.title,
        h1Count: document.querySelectorAll('h1').length,
        headingOrderOk: ordered,
        ctaPresent: Boolean(document.querySelector('#cta')),
        cardCount: document.querySelectorAll('.card').length,
      };
    });

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return {
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : -1,
        loadMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : -1,
      };
    });

    // Accessibility: the real axe-core engine against the real DOM. Skipped
    // entirely when the subject has no accessibility capability, so its cost is
    // not charged to a subject that cannot do it.
    let axe = { violations: -1, serious: -1, ruleIds: [] as string[] };
    if (held.has('accessibility-audit')) {
    await page.addScriptTag({ content: axeSource });
    axe = (await page.evaluate(async () => {
      // @ts-expect-error injected at runtime
      const results = await window.axe.run(document, { resultTypes: ['violations'] });
      return {
        violations: results.violations.length,
        serious: results.violations.filter((v: { impact?: string }) => v.impact === 'serious' || v.impact === 'critical').length,
        ruleIds: results.violations.map((v: { id: string }) => v.id),
      };
    })) as { violations: number; serious: number; ruleIds: string[] };
    }

    const perViewport: PageFacts['perViewport'] = [];
    const shots: Buffer[] = [];
    const needsViewports = held.has('screenshot-capture') || held.has('responsive-design');
    for (const vp of needsViewports ? VIEWPORTS : []) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const shot = await page.screenshot({ fullPage: false });
      shots.push(shot);
      perViewport.push({
        name: vp.name,
        // A one-pixel rounding difference is not a broken layout.
        horizontalOverflow: layout.scrollWidth > layout.clientWidth + 1,
        contentWidth: layout.clientWidth,
        screenshotBytes: shot.byteLength,
      });
    }

    // Visual regression: capture the same viewport twice and diff. A stable
    // page must produce a zero diff; a non-zero diff here would mean the
    // capture pipeline itself is not deterministic.
    let diffRatio = -1;
    if (held.has('image-comparison')) {
      await page.setViewportSize({ width: 1440, height: 900 });
      const baseline = await page.screenshot({ fullPage: false });
      const current = await page.screenshot({ fullPage: false });
      const a = PNG.sync.read(baseline);
      const b = PNG.sync.read(current);
      const diff = new PNG({ width: a.width, height: a.height });
      const changed = (pixelmatch as (
        a: Buffer, b: Buffer, out: Buffer | null, w: number, h: number, o?: { threshold: number },
      ) => number)(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      diffRatio = changed / (a.width * a.height);
    }

    await context.close();
    return {
      ...structure,
      axeViolations: axe.violations,
      axeSerious: axe.serious,
      axeRuleIds: axe.ruleIds,
      perViewport,
      domContentLoadedMs: timing.domContentLoadedMs,
      loadMs: timing.loadMs,
      diffRatio,
      screenshotCount: shots.length,
    };
  } finally {
    await browser.close();
  }
}

type TaskImpl = (f: PageFacts) => { ok: boolean; detail: string; evidence: Record<string, string | number> };

/**
 * One implementation per task, shared by every subject. A subject changes which
 * tasks it may attempt, never how a task is carried out.
 */
const IMPLS: Record<string, TaskImpl> = {
  T1: (f) => {
    const overflow = f.perViewport.filter((v) => v.horizontalOverflow);
    return {
      ok: f.cardCount === 3 && overflow.length === 0,
      detail: overflow.length ? `horizontal overflow at ${overflow.map((v) => v.name).join(', ')}` : 'layout adapts at every viewport with no horizontal overflow',
      evidence: { cards: f.cardCount, viewports: f.perViewport.length, overflowViewports: overflow.length },
    };
  },
  T2: (f) => ({
    ok: f.h1Count === 1 && f.headingOrderOk && f.title.length > 0,
    detail: `one h1: ${f.h1Count === 1}, heading order sound: ${f.headingOrderOk}`,
    evidence: { h1Count: f.h1Count, headingOrderOk: String(f.headingOrderOk), title: f.title },
  }),
  T3: (f) => ({
    ok: f.screenshotCount === VIEWPORTS.length && f.perViewport.every((v) => v.screenshotBytes > 1000),
    detail: `captured ${f.screenshotCount} screenshots`,
    evidence: Object.fromEntries(f.perViewport.map((v) => [`shot:${v.name}`, v.screenshotBytes])),
  }),
  T4: (f) => ({
    // The page carries one deliberate defect, so the check is expected to FIND
    // something. A run reporting zero violations would mean axe did not run.
    ok: f.axeViolations > 0 && f.axeRuleIds.includes('image-alt'),
    detail: `axe-core reported ${f.axeViolations} violation(s): ${f.axeRuleIds.join(', ') || 'none'}`,
    evidence: { violations: f.axeViolations, serious: f.axeSerious, rules: f.axeRuleIds.join(',') },
  }),
  T5: (f) => ({
    ok: f.loadMs >= 0 && f.domContentLoadedMs >= 0,
    detail: `load ${f.loadMs}ms, DOMContentLoaded ${f.domContentLoadedMs}ms`,
    evidence: { loadMs: f.loadMs, domContentLoadedMs: f.domContentLoadedMs },
  }),
  T6: (f) => ({
    ok: f.diffRatio === 0,
    detail: `pixel diff ratio against baseline: ${f.diffRatio}`,
    evidence: { diffRatio: f.diffRatio },
  }),
  T8: (f) => ({
    ok: f.ctaPresent && f.cardCount === 3,
    detail: `DOM assertions: cta present ${f.ctaPresent}, cards ${f.cardCount}`,
    evidence: { ctaPresent: String(f.ctaPresent), cardCount: f.cardCount },
  }),
  T9: (f) => ({
    ok: f.axeViolations >= 0 && f.loadMs >= 0 && f.screenshotCount > 0,
    detail: `verdict assembled from ${f.axeViolations} a11y violation(s), load ${f.loadMs}ms, ${f.screenshotCount} screenshots`,
    evidence: { violations: f.axeViolations, loadMs: f.loadMs, screenshots: f.screenshotCount },
  }),
};

export function executableTaskIds(): string[] {
  return Object.keys(IMPLS);
}

export function runSubject(
  subject: string,
  capabilities: string[],
  tasks: LiveTask[],
  facts: PageFacts,
  collectionMs = 0,
): SubjectRun {
  const held = new Set(capabilities);
  const outcomes: TaskOutcome[] = [];
  // The browser work this subject's capabilities required is part of its cost.
  let totalMs = collectionMs;

  for (const task of tasks) {
    const impl = IMPLS[task.id];
    if (!impl) continue;
    if (!task.requires.every((r) => held.has(r))) {
      outcomes.push({
        taskId: task.id,
        status: 'not-attempted',
        ms: 0,
        detail: `missing capability: ${task.requires.filter((r) => !held.has(r)).join(', ')}`,
        evidence: {},
      });
      continue;
    }
    const started = performance.now();
    try {
      const res = impl(facts);
      const ms = Math.round(performance.now() - started);
      totalMs += ms;
      outcomes.push({
        taskId: task.id,
        status: res.ok ? 'passed' : 'failed',
        ms,
        detail: res.detail,
        evidence: res.evidence,
      });
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      totalMs += ms;
      outcomes.push({ taskId: task.id, status: 'errored', ms, detail: (err as Error).message, evidence: {} });
    }
  }

  const attempted = outcomes.filter((o) => o.status !== 'not-attempted');
  const passed = attempted.filter((o) => o.status === 'passed');
  const errored = attempted.filter((o) => o.status === 'errored' || o.status === 'failed');
  const rubric = scoreRubric(capabilities, facts, outcomes);

  return {
    subject,
    outcomes,
    totalMs,
    rubric,
    executed: {
      tasksAttempted: attempted.length,
      tasksPassed: passed.length,
      tasksErrored: errored.length,
      totalMs,
      rubric: rubric.map((r) => ({ id: r.id, score: r.score, max: r.max })),
      reliability: null,
    },
  };
}

/**
 * Output Quality rubric. A criterion is scored ONLY from a capability the
 * subject actually holds and a measurement that actually ran. Anything else is
 * null — excluded from the score rather than counted as zero, because "we could
 * not check" is not the same as "it failed".
 */
function scoreRubric(capabilities: string[], f: PageFacts, outcomes: TaskOutcome[]): RubricScore[] {
  const held = new Set(capabilities);
  const passed = (id: string) => outcomes.find((o) => o.taskId === id)?.status === 'passed';
  const attempted = (id: string) => {
    const o = outcomes.find((x) => x.taskId === id);
    return Boolean(o && o.status !== 'not-attempted');
  };

  const out: RubricScore[] = [];
  const add = (id: string, name: string, gate: boolean, score: number, evidence: string) =>
    out.push({ id, name, score: gate ? score : null, max: 2, evidence: gate ? evidence : 'NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run.' });

  add('requirement-satisfaction', 'Requirement Satisfaction', attempted('T8'), passed('T8') ? 2 : 0,
    `DOM assertions ${passed('T8') ? 'passed' : 'failed'} (cta present, 3 cards).`);
  add('visual-consistency', 'Visual Consistency', held.has('screenshot-capture') && attempted('T3'), passed('T3') ? 2 : 0,
    `${f.screenshotCount} screenshots captured across ${f.perViewport.length} viewports.`);
  add('responsive-behavior', 'Responsive Behavior', held.has('responsive-design') && attempted('T1'),
    f.perViewport.every((v) => !v.horizontalOverflow) ? 2 : 0,
    `no horizontal overflow at ${f.perViewport.map((v) => v.name).join(', ')}.`);
  add('accessibility', 'Accessibility', held.has('accessibility-audit') && attempted('T4'),
    f.axeSerious === 0 ? (f.axeViolations === 0 ? 2 : 1) : 0,
    `axe-core: ${f.axeViolations} violation(s), ${f.axeSerious} serious/critical (${f.axeRuleIds.join(', ') || 'none'}).`);
  add('functional-correctness', 'Functional Correctness', attempted('T8'), passed('T8') ? 2 : 0,
    `cta present: ${f.ctaPresent}, cards: ${f.cardCount}.`);
  add('visual-regression', 'Visual Regression', held.has('visual-regression') && attempted('T6'),
    f.diffRatio === 0 ? 2 : f.diffRatio < 0.01 ? 1 : 0,
    `pixel diff ratio ${f.diffRatio}.`);
  add('performance', 'Performance', held.has('performance-audit') && attempted('T5'),
    f.loadMs >= 0 && f.loadMs < 1000 ? 2 : f.loadMs >= 0 ? 1 : 0,
    `load ${f.loadMs}ms, DOMContentLoaded ${f.domContentLoadedMs}ms.`);
  // Deliberately never scored: the suite exercises a rendered page, not a
  // codebase, so there is no evidence for a code-quality judgement.
  out.push({
    id: 'code-quality',
    name: 'Code Quality',
    score: null,
    max: 2,
    evidence: 'NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion.',
  });
  return out;
}

/**
 * Executes the task suite for every subject, repeated `repeats` times.
 *
 * Every subject sees the same page, the same implementations and the same
 * viewports within a repeat, so the only variable is the capability set. That
 * is what makes the comparison fair: rule 10 requires identical task conditions.
 *
 * Reliability is only reported when `repeats > 1` — a single run cannot measure
 * variance, and reporting one run as "reliable" would be a guess.
 */
export interface SuiteResult {
  runs: Map<string, SubjectRun>;
  repeats: number;
  pageUrl: string;
  facts: unknown;
}

export async function runRealTaskSuite(
  subjects: { name: string; capabilities: string[] }[],
  tasks: LiveTask[],
  repeats = 1,
): Promise<SuiteResult> {
  const { server, url } = await startSite();
  try {
    const perRepeat: Map<string, SubjectRun>[] = [];
    let lastFacts: PageFacts | null = null;

    for (let i = 0; i < repeats; i++) {
      const round = new Map<string, SubjectRun>();
      // Each subject gets its own browser pass, doing only the collection its
      // capabilities imply, so its execution time is its own rather than a
      // shared figure that would be identical for everyone.
      for (const s of subjects) {
        const started = performance.now();
        const facts = await collectPageFacts(url, new Set(s.capabilities));
        const collectionMs = Math.round(performance.now() - started);
        lastFacts = facts;
        round.set(s.name, runSubject(s.name, s.capabilities, tasks, facts, collectionMs));
      }
      perRepeat.push(round);
    }

    const first = perRepeat[0] as Map<string, SubjectRun>;
    const runs = new Map<string, SubjectRun>();
    for (const [name, run] of first) {
      let reliability: number | null = null;
      if (repeats > 1) {
        const attempted = run.outcomes.filter((o) => o.status !== 'not-attempted');
        const stable = attempted.filter((o) =>
          perRepeat.every((r) => r.get(name)?.outcomes.find((x) => x.taskId === o.taskId)?.status === o.status),
        );
        reliability = attempted.length === 0 ? null : stable.length / attempted.length;
      }
      // Report the median total time rather than the first run's, so a cold
      // start does not become the headline number.
      const times = perRepeat.map((r) => r.get(name)?.totalMs ?? 0).sort((a, b) => a - b);
      const medianMs = times[Math.floor(times.length / 2)] ?? run.totalMs;
      runs.set(name, {
        ...run,
        totalMs: medianMs,
        executed: { ...run.executed, totalMs: medianMs, reliability },
      });
    }

    return { runs, repeats, pageUrl: url, facts: lastFacts };
  } finally {
    server.close();
  }
}
