/**
 * A "guild pack" is a reusable company profile: which departments exist, how a
 * task moves through them, what a reviewer must check, and how the prompt for a
 * worker is scaffolded. Packs are data, so adding one never touches the engine.
 */
export interface DepartmentBlueprint {
  code: string;
  nameEn: string;
  nameJa: string;
  nameKo: string;
  nameZh: string;
  mission: string;
  accent: string;
}

export interface GuildPack {
  key: string;
  nameEn: string;
  nameJa: string;
  /** Short label shown on task chips. */
  badge: string;
  summary: string;
  departments: DepartmentBlueprint[];
  /** Departments, in order, a task is routed through when it is decomposed. */
  pipeline: string[];
  /** Department that owns planning and final acceptance. */
  coordinatorCode: string;
  /** Department that must sign off before a task can reach `done`. */
  reviewerCode: string;
  /** Checklist injected into every review prompt. */
  reviewChecklist: string[];
  /** Instructions injected into every worker prompt. */
  executionRules: string[];
  /** Expected shape of a deliverable, used in the worker prompt. */
  deliverable: string;
}

const dept = (
  code: string,
  nameEn: string,
  nameJa: string,
  nameKo: string,
  nameZh: string,
  mission: string,
  accent: string,
): DepartmentBlueprint => ({ code, nameEn, nameJa, nameKo, nameZh, mission, accent });

