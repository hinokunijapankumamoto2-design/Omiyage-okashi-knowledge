#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, realpathSync } from 'node:fs';
import { runScout, type ScoutOptions } from './pipeline.js';
import { designArchitecture } from './integration/architect.js';
import { buildPlugin } from './builder/plugin-builder.js';
import { validatePluginPackage } from './validation/package-validator.js';
import { runBenchmark, type BenchmarkTask } from './validation/benchmark.js';
import { buildSubjects, renderIntegrationReport, renderValidationReport } from './validation/reports.js';
import { renderGoalSpec, normalizeGoal } from './goal/engine.js';
import { analyzeRepository } from './repository/analyzer.js';
import { extractWithGates } from './capability/extractor.js';
import { assessHealth } from './health/engine.js';
import { projectRoot, readJson, writeFileEnsured } from './util/io.js';

/**
 * oss-integrate CLI.
 *
 *   oss-integrate goal    "<goal text>"                    (MODE A)
 *   oss-integrate analyze --repo <url>                     (MODE B)
 *   oss-integrate build   --goal "<text>" --repo <url> ... (MODE C)
 */

interface Args {
  command: string;
  goal: string | null;
  repos: string[];
  live: boolean;
  out: string | null;
  name: string | null;
  json: boolean;
  positional: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] ?? 'help',
    goal: null,
    repos: [],
    live: false,
    out: null,
    name: null,
    json: false,
    positional: [],
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--goal') args.goal = argv[++i] ?? null;
    else if (a === '--repo') {
      const v = argv[++i];
      if (v) args.repos.push(v);
    } else if (a === '--live') args.live = true;
    else if (a === '--out') args.out = argv[++i] ?? null;
    else if (a === '--name') args.name = argv[++i] ?? null;
    else if (a === '--json') args.json = true;
    else if (a && !a.startsWith('--')) args.positional.push(a);
  }
  return args;
}

function usage(): string {
  return `oss-integrate — OSS Scout x Integration Architect (v0.1)

  goal "<text>"                       MODE A. Decompose a goal into capabilities,
                                      discover candidate OSS, and print the best
                                      capability stack. No plugin is written.

  analyze --repo <github-url>         MODE B. Analyse one repository: capabilities,
                                      evidence, licence gate, security gate, health,
                                      Scout Score.

  build --goal "<text>" --repo <url>  MODE C. The full pipeline, ending in a real
        [--repo <url> ...]            plugin under generated/plugins/, plus
                                      INTEGRATION_REPORT.md, VALIDATION_REPORT.md
                                      and PROVENANCE.md.

Options
  --live          Allow network calls to the GitHub API. Off by default so runs
                  are reproducible; without it, unknown repositories resolve to
                  an explicit UNKNOWN rather than a guess.
  --out <dir>     Output root for build (default: generated/plugins).
  --name <name>   Name of the generated plugin (default: derived from the goal).
  --json          Emit machine-readable JSON instead of prose.
`;
}

