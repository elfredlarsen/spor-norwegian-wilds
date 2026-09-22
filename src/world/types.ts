export type ParticipantId = "elder" | "child";

export type WeatherKind = "clear" | "rain" | "mist" | "sun" | "aurora";

export type PlacementKind = "stone" | "flower" | "lantern" | "berry" | "howl";

export type Placement = {
  id: string;
  kind: PlacementKind;
  x: number;
  y: number;
  variant: number;
  by: ParticipantId;
  at: number;
};

export type Footprint = {
  x: number;
  y: number;
  angle: number;
  by: ParticipantId;
  at: number;
};

export type WeatherState = {
  kind: WeatherKind;
  by: ParticipantId;
  at: number;
};

export type DenMaterial = "needles" | "moss" | "bark";

export type DenKeepsake = "pebble" | "feather" | "cone" | "lingonberry";

export type DenBedding = {
  material: DenMaterial;
  by: ParticipantId;
  at: number;
  offsetX: number;
  offsetY: number;
  angle: number;
};

export type DenKeepsakePlacement = {
  nicheId: string;
  item: DenKeepsake;
  by: ParticipantId;
  at: number;
};

export type DenInvitation = {
  by: ParticipantId;
  at: number;
  path: Array<{ x: number; y: number }>;
};

export type DenNote = {
  text: string;
  by: ParticipantId;
  at: number;
};

export type DenState = {
  discovered: boolean;
  rests: number;
  bedding: DenBedding[];
  keepsakes: DenKeepsakePlacement[];
  invitation: DenInvitation | null;
  /** A short note left for whoever visits next — the one thing in the den meant to be read, not just found. */
  note: DenNote | null;
};

export type WorldState = {
  version: 1;
  placements: Placement[];
  trail: Footprint[];
  weather: WeatherState;
  positions: Record<ParticipantId, { x: number; y: number }>;
  seen: Record<string, boolean>;
  den: DenState;
};

export type FeatureKind = "pine" | "birch" | "rock" | "heather" | "reed";

export type Feature = {
  id: string;
  kind: FeatureKind;
  x: number;
  y: number;
  scale: number;
};

export const PARTICIPANTS: Record<ParticipantId, { label: string; hue: string }> = {
  elder: { label: "Fox 1", hue: "#b9532f" },
  child: { label: "Fox 2", hue: "#dc8646" },
};
