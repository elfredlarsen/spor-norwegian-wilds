import { create } from "zustand";

export type FoxAction = "moving" | "idle" | "resting" | "sniffing";

type GameStore = {
  action: FoxAction;
  restHeld: boolean;
  sniffRequested: boolean;
  joystick: { x: number; y: number };
  explored: boolean;
  setAction: (action: FoxAction) => void;
  setRestHeld: (restHeld: boolean) => void;
  requestSniff: () => void;
  consumeSniff: () => void;
  setJoystick: (x: number, y: number) => void;
  markExplored: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
  action: "idle",
  restHeld: false,
  sniffRequested: false,
  joystick: { x: 0, y: 0 },
  explored: false,
  setAction: (action) => set({ action }),
  setRestHeld: (restHeld) => set({ restHeld, explored: true }),
  requestSniff: () => set({ sniffRequested: true, explored: true }),
  consumeSniff: () => set({ sniffRequested: false }),
  setJoystick: (x, y) => set({ joystick: { x, y }, explored: true }),
  markExplored: () => set({ explored: true }),
}));