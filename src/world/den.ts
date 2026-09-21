import type { DenKeepsake, DenMaterial } from "./types";

/** The den mouth sits under the roots of a fallen pine, west of the stream. */
export const DEN_MOUTH = { x: 430, y: 1310 };
export const DEN_NEAR_RADIUS = 96;

/** The sheltered interior has its own small, calm coordinate space. */
export const DEN_WIDTH = 760;
export const DEN_HEIGHT = 540;
export const DEN_CENTER = { x: DEN_WIDTH / 2, y: DEN_HEIGHT / 2 - 20 };
export const DEN_RADIUS_X = 310;
export const DEN_RADIUS_Y = 210;
export const DEN_EXIT = { x: DEN_WIDTH / 2, y: DEN_HEIGHT - 70 };

export const NICHES: Array<{ id: string; x: number; y: number }> = [
  { id: "shelf-west", x: DEN_CENTER.x - 210, y: DEN_CENTER.y - 40 },
  { id: "crack-north", x: DEN_CENTER.x - 70, y: DEN_CENTER.y - 150 },
  { id: "root-hollow", x: DEN_CENTER.x + 80, y: DEN_CENTER.y - 152 },
  { id: "shelf-east", x: DEN_CENTER.x + 214, y: DEN_CENTER.y - 30 },
  { id: "floor-crack", x: DEN_CENTER.x + 170, y: DEN_CENTER.y + 120 },
];

export const MATERIALS: Record<DenMaterial, { label: string; norwegian: string }> = {
  needles: { label: "Tørre fyrrenåle", norwegian: "furunåler" },
  moss: { label: "Blødt mos", norwegian: "mose" },
  bark: { label: "Birkebark", norwegian: "bjørkebark" },
};

export const KEEPSAKES: Record<DenKeepsake, { label: string; norwegian: string }> = {
  pebble: { label: "Stribet kiselsten", norwegian: "stripet kiselstein" },
  feather: { label: "Fuglefjer", norwegian: "fuglefjær" },
  cone: { label: "Tør grankogle", norwegian: "grankongle" },
  lingonberry: { label: "Sent tyttebær", norwegian: "tyttebær" },
};

/** Keeps the fox within the rounded chamber. */
export function clampInsideDen(x: number, y: number) {
  const dx = (x - DEN_CENTER.x) / DEN_RADIUS_X;
  const dy = (y - DEN_CENTER.y) / DEN_RADIUS_Y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1) return { x, y };
  return {
    x: DEN_CENTER.x + (dx / distance) * DEN_RADIUS_X,
    y: DEN_CENTER.y + (dy / distance) * DEN_RADIUS_Y,
  };
}

export function nearestNiche(x: number, y: number, radius = 110) {
  let best: (typeof NICHES)[number] | null = null;
  let bestDistance = radius;
  for (const niche of NICHES) {
    const distance = Math.hypot(niche.x - x, niche.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = niche;
    }
  }
  return best;
}

/** A gentle, slightly wandering line of paw prints from the den out to a guest. */
export function invitationPath(toX: number, toY: number) {
  const points: Array<{ x: number; y: number }> = [];
  const steps = 22;
  const dx = toX - DEN_MOUTH.x;
  const dy = toY - DEN_MOUTH.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const wander = Math.sin(t * Math.PI * 2.1) * 46;
    points.push({
      x: DEN_MOUTH.x + dx * t + normalX * wander,
      y: DEN_MOUTH.y + dy * t + normalY * wander,
    });
  }
  return points;
}
