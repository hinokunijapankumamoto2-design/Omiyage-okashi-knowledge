/**
 * Every character's colours are derived from an integer seed, so the office is
 * populated without shipping a single image file and a member always looks the
 * same across sessions.
 */
export interface CharacterPalette {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  accent: string;
}

/** Small deterministic PRNG (xorshift32) — same seed, same character. */
export function rng(seed: number): () => number {
  let state = (seed | 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

const SKINS = ["#f2d3b6", "#e3b48c", "#c98d63", "#a06a45", "#7a4a2e", "#f7e0c8"];
const HAIRS = ["#2b2118", "#4a3527", "#7a4a2e", "#1d1b22", "#5c4b8a", "#8a4b4b", "#c9a227", "#3d5a6c"];
const TOPS = ["#7c9cff", "#4fd1a5", "#ffc857", "#ff7a90", "#a78bfa", "#5ec8e5", "#e88a4f", "#9aa7bd"];
const BOTTOMS = ["#2f3646", "#3a4356", "#4a3f5c", "#243043", "#3d3a33"];

export function paletteFor(seed: number, accent: string): CharacterPalette {
  const next = rng(seed * 2654435761);
  const pick = <T>(list: T[]) => list[Math.floor(next() * list.length) % list.length];
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    shoes: "#1a1d26",
    accent,
  };
}

export const OFFICE_COLORS = {
  floor: "#161a25",
  floorAlt: "#1a1f2c",
  wall: "#0d1017",
  wallTop: "#232a3b",
  desk: "#3a3021",
  deskTop: "#5a4a33",
  screen: "#0e2233",
  screenOn: "#4fd1a5",
  plant: "#3f7d54",
  plantPot: "#6b4a35",
  rug: "#232a3b",
  text: "#aab3c7",
  meetingTable: "#4a3f5c",
} as const;
