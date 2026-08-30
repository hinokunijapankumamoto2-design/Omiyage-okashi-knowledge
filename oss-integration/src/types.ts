/**
 * OSS Scout x Integration Architect - shared domain model.
 *
 * Design rule for this file: every field that can be unknown is explicitly
 * representable as UNKNOWN. Nothing in this system is allowed to invent a
 * value it did not observe.
 */

export const UNKNOWN = 'UNKNOWN' as const;
export type Unknown = typeof UNKNOWN;

/** Evidence classes, strongest first. See docs: EVIDENCE STANDARD. */
export type EvidenceClass = 'VERIFIED' | 'SUPPORTED' | 'INFERRED' | 'CLAIMED' | 'UNKNOWN';

/**
 * Where a piece of evidence came from, strongest first. The evidence engine
 * derives an EvidenceClass from these, never from stars or README prose alone.
 */
export type EvidenceBasis =
  | 'executable-test'
  | 'source-inspection'
  | 'reproducible-example'
  | 'official-documentation'
  | 'independent-evidence'
  | 'maintainer-activity'
  | 'readme-claim'
  | 'social-popularity';

export interface Evidence {
  class: EvidenceClass;
  basis: EvidenceBasis[];
  /** Human-readable notes about what was actually inspected. */
  notes: string[];
}

/** Hard gate status. BLOCK always beats a high score. */
export type GateStatus = 'PASS' | 'CONDITIONAL' | 'REVIEW_REQUIRED' | 'BLOCK' | 'UNKNOWN';

export type GateName = 'LICENSE' | 'SECURITY' | 'SOURCE_INTEGRITY' | 'REPRODUCIBILITY';

export interface GateResult {
  gate: GateName;
  status: GateStatus;
  reasons: string[];
}

/** How third-party material may legally be used. */
export type ReusePolicy =
  | 'REUSE_OK'
  | 'REUSE_WITH_CONDITIONS'
  | 'REFERENCE_ONLY'
  | 'LEGAL_REVIEW'
  | 'BLOCK';

export interface LicenseAssessment {
  spdx: string | Unknown;
  evidence: Evidence;
  policy: ReusePolicy;
  status: GateStatus;
  conditions: string[];
  reasons: string[];
}

export type SecurityRisk =
  | 'arbitrary-command-execution'
  | 'unsafe-shell-execution'
  | 'credential-exposure'
  | 'secret-collection'
  | 'unexpected-network-access'
  | 'destructive-file-operations'
  | 'excessive-permissions'
  | 'untrusted-install-script'
  | 'suspicious-dependency'
  | 'known-critical-vulnerability';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  risk: SecurityRisk;
  severity: Severity;
  where: string;
  excerpt: string;
  rule: string;
}

export interface SecurityAssessment {
  status: GateStatus;
  findings: SecurityFinding[];
  /** Which artifacts were actually scanned. An empty list means UNKNOWN, not PASS. */
  scanned: string[];
  reasons: string[];
}