async function cmdGoal(args: Args): Promise<number> {
  const goalText = args.goal ?? args.positional[0];
  if (!goalText) {
    console.error('goal: a goal string is required.\n\n' + usage());
    return 2;
  }
  const opts: ScoutOptions = { live: args.live };
  const scout = await runScout({ goal: goalText, repos: args.repos }, opts);

  if (args.json) {
    console.log(JSON.stringify({ goal: scout.goal, stack: scout.stack }, null, 2));
    return 0;
  }

  console.log('=== GOAL ===\n');
  console.log(renderGoalSpec(scout.goal));
  console.log('\n=== CAPABILITY GRAPH ===\n');
  console.log(scout.graph.render(scout.goal.requiredCapabilities) || '(no relations in scope)');
  console.log('\n=== DISCOVERY ===\n');
  for (const n of scout.discoveryNotes) console.log('- ' + n);
  for (const r of scout.discovered) {
    console.log(
      `- ${r.profile.id}: ${r.capabilities.map((c) => c.capabilityId).join(', ')} | licence ${r.license.status} (${r.license.policy}) | security ${r.security.status} | score ${r.score.total.toFixed(2)}`,
    );
  }
  console.log('\n=== GAP ===\n');
  console.log('missing: ' + (scout.stack.gaps.missing.join(', ') || '(none)'));
  for (const n of scout.stack.gaps.nearMisses) {
    console.log(`near-miss: add ${n.missing.join(' + ')} -> unlocks ${n.unlocks}`);
  }
  console.log('\n=== BEST CAPABILITY STACK ===\n');
  for (const e of scout.stack.entries) {
    console.log(
      `- ${e.capabilityId}  <- ${e.capability.sourceRepository}  [${e.origin}, evidence ${e.capability.evidence.class}, licence ${e.capability.licenseStatus}]`,
    );
  }
  console.log('\n=== UNKNOWN ===\n');
  for (const u of scout.goal.unknowns) console.log('- ' + u);
  for (const c of scout.unresolved) console.log(`- no candidate found for required capability "${c}"`);
  console.log('\nNothing was written. Run `build` to generate a plugin.');
  return 0;
}

async function cmdAnalyze(args: Args): Promise<number> {
  const ref = args.repos[0] ?? args.positional[0];
  if (!ref) {
    console.error('analyze: --repo <github-url> is required.\n\n' + usage());
    return 2;
  }
  const profile = await analyzeRepository(ref, { live: args.live });
  const goal = normalizeGoal({ goal: args.goal ?? '', repos: [ref] });
  const { capabilities, license, security } = extractWithGates(profile, { commercialUse: goal.commercialUse });
  const health = assessHealth(profile);

  if (args.json) {
    console.log(JSON.stringify({ profile, capabilities, license, security, health }, null, 2));
    return 0;
  }

  console.log(`=== REPOSITORY: ${profile.id} ===\n`);
  console.log(`URL                  : ${profile.url}`);
  console.log(`Data source          : ${profile.source} (captured ${profile.capturedAt})`);
  console.log(`Author/Organisation  : ${profile.owner}`);
  console.log(`Kind                 : ${profile.kind}`);
  console.log(`Description          : ${profile.description}`);
  console.log(`Licence              : ${profile.licenseSpdx} [evidence ${profile.licenseEvidence.class}]`);
  console.log(`Latest release       : ${profile.latestRelease}`);
  console.log(`Last meaningful update: ${profile.lastMeaningfulUpdate}`);
  console.log(`Documentation        : ${profile.documentation}`);
  console.log(`Tests                : ${profile.tests}`);
  console.log(`Dependencies         : ${profile.dependencies.join(', ') || 'UNKNOWN'}`);
  console.log(`Architecture         : ${profile.architecture}`);
  console.log(`Installation         : ${profile.installation}`);
  console.log(`Inspected artifacts  : ${profile.inspected.join(', ') || 'none'}`);
  console.log(`Primary capability   : ${profile.primaryCapability}`);
  console.log(`Secondary capabilities: ${profile.secondaryCapabilities.join(', ') || '(none)'}`);

  console.log('\n=== CAPABILITIES ===\n');
  for (const c of capabilities) {
    console.log(`- ${c.capabilityId} (${c.category})`);
    console.log(`    evidence   : ${c.evidence.class} via ${c.evidence.basis.join(', ') || 'nothing'}`);
    console.log(`    confidence : ${c.confidence}`);
    console.log(`    licence    : ${c.licenseStatus}`);
    console.log(`    security   : ${c.securityStatus}`);
    for (const l of c.limitations) console.log(`    limitation : ${l}`);
  }

  console.log('\n=== LICENCE GATE ===\n');
  console.log(`status: ${license.status}   policy: ${license.policy}`);
  for (const r of license.reasons) console.log('- ' + r);
  for (const c of license.conditions) console.log('  condition: ' + c);

  console.log('\n=== SECURITY GATE ===\n');
  console.log(`status: ${security.status}`);
  for (const r of security.reasons) console.log('- ' + r);
  for (const f of security.findings) {
    console.log(`- [${f.severity}] ${f.risk} in ${f.where}: ${f.rule}`);
    console.log(`    matched: ${f.excerpt}`);
  }

  console.log('\n=== HEALTH ===\n');
  console.log(`score: ${health.score ?? 'UNKNOWN'}`);
  for (const s of health.signals) console.log('- ' + s);
  for (const u of health.unknowns) console.log('- UNKNOWN: ' + u);
  return 0;
}

