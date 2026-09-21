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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus({ kind: "signed-out" });
      return;
    }
    let cancelled = false;
    setStatus({ kind: "loading" });
    getMyPairing()
      .then(async (pairing) => {
        if (cancelled) return;
        if (!pairing) {
          setStatus({ kind: "unpaired" });
          return;
        }
        if (!pairing.paired) {
          setStatus({ kind: "pending", inviteCode: (await createInvite({ data: {} })).inviteCode });
          return;
        }
        const roleByUserId: Record<string, ParticipantId> = { [pairing.inviterId]: "elder" };
        if (pairing.companionId) roleByUserId[pairing.companionId] = "child";
        if (bound.current !== pairing.pairingId) {
          bound.current = pairing.pairingId;
          await worldEngine.bindRemote(pairing.pairingId, pairing.myUserId, roleByUserId);
        }
        setParticipant(pairing.role);
        setStatus({ kind: "paired", role: pairing.role });
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "unpaired" });
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, setParticipant]);

  useEffect(
    () => () => {
      if (bound.current) worldEngine.unbindRemote();
    },
    [],
  );

  return status;
}
