import { paletteFor, type CharacterPalette } from "./palette.js";

export type Facing = "down" | "up" | "left" | "right";

/**
 * Characters are drawn as pixel rectangles at runtime rather than blitted from a
 * sprite sheet. Twelve rows of a 10-wide grid is enough to read as a person at
 * office zoom, and it keeps the whole project asset-free.
 */
const W = 10;
const H = 14;

interface DrawOptions {
  facing: Facing;
  /** 0 or 1 — alternating step for the walk cycle. */
  step: number;
  sitting: boolean;
}

type Cell = keyof CharacterPalette | "outline" | null;

function body(options: DrawOptions): Cell[][] {
  const { facing, step, sitting } = options;
  const grid: Cell[][] = Array.from({ length: H }, () => Array<Cell>(W).fill(null));
  const set = (x: number, y: number, cell: Cell) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = cell;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, cell: Cell) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(x, y, cell);
  };

  // Hair and head
  rect(3, 0, 6, 1, "hair");
  rect(2, 1, 7, 4, "skin");
  if (facing === "down") {
    rect(2, 1, 7, 2, "hair");
    set(3, 3, "outline");
    set(6, 3, "outline");
  } else if (facing === "up") {
    rect(2, 1, 7, 4, "hair");
  } else {
    rect(2, 1, 7, 2, "hair");
    set(facing === "left" ? 3 : 6, 3, "outline");
    rect(facing === "left" ? 2 : 7, 1, facing === "left" ? 2 : 7, 3, "hair");
  }

  // Torso
  rect(2, 5, 7, 9, "top");
  rect(3, 5, 6, 5, "accent");

  // Arms
  const armDrop = sitting ? 0 : step === 1 ? 1 : 0;
  rect(1, 6 + armDrop, 1, 8 + armDrop, "top");
  rect(8, 6 - armDrop, 8, 8 - armDrop, "top");
  set(1, 9 + armDrop, "skin");
  set(8, 9 - armDrop, "skin");

  if (sitting) {
    // Seated: legs fold forward, no stride.
    rect(2, 10, 7, 11, "bottom");
    rect(2, 12, 3, 12, "shoes");
    rect(6, 12, 7, 12, "shoes");
    return grid;
  }

  // Legs with a two-frame stride
  rect(3, 10, 4, 12, "bottom");
  rect(5, 10, 6, 12, "bottom");
  if (step === 0) {
    rect(2, 13, 4, 13, "shoes");
    rect(5, 13, 6, 13, "shoes");
  } else {
    rect(3, 13, 4, 13, "shoes");
    rect(5, 13, 7, 13, "shoes");
  }
  return grid;
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixel: number,
  seed: number,
  accent: string,
  options: DrawOptions,
): void {
  const palette = paletteFor(seed, accent);
  const grid = body(options);

  // Contact shadow keeps the figure anchored to the floor.
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(x + (W * pixel) / 2, y + H * pixel, W * pixel * 0.34, pixel * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let row = 0; row < H; row += 1) {
    for (let column = 0; column < W; column += 1) {
      const cell = grid[row][column];
      if (!cell) continue;
      ctx.fillStyle = cell === "outline" ? "#151821" : palette[cell];
      ctx.fillRect(x + column * pixel, y + row * pixel, pixel, pixel);
    }
  }
}

export const SPRITE_WIDTH = W;
export const SPRITE_HEIGHT = H;
