/**
 * The forest follows real time: the light of the actual hour, and the season of
 * the actual month. Nothing here hurries the player — it simply means the wood
 * looks different when you come back in the evening, or next month.
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

export type Cycle = {
  /** 0 = deep night, 1 = full midday. */
  daylight: number;
  /** A soft colour wash laid over the whole world. */
  tint: string;
  tintAlpha: number;
  /** Lanterns and glowing berries carry further after dusk. */
  glow: number;
  season: Season;
};

export type SeasonPalette = {
  /** Birch canopy; empty means bare branches. */
  leaf: string | null;
  leafHighlight: string | null;
  pine: [string, string, string];
  /** A wash over the forest floor. */
  ground: string;
  groundAlpha: number;
  /** Berries and lingonberries are richest in late summer and autumn. */
  berries: number;
  /** Birds are quieter and fewer in the cold months. */
  birdActivity: number;
  /** Falling leaves on the stream. */
  leafFall: number;
};

export const SEASON_PALETTE: Record<Season, SeasonPalette> = {
  spring: {
    leaf: "#8fae5f",
    leafHighlight: "#a8c274",
    pine: ["#324b33", "#3e5b3b", "#4d6b42"],
    ground: "#7f9a5c",
    groundAlpha: 0.1,
    berries: 0.2,
    birdActivity: 1,
    leafFall: 0.15,
  },
  summer: {
    leaf: "#7c9455",
    leafHighlight: "#93aa66",
    pine: ["#2f4732", "#3a5639", "#47653f"],
    ground: "#6c8a4f",
    groundAlpha: 0.06,
    berries: 0.75,
    birdActivity: 0.9,
    leafFall: 0.2,
  },
  autumn: {
    leaf: "#c39a4c",
    leafHighlight: "#d9b463",
    pine: ["#2c4230", "#365036", "#43603d"],
    ground: "#9a7c46",
    groundAlpha: 0.14,
    berries: 1,
    birdActivity: 0.6,
    leafFall: 1,
  },
  winter: {
    leaf: null,
    leafHighlight: null,
    pine: ["#2a3a30", "#334537", "#3d523d"],
    ground: "#c9d2d6",
    groundAlpha: 0.3,
    berries: 0.25,
    birdActivity: 0.3,
    leafFall: 0.05,
  },
};

export function seasonOf(date: Date): Season {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 9) return "autumn";
  return "winter";
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function currentCycle(date = new Date()): Cycle {
  const hours = date.getHours() + date.getMinutes() / 60;
  const season = seasonOf(date);
  // Nordic light: short days in winter, long ones in summer.
  const sunrise = season === "winter" ? 9 : season === "summer" ? 4.5 : 7;
  const sunset = season === "winter" ? 15.5 : season === "summer" ? 22 : 19;

  let daylight: number;
  if (hours <= sunrise - 1.4 || hours >= sunset + 1.4) daylight = 0;
  else if (hours < sunrise + 1) daylight = mix(0, 1, (hours - (sunrise - 1.4)) / 2.4);
  else if (hours > sunset - 1) daylight = mix(1, 0, (hours - (sunset - 1)) / 2.4);
  else daylight = 1;

  let tint = "#1d2b32";
  let tintAlpha = 0.46;
  if (daylight > 0.9) {
    // A quiet, lichen-soft daylight rather than a pale yellow veil.
    tint = season === "winter" ? "#dce5e3" : "#d8dfc8";
    tintAlpha = 0.055;
  } else if (hours < 12) {
    // morning: muted rose held close to bark and moss
    tint = "#d8b697";
    tintAlpha = mix(0.4, 0.075, daylight);
  } else {
    // evening: weathered ochre sinking into a forest blue-grey
    tint = daylight > 0.35 ? "#bd8f68" : "#263847";
    tintAlpha = mix(0.46, 0.085, daylight);
  }

  return { daylight, tint, tintAlpha, glow: 1 - daylight, season };
}
