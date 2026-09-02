import { describe, expect, it } from "vitest";
import { BUILTIN_SKILLS } from "../domain/skill-catalog.js";

describe("built-in skills", () => {
  it("uses unique slugs", () => {
    const slugs = BUILTIN_SKILLS.map((skill) => skill.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses slugs the API will accept", () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.slug, skill.slug).toMatch(/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/);
    }
  });

  it("gives every skill a body with at least one rule", () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.body, skill.slug).toContain("## Rules");
      expect(skill.body.split("\n- ").length, skill.slug).toBeGreaterThan(1);
    }
  });
});
