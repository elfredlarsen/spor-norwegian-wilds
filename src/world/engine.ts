import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
import type { PlacementRow, WorldStateRow } from "./multiplayer-types";
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
 *
 * Once bindRemote() is called (a signed-in, paired account), every mutation
 * below also writes through to Supabase and a Postgres Changes subscription
 * feeds the companion's changes back in. Unpaired play is untouched — those
 * writes simply never happen and everything stays on localStorage, as before.
 */
class WorldEngine {
  state: WorldState = emptyWorld();
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;
  private pairingId: string | null = null;
  private myUserId: string | null = null;
  private roleByUserId: Record<string, ParticipantId> = {};
  private remoteChannel: RealtimeChannel | null = null;
  private knownPlacementIds = new Set<string>();

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

  // ---- multiplayer sync (only active once a signed-in, paired account calls this) ----

  /**
   * `roleByUserId` maps both accounts in the pairing to "elder"/"child" so
   * incoming rows (stamped with a Supabase user id) can be shown as the
   * right fox — the caller (useMultiplayerSync) builds this from
   * getMyPairing()'s inviterId/companionId.
   */
  async bindRemote(pairingId: string, myUserId: string, roleByUserId: Record<string, ParticipantId>) {
    if (this.pairingId === pairingId) return;
    this.unbindRemote();
    this.pairingId = pairingId;
    this.myUserId = myUserId;
    this.roleByUserId = roleByUserId;

    const [worldRow, placementRows] = await Promise.all([
      supabase.from("world_state" as never).select("*").eq("pairing_id", pairingId).maybeSingle(),
      supabase.from("placements" as never).select("*").eq("pairing_id", pairingId).order("at", { ascending: true }),
    ]);

    if (worldRow.data) this.applyWorldStateRow(worldRow.data as unknown as WorldStateRow);
    if (placementRows.data) {
      const rows = placementRows.data as unknown as PlacementRow[];
      this.state.placements = rows.map((row) => this.placementFromRow(row));
      this.knownPlacementIds = new Set(this.state.placements.map((item) => item.id));
    }
    this.emit();

    this.remoteChannel = supabase
      .channel(`pairing:${pairingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "placements", filter: `pairing_id=eq.${pairingId}` },
        (payload) => {
          const row = payload.new as unknown as PlacementRow;
          if (this.knownPlacementIds.has(row.id)) return;
          this.knownPlacementIds.add(row.id);
          this.state.placements.push(this.placementFromRow(row));
          this.emit();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "world_state", filter: `pairing_id=eq.${pairingId}` },
        (payload) => {
          this.applyWorldStateRow(payload.new as unknown as WorldStateRow);
          this.emit();
        },
      )
      .subscribe();
  }

  unbindRemote() {
    if (this.remoteChannel) {
      void supabase.removeChannel(this.remoteChannel);
      this.remoteChannel = null;
    }
    this.pairingId = null;
    this.myUserId = null;
    this.roleByUserId = {};
  }

  private roleFor(userId: string): ParticipantId {
    return this.roleByUserId[userId] ?? "elder";
  }

  private applyWorldStateRow(row: WorldStateRow) {
    this.state.weather = {
      kind: row.weather_kind,
      by: row.weather_by ? this.roleFor(row.weather_by) : "elder",
      at: new Date(row.weather_at).getTime(),
    };
    this.state.den = { ...emptyDen(), ...row.den };
  }

  private placementFromRow(row: PlacementRow): Placement {
    return {
      id: row.id,
      kind: row.kind,
      x: row.x,
      y: row.y,
      variant: row.variant,
      by: this.roleFor(row.by),
      at: new Date(row.at).getTime(),
    };
  }

  private pushWorldState() {
    if (!this.pairingId || !this.myUserId) return;
    void supabase
      .from("world_state" as never)
      .update({
        weather_kind: this.state.weather.kind,
        weather_by: this.myUserId,
        weather_at: new Date(this.state.weather.at).toISOString(),
        den: this.state.den,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("pairing_id", this.pairingId);
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
    if (this.pairingId && this.myUserId) {
      this.knownPlacementIds.add(placement.id);
      void supabase.from("placements" as never).insert({
        id: placement.id,
        pairing_id: this.pairingId,
        kind: placement.kind,
        x: placement.x,
        y: placement.y,
        variant: placement.variant,
        by: this.myUserId,
      } as never);
    }
    return placement;
  }

  setWeather(kind: WeatherKind, by: ParticipantId) {
    this.state.weather = { kind, by, at: Date.now() };
    this.emit();
    this.pushWorldState();
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
    this.pushWorldState();
    return true;
  }

  /** Each rest presses the floor of the den a little flatter. */
  restInDen() {
    this.state.den.rests += 1;
    this.emit();
    this.pushWorldState();
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
    this.pushWorldState();
    return this.state.den.bedding.length;
  }

  /** Inside the den nothing weathers away — keepsakes simply stay. */
  placeKeepsake(nicheId: string, item: DenKeepsake, by: ParticipantId) {
    if (this.state.den.keepsakes.some((entry) => entry.nicheId === nicheId)) return false;
    this.state.den.keepsakes.push({ nicheId, item, by, at: Date.now() });
    this.emit();
    this.pushWorldState();
    return true;
  }

  keepsakeAt(nicheId: string) {
    return this.state.den.keepsakes.find((entry) => entry.nicheId === nicheId) ?? null;
  }

  setInvitation(path: Array<{ x: number; y: number }>, by: ParticipantId) {
    this.state.den.invitation = { by, at: Date.now(), path };
    this.emit();
    this.pushWorldState();
  }

  /** Anything another participant left since the given moment. */
  tracesFrom(other: ParticipantId, since: number) {
    return this.state.placements.filter((item) => item.by === other && item.at > since);
  }
}

export const worldEngine = new WorldEngine();