export function derivePluginName(goal: string): string {
  const ascii = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 4)
    .join('-');
  return ascii.length >= 3 ? `${ascii}-plugin` : 'optimized-plugin';
}

function loadTasks(): BenchmarkTask[] {
  const path = resolve(projectRoot(), 'tests', 'benchmark', 'tasks.json');
  if (!existsSync(path)) return [];
  return readJson<{ tasks: BenchmarkTask[] }>(path).tasks;
}

export interface BuildOutcome {
  outputDir: string;
  packageOk: boolean;
  benchmarkVerdict: string;
  reportPaths: string[];
}

export async function runBuild(args: {
  goal: string;
  repos: string[];
  live?: boolean;
  out?: string | null;
  name?: string | null;
}): Promise<BuildOutcome> {
  const scout = await runScout({ goal: args.goal, repos: args.repos }, { live: args.live ?? false });

  const pluginName = args.name ?? derivePluginName(args.goal);
  const plan = designArchitecture(scout.stack, { pluginName });

  const outputRoot = args.out ?? resolve(projectRoot(), 'generated', 'plugins');
  const built = buildPlugin(plan, { outputRoot });

  const pkg = validatePluginPackage(built.outputDir);
  const tasks = loadTasks();
  const { subjects, integratedName } = buildSubjects(scout, plan);
  const bench = runBenchmark(tasks, subjects, integratedName);

  const integrationPath = resolve(built.outputDir, 'INTEGRATION_REPORT.md');
  const validationPath = resolve(built.outputDir, 'VALIDATION_REPORT.md');
  writeFileEnsured(integrationPath, renderIntegrationReport(scout, plan));
  writeFileEnsured(validationPath, renderValidationReport(plan, pkg, bench, tasks));

  return {
    outputDir: built.outputDir,
    packageOk: pkg.ok,
    benchmarkVerdict: bench.overall,
    reportPaths: [integrationPath, validationPath, resolve(built.outputDir, 'PROVENANCE.md')],
  };
}

async function cmdBuild(args: Args): Promise<number> {
  const goalText = args.goal ?? args.positional[0];
  if (!goalText) {
    console.error('build: --goal "<text>" is required.\n\n' + usage());
    return 2;
  }
  const outcome = await runBuild({
    goal: goalText,
    repos: args.repos,
    live: args.live,
    out: args.out,
    name: args.name,
  });

  console.log('=== BUILD COMPLETE ===\n');
  console.log('Plugin           : ' + outcome.outputDir);
  console.log('Package validator: ' + (outcome.packageOk ? 'PASS' : 'FAIL'));
  console.log('Benchmark verdict: ' + outcome.benchmarkVerdict);
  console.log('\nReports:');
  for (const p of outcome.reportPaths) console.log('  - ' + p);
  if (!outcome.packageOk) {
    console.log('\nThe generated package failed structural validation. See VALIDATION_REPORT.md.');
    return 1;
  }
  return 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let code = 0;
  switch (args.command) {
    case 'goal':
      code = await cmdGoal(args);
      break;
    case 'analyze':
      code = await cmdAnalyze(args);
      break;
    case 'build':
      code = await cmdBuild(args);
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(usage());
      break;
    default:
      console.error(`Unknown command: ${args.command}\n\n${usage()}`);
      code = 2;
  }
  process.exitCode = code;
}

// Run main only when this file is the process entry point, so the module can
// also be imported by the tests without executing the CLI.
const entry = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (entry && fileURLToPath(import.meta.url) === entry) {
  await main();
}
