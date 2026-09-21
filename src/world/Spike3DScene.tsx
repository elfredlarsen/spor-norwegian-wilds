import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

/**
 * A throwaway comparison prototype: renders a small forest clearing with real
 * CC0 low-poly assets (KayKit Forest Nature Pack) under a fixed elevated camera,
 * so the calm-Nordic 2D game and a 3D version can be judged side by side.
 * Not wired into the actual game in any way.
 */

const MODEL = (name: string) => `/models/kaykit/${name}.gltf`;

type PropPlacement = {
  model: string;
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
};

// A ring of trees around a small clearing, echoing the den-clearing reference art.
// Real tree heights in this pack run 3-8 units, so the ring needs real breathing room.
const TREES: PropPlacement[] = [
  { model: "Tree_1_A_Color1", x: -11, z: -7, scale: 0.85 },
  { model: "Tree_1_C_Color1", x: -12.5, z: 3.5, scale: 0.7 },
  { model: "Tree_3_A_Color1", x: -9, z: 10.5, scale: 0.9 },
  { model: "Tree_3_C_Color1", x: 3, z: 12.5, scale: 0.75 },
  { model: "Tree_1_A_Color1", x: 11.5, z: 8.5, scale: 0.8, rotation: 1.2 },
  { model: "Tree_3_A_Color1", x: 13, z: -2.5, scale: 0.85, rotation: 2.1 },
  { model: "Tree_1_C_Color1", x: 9, z: -11, scale: 0.65, rotation: 0.6 },
  { model: "Tree_3_C_Color1", x: -2, z: -13, scale: 0.7, rotation: 2.8 },
  { model: "Tree_Bare_1_A_Color1", x: -6.5, z: -12, scale: 1.1, rotation: 1.5 },
];

const ROCKS: PropPlacement[] = [
  { model: "Rock_1_C_Color1", x: 3.2, z: 2, scale: 1.4 },
  { model: "Rock_2_B_Color1", x: -3.6, z: -1.4, scale: 1.2, rotation: 0.8 },
  { model: "Rock_1_C_Color1", x: 4.8, z: -3.4, scale: 1, rotation: 2.4 },
];

const BUSHES: PropPlacement[] = [
  { model: "Bush_1_B_Color1", x: -2.4, z: 4.4, scale: 1.3 },
  { model: "Bush_2_C_Color1", x: 3.8, z: 5, scale: 1.4, rotation: 1 },
  { model: "Bush_1_B_Color1", x: -5.2, z: 5.2, scale: 1.1, rotation: 2 },
  { model: "Bush_2_C_Color1", x: 0.6, z: -3.8, scale: 1.2, rotation: 0.4 },
];

const GRASS: PropPlacement[] = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const radius = 2.2 + (i % 3) * 0.8;
  return {
    model: "Grass_1_A_Color1",
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    scale: 1.4 + (i % 4) * 0.15,
    rotation: angle,
  };
});

function Prop({ placement }: { placement: PropPlacement }) {
  const { scene } = useGLTF(MODEL(placement.model));
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return (
    <primitive
      object={cloned}
      position={[placement.x, 0, placement.z]}
      scale={placement.scale ?? 1}
      rotation={[0, placement.rotation ?? 0, 0]}
    />
  );
}

function Clearing() {
  return (
    <>
      {/* forest floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#6c8a4f" roughness={1} />
      </mesh>
      {/* a slightly darker worn path patch at the centre, like the clearing reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.5]}>
        <circleGeometry args={[2.6, 32]} />
        <meshStandardMaterial color="#7c8f5c" roughness={1} />
      </mesh>

      {TREES.map((placement, index) => (
        <Prop key={`tree-${index}`} placement={placement} />
      ))}
      {ROCKS.map((placement, index) => (
        <Prop key={`rock-${index}`} placement={placement} />
      ))}
      {BUSHES.map((placement, index) => (
        <Prop key={`bush-${index}`} placement={placement} />
      ))}
      {GRASS.map((placement, index) => (
        <Prop key={`grass-${index}`} placement={placement} />
      ))}
    </>
  );
}

export function Spike3DScene() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#8fa9c4" }}>
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10,
          padding: "8px 14px",
          background: "rgba(20, 24, 18, 0.72)",
          color: "#f1efe6",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          borderRadius: 8,
          maxWidth: 320,
          lineHeight: 1.4,
        }}
      >
        <strong>3D-spike (prototype)</strong> — sammenligningstest med KayKit CC0-assets.
        Ikke koblet til det rigtige spil. Træk med musen for at se rundt.
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [24, 19, 24], fov: 32 }}>
        <color attach="background" args={["#c9d8e0"]} />
        <fog attach="fog" args={["#c9d8e0", 24, 62]} />
        <ambientLight intensity={0.55} color="#dce8dc" />
        <directionalLight
          position={[16, 26, 10]}
          intensity={1.15}
          color="#fff3d6"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
        />
        <directionalLight position={[-10, 8, -12]} intensity={0.25} color="#9fb8d8" />
        <Suspense fallback={null}>
          <Clearing />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.5}
          maxPolarAngle={1.3}
          minDistance={14}
          maxDistance={45}
          target={[0, 1, 0]}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL("Tree_1_A_Color1"));
useGLTF.preload(MODEL("Tree_1_C_Color1"));
useGLTF.preload(MODEL("Tree_3_A_Color1"));
useGLTF.preload(MODEL("Tree_3_C_Color1"));
useGLTF.preload(MODEL("Tree_Bare_1_A_Color1"));
useGLTF.preload(MODEL("Rock_1_C_Color1"));
useGLTF.preload(MODEL("Rock_2_B_Color1"));
useGLTF.preload(MODEL("Bush_1_B_Color1"));
useGLTF.preload(MODEL("Bush_2_C_Color1"));
useGLTF.preload(MODEL("Grass_1_A_Color1"));
