import type { Staff } from "../api/client.js";
import { OFFICE_COLORS } from "./palette.js";
import { TILE, type FloorPlan, type Room } from "./layout.js";
import { drawCharacter, SPRITE_HEIGHT, SPRITE_WIDTH, type Facing } from "./sprite.js";

interface Actor {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: Facing;
  phase: number;
  sitting: boolean;
  seed: number;
  accent: string;
  label: string;
  status: Staff["status"];
  /** Route the actor is currently walking, in tile coordinates. */
  waypoints: Array<{ x: number; y: number }>;
}

export interface OfficeHandle {
  update(staff: Staff[], plan: FloorPlan): void;
  setHover(canvasX: number, canvasY: number): void;
  hitTest(canvasX: number, canvasY: number): string | null;
  destroy(): void;
}

const SPEED = 2.6; // tiles per second

export function mountOffice(canvas: HTMLCanvasElement, onPick: (staffId: string) => void): OfficeHandle {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let plan: FloorPlan | null = null;
  let actors = new Map<string, Actor>();
  let hovered: string | null = null;
  let scale = 2;
  let offsetX = 0;
  let offsetY = 0;
  let raf = 0;
  let last = performance.now();

  function fit(): void {
    if (!plan) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const raw = Math.min(rect.width / (plan.width * TILE), rect.height / (plan.height * TILE));
    scale = Math.max(0.6, Math.min(3, raw));
    offsetX = (rect.width - plan.width * TILE * scale) / 2;
    offsetY = (rect.height - plan.height * TILE * scale) / 2;
  }

  const observer = new ResizeObserver(() => fit());
  observer.observe(canvas);

  function routeTo(actor: Actor, target: { x: number; y: number }): void {
    if (!plan) return;
    // Walk to the nearest corridor, along it, then into the destination room.
    const corridor = plan.corridorY.reduce((best, y) =>
      Math.abs(y - actor.y) < Math.abs(best - actor.y) ? y : best,
    plan.corridorY[0]);
    const exit = plan.corridorY.reduce((best, y) =>
      Math.abs(y - target.y) < Math.abs(best - target.y) ? y : best,
    plan.corridorY[0]);
    actor.waypoints =
      Math.abs(target.y - actor.y) < 2
        ? [target]
        : [
            { x: actor.x, y: corridor },
            { x: target.x, y: corridor },
            { x: target.x, y: exit },
            target,
          ];
  }

  function desiredSpot(member: Staff): { x: number; y: number; sitting: boolean } {
    if (!plan) return { x: 2, y: 2, sitting: false };
    const desk = plan.deskOf.get(member.id);
    if (member.status === "meeting") {
      const room = plan.meetingRoom;
      const index = [...plan.deskOf.keys()].indexOf(member.id);
      return {
        x: room.x + 3 + (index % 5) * 1.6,
        y: room.y + 3 + (index % 2) * 2.4,
        sitting: true,
      };
    }
    if (member.status === "break") {
      const room = plan.lounge;
      const index = [...plan.deskOf.keys()].indexOf(member.id);
      return { x: room.x + 2 + (index % 8) * 1.2, y: room.y + 4 + (index % 3), sitting: false };
    }
    if (desk) return { x: desk.x, y: desk.y, sitting: member.status === "working" };
    return { x: 3, y: 3, sitting: false };
  }

  function update(staff: Staff[], nextPlan: FloorPlan): void {
    plan = nextPlan;
    const next = new Map<string, Actor>();
    for (const member of staff) {
      const spot = desiredSpot(member);
      const existing = actors.get(member.id);
      const actor: Actor =
        existing ??
        {
          id: member.id,
          x: spot.x,
          y: spot.y,
          targetX: spot.x,
          targetY: spot.y,
          facing: "down",
          phase: Math.random() * 6,
          sitting: spot.sitting,
          seed: member.avatarSeed || 1,
          accent: member.departmentAccent ?? "#7c9cff",
          label: member.displayName,
          status: member.status,
          waypoints: [],
        };
      actor.accent = member.departmentAccent ?? actor.accent;
      actor.label = member.displayName;
      actor.status = member.status;
      actor.sitting = spot.sitting;
      if (Math.abs(actor.targetX - spot.x) > 0.1 || Math.abs(actor.targetY - spot.y) > 0.1) {
        actor.targetX = spot.x;
        actor.targetY = spot.y;
        routeTo(actor, spot);
      }
      next.set(member.id, actor);
    }
    actors = next;
    fit();
  }

  function step(dt: number): void {
    for (const actor of actors.values()) {
      const waypoint = actor.waypoints[0];
      if (!waypoint) continue;
      const dx = waypoint.x - actor.x;
      const dy = waypoint.y - actor.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.06) {
        actor.waypoints.shift();
        continue;
      }
      const move = Math.min(distance, SPEED * dt);
      actor.x += (dx / distance) * move;
      actor.y += (dy / distance) * move;
      actor.facing =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      actor.phase += dt * 7;
    }
  }

  function drawRoom(room: Room): void {
    const x = room.x * TILE;
    const y = room.y * TILE;
    const w = room.w * TILE;
    const h = room.h * TILE;

    ctx.fillStyle = OFFICE_COLORS.wallTop;
    ctx.fillRect(x - 2, y - 6, w + 4, h + 8);
    ctx.fillStyle = OFFICE_COLORS.floor;
    ctx.fillRect(x, y, w, h);

    // Checker floor for depth.
    ctx.fillStyle = OFFICE_COLORS.floorAlt;
    for (let ty = 0; ty < room.h; ty += 1) {
      for (let tx = 0; tx < room.w; tx += 1) {
        if ((tx + ty) % 2 === 0) ctx.fillRect(x + tx * TILE, y + ty * TILE, TILE, TILE);
      }
    }

    // Accent header strip and room name.
    ctx.fillStyle = room.accent;
    ctx.fillRect(x, y - 6, w, 4);
    ctx.fillStyle = "#e8ecf5";
    ctx.font = "700 9px ui-sans-serif, system-ui";
    ctx.textBaseline = "bottom";
    ctx.fillText(room.label.toUpperCase(), x + 2, y - 8);

    if (room.kind === "meeting") {
      ctx.fillStyle = OFFICE_COLORS.meetingTable;
      ctx.fillRect(x + 2 * TILE, y + 3 * TILE, w - 4 * TILE, 2 * TILE);
      ctx.fillStyle = "#5d5178";
      ctx.fillRect(x + 2 * TILE, y + 3 * TILE, w - 4 * TILE, 4);
      return;
    }
    if (room.kind === "lounge") {
      ctx.fillStyle = OFFICE_COLORS.rug;
      ctx.fillRect(x + TILE, y + 2 * TILE, w - 2 * TILE, h - 3 * TILE);
      for (let index = 0; index < 3; index += 1) {
        const px = x + (2 + index * 4) * TILE;
        const py = y + (room.h - 2) * TILE;
        ctx.fillStyle = OFFICE_COLORS.plantPot;
        ctx.fillRect(px, py + 8, 10, 8);
        ctx.fillStyle = OFFICE_COLORS.plant;
        ctx.fillRect(px + 1, py - 2, 8, 12);
      }
      return;
    }

  }

  /** Monitors sit behind the seated agent; the table is drawn over them later. */
  function drawDeskBacks(room: Room): void {
    if (room.kind !== "department") return;
    for (const desk of room.desks) {
      const dx = desk.x * TILE;
      const dy = desk.y * TILE;
      ctx.fillStyle = "#2a3547";
      ctx.fillRect(dx + 6, dy - 12, 12, 3);
      ctx.fillStyle = OFFICE_COLORS.screen;
      ctx.fillRect(dx + 2, dy - 22, 20, 12);
      ctx.fillStyle = "#22303f";
      ctx.fillRect(dx + 3, dy - 21, 18, 10);
    }
  }

  function drawDeskFronts(room: Room): void {
    if (room.kind !== "department") return;
    for (const desk of room.desks) {
      const dx = desk.x * TILE;
      const dy = desk.y * TILE;
      ctx.fillStyle = OFFICE_COLORS.deskTop;
      ctx.fillRect(dx - 6, dy + 2, 34, 5);
      ctx.fillStyle = OFFICE_COLORS.desk;
      ctx.fillRect(dx - 6, dy + 7, 34, 9);
      ctx.fillStyle = "#2b2417";
      ctx.fillRect(dx - 5, dy + 16, 3, 5);
      ctx.fillRect(dx + 25, dy + 16, 3, 5);
    }
  }

  function drawActor(actor: Actor, now: number): void {
    const pixel = 1.6;
    const px = actor.x * TILE - (SPRITE_WIDTH * pixel) / 2;
    const py = actor.y * TILE - SPRITE_HEIGHT * pixel;
    const moving = actor.waypoints.length > 0;
    const walkStep = moving ? (Math.floor(actor.phase) % 2 as 0 | 1) : 0;

    if (actor.status === "working") {
      // A soft glow marks who is actually running a process right now.
      const pulse = 0.35 + 0.25 * Math.sin(now / 320 + actor.seed);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = OFFICE_COLORS.screenOn;
      ctx.fillRect(actor.x * TILE - 8, actor.y * TILE - 21, 20, 10);
      ctx.globalAlpha = 1;
    }

    drawCharacter(ctx, px, py, pixel, actor.seed, actor.accent, {
      facing: actor.facing,
      step: walkStep,
      sitting: actor.sitting && !moving,
    });

    if (hovered === actor.id) {
      const label = actor.label;
      ctx.font = "600 9px ui-sans-serif, system-ui";
      const width = ctx.measureText(label).width + 8;
      ctx.fillStyle = "rgba(11,13,19,0.92)";
      ctx.fillRect(actor.x * TILE - width / 2, py - 14, width, 12);
      ctx.fillStyle = actor.accent;
      ctx.fillRect(actor.x * TILE - width / 2, py - 14, 2, 12);
      ctx.fillStyle = "#e8ecf5";
      ctx.textBaseline = "top";
      ctx.fillText(label, actor.x * TILE - width / 2 + 5, py - 12);
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!plan) return;
    step(dt);

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = OFFICE_COLORS.wall;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    for (const room of plan.rooms) drawRoom(room);
    for (const room of plan.rooms) drawDeskBacks(room);
    const ordered = [...actors.values()].sort((a, b) => a.y - b.y);
    for (const actor of ordered) drawActor(actor, now);
    for (const room of plan.rooms) drawDeskFronts(room);
    ctx.restore();
  }
  raf = requestAnimationFrame(frame);

  function toTile(canvasX: number, canvasY: number): { x: number; y: number } {
    return { x: (canvasX - offsetX) / scale / TILE, y: (canvasY - offsetY) / scale / TILE };
  }

  function hitTest(canvasX: number, canvasY: number): string | null {
    const point = toTile(canvasX, canvasY);
    let best: { id: string; distance: number } | null = null;
    for (const actor of actors.values()) {
      const distance = Math.hypot(actor.x - point.x, actor.y - point.y - 0.4);
      if (distance < 0.9 && (!best || distance < best.distance)) best = { id: actor.id, distance };
    }
    return best?.id ?? null;
  }

  const onClick = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const id = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (id) onPick(id);
  };
  const onMove = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    hovered = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    canvas.style.cursor = hovered ? "pointer" : "default";
  };
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("mousemove", onMove);

  return {
    update,
    setHover: (x, y) => {
      hovered = hitTest(x, y);
    },
    hitTest,
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMove);
    },
  };
}
