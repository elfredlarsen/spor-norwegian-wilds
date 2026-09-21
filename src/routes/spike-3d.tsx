import { createFileRoute } from "@tanstack/react-router";
import { Spike3DScene } from "@/world/Spike3DScene";

export const Route = createFileRoute("/spike-3d")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Spor — 3D spike (prototype)" }],
  }),
  component: Spike3DScene,
});
