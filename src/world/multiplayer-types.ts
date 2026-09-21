import type { DenState, PlacementKind, WeatherKind } from "./types";

/**
 * Row shapes for the `pairings` / `world_state` / `placements` / `footprints`
 * tables added in supabase/migrations/20260921120000_multiplayer_pairing.sql.
 *
 * src/integrations/supabase/types.ts doesn't know about these yet — it's
 * regenerated from the live database by Lovable, and that migration hasn't
 * been applied there yet. These are written by hand to match the migration
 * exactly; once the generated `Database` type includes these tables, calls
 * can drop the `as unknown as` casts in pairing.functions.ts and multiplayer.ts.
 */

export type PairingRow = {
  id: string;
  inviter_id: string;
  companion_id: string | null;
  invite_code: string;
  created_at: string;
};

export type WorldStateRow = {
  pairing_id: string;
  weather_kind: WeatherKind;
  weather_by: string | null;
  weather_at: string;
  den: DenState;
  updated_at: string;
};

export type PlacementRow = {
  id: string;
  pairing_id: string;
  kind: PlacementKind;
  x: number;
  y: number;
  variant: number;
  by: string;
  at: string;
};

export type FootprintRow = {
  id: number;
  pairing_id: string;
  x: number;
  y: number;
  angle: number;
  by: string;
  at: string;
};