export interface HealthAssessment {
  /** 0-5, or null when there is not enough signal to score honestly. */
  score: number | null;
  lastMeaningfulUpdate: string | Unknown;
  releaseCadence: string | Unknown;
  signals: string[];
  unknowns: string[];
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export type TriState = 'YES' | 'NO' | 'UNKNOWN';

export interface GoalSpec {
  raw: string;
  goal: string;
  targetEnvironment: string | Unknown;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  constraints: string[];
  userSuppliedOss: string[];
  commercialUse: TriState;
  evidenceStandard: EvidenceClass;
  /**
   * Which goal archetypes expanded this goal, and why. Recorded so the
   * expansion is auditable and can be rejected, rather than looking like the
   * engine invented requirements.
   */
  derivedFrom: { archetype: string; rationale: string }[];
  /** Everything the user did not state. Never silently filled in. */
  unknowns: string[];
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export type SignalPresence = 'PRESENT' | 'ABSENT' | 'UNKNOWN';

export type RepoSource = 'fixture' | 'live-github' | 'registry-seed';

export interface PluginSurface {
  commands: string[];
  skills: string[];
  agents: string[];
  hooks: string[];
  mcpServers: string[];
  configKeys: string[];
  writesPaths: string[];
  envVars: string[];
}

export function emptySurface(): PluginSurface {
  return {
    commands: [],
    skills: [],
    agents: [],
    hooks: [],
    mcpServers: [],
    configKeys: [],
    writesPaths: [],
    envVars: [],
  };
}

export interface RepositoryProfile {
  /** owner/name */
  id: string;
  url: string;
  owner: string;
  name: string;
  description: string | Unknown;
  kind:
    | 'claude-plugin'
    | 'skill'
    | 'agent'
    | 'hook'
    | 'mcp-server'
    | 'library'
    | 'cli'
    | 'framework'
    | 'unknown';
  licenseSpdx: string | Unknown;
  licenseEvidence: Evidence;
  latestRelease: string | Unknown;
  lastMeaningfulUpdate: string | Unknown;
  documentation: SignalPresence;
  tests: SignalPresence;
  dependencies: string[];
  architecture: string | Unknown;
  installation: string | Unknown;
  primaryCapability: string | Unknown;
  secondaryCapabilities: string[];
  stars: number | null;
  /** Artifact kinds actually inspected, e.g. ['README','source','tests','package-metadata']. */
  inspected: string[];
  /** Raw text blobs the gates are allowed to scan. Keyed by artifact path. */
  artifacts: Record<string, string>;
  /** Declared plugin surface, used for conflict detection. */
  surface: PluginSurface;
  source: RepoSource;
  capturedAt: string | Unknown;
  /** Provenance of the data itself, e.g. a URL that was read. */
  dataProvenance: string[];
}

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

export type CapabilityCategory =
  | 'design'
  | 'implementation'
  | 'automation'
  | 'verification'
  | 'quality'
  | 'security'
  | 'orchestration'
  | 'unknown';

export interface CompatibilityInfo {
  runtime: string[];
  conflictsWith: string[];
  notes: string[];
}

export interface Capability {
  capabilityId: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  sourceRepository: string;
  sourceVersion: string | Unknown;
  sourceCommit: string | Unknown;
  evidence: Evidence;
  strength: string[];
  limitations: string[];
  dependencies: string[];
  compatibility: CompatibilityInfo;
  licenseStatus: ReusePolicy;
  securityStatus: GateStatus;
  /** 0-1. Derived from evidence class and gate status, never asserted freely. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type RelationKind = 'REQUIRES' | 'COMPLEMENTS' | 'ALTERNATIVE_TO' | 'CONFLICTS_WITH' | 'UNLOCKS';

export interface Relation {
  from: string[];
  kind: RelationKind;
  to: string;
  note?: string;
}

export interface NearMiss {
  unlocks: string;
  have: string[];
  missing: string[];
  distance: number;
}

// ---------------------------------------------------------------------------
// Scoring & decisions
// ---------------------------------------------------------------------------

export type ScoutAxis =
  | 'taskFit'
  | 'evidence'
  | 'maintenance'
  | 'architecture'
  | 'compatibility'
  | 'differentiation'
  | 'integrationValue'
  | 'popularity';

export interface ScoutScore {
  total: number;
  breakdown: Record<ScoutAxis, { raw: number; weight: number; weighted: number; why: string }>;
  gates: GateResult[];
  blocked: boolean;
}

export type DecisionKind = 'KEEP' | 'REPLACE' | 'ADD' | 'REMOVE' | 'WATCH' | 'REJECT' | 'UNKNOWN';

export interface CapabilityDecision {
  capabilityId: string;
  candidate: string;
  decision: DecisionKind;
  reason: string;
  replacedBy?: string;
}

export type SelectionAxis =
  | 'BEST_EVIDENCE'
  | 'BEST_IMPLEMENTATION'
  | 'BEST_MAINTENANCE'
  | 'BEST_ARCHITECTURE'
  | 'BEST_COMPATIBILITY'
  | 'BEST_INTEGRATION_VALUE'
  | 'BEST_REFERENCE';

export interface DuplicateGroup {
  capabilityId: string;
  members: string[];
  winner: string;
  axis: SelectionAxis;
  reason: string;
}

export type ConflictKind =
  | 'command-namespace'
  | 'duplicate-hook'
  | 'overlapping-agent'
  | 'incompatible-dependency'
  | 'runtime-conflict'
  | 'configuration-conflict'
  | 'filesystem-conflict'
  | 'duplicated-mcp-responsibility'
  | 'environment-conflict';

export interface Conflict {
  kind: ConflictKind;
  subject: string;
  parties: string[];
  detail: string;
  resolution: string;
  resolved: boolean;
}

export interface GapReport {
  required: string[];
  current: string[];
  missing: string[];
  /**
   * Required capabilities that no single source supplies, but which the graph
   * says are UNLOCKED by the combination already held. These are not gaps -
   * they are the point of integrating.
   */
  coveredByUnlock: string[];
  nearMisses: NearMiss[];
}

// ---------------------------------------------------------------------------
// Stack & architecture
// ---------------------------------------------------------------------------

export interface StackEntry {
  capabilityId: string;
  capability: Capability;
  origin: 'user-supplied' | 'discovered' | 'original';
  selectionAxis: SelectionAxis | 'ORIGINAL';
  rejectedAlternatives: { candidate: string; reason: string }[];
}

export interface CapabilityStack {
  goal: GoalSpec;
  entries: StackEntry[];
  decisions: CapabilityDecision[];
  duplicates: DuplicateGroup[];
  conflicts: Conflict[];
  gaps: GapReport;
  rejected: { capabilityId: string; candidate: string; reason: string }[];
}

export interface OriginalComponent {
  id: string;
  name: string;
  rationale: string;
  justifiedBy: string[];
}

export interface ArchitectureLayer {
  name: string;
  responsibility: string;
  capabilities: string[];
  components: { kind: 'skill' | 'agent' | 'hook' | 'command' | 'mcp' | 'config' | 'doc'; name: string }[];
}

export interface ArchitecturePlan {
  pluginName: string;
  displayName: string;
  description: string;
  layers: ArchitectureLayer[];
  originalComponents: OriginalComponent[];
  workflow: string[];
  unifiedConfig: Record<string, { type: string; description: string; default?: unknown }>;
  normalizedDependencies: { name: string; requiredBy: string[]; resolution: string }[];
  conflicts: Conflict[];
  stack: CapabilityStack;
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface ProvenanceRecord {
  source: string;
  repository: string;
  author: string | Unknown;
  license: string | Unknown;
  commitOrRelease: string | Unknown;
  researchDate: string;
  capability: string;
  adoptedConcept: string;
  reusedCode: string;
  modification: string;
  originalContribution: string;
  evidence: EvidenceClass;
  decision: DecisionKind;
  generatedComponent: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type BenchmarkVerdict = 'IMPROVED' | 'EQUIVALENT' | 'REGRESSION' | 'NOT_VERIFIED';

export interface MetricResult {
  metric: string;
  unit: string;
  measured: boolean;
  /**
   * Whether this metric feeds the overall verdict. Set false only for a metric
   * whose comparison is not like-for-like across subjects; `excludedBecause`
   * must then say why, and the report prints it.
   */
  countsTowardVerdict: boolean;
  excludedBecause?: string;
  values: Record<string, number | null>;
  higherIsBetter: boolean;
  verdict: BenchmarkVerdict;
  note: string;
  /** Whether a regression here blocks a PASS, per the pre-registered materiality rule. */
  material?: boolean;
  materialityNote?: string;
}

export interface BenchmarkReport {
  kind: string;
  taskCount: number;
  subjects: string[];
  metrics: MetricResult[];
  overall: BenchmarkVerdict;
  overallNote: string;
  notMeasured: string[];
}
