import { all, one, run, transact } from "./index.js";
import { ids } from "../core/ids.js";
import { PACKS, DEFAULT_PACK_KEY, getPack } from "../domain/packs.js";
import { BUILTIN_SKILLS } from "../domain/skill-catalog.js";
import { createLogger } from "../core/logger.js";

const log = createLogger("seed");

/** Name pools are generated, not curated, so no third-party name list is embedded. */
const GIVEN = [
  "Aria", "Bran", "Cleo", "Dario", "Elin", "Faro", "Gwen", "Hugo", "Iris", "Jun",
  "Kaya", "Leon", "Mira", "Noel", "Orin", "Pia", "Quill", "Rhea", "Soren", "Tama",
  "Uma", "Vero", "Wren", "Xan", "Yuri", "Zia",
];
const JA = [
  "アリア", "ブラン", "クレオ", "ダリオ", "エリン", "ファーロ", "グウェン", "ヒューゴ", "イリス", "ジュン",
  "カヤ", "レオン", "ミラ", "ノエル", "オリン", "ピア", "クィル", "レア", "ソレン", "タマ",
  "ウマ", "ヴェロ", "レン", "ザン", "ユリ", "ジア",
];

const TEMPERAMENTS = [
  "Methodical; asks for acceptance criteria before starting.",
  "Fast first draft, then tightens it in a second pass.",
  "Skeptical; reproduces a problem before proposing a fix.",
  "Detail-obsessed; will not leave a loose end unlabelled.",
  "Systems thinker; looks for the cause one level up.",
  "Pragmatic; ships the smallest thing that satisfies the brief.",
];

function pick<T>(list: T[], index: number): T {
  return list[index % list.length];
}

export function seedIfEmpty(): void {
  const existing = one<{ n: number }>("SELECT COUNT(*) AS n FROM departments");
  if ((existing?.n ?? 0) > 0) {
    seedSkills();
    return;
  }
  log.info("empty database — seeding departments, staff and skills");
  transact(() => {
    seedDepartments();
    seedStaff();
    seedSkills();
    seedSettings();
  });
}

function seedDepartments(): void {
  for (const pack of PACKS) {
    pack.departments.forEach((blueprint, index) => {
      run(
        `INSERT INTO departments (id, pack_key, code, name_en, name_ja, name_ko, name_zh, mission, accent, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ids.department(),
        pack.key,
        blueprint.code,
        blueprint.nameEn,
        blueprint.nameJa,
        blueprint.nameKo,
        blueprint.nameZh,
        blueprint.mission,
        blueprint.accent,
        index,
      );
    });
  }
}

function seedStaff(): void {
  const pack = getPack(DEFAULT_PACK_KEY);
  const departments = all<{ id: string; code: string }>(
    "SELECT id, code FROM departments WHERE pack_key = ? ORDER BY sort_order",
    pack.key,
  );
  let cursor = 0;
  for (const department of departments) {
    // One lead plus two members keeps the default office readable but non-trivial.
    const seniorities: Array<"lead" | "senior" | "associate"> = ["lead", "senior", "associate"];
    for (const seniority of seniorities) {
      const index = cursor++;
      run(
        `INSERT INTO staff
           (id, department_id, display_name, name_ja, seniority, is_coordinator,
            runner_kind, runner_id, temperament, avatar_seed)
         VALUES (?, ?, ?, ?, ?, ?, 'cli', 'claude-code', ?, ?)`,
        ids.staff(),
        department.id,
        pick(GIVEN, index),
        pick(JA, index),
        seniority,
        seniority === "lead" && department.code === pack.coordinatorCode ? 1 : 0,
        pick(TEMPERAMENTS, index),
        index + 1,
      );
    }
  }
}

function seedSkills(): void {
  for (const skill of BUILTIN_SKILLS) {
    const exists = one("SELECT id FROM skills WHERE slug = ?", skill.slug);
    if (exists) continue;
    run(
      `INSERT INTO skills (id, slug, name, category, summary, body, origin)
       VALUES (?, ?, ?, ?, ?, ?, 'builtin')`,
      ids.skill(),
      skill.slug,
      skill.name,
      skill.category,
      skill.summary,
      skill.body,
    );
  }
}

function seedSettings(): void {
  const defaults: Record<string, unknown> = {
    "ui.locale": "ja",
    "ui.theme": "midnight",
    "guild.name": "AgentGuild",
    "guild.activePack": DEFAULT_PACK_KEY,
    "engine.autoDispatch": true,
    "engine.reviewRounds": 2,
  };
  for (const [key, value] of Object.entries(defaults)) {
    run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, JSON.stringify(value));
  }
}
