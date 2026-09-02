import { all, one, run } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { badRequest, notFound } from "../core/errors.js";

export interface Skill {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  body: string;
  origin: "builtin" | "custom";
  createdAt: number;
  learners?: number;
}

const SELECT = `
  SELECT sk.id, sk.slug, sk.name, sk.category, sk.summary, sk.body, sk.origin, sk.created_at AS createdAt,
         (SELECT COUNT(*) FROM staff_skills ss WHERE ss.skill_id = sk.id) AS learners
  FROM skills sk`;

export function listSkills(category?: string): Skill[] {
  return category
    ? all<Skill>(`${SELECT} WHERE sk.category = ? ORDER BY sk.name`, category)
    : all<Skill>(`${SELECT} ORDER BY sk.category, sk.name`);
}

export function getSkill(idOrSlug: string): Skill {
  const row =
    one<Skill>(`${SELECT} WHERE sk.id = ?`, idOrSlug) ?? one<Skill>(`${SELECT} WHERE sk.slug = ?`, idOrSlug);
  if (!row) throw notFound("skill");
  return row;
}

export function categories(): Array<{ category: string; count: number }> {
  return all("SELECT category, COUNT(*) AS count FROM skills GROUP BY category ORDER BY category");
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export function upsertCustomSkill(input: {
  slug: string;
  name: string;
  category?: string;
  summary?: string;
  body: string;
}): Skill {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw badRequest("bad_slug", "slug must be lowercase letters, digits and hyphens (3-60 chars)");
  }
  const existing = one<{ id: string; origin: string }>("SELECT id, origin FROM skills WHERE slug = ?", slug);
  if (existing && existing.origin === "builtin") {
    throw badRequest("builtin_readonly", `"${slug}" is a built-in skill; choose a different slug`);
  }
  if (existing) {
    run(
      "UPDATE skills SET name = ?, category = ?, summary = ?, body = ? WHERE id = ?",
      input.name,
      input.category ?? "custom",
      input.summary ?? "",
      input.body,
      existing.id,
    );
  } else {
    run(
      `INSERT INTO skills (id, slug, name, category, summary, body, origin)
       VALUES (?, ?, ?, ?, ?, ?, 'custom')`,
      ids.skill(),
      slug,
      input.name,
      input.category ?? "custom",
      input.summary ?? "",
      input.body,
    );
  }
  bus.publish({ type: "skill.updated", staffId: null });
  return getSkill(slug);
}

export function deleteCustomSkill(slug: string): void {
  const skill = getSkill(slug);
  if (skill.origin === "builtin") throw badRequest("builtin_readonly", "built-in skills cannot be deleted");
  run("DELETE FROM skills WHERE id = ?", skill.id);
  bus.publish({ type: "skill.updated", staffId: null });
}

export function learn(staffId: string, slug: string, level = 1): void {
  const skill = getSkill(slug);
  run(
    `INSERT INTO staff_skills (staff_id, skill_id, level) VALUES (?, ?, ?)
     ON CONFLICT(staff_id, skill_id) DO UPDATE SET level = excluded.level`,
    staffId,
    skill.id,
    Math.min(5, Math.max(1, level)),
  );
  bus.publish({ type: "skill.updated", staffId });
}

export function unlearn(staffId: string, slug: string): void {
  const skill = getSkill(slug);
  run("DELETE FROM staff_skills WHERE staff_id = ? AND skill_id = ?", staffId, skill.id);
  bus.publish({ type: "skill.updated", staffId });
}

export function skillsForStaff(staffId: string): Skill[] {
  return all<Skill>(
    `${SELECT} JOIN staff_skills ss ON ss.skill_id = sk.id WHERE ss.staff_id = ? ORDER BY sk.category, sk.name`,
    staffId,
  );
}
