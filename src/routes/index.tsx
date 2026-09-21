import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "@/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Spor — A Quiet Norwegian Nature World" },
      { name: "description", content: "Wander slowly as a red fox through a living Norwegian pine glade." },
      { property: "og:title", content: "Spor — A Quiet Norwegian Nature World" },
      { property: "og:description", content: "Wander slowly as a red fox through a living Norwegian pine glade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
