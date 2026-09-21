import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "./auth-store";
import { getMyPairing, createInvite } from "./pairing.functions";
import { worldEngine } from "./engine";
import { useUiStore } from "./ui-store";
import type { ParticipantId } from "./types";

export type MultiplayerStatus =
  | { kind: "signed-out" }
  | { kind: "loading" }
  | { kind: "unpaired" }
  | { kind: "pending"; inviteCode: string }
  | { kind: "paired"; role: ParticipantId };

/**
 * Drives WorldEngine.bindRemote() once a signed-in account turns out to be
 * paired, and locks the HUD's fox-switch to that account's own role — in
 * shared play you are always your own fox, never your companion's.
 * Solo/unauthenticated play is untouched: this hook simply reports
 * "signed-out" and nothing downstream changes.
 */
export function useMultiplayerSync(): MultiplayerStatus {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const setParticipant = useUiStore((state) => state.setParticipant);
  const [status, setStatus] = useState<MultiplayerStatus>({ kind: "loading" });
  const bound = useRef<string | null>(null);
  // Supabase fires several auth events in a row (initial session, signed in,
  // token refreshed) and each hands us a fresh user object. Keying the effect
  // on the account id — and letting only the newest lookup win — keeps a
  // superseded run from leaving the panel stuck on "loading" forever.
  const userId = user?.id ?? null;
  const run = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setStatus({ kind: "signed-out" });
      return;
    }
    const mine = ++run.current;
    const stale = () => run.current !== mine;
    setStatus({ kind: "loading" });
    getMyPairing()
      .then(async (pairing) => {
        console.log('MP pairing', JSON.stringify(pairing));
        if (stale()) return;
        if (!pairing) {
          setStatus({ kind: "unpaired" });
          return;
        }
        if (!pairing.paired) {
          const invite = await createInvite({ data: {} });
          if (stale()) return;
          setStatus({ kind: "pending", inviteCode: invite.inviteCode });
          return;
        }
        const roleByUserId: Record<string, ParticipantId> = { [pairing.inviterId]: "elder" };
        if (pairing.companionId) roleByUserId[pairing.companionId] = "child";
        if (bound.current !== pairing.pairingId) {
          bound.current = pairing.pairingId;
          console.log('MP bind start');
          await worldEngine.bindRemote(pairing.pairingId, pairing.myUserId, roleByUserId);
          console.log('MP bind done');
        }
        if (stale()) return;
        setParticipant(pairing.role);
        setStatus({ kind: "paired", role: pairing.role });
      })
      .catch((e) => {
        console.log('MP error', String(e));
        if (!stale()) setStatus({ kind: "unpaired" });
      });
  }, [userId, authLoading, setParticipant]);

  useEffect(
    () => () => {
      if (bound.current) worldEngine.unbindRemote();
    },
    [],
  );

  return status;
}
