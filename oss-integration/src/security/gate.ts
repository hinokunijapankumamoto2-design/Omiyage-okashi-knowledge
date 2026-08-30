import type { GateStatus, SecurityAssessment, SecurityFinding, SecurityRisk, Severity } from '../types.js';
import { worst } from '../license/gate.js';

/**
 * Security Gate.
 *
 * A static pattern scan over the artifacts that were actually collected.
 * Two rules keep it honest:
 *   1. Scanning nothing yields UNKNOWN, never PASS.
 *   2. A critical finding is a BLOCK regardless of how good the score is.
 */

interface Rule {
  id: string;
  risk: SecurityRisk;
  severity: Severity;
  pattern: RegExp;
  why: string;
}

const RULES: Rule[] = [
  {
    id: 'shell-pipe-installer',
    risk: 'untrusted-install-script',
    severity: 'critical',
    pattern: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/i,
    why: 'Pipes a network-fetched script straight into a shell.',
  },
  {
    id: 'shell-exec-interpolated',
    risk: 'unsafe-shell-execution',
    severity: 'high',
    pattern: /\b(execSync|exec)\s*\(\s*[`'"][^`'"]*\$\{/,
    why: 'Builds a shell command from interpolated input.',
  },
  {
    id: 'arbitrary-eval',
    risk: 'arbitrary-command-execution',
    severity: 'high',
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    why: 'Evaluates code at runtime.',
  },
  {
    id: 'skip-permissions',
    risk: 'excessive-permissions',
    severity: 'critical',
    pattern: /--dangerously-skip-permissions|bypassPermissions|"permissions"\s*:\s*"\*"/i,
    why: 'Requests or bypasses the host permission model wholesale.',
  },
  {
    id: 'destructive-rm-broad',
    risk: 'destructive-file-operations',
    severity: 'critical',
    pattern: /rm\s+-rf\s+(\/\s|\/$|\$HOME|~|\*)/,
    why: 'Recursive force delete against a broad path (filesystem root, home directory, or a glob).',
  },
  {
    // Split out from the rule above. The critical rule claims to fire on a
    // BROAD path, but the previous implementation matched any recursive+force
    // delete whatever the target was, so a library deleting its own computed
    // temp file was scored identically to `rm -rf /`. A recursive delete is
    // worth a human look; it is not on its own a reason to block a dependency.
    // The path expression is not evaluated here, so the severity reflects that
    // uncertainty rather than assuming the worst or assuming the best.
    id: 'recursive-force-delete',
    risk: 'destructive-file-operations',
    severity: 'medium',
    pattern: /\b(rmSync|rmdirSync|rm)\s*\([^)]*recursive:\s*true[^)]*force:\s*true/,
    why: 'Recursive force delete whose target path was not evaluated by this scan.',
  },
  {
    id: 'credential-read',
    risk: 'credential-exposure',
    severity: 'high',
    pattern: /\.aws\/credentials|\.ssh\/id_[a-z]+|\.npmrc|process\.env\.(AWS_SECRET|GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)/,
    why: 'Reads a credential store or a secret environment variable.',
  },
  {
    id: 'secret-exfil',
    risk: 'secret-collection',
    severity: 'critical',
    pattern: /(fetch|axios|request)\s*\([^)]*(token|secret|password|apiKey)/i,
    why: 'Sends something named like a secret over the network.',
  },
  {
    id: 'undeclared-network',
    risk: 'unexpected-network-access',
    severity: 'medium',
    pattern: /https?:\/\/(?!github\.com|raw\.githubusercontent\.com|registry\.npmjs\.org|docs\.|localhost|127\.0\.0\.1)[a-z0-9.-]+\/(collect|track|telemetry|beacon|ingest)/i,
    why: 'Contacts a telemetry or ingest endpoint.',
  },
];

const SEVERITY_TO_STATUS: Record<Severity, GateStatus> = {
  critical: 'BLOCK',
  high: 'REVIEW_REQUIRED',
  medium: 'CONDITIONAL',
  low: 'CONDITIONAL',
  info: 'PASS',
};

export interface SecurityScanInput {
  /** Artifact path -> text. Only what was actually collected. */
  artifacts: Record<string, string>;
  /** Declared dependency names, used for the advisory check. */
  dependencies?: string[];
  /** Package names with a known critical advisory, supplied by the caller. */
  knownVulnerable?: string[];
}

export function scanSecurity(input: SecurityScanInput): SecurityAssessment {
  const scanned = Object.keys(input.artifacts);
  const findings: SecurityFinding[] = [];

  // Dependency risk is checked structurally rather than by regex. The regex
  // version matched any JSON value beginning with http://, which fired on
  // author URLs and other metadata that are not dependencies at all.
  for (const [where, text] of Object.entries(input.artifacts)) {
    if (!/(^|\/)package\.json$/.test(where)) continue;
    findings.push(...inspectPackageJson(where, text));
  }

  for (const [where, text] of Object.entries(input.artifacts)) {
    for (const rule of RULES) {
      // Fresh lastIndex safety: rules are non-global, so exec is stable.
      const m = rule.pattern.exec(text);
      if (!m) continue;
      findings.push({
        risk: rule.risk,
        severity: rule.severity,
        where,
        excerpt: excerptAround(text, m.index, m[0].length),
        rule: `${rule.id}: ${rule.why}`,
      });
    }
  }

  for (const dep of input.dependencies ?? []) {
    if ((input.knownVulnerable ?? []).includes(dep)) {
      findings.push({
        risk: 'known-critical-vulnerability',
        severity: 'critical',
        where: 'dependencies',
        excerpt: dep,
        rule: 'advisory-list: dependency appears on the caller-supplied critical advisory list.',
      });
    }
  }

  if (scanned.length === 0) {
    return {
      status: 'UNKNOWN',
      findings,
      scanned,
      reasons: ['No artifact was available to scan. Absence of findings is not evidence of safety.'],
    };
  }

  let status: GateStatus = 'PASS';
  for (const f of findings) status = worst(status, SEVERITY_TO_STATUS[f.severity]);

  const reasons: string[] = [];
  reasons.push(`Scanned ${scanned.length} artifact(s): ${scanned.join(', ')}.`);
  if (findings.length === 0) {
    reasons.push('No pattern rule matched. This is a static scan only; it does not prove the code is safe.');
  } else {
    const bySeverity = new Map<Severity, number>();
    for (const f of findings) bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    reasons.push(
      'Findings: ' +
        [...bySeverity.entries()].map(([s, n]) => `${n} ${s}`).join(', ') +
        '.',
    );
  }
  return { status, findings, scanned, reasons };
}

/**
 * Structured package.json checks. Only the dependency maps are treated as
 * dependencies, and only the scripts that actually run at install time are
 * treated as install scripts.
 */
export function inspectPackageJson(where: string, text: string): SecurityFinding[] {
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(text);
  } catch {
    return [];
  }

  const out: SecurityFinding[] = [];
  const depMaps: [string, Record<string, string> | undefined][] = [
    ['dependencies', pkg.dependencies],
    ['optionalDependencies', pkg.optionalDependencies],
  ];
  for (const [mapName, map] of depMaps) {
    for (const [name, spec] of Object.entries(map ?? {})) {
      if (typeof spec !== 'string') continue;
      if (/^(git\+|git:\/\/|https?:\/\/|file:)/i.test(spec)) {
        out.push({
          risk: 'suspicious-dependency',
          severity: 'medium',
          where: `${where} > ${mapName}`,
          excerpt: `"${name}": "${spec}"`,
          rule: 'dependency-not-from-registry: resolved from a mutable or unauthenticated source rather than a versioned registry entry.',
        });
      }
    }
  }

  for (const stage of ['preinstall', 'install', 'postinstall'] as const) {
    const script = pkg.scripts?.[stage];
    if (!script) continue;
    out.push({
      risk: 'untrusted-install-script',
      severity: 'medium',
      where: `${where} > scripts.${stage}`,
      excerpt: script.length > 120 ? script.slice(0, 120) + '…' : script,
      rule: `install-script: "${stage}" runs automatically when the package is installed.`,
    });
  }

  return out;
}

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Which risk categories the gate can actually detect. Two categories
 * (suspicious dependencies, untrusted install scripts) are covered by the
 * structured package.json inspection rather than by a pattern rule, so counting
 * RULES alone understates coverage.
 */
export function coveredRisks(): SecurityRisk[] {
  return [...new Set<SecurityRisk>([...RULES.map((r) => r.risk), 'suspicious-dependency', 'untrusted-install-script'])];
}

export function securityRuleCount(): number {
  return RULES.length;
}
