import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";
import { Hud } from "./Hud";

export function GameCanvas() {
  return <main className="fixed inset-0 overflow-hidden bg-background">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [5.8, 4.2, 8.3], fov: 48, near: 0.1, far: 120 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <Scene />
    </Canvas>
    <Hud />
  </main>;
}