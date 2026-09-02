import { Router } from "express";
import { body, handler, param, str } from "../helpers.js";
import { listChannels, listMessages, postMessage } from "../../domain/messages.js";
import { DIRECTIVE_HELP, isDirective } from "../../engine/directives.js";
import { runDirective } from "../../engine/directive-runner.js";
import {
  categories,
  deleteCustomSkill,
  getSkill,
  learn,
  listSkills,
  skillsForStaff,
  unlearn,
  upsertCustomSkill,
} from "../../domain/skills.js";
import { badRequest } from "../../core/errors.js";

export const commsRouter = Router();

commsRouter.get("/channels", handler(() => ({ channels: listChannels() })));
commsRouter.get(
  "/messages",
  handler((req) => ({ messages: listMessages(str(req, "channel") ?? "lobby", Number(str(req, "limit") ?? 200)) })),
);

/**
 * One entry point for everything typed into the chat box: plain text is posted
 * as a CEO message, `$…` is parsed as a directive and answered by the system.
 */
commsRouter.post(
  "/messages",
  handler((req) => {
    const payload = body(req);
    const text = String(payload.body ?? "").trim();
    const channel = String(payload.channel ?? "lobby");
    if (!text) throw badRequest("empty_message", "a message needs a body");

    const posted = postMessage({
      channel,
      taskId: (payload.taskId as string) ?? null,
      authorKind: "ceo",
      body: text,
      directive: isDirective(text) ? text : "",
    });

    if (!isDirective(text)) return { message: posted };

    try {
      const result = runDirective(text, channel);
      const reply = postMessage({ channel, authorKind: "system", body: result.reply, taskId: result.taskId ?? null });
      return { message: posted, reply, result };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const reply = postMessage({ channel, authorKind: "system", body: `⚠ ${reason}` });
      return { message: posted, reply, result: { ok: false, reply: reason } };
    }
  }),
);

commsRouter.get("/directives", handler(() => ({ directives: DIRECTIVE_HELP })));

commsRouter.get(
  "/skills",
  handler((req) => ({ skills: listSkills(str(req, "category")), categories: categories() })),
);
commsRouter.get("/skills/:slug", handler((req) => getSkill(param(req, "slug"))));
commsRouter.post("/skills", handler((req) => upsertCustomSkill(body(req) as never)));
commsRouter.delete(
  "/skills/:slug",
  handler((req) => {
    deleteCustomSkill(param(req, "slug"));
    return { ok: true };
  }),
);
commsRouter.get("/staff/:id/skills", handler((req) => ({ skills: skillsForStaff(param(req, "id")) })));
commsRouter.post(
  "/staff/:id/skills",
  handler((req) => {
    const payload = body(req);
    learn(param(req, "id"), String(payload.slug), Number(payload.level ?? 1));
    return { skills: skillsForStaff(param(req, "id")) };
  }),
);
commsRouter.delete(
  "/staff/:id/skills/:slug",
  handler((req) => {
    unlearn(param(req, "id"), param(req, "slug"));
    return { skills: skillsForStaff(param(req, "id")) };
  }),
);
