import { Hud } from "./Hud";
import { WorldCanvas } from "./WorldCanvas";

export function WorldExperience() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#39473a]">
      <WorldCanvas />
      <Hud />
    </main>
  );
}
