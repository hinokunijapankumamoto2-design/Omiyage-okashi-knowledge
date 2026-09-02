import { Router } from "express";
import { body, handler, param, str } from "../helpers.js";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  reorderDepartments,
  updateDepartment,
} from "../../domain/departments.js";
import {
  dismissStaff,
  getStaffWithSkills,
  hireStaff,
  leaderboard,
  levelFromXp,
  listStaff,
  updateStaff,
} from "../../domain/staff.js";
import { guildStats } from "../../domain/stats.js";
import { PACKS, getPack } from "../../domain/packs.js";
import { readSettings, writeSettings } from "../../domain/settings.js";
import { skillsForStaff } from "../../domain/skills.js";

export const officeRouter = Router();

officeRouter.get("/packs", handler(() => ({ packs: PACKS })));
officeRouter.get("/packs/:key", handler((req) => getPack(param(req, "key"))));

officeRouter.get(
  "/departments",
  handler((req) => ({ departments: listDepartments(str(req, "pack")) })),
);
officeRouter.post("/departments", handler((req) => createDepartment(body(req) as never)));
officeRouter.patch("/departments/:id", handler((req) => updateDepartment(param(req, "id"), body(req))));
officeRouter.delete(
  "/departments/:id",
  handler((req) => {
    deleteDepartment(param(req, "id"));
    return { ok: true };
  }),
);
officeRouter.post(
  "/departments/reorder",
  handler((req) => {
    reorderDepartments((body(req).ids as string[]) ?? []);
    return { ok: true };
  }),
);

officeRouter.get(
  "/staff",
  handler((req) => {
    const roster = listStaff({ departmentId: str(req, "department"), status: str(req, "status") });
    return {
      staff: roster.map((member) => ({ ...member, level: levelFromXp(member.xp).level })),
    };
  }),
);
officeRouter.get(
  "/staff/:id",
  handler((req) => {
    const member = getStaffWithSkills(param(req, "id"));
    return { ...member, level: levelFromXp(member.xp), skillDetails: skillsForStaff(member.id) };
  }),
);
officeRouter.post("/staff", handler((req) => hireStaff(body(req) as never)));
officeRouter.patch("/staff/:id", handler((req) => updateStaff(param(req, "id"), body(req))));
officeRouter.delete(
  "/staff/:id",
  handler((req) => {
    dismissStaff(param(req, "id"));
    return { ok: true };
  }),
);

officeRouter.get("/stats", handler(() => guildStats()));
officeRouter.get("/leaderboard", handler((req) => ({ entries: leaderboard(Number(str(req, "limit") ?? 10)) })));

officeRouter.get("/settings", handler(() => readSettings()));
officeRouter.patch("/settings", handler((req) => writeSettings(body(req))));
