import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DenState, Placement, WeatherState } from "./types";
import type { PairingRow } from "./multiplayer-types";

function randomInviteCode(): string {
  // short and easy to read aloud / paste — not a security boundary on its
  // own, the row it points to only ever accepts one companion (see the
  // migration's unique index and the "already accepted" check below).
  return Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");
}

const seedInput = z.object({
  placements: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["stone", "flower", "lantern", "berry"]),
      x: z.number(),
      y: z.number(),
      variant: z.number(),
      at: z.number(),
    }),
  ),
  den: z.unknown(),
  weather: z.object({ kind: z.enum(["clear", "rain", "mist", "sun"]), at: z.number() }),
});

const createInviteInput = z.object({ seed: seedInput.optional() });

/**
 * Returns the caller's existing pairing (as inviter) if there is one,
 * otherwise creates a fresh one. Idempotent by design — the HUD can call
 * this every time it opens the "invite companion" panel.
 */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInviteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const existing = await supabase.from("pairings" as never).select("*").eq("inviter_id", userId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const row = existing.data as unknown as PairingRow;
      return { inviteCode: row.invite_code, pairingId: row.id, paired: row.companion_id !== null };
    }

    const inviteCode = randomInviteCode();
    const inserted = await supabase
      .from("pairings" as never)
      .insert({ inviter_id: userId, invite_code: inviteCode } as never)
      .select("*")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    const row = inserted.data as unknown as PairingRow;

    if (data.seed) {
      const seed = data.seed as { placements: Placement[]; den: DenState; weather: WeatherState };
      await supabase.from("world_state" as never).insert({
        pairing_id: row.id,
        weather_kind: seed.weather.kind,
        weather_by: userId,
        den: seed.den,
      } as never);
      if (seed.placements.length > 0) {
        await supabase.from("placements" as never).insert(
          seed.placements.map((placement) => ({
            id: placement.id,
            pairing_id: row.id,
            kind: placement.kind,
            x: placement.x,
            y: placement.y,
            variant: placement.variant,
            by: userId,
          })) as never,
        );
      }
    } else {
      await supabase.from("world_state" as never).insert({ pairing_id: row.id, weather_by: userId } as never);
    }

    return { inviteCode: row.invite_code, pairingId: row.id, paired: false };
  });

export const getMyPairing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const result = await supabase
      .from("pairings" as never)
      .select("*")
      .or(`inviter_id.eq.${userId},companion_id.eq.${userId}`)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) return null;
    const row = result.data as unknown as PairingRow;
    return {
      pairingId: row.id,
      role: row.inviter_id === userId ? ("elder" as const) : ("child" as const),
      paired: row.companion_id !== null,
      myUserId: userId,
      inviterId: row.inviter_id,
      companionId: row.companion_id,
    };
  });

const acceptInput = z.object({ code: z.string().min(1) });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => acceptInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // the joiner isn't a member of the pairing yet, so RLS blocks the lookup
    // on the normal client — this one step needs the service-role client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const found = await supabaseAdmin.from("pairings" as never).select("*").eq("invite_code", data.code).maybeSingle();
    if (found.error) throw new Error(found.error.message);
    const row = found.data as unknown as PairingRow | null;
    if (!row) throw new Error("Den invitation findes ikke længere.");
    if (row.inviter_id === userId) throw new Error("Du kan ikke tage imod din egen invitation.");
    if (row.companion_id) throw new Error("Denne invitation er allerede taget imod.");

    const updated = await supabaseAdmin
      .from("pairings" as never)
      .update({ companion_id: userId } as never)
      .eq("id", row.id)
      .is("companion_id", null)
      .select("*")
      .single();
    if (updated.error) {
      // most likely the unique index on companion_id — this account already
      // belongs to a different pairing
      throw new Error("Du er allerede parret med en anden ræv.");
    }

    return { pairingId: row.id };
  });
