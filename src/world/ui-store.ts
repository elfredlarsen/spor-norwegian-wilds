import { create } from "zustand";
import type { ParticipantId, PlacementKind, WeatherKind } from "./types";

export type Tool = PlacementKind;

type UiStore = {
  participant: ParticipantId;
  tool: Tool;
  weather: WeatherKind;
  volume: number;
  muted: boolean;
  note: { title: string; norwegian: string; note: string } | null;
  hintSeen: boolean;
  discovery: string | null;
  setParticipant: (participant: ParticipantId) => void;
  setTool: (tool: Tool) => void;
  setWeather: (weather: WeatherKind) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setNote: (note: UiStore["note"]) => void;
  setDiscovery: (discovery: string | null) => void;
  markHintSeen: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  participant: "elder",
  tool: "stone",
  weather: "clear",
  volume: 45,
  muted: false,
  note: null,
  hintSeen: false,
  discovery: null,
  setParticipant: (participant) => set({ participant, hintSeen: true }),
  setTool: (tool) => set({ tool, hintSeen: true }),
  setWeather: (weather) => set({ weather, hintSeen: true }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setNote: (note) => set({ note }),
  setDiscovery: (discovery) => set({ discovery }),
  markHintSeen: () => set({ hintSeen: true }),
}));
