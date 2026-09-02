import type { Department, Staff } from "../api/client.js";

export const TILE = 16;

export interface Room {
  id: string;
  code: string;
  label: string;
  accent: string;
  x: number;
  y: number;
  w: number;
  h: number;
  desks: Array<{ x: number; y: number }>;
  kind: "department" | "meeting" | "lounge";
}

export interface FloorPlan {
  width: number;
  height: number;
  rooms: Room[];
  /** Corridor centre lines agents walk along between rooms. */
  corridorY: number[];
  deskOf: Map<string, { x: number; y: number; roomId: string }>;
  meetingRoom: Room;
  lounge: Room;
}

const ROOM_W = 13;
const ROOM_H = 6;
const GAP_X = 2;
const GAP_Y = 3;
const MARGIN = 2;

function desksFor(room: { x: number; y: number }, count: number): Array<{ x: number; y: number }> {
  const desks: Array<{ x: number; y: number }> = [];
  const perRow = 3;
  for (let index = 0; index < count; index += 1) {
    const column = index % perRow;
    const row = Math.floor(index / perRow);
    desks.push({ x: room.x + 2 + column * 4, y: room.y + 3 + row * 3 });
  }
  return desks;
}

/**
 * Builds a floor plan from the live department list: three rooms per row, a
 * meeting room and a lounge appended at the end. Everything is measured in
 * tiles so the renderer can scale without re-computing geometry.
 */
export function buildFloorPlan(departments: Department[], staff: Staff[]): FloorPlan {
  const columns = 3;
  const rooms: Room[] = [];

  const cells = [...departments.map((d) => ({ kind: "department" as const, department: d })),
    { kind: "meeting" as const, department: null },
    { kind: "lounge" as const, department: null }];

  cells.forEach((cell, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (ROOM_W + GAP_X);
    const y = MARGIN + row * (ROOM_H + GAP_Y);
    const headcount = cell.department
      ? staff.filter((member) => member.departmentId === cell.department!.id).length
      : 0;
    rooms.push({
      id: cell.department?.id ?? cell.kind,
      code: cell.department?.code ?? cell.kind,
      label: cell.department?.nameEn ?? (cell.kind === "meeting" ? "Meeting" : "Lounge"),
      accent: cell.department?.accent ?? (cell.kind === "meeting" ? "#a78bfa" : "#4fd1a5"),
      x,
      y,
      w: ROOM_W,
      h: ROOM_H,
      kind: cell.kind,
      desks: cell.kind === "department" ? desksFor({ x, y }, Math.max(headcount, 3)) : [],
    });
  });

  const rowCount = Math.ceil(cells.length / columns);
  const width = MARGIN * 2 + columns * ROOM_W + (columns - 1) * GAP_X;
  const height = MARGIN * 2 + rowCount * ROOM_H + (rowCount - 1) * GAP_Y;

  const corridorY: number[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    corridorY.push(MARGIN + row * (ROOM_H + GAP_Y) + ROOM_H + 1);
  }

  const deskOf = new Map<string, { x: number; y: number; roomId: string }>();
  for (const room of rooms) {
    if (room.kind !== "department") continue;
    const members = staff.filter((member) => member.departmentId === room.id);
    members.forEach((member, index) => {
      const desk = room.desks[index % Math.max(room.desks.length, 1)];
      if (desk) deskOf.set(member.id, { x: desk.x + 0.55, y: desk.y + 0.35, roomId: room.id });
    });
  }

  return {
    width,
    height,
    rooms,
    corridorY,
    deskOf,
    meetingRoom: rooms.find((room) => room.kind === "meeting")!,
    lounge: rooms.find((room) => room.kind === "lounge")!,
  };
}
