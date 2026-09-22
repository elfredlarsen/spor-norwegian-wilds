import { create } from "zustand";
import type { DenKeepsake, DenMaterial, ParticipantId, WeatherKind } from "./types";

export type SenseAction = "dig" | "howl" | "listen";
export type DenAction = "enter" | "exit" | "gather" | "deposit" | "invite";

export type Carried =
  | { category: "bedding"; kind: DenMaterial; label: string; norwegian: string }
  | { category: "keepsake"; kind: DenKeepsake; label: string; norwegian: string };

type UiStore = {
  participant: ParticipantId;
  weather: WeatherKind;
  volume: number;
  muted: boolean;
  note: { title: string; norwegian: string; note: string } | null;
  hintSeen: boolean;
  discovery: string | null;
  senseRequest: { kind: SenseAction; nonce: number } | null;
  nearWater: boolean;
  denInside: boolean;
  nearDen: boolean;
  nearNiche: boolean;
  gatherable: Carried | null;
  carried: Carried | null;
  denRequest: { kind: DenAction; nonce: number } | null;
  setParticipant: (participant: ParticipantId) => void;
  setWeather: (weather: WeatherKind) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setNote: (note: UiStore["note"]) => void;
  setDiscovery: (discovery: string | null) => void;
  requestSense: (kind: SenseAction) => void;
  clearSenseRequest: () => void;
  setNearWater: (nearWater: boolean) => void;
  setDenInside: (denInside: boolean) => void;
  setNearDen: (nearDen: boolean) => void;
  setNearNiche: (nearNiche: boolean) => void;
  setGatherable: (gatherable: Carried | null) => void;
  setCarried: (carried: Carried | null) => void;
  requestDen: (kind: DenAction) => void;
  clearDenRequest: () => void;
  markHintSeen: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  participant: "elder",
  weather: "clear",
  volume: 45,
  muted: false,
  note: null,
  hintSeen: false,
  discovery: null,
  senseRequest: null,
  nearWater: false,
  denInside: false,
  nearDen: false,
  nearNiche: false,
  gatherable: null,
  carried: null,
  denRequest: null,
  setParticipant: (participant) => set({ participant, hintSeen: true }),
  setWeather: (weather) => set({ weather, hintSeen: true }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setNote: (note) => set({ note }),
  setDiscovery: (discovery) => set({ discovery }),
  requestSense: (kind) => set({ senseRequest: { kind, nonce: Date.now() }, hintSeen: true }),
  clearSenseRequest: () => set({ senseRequest: null }),
  setNearWater: (nearWater) => set({ nearWater }),
  setDenInside: (denInside) => set({ denInside }),
  setNearDen: (nearDen) => set({ nearDen }),
  setNearNiche: (nearNiche) => set({ nearNiche }),
  setGatherable: (gatherable) => set({ gatherable }),
  setCarried: (carried) => set({ carried }),
  requestDen: (kind) => set({ denRequest: { kind, nonce: Date.now() }, hintSeen: true }),
  clearDenRequest: () => set({ denRequest: null }),
  markHintSeen: () => set({ hintSeen: true }),
}));
