import { Router } from "express";
import PptxGenJS from "pptxgenjs";
import { handler, param } from "../helpers.js";
import { getMeeting, minutesMarkdown } from "../../domain/meetings.js";
import { getReport } from "../../domain/reports.js";
import { guildStats } from "../../domain/stats.js";

export const exportRouter = Router();

const INK = "1B1E28";
const ACCENT = "6C8CFF";
const MUTED = "6B7280";

function titleSlide(deck: PptxGenJS, title: string, subtitle: string): void {
  const slide = deck.addSlide();
  slide.background = { color: "F7F8FC" };
  slide.addShape("rect", { x: 0, y: 0, w: 0.28, h: 5.63, fill: { color: ACCENT } });
  slide.addText(title, { x: 0.8, y: 1.6, w: 8.4, h: 1.2, fontSize: 34, bold: true, color: INK });
  slide.addText(subtitle, { x: 0.8, y: 2.8, w: 8.4, h: 0.8, fontSize: 15, color: MUTED });
}

function bulletSlide(deck: PptxGenJS, heading: string, points: string[]): void {
  const slide = deck.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText(heading, { x: 0.7, y: 0.5, w: 8.6, h: 0.7, fontSize: 22, bold: true, color: INK });
  slide.addShape("rect", { x: 0.7, y: 1.2, w: 1.1, h: 0.05, fill: { color: ACCENT } });
  slide.addText(
    points.slice(0, 8).map((point) => ({ text: point, options: { bullet: true, breakLine: true } })),
    { x: 0.7, y: 1.5, w: 8.6, h: 3.6, fontSize: 14, color: INK, lineSpacingMultiple: 1.3 },
  );
}

/** Splits Markdown minutes into slide-sized chunks under their own headings. */
function slidesFromMarkdown(markdown: string): Array<{ heading: string; points: string[] }> {
  const sections: Array<{ heading: string; points: string[] }> = [];
  let current: { heading: string; points: string[] } | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{2,3}\s+(.*)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { heading: heading[1], points: [] };
      continue;
    }
    const text = line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim();
    if (!text || text.startsWith("#")) continue;
    if (!current) current = { heading: "Notes", points: [] };
    current.points.push(text);
    if (current.points.length === 8) {
      sections.push(current);
      current = { heading: `${current.heading} (cont.)`, points: [] };
    }
  }
  if (current?.points.length) sections.push(current);
  return sections;
}

async function sendDeck(res: import("express").Response, deck: PptxGenJS, filename: string): Promise<void> {
  const buffer = (await deck.write({ outputType: "nodebuffer" })) as Buffer;
  res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("content-disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

exportRouter.get(
  "/meetings/:id/minutes.md",
  handler((req, res) => {
    res.type("text/markdown").send(minutesMarkdown(param(req, "id")));
  }),
);

exportRouter.get(
  "/meetings/:id/deck.pptx",
  handler(async (req, res) => {
    const meeting = getMeeting(param(req, "id"));
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_16x9";
    titleSlide(deck, meeting.topic, `${meeting.kind} · ${new Date(meeting.createdAt).toLocaleString()}`);
    for (const section of slidesFromMarkdown(minutesMarkdown(param(req, "id")))) {
      bulletSlide(deck, section.heading, section.points);
    }
    await sendDeck(res, deck, `minutes-${meeting.id}.pptx`);
  }),
);

exportRouter.get(
  "/reports/:id/deck.pptx",
  handler(async (req, res) => {
    const report = getReport(param(req, "id"));
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_16x9";
    titleSlide(deck, report.title, report.taskTitle ?? "");
    for (const section of slidesFromMarkdown(report.body)) bulletSlide(deck, section.heading, section.points);
    await sendDeck(res, deck, `report-${report.id}.pptx`);
  }),
);

exportRouter.get(
  "/stats/deck.pptx",
  handler(async (_req, res) => {
    const stats = guildStats();
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_16x9";
    titleSlide(deck, "Guild status", new Date().toLocaleString());
    bulletSlide(deck, "Headcount", [
      `Total members: ${stats.staff.total}`,
      `Working now: ${stats.staff.working}`,
      `Idle: ${stats.staff.idle}`,
      `Mean successful run: ${stats.meanRunSeconds}s`,
    ]);
    bulletSlide(
      deck,
      "Board",
      Object.entries(stats.tasks).map(([stage, count]) => `${stage}: ${count}`),
    );
    bulletSlide(
      deck,
      "Top performers",
      stats.leaderboard.map((entry) => `${entry.displayName} — level ${entry.level}, ${entry.completedTasks} done`),
    );
    await sendDeck(res, deck, "guild-status.pptx");
  }),
);
