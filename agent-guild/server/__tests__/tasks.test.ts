import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const scratch = mkdtempSync(path.join(tmpdir(), "agent-guild-test-"));
process.env.AG_DATA_DIR = scratch;
process.env.AG_DB_PATH = path.join(scratch, "test.sqlite");
process.env.AG_LOG_DIR = path.join(scratch, "logs");

const { openDatabase, closeDatabase } = await import("../db/index.js");
const { seedIfEmpty } = await import("../db/seed.js");
const tasks = await import("../domain/tasks.js");
const staff = await import("../domain/staff.js");

beforeAll(() => {
  openDatabase();
  seedIfEmpty();
});

afterAll(() => {
  closeDatabase();
  rmSync(scratch, { recursive: true, force: true });
});

describe("stage transitions", () => {
  it("allows the forward path through the pipeline", () => {
    expect(tasks.canTransition("inbox", "planning")).toBe(true);
    expect(tasks.canTransition("planning", "running")).toBe(true);
    expect(tasks.canTransition("running", "review")).toBe(true);
    expect(tasks.canTransition("review", "done")).toBe(true);
  });

  it("refuses to jump straight from the inbox to done", () => {
    expect(tasks.canTransition("inbox", "done")).toBe(false);
  });

  it("treats a no-op move as legal", () => {
    expect(tasks.canTransition("running", "running")).toBe(true);
  });

  it("rejects an illegal move through the API surface", () => {
    const task = tasks.createTask({ title: "Illegal move" });
    expect(() => tasks.updateTask(task.id, { stage: "done" })).toThrow(/cannot move a task/i);
  });
});

describe("task persistence", () => {
  it("round-trips a task and its fields", () => {
    const created = tasks.createTask({
      title: "Add rate limiting",
      brief: "Protect the public API",
      acceptance: "429 after 10 req/s",
      priority: 3,
    });
    const loaded = tasks.getTask(created.id);
    expect(loaded.title).toBe("Add rate limiting");
    expect(loaded.acceptance).toBe("429 after 10 req/s");
    expect(loaded.priority).toBe(3);
    expect(loaded.stage).toBe("inbox");
  });

  it("refuses an empty title", () => {
    expect(() => tasks.createTask({ title: "   " })).toThrow(/title/i);
  });

  it("groups subtasks under their parent", () => {
    const parent = tasks.createTask({ title: "Parent" });
    tasks.createTask({ title: "Child A", parentTaskId: parent.id });
    tasks.createTask({ title: "Child B", parentTaskId: parent.id });
    expect(tasks.subtasksOf(parent.id).map((task) => task.title).sort()).toEqual(["Child A", "Child B"]);
  });

  it("keeps subtasks out of the top-level board", () => {
    const parent = tasks.createTask({ title: "Board parent" });
    tasks.createTask({ title: "Board child", parentTaskId: parent.id });
    const board = tasks.boardSnapshot();
    const titles = Object.values(board).flat().map((task) => task.title);
    expect(titles).toContain("Board parent");
    expect(titles).not.toContain("Board child");
  });
});

describe("experience curve", () => {
  it("starts at level 1", () => {
    expect(staff.levelFromXp(0).level).toBe(1);
    expect(staff.levelFromXp(99).level).toBe(1);
  });

  it("levels up at the band boundary", () => {
    expect(staff.levelFromXp(100).level).toBe(2);
  });

  it("makes each band more expensive than the last", () => {
    const second = staff.levelFromXp(100).span;
    const third = staff.levelFromXp(100 + second).span;
    expect(third).toBeGreaterThan(second);
  });

  it("keeps progress inside the current band", () => {
    const progress = staff.levelFromXp(150);
    expect(progress.into).toBeLessThan(progress.span);
  });
});

describe("seeding", () => {
  it("creates a full office", () => {
    expect(staff.listStaff().length).toBeGreaterThan(0);
    expect(staff.listStaff().every((member) => member.departmentId)).toBe(true);
  });
});
