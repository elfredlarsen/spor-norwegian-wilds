import type {
  DenKeepsake,
  DenMaterial,
  DenState,
  Footprint,
  ParticipantId,
  Placement,
  PlacementKind,
  WeatherKind,
  WorldState,
} from "./types";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./world";

const STORAGE_KEY = "spor.world.v1";
const TRAIL_LIMIT = 900;
const PLACEMENT_LIMIT = 600;

function emptyDen(): DenState {
  return { discovered: false, rests: 0, bedding: [], keepsakes: [], invitation: null };
}

function emptyWorld(): WorldState {
  return {
    den: emptyDen(),
    version: 1,
    placements: [],
    trail: [],
    weather: { kind: "clear", by: "elder", at: Date.now() },
    positions: {
      elder: { x: WORLD_WIDTH * 0.38, y: WORLD_HEIGHT * 0.56 },
      child: { x: WORLD_WIDTH * 0.63, y: WORLD_HEIGHT * 0.44 },
    },
    seen: {},
  };
}

/**
 * The world engine keeps the shared, persistent state of the forest.
 * It is deliberately free of React and of any storage assumption beyond a
 * pluggable load/save, so it can later be backed by a multiplayer sync layer
 * or an offline database instead of localStorage.
 */
class WorldEngine {
  state: WorldState = emptyWorld();
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;

  load() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WorldState>;
        if (parsed && parsed.version === 1) {
          this.state = {
            ...emptyWorld(),
            ...parsed,
            den: { ...emptyDen(), ...(parsed.den ?? {}) },
          } as WorldState;
        }
      }
    } catch {
      this.state = emptyWorld();
    }
    this.emit();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
    this.scheduleSave();
  }

  private scheduleSave() {
    if (typeof window === "undefined") return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 600);
  }

  save() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage may be full or blocked; the world simply stays in memory */
    }
  }

  position(participant: ParticipantId) {
    return this.state.positions[participant];
  }

  setPosition(participant: ParticipantId, x: number, y: number) {
    this.state.positions[participant] = { x, y };
    this.scheduleSave();
  }

  addFootprint(print: Footprint) {
    this.state.trail.push(print);
    if (this.state.trail.length > TRAIL_LIMIT) {
      this.state.trail.splice(0, this.state.trail.length - TRAIL_LIMIT);
    }
    this.scheduleSave();
  }

  place(kind: PlacementKind, x: number, y: number, by: ParticipantId) {
    const placement: Placement = {
      id: `${kind}-${Date.now()}-${Math.round(Math.random() * 9999)}`,
      kind,
      x,
      y,
      variant: Math.floor(Math.random() * 3),
      by,
      at: Date.now(),
    };
    this.state.placements.push(placement);
    if (this.state.placements.length > PLACEMENT_LIMIT) {
      this.state.placements.splice(0, this.state.placements.length - PLACEMENT_LIMIT);
    }
    this.emit();
    return placement;
  }

  setWeather(kind: WeatherKind, by: ParticipantId) {
    this.state.weather = { kind, by, at: Date.now() };
    this.emit();
  }

  markSeen(id: string) {
    if (this.state.seen[id]) return;
    this.state.seen[id] = true;
    this.scheduleSave();
  }

  // ---- the den ----

  /** The fox finds the opening under the fallen pine. */
  discoverDen() {
    if (this.state.den.discovered) return false;
    this.state.den.discovered = true;
    this.emit();
    return true;
  }

  /** Each rest presses the floor of the den a little flatter. */
  restInDen() {
    this.state.den.rests += 1;
    this.emit();
    return this.state.den.rests;
  }

  addBedding(material: DenMaterial, by: ParticipantId) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 34;
    this.state.den.bedding.push({
      material,
      by,
      at: Date.now(),
      offsetX: Math.cos(angle) * distance,
      offsetY: Math.sin(angle) * distance * 0.6,
      angle: Math.random() * Math.PI,
    });
    this.emit();
    return this.state.den.bedding.length;
  }

  /** Inside the den nothing weathers away — keepsakes simply stay. */
  placeKeepsake(nicheId: string, item: DenKeepsake, by: ParticipantId) {
    if (this.state.den.keepsakes.some((entry) => entry.nicheId === nicheId)) return false;
    this.state.den.keepsakes.push({ nicheId, item, by, at: Date.now() });
    this.emit();
    return true;
  }

  keepsakeAt(nicheId: string) {
    return this.state.den.keepsakes.find((entry) => entry.nicheId === nicheId) ?? null;
  }

  setInvitation(path: Array<{ x: number; y: number }>, by: ParticipantId) {
    this.state.den.invitation = { by, at: Date.now(), path };
    this.emit();
  }

  /** Anything another participant left since the given moment. */
  tracesFrom(other: ParticipantId, since: number) {
    return this.state.placements.filter((item) => item.by === other && item.at > since);
  }
}

export const worldEngine = new WorldEngine();
