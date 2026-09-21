import { useEffect } from "react";
import { Hud } from "./Hud";
import { WorldCanvas } from "./WorldCanvas";
import { startAuthListener } from "./auth-store";
import { useMultiplayerSync } from "./use-multiplayer-sync";

export function WorldExperience() {
  useEffect(() => {
    startAuthListener();
  }, []);
  // Harmless when signed out: solo play never touches Supabase.
  const multiplayer = useMultiplayerSync();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#39473a]">
      <WorldCanvas />
      <Hud multiplayer={multiplayer} />
    </main>
  );
}
