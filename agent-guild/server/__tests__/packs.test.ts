import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_KEY, PACKS, getPack, packKeys } from "../domain/packs.js";

describe("guild packs", () => {
  it("exposes a stable default", () => {
    expect(packKeys()).toContain(DEFAULT_PACK_KEY);
  });

  it("gives every pack a coordinator and a reviewer that exist in it", () => {
    for (const pack of PACKS) {
      const codes = pack.departments.map((department) => department.code);
      expect(codes, `${pack.key} coordinator`).toContain(pack.coordinatorCode);
      expect(codes, `${pack.key} reviewer`).toContain(pack.reviewerCode);
    }
  });

  it("routes only through departments the pack declares", () => {
    for (const pack of PACKS) {
      const codes = new Set(pack.departments.map((department) => department.code));
      for (const step of pack.pipeline) expect(codes.has(step), `${pack.key}:${step}`).toBe(true);
    }
  });

  it("keeps department codes unique inside a pack", () => {
    for (const pack of PACKS) {
      const codes = pack.departments.map((department) => department.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it("gives every pack review criteria and execution rules", () => {
    for (const pack of PACKS) {
      expect(pack.reviewChecklist.length).toBeGreaterThan(0);
      expect(pack.executionRules.length).toBeGreaterThan(0);
      expect(pack.deliverable).not.toBe("");
    }
  });

  it("falls back to the first pack for an unknown key", () => {
    expect(getPack("nope").key).toBe(PACKS[0].key);
  });
});