export const PACKS: GuildPack[] = [
  {
    key: "software",
    nameEn: "Software Studio",
    nameJa: "ソフトウェアスタジオ",
    badge: "SW",
    summary: "Default engineering company: plan, build, verify, ship.",
    departments: [
      dept("strategy", "Strategy", "企画室", "기획실", "企划室", "Turns CEO intent into scoped, testable work orders.", "#7c9cff"),
      dept("build", "Engineering", "開発部", "개발부", "开发部", "Implements changes inside an isolated workspace.", "#4fd1a5"),
      dept("design", "Product Design", "デザイン部", "디자인부", "设计部", "Owns interface structure, states and visual language.", "#f0a4d0"),
      dept("quality", "Quality", "品質保証部", "품질보증부", "质量保证部", "Reproduces, tests and blocks regressions.", "#ffc857"),
      dept("platform", "Platform", "基盤部", "플랫폼부", "平台部", "Build pipeline, dependencies, runtime and security posture.", "#8f7bff"),
      dept("operations", "Operations", "運用部", "운영부", "运营部", "Release notes, docs, follow-up and housekeeping.", "#6fd0e8"),
    ],
    pipeline: ["strategy", "design", "build", "quality", "operations"],
    coordinatorCode: "strategy",
    reviewerCode: "quality",
    reviewChecklist: [
      "Does the change actually satisfy every acceptance criterion, literally?",
      "Are there failing or newly-skipped tests?",
      "Is anything outside the stated scope modified?",
      "Are errors handled, or silently swallowed?",
    ],
    executionRules: [
      "Work only inside the workspace path you were given.",
      "Make the smallest change that satisfies the acceptance criteria.",
      "Run the project's own checks before you report completion.",
      "If you cannot finish, stop and report the blocker instead of guessing.",
    ],
    deliverable: "A working code change plus a short summary of what you changed and how you verified it.",
  },
  {
    key: "document",
    nameEn: "Document Bureau",
    nameJa: "ドキュメント編集局",
    badge: "DOC",
    summary: "Structured written deliverables: reports, specs, manuals.",
    departments: [
      dept("editorial", "Editorial", "編集企画", "편집기획", "编辑企划", "Defines the outline, audience and voice.", "#7c9cff"),
      dept("research", "Research", "調査班", "조사반", "调查班", "Gathers and organises source material.", "#4fd1a5"),
      dept("writing", "Writing", "執筆班", "집필반", "执笔班", "Writes the sections against the outline.", "#f0a4d0"),
      dept("layout", "Layout", "体裁設計", "체재설계", "版式设计", "Headings, tables, figures and export formats.", "#8f7bff"),
      dept("review", "Review", "校閲班", "교열반", "校对班", "Fact, consistency and style pass.", "#ffc857"),
    ],
    pipeline: ["editorial", "research", "writing", "layout", "review"],
    coordinatorCode: "editorial",
    reviewerCode: "review",
    reviewChecklist: [
      "Does every outline section exist and carry real content?",
      "Is every factual claim traceable to a stated source?",
      "Is terminology consistent across sections?",
      "Does the length and register match the brief?",
    ],
    executionRules: [
      "Follow the agreed outline; do not silently reorganise it.",
      "Mark any claim you could not verify rather than asserting it.",
      "Write in the brief's language and register.",
    ],
    deliverable: "A Markdown document that follows the agreed outline, plus a list of open questions.",
  },
  {
    key: "research",
    nameEn: "Research Desk",
    nameJa: "リサーチデスク",
    badge: "RSD",
    summary: "Source-driven investigation with explicit citation discipline.",
    departments: [
      dept("planning", "Question Design", "調査設計", "조사설계", "调查设计", "Turns a vague question into answerable sub-questions.", "#7c9cff"),
      dept("collection", "Collection", "情報収集", "정보수집", "信息收集", "Finds and stores candidate sources.", "#4fd1a5"),
      dept("synthesis", "Synthesis", "統合分析", "통합분석", "综合分析", "Reconciles sources into findings.", "#f0a4d0"),
      dept("verification", "Verification", "検証班", "검증반", "验证班", "Challenges each finding against its evidence.", "#ffc857"),
    ],
    pipeline: ["planning", "collection", "synthesis", "verification"],
    coordinatorCode: "planning",
    reviewerCode: "verification",
    reviewChecklist: [
      "Does every finding cite at least one retrievable source?",
      "Are conflicting sources acknowledged rather than averaged away?",
      "Is the confidence level stated for each finding?",
      "Are the original sub-questions all answered or explicitly deferred?",
    ],
    executionRules: [
      "Record where each fact came from as you collect it.",
      "Separate what a source says from what you infer.",
      "Prefer primary sources; note when you could only find secondary ones.",
    ],
    deliverable: "Findings with per-item citations and a confidence rating.",
  },
  {
    key: "narrative",
    nameEn: "Narrative House",
    nameJa: "ナラティブハウス",
    badge: "NAR",
    summary: "Long-form fiction with world, plot and voice continuity.",
    departments: [
      dept("world", "Worldbuilding", "世界観設計", "세계관설계", "世界观设计", "Setting rules, canon and continuity ledger.", "#7c9cff"),
      dept("plot", "Plot", "物語構成", "이야기구성", "故事结构", "Beat structure, pacing and arcs.", "#4fd1a5"),
      dept("cast", "Cast", "キャラクター", "캐릭터", "角色", "Character voice, motivation and relationships.", "#f0a4d0"),
      dept("prose", "Prose", "本文執筆", "본문집필", "正文执笔", "Scene-level writing.", "#8f7bff"),
      dept("continuity", "Continuity", "整合検証", "정합검증", "一致性验证", "Catches canon and voice drift.", "#ffc857"),
    ],
    pipeline: ["world", "plot", "cast", "prose", "continuity"],
    coordinatorCode: "plot",
    reviewerCode: "continuity",
    reviewChecklist: [
      "Does anything contradict the established canon ledger?",
      "Is each character's voice distinguishable and consistent?",
      "Does the scene advance the beat it was assigned?",
      "Is the prose register stable across the chapter?",
    ],
    executionRules: [
      "Never introduce a new canon fact without adding it to the ledger.",
      "Write the assigned beat only; do not run ahead of the outline.",
    ],
    deliverable: "Prose for the assigned beats plus any new canon entries.",
  },
  {
    key: "film",
    nameEn: "Pre-production Unit",
    nameJa: "映像プリプロ班",
    badge: "FLM",
    summary: "Concept, script, shot list and edit notes for video work.",
    departments: [
      dept("concept", "Concept", "コンセプト", "콘셉트", "概念", "Logline, tone and reference board.", "#7c9cff"),
      dept("script", "Script", "脚本", "각본", "剧本", "Scene-by-scene script and dialogue.", "#4fd1a5"),
      dept("shots", "Shot Design", "画コンテ", "콘티", "分镜", "Shot list, framing and coverage.", "#f0a4d0"),
      dept("audio", "Audio", "音響設計", "음향설계", "音效设计", "VO, music brief and sound cues.", "#8f7bff"),
      dept("cut", "Edit Review", "編集検証", "편집검증", "剪辑验证", "Checks the cut plan against the script.", "#ffc857"),
    ],
    pipeline: ["concept", "script", "shots", "audio", "cut"],
    coordinatorCode: "concept",
    reviewerCode: "cut",
    reviewChecklist: [
      "Does every scripted beat have at least one shot covering it?",
      "Is the runtime estimate consistent with the shot list?",
      "Are audio cues placed against specific shots?",
    ],
    executionRules: [
      "Keep timings explicit; every scene carries an estimated duration.",
      "Reference shots by a stable ID so downstream notes can point at them.",
    ],
    deliverable: "Script, shot list with IDs and timings, and edit notes — all as text.",
  },
  {
    key: "persona",
    nameEn: "Persona Lab",
    nameJa: "ペルソナラボ",
    badge: "PSN",
    summary: "Character-driven conversational sessions with a consistency guard.",
    departments: [
      dept("charter", "Charter", "設定室", "설정실", "设定室", "Persona sheet, boundaries and refusal rules.", "#7c9cff"),
      dept("dialogue", "Dialogue", "会話エンジン", "대화엔진", "对话引擎", "Runs the in-character exchange.", "#4fd1a5"),
      dept("staging", "Staging", "演出", "연출", "演出", "Scene framing and pacing of the exchange.", "#f0a4d0"),
      dept("guard", "Consistency Guard", "整合ガード", "정합가드", "一致性守卫", "Flags out-of-character or boundary breaks.", "#ffc857"),
    ],
    pipeline: ["charter", "staging", "dialogue", "guard"],
    coordinatorCode: "charter",
    reviewerCode: "guard",
    reviewChecklist: [
      "Did the persona stay inside its charter and refusal rules?",
      "Is the voice consistent with the persona sheet?",
      "Were user-set boundaries respected?",
    ],
    executionRules: [
      "Stay inside the persona charter; break character to refuse rather than comply out of bounds.",
      "Keep replies at the length the charter specifies.",
    ],
    deliverable: "The in-character exchange plus a note on any boundary the persona had to hold.",
  },
];

export const DEFAULT_PACK_KEY = "software";

export function getPack(key: string): GuildPack {
  return PACKS.find((pack) => pack.key === key) ?? PACKS[0];
}

export function packKeys(): string[] {
  return PACKS.map((pack) => pack.key);
}
