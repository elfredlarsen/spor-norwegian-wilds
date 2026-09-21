import type { Feature, FeatureKind } from "./types";

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1800;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Centre line of the stream at a given world y. */
export function streamCenter(y: number) {
  return (
    WORLD_WIDTH * 0.52 +
    Math.sin(y * 0.0032) * 210 +
    Math.sin(y * 0.0071 + 1.3) * 90
  );
}

export function streamHalfWidth(y: number) {
  return 66 + Math.sin(y * 0.0045 + 0.6) * 18;
}

/** 0 = dry land, 1 = middle of the stream. */
export function waterDepth(x: number, y: number) {
  const distance = Math.abs(x - streamCenter(y));
  const half = streamHalfWidth(y);
  if (distance >= half) return 0;
  return 1 - distance / half;
}

const NOTE_TEXT: Record<FeatureKind, { title: string; norwegian: string; note: string }> = {
  pine: {
    title: "Scots pine",
    norwegian: "furu",
    note: "Its bark turns copper high up, where the old trunk holds the last of the daylight.",
  },
  birch: {
    title: "Mountain birch",
    norwegian: "fjellbjørk",
    note: "Birches grow highest of all Nordic trees, bending rather than breaking in the wind.",
  },
  rock: {
    title: "Granite boulder",
    norwegian: "granittblokk",
    note: "Left behind by the ice. The pale crust on top is lichen, growing a millimetre a year.",
  },
  heather: {
    title: "Heather and lingonberry",
    norwegian: "røsslyng og tyttebær",
    note: "Low evergreen shrubs that keep the forest floor warm and feed birds through winter.",
  },
  reed: {
    title: "Stream and trout",
    norwegian: "bekk og ørret",
    note: "Cold running water carries oxygen; brown trout rest in the shade of the bank.",
  },
};

export function featureNote(kind: FeatureKind) {
  return NOTE_TEXT[kind];
}

function buildFeatures(): Feature[] {
  const random = mulberry32(20260921);
  const features: Feature[] = [];
  const counts: Array<[FeatureKind, number]> = [
    ["pine", 120],
    ["birch", 58],
    ["rock", 46],
    ["heather", 180],
  ];

  for (const [kind, count] of counts) {
    for (let index = 0; index < count; index += 1) {
      let x = 0;
      let y = 0;
      let tries = 0;
      do {
        x = 90 + random() * (WORLD_WIDTH - 180);
        y = 90 + random() * (WORLD_HEIGHT - 180);
        tries += 1;
      } while (waterDepth(x, y) > 0 && tries < 14);
      if (waterDepth(x, y) > 0) continue;
      features.push({
        id: `${kind}-${index}`,
        kind,
        x,
        y,
        scale: 0.78 + random() * 0.55,
      });
    }
  }

  for (let index = 0; index < 90; index += 1) {
    const y = 60 + random() * (WORLD_HEIGHT - 120);
    const side = random() > 0.5 ? 1 : -1;
    const x = streamCenter(y) + side * (streamHalfWidth(y) + 6 + random() * 26);
    features.push({ id: `reed-${index}`, kind: "reed", x, y, scale: 0.7 + random() * 0.6 });
  }

  return features.sort((a, b) => a.y - b.y);
}

export const FEATURES = buildFeatures();

export function nearestFeature(x: number, y: number, radius: number) {
  let best: Feature | null = null;
  let bestDistance = radius * radius;
  for (const feature of FEATURES) {
    if (Math.abs(feature.y - y) > radius) continue;
    const dx = feature.x - x;
    const dy = feature.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = feature;
    }
  }
  return best;
}

/** Simple solid collision so the fox walks around trunks and boulders. */
export function resolveCollisions(x: number, y: number) {
  let nextX = x;
  let nextY = y;
  for (const feature of FEATURES) {
    if (feature.kind === "heather" || feature.kind === "reed") continue;
    if (Math.abs(feature.y - nextY) > 60) continue;
    const solid = feature.kind === "rock" ? 26 * feature.scale : 13 * feature.scale;
    const dx = nextX - feature.x;
    const dy = (nextY - feature.y) * 1.6;
    const distance = Math.hypot(dx, dy);
    if (distance < solid && distance > 0.001) {
      const push = (solid - distance) / distance;
      nextX += dx * push;
      nextY += (dy * push) / 1.6;
    }
  }
  return {
    x: Math.min(WORLD_WIDTH - 40, Math.max(40, nextX)),
    y: Math.min(WORLD_HEIGHT - 40, Math.max(40, nextY)),
  };
}
