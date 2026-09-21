export type ParticipantId = "elder" | "child";

export type WeatherKind = "clear" | "rain" | "mist" | "sun";

export type PlacementKind = "stone" | "flower" | "lantern";

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

export type WorldState = {
  version: 1;
  placements: Placement[];
  trail: Footprint[];
  weather: WeatherState;
  positions: Record<ParticipantId, { x: number; y: number }>;
  seen: Record<string, boolean>;
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
  elder: { label: "Exploring as parent", hue: "#c4622d" },
  child: { label: "Exploring as child", hue: "#d89a4a" },
};
