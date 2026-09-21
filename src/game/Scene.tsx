import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { forestAudio } from "./audio";
import { useKeyboard } from "./use-keyboard";
import { useGameStore, type FoxAction } from "./store";

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const MOVE = new THREE.Vector3();
const CAMERA_TARGET = new THREE.Vector3();
const LOOK_TARGET = new THREE.Vector3();

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function groundHeight(x: number, z: number) {
  return Math.sin(x * 0.11) * 0.42 + Math.cos(z * 0.09) * 0.32 + Math.sin((x + z) * 0.055) * 0.26;
}

function createGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();
  context.fillStyle = "#405944";
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 1800; index += 1) {
    const x = seeded(index, 2) * 256;
    const y = seeded(index, 4) * 256;
    context.fillStyle = index % 3 === 0 ? "#6e7651" : index % 2 === 0 ? "#263d34" : "#52664a";
    context.globalAlpha = 0.2 + seeded(index, 6) * 0.35;
    context.fillRect(x, y, 1 + seeded(index, 8) * 3, 1 + seeded(index, 10) * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Terrain() {
  const texture = useMemo(createGroundTexture, []);
  const geometry = useMemo(() => {
    const result = new THREE.PlaneGeometry(86, 86, 48, 48);
    result.rotateX(-Math.PI / 2);
    const positions = result.attributes["position"];
    if (!positions) return result;
    for (let index = 0; index < positions.count; index += 1) {
      positions.setY(index, groundHeight(positions.getX(index), positions.getZ(index)));
    }
    result.computeVertexNormals();
    return result;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={texture} color="#829078" roughness={0.98} />
    </mesh>
  );
}

function Pine({ position, scale, phase }: { position: [number, number, number]; scale: number; phase: number }) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.36 + phase) * 0.012;
  });
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position-y={3.1}>
        <cylinderGeometry args={[0.24, 0.38, 6.2, 7]} />
        <meshStandardMaterial color="#75543b" roughness={1} />
      </mesh>
      <group ref={crown} position-y={4.1}>
        <mesh castShadow position-y={2.3}><coneGeometry args={[1.65, 3.2, 8]} /><meshStandardMaterial color="#24463a" roughness={0.95} /></mesh>
        <mesh castShadow position-y={1.05}><coneGeometry args={[2.05, 3.4, 8]} /><meshStandardMaterial color="#315640" roughness={0.96} /></mesh>
        <mesh castShadow position-y={-0.25}><coneGeometry args={[2.35, 3.2, 8]} /><meshStandardMaterial color="#3e6349" roughness={0.98} /></mesh>
      </group>
    </group>
  );
}

function Birch({ position, scale, phase }: { position: [number, number, number]; scale: number; phase: number }) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.48 + phase) * 0.018;
  });
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position-y={2.6}><cylinderGeometry args={[0.14, 0.23, 5.2, 7]} /><meshStandardMaterial color="#d9d3bc" roughness={0.92} /></mesh>
      {[1.4, 2.4, 3.45].map((height, index) => <mesh key={height} position={[0.01, height, 0.18]} rotation-z={index % 2 ? 0.12 : -0.1}><boxGeometry args={[0.28, 0.08, 0.08]} /><meshStandardMaterial color="#413b35" /></mesh>)}
      <group ref={crown} position-y={4.6}>
        <mesh castShadow scale={[1.3, 1, 1.15]}><dodecahedronGeometry args={[1.25, 0]} /><meshStandardMaterial color="#879b62" roughness={1} /></mesh>
        <mesh castShadow position={[-0.6, -0.4, 0.2]} scale={0.72}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#6f8957" roughness={1} /></mesh>
      </group>
    </group>
  );
}

function Boulder({ position, scale, rotation }: { position: [number, number, number]; scale: number; rotation: number }) {
  return (
    <mesh position={position} scale={[scale * 1.3, scale * 0.8, scale]} rotation={[0.1, rotation, -0.08]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#85887f" roughness={0.88} />
    </mesh>
  );
}

function Understory() {
  const shrubs = useMemo(() => Array.from({ length: 95 }, (_, index) => {
    const radius = 6 + seeded(index, 12) * 32;
    const angle = seeded(index, 13) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, scale: 0.35 + seeded(index, 14) * 0.55, berry: index % 4 === 0 };
  }), []);
  return <>{shrubs.map((shrub, index) => (
    <group key={index} position={[shrub.x, groundHeight(shrub.x, shrub.z) + 0.12, shrub.z]} scale={shrub.scale}>
      {[0, 1, 2].map((leaf) => <mesh key={leaf} position={[(leaf - 1) * 0.3, leaf % 2 * 0.18, (leaf % 2 - 0.5) * 0.25]} rotation={[0, leaf * 2.1, 0]}><octahedronGeometry args={[0.38, 0]} /><meshStandardMaterial color={leaf === 1 ? "#526a3f" : "#3f5938"} roughness={1} /></mesh>)}
      {shrub.berry && <mesh position={[0.22, 0.3, 0.24]}><sphereGeometry args={[0.08, 6, 5]} /><meshStandardMaterial color="#40527c" roughness={0.8} /></mesh>}
    </group>
  ))}</>;
}

function Forest() {
  const trees = useMemo(() => Array.from({ length: 34 }, (_, index) => {
    const radius = 11 + seeded(index, 20) * 29;
    const angle = seeded(index, 22) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return { x, z, scale: 0.72 + seeded(index, 24) * 0.65, birch: index % 5 === 0, phase: seeded(index, 26) * 8 };
  }), []);
  const rocks = useMemo(() => Array.from({ length: 15 }, (_, index) => {
    const radius = 8 + seeded(index, 30) * 31;
    const angle = seeded(index, 31) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return { x, z, scale: 0.65 + seeded(index, 32) * 1.4, rotation: seeded(index, 33) * Math.PI };
  }), []);
  return <>
    {trees.map((tree, index) => tree.birch
      ? <Birch key={index} position={[tree.x, groundHeight(tree.x, tree.z), tree.z]} scale={tree.scale} phase={tree.phase} />
      : <Pine key={index} position={[tree.x, groundHeight(tree.x, tree.z), tree.z]} scale={tree.scale} phase={tree.phase} />)}
    {rocks.map((rock, index) => <Boulder key={index} position={[rock.x, groundHeight(rock.x, rock.z) + rock.scale * 0.35, rock.z]} scale={rock.scale} rotation={rock.rotation} />)}
    <Understory />
  </>;
}

function Fox({ action }: { action: FoxAction }) {
  const body = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime;
    if (body.current) {
      const targetY = action === "resting" ? 0.38 : 0.74;
      body.current.position.y += (targetY - body.current.position.y) * (1 - Math.exp(-5 * dt));
      body.current.rotation.x += ((action === "resting" ? -0.08 : 0) - body.current.rotation.x) * (1 - Math.exp(-5 * dt));
      if (action === "moving") body.current.position.y += Math.sin(t * 10) * 0.008;
    }
    if (tail.current) {
      const curl = action === "resting" ? -2.15 : -0.55 + Math.sin(t * 2.1) * 0.08;
      tail.current.rotation.y += (curl - tail.current.rotation.y) * (1 - Math.exp(-4 * dt));
    }
    if (head.current) {
      const lift = action === "sniffing" ? -0.48 : action === "resting" ? 0.22 : 0;
      head.current.rotation.x += (lift - head.current.rotation.x) * (1 - Math.exp(-4 * dt));
    }
  });
  const red = "#a94c27";
  return (
    <group ref={body} position-y={0.74}>
      <mesh castShadow scale={[0.62, 0.55, 1.15]}><sphereGeometry args={[0.72, 12, 8]} /><meshStandardMaterial color={red} roughness={0.85} /></mesh>
      <group ref={head} position={[0, 0.28, -1.03]}>
        <mesh castShadow scale={[0.56, 0.55, 0.7]}><sphereGeometry args={[0.65, 12, 8]} /><meshStandardMaterial color={red} roughness={0.85} /></mesh>
        <mesh position={[0, -0.08, -0.55]} rotation-x={Math.PI / 2}><coneGeometry args={[0.28, 0.72, 8]} /><meshStandardMaterial color="#c36a3b" roughness={0.86} /></mesh>
        <mesh position={[0, -0.1, -0.93]}><sphereGeometry args={[0.095, 8, 6]} /><meshStandardMaterial color="#252722" roughness={0.72} /></mesh>
        {[-1, 1].map((side) => <group key={side} position={[side * 0.35, 0.53, -0.06]} rotation-z={side * -0.18}><mesh><coneGeometry args={[0.2, 0.58, 7]} /><meshStandardMaterial color={red} roughness={0.9} /></mesh><mesh position={[0, -0.04, -0.012]} scale={0.58}><coneGeometry args={[0.2, 0.52, 7]} /><meshStandardMaterial color="#49352f" roughness={1} /></mesh></group>)}
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.24, 0.15, -0.5]}><sphereGeometry args={[0.045, 7, 6]} /><meshStandardMaterial color="#171b18" roughness={0.5} /></mesh>)}
        <mesh position={[0, -0.28, -0.2]} scale={[0.38, 0.24, 0.42]}><sphereGeometry args={[0.55, 10, 7]} /><meshStandardMaterial color="#e2d5b7" roughness={1} /></mesh>
      </group>
      <group ref={tail} position={[0, 0.15, 0.82]} rotation={[0.18, -0.55, 0]}>
        <mesh position={[0, 0, 0.86]} rotation-x={Math.PI / 2} castShadow><coneGeometry args={[0.42, 1.9, 10]} /><meshStandardMaterial color={red} roughness={0.9} /></mesh>
        <mesh position={[0, 0, 1.7]} rotation-x={Math.PI / 2}><coneGeometry args={[0.26, 0.55, 10]} /><meshStandardMaterial color="#e4d8bc" roughness={1} /></mesh>
      </group>
      {[-0.38, 0.38].flatMap((x) => [-0.48, 0.48].map((z) => <group key={`${x}-${z}`} position={[x, -0.36, z]}><mesh castShadow><cylinderGeometry args={[0.1, 0.12, 0.68, 7]} /><meshStandardMaterial color="#6f351f" roughness={0.9} /></mesh><mesh position={[0, -0.33, -0.05]} scale={[0.14, 0.08, 0.22]}><sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#282b26" /></mesh></group>))}
    </group>
  );
}

type TrailPoint = { id: number; x: number; z: number; yaw: number };
type Bloom = { id: number; x: number; z: number };

function Player() {
  const player = useRef<THREE.Group>(null);
  const keys = useKeyboard();
  const [trails, setTrails] = useState<TrailPoint[]>([]);
  const [blooms, setBlooms] = useState<Bloom[]>([]);
  const trailDistance = useRef(0);
  const bloomClock = useRef(0);
  const sniffClock = useRef(0);
  const stepClock = useRef(0);
  const actionRef = useRef<FoxAction>("idle");
  const { camera } = useThree();

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const object = player.current;
    if (!object) return;
    const store = useGameStore.getState();
    if (store.sniffRequested) {
      sniffClock.current = 4.8;
      store.consumeSniff();
      forestAudio.calmWind(true);
    }
    sniffClock.current = Math.max(0, sniffClock.current - dt);
    if (sniffClock.current === 0) forestAudio.calmWind(false);
    const resting = store.restHeld;
    const sniffing = sniffClock.current > 0;
    const forwardInput = (keys.current.has("KeyW") || keys.current.has("ArrowUp") ? 1 : 0) - (keys.current.has("KeyS") || keys.current.has("ArrowDown") ? 1 : 0) - store.joystick.y;
    const sideInput = (keys.current.has("KeyD") || keys.current.has("ArrowRight") ? 1 : 0) - (keys.current.has("KeyA") || keys.current.has("ArrowLeft") ? 1 : 0) + store.joystick.x;
    let moving = false;
    if (!resting && !sniffing && Math.hypot(forwardInput, sideInput) > 0.08) {
      camera.getWorldDirection(FORWARD);
      FORWARD.y = 0;
      FORWARD.normalize();
      RIGHT.crossVectors(FORWARD, camera.up).normalize();
      MOVE.set(0, 0, 0).addScaledVector(FORWARD, forwardInput).addScaledVector(RIGHT, sideInput).normalize();
      const distance = 2.75 * dt;
      object.position.addScaledVector(MOVE, distance);
      const radius = Math.hypot(object.position.x, object.position.z);
      if (radius > 35) object.position.multiplyScalar(35 / radius);
      object.position.y = groundHeight(object.position.x, object.position.z);
      const yaw = Math.atan2(-MOVE.x, -MOVE.z);
      const diff = Math.atan2(Math.sin(yaw - object.rotation.y), Math.cos(yaw - object.rotation.y));
      object.rotation.y += diff * (1 - Math.exp(-8 * dt));
      moving = true;
      trailDistance.current += distance;
      stepClock.current += dt;
      if (stepClock.current > 0.58) { forestAudio.footstep(); stepClock.current = 0; }
      if (trailDistance.current > 0.72) {
        trailDistance.current = 0;
        setTrails((previous) => [...previous.slice(-179), { id: Date.now() + previous.length, x: object.position.x, z: object.position.z, yaw: object.rotation.y }]);
      }
    }
    if (resting) {
      bloomClock.current += dt;
      if (bloomClock.current > 0.5) {
        bloomClock.current = 0;
        const index = blooms.length;
        const angle = index * 2.399;
        const radius = 1.05 + Math.min(index, 28) * 0.075;
        setBlooms((previous) => [...previous.slice(-47), { id: Date.now() + index, x: object.position.x + Math.cos(angle) * radius, z: object.position.z + Math.sin(angle) * radius }]);
      }
    }
    const nextAction: FoxAction = resting ? "resting" : sniffing ? "sniffing" : moving ? "moving" : "idle";
    if (nextAction !== actionRef.current) { actionRef.current = nextAction; store.setAction(nextAction); }
    const offsetDistance = sniffing ? 10.8 : 8.3;
    CAMERA_TARGET.set(object.position.x + 5.8, object.position.y + 4.2, object.position.z + offsetDistance);
    camera.position.lerp(CAMERA_TARGET, 1 - Math.exp(-(sniffing ? 1.4 : 2.5) * dt));
    LOOK_TARGET.set(object.position.x, object.position.y + (sniffing ? 1.35 : 0.9), object.position.z - 0.7);
    camera.lookAt(LOOK_TARGET);
  });

  const action = useGameStore((state) => state.action);
  return <>
    {trails.map((trail) => <mesh key={trail.id} position={[trail.x, groundHeight(trail.x, trail.z) + 0.025, trail.z]} rotation={[-Math.PI / 2, 0, trail.yaw]}><circleGeometry args={[0.34, 10]} /><meshStandardMaterial color="#4b513e" transparent opacity={0.45} roughness={1} depthWrite={false} /></mesh>)}
    {blooms.map((bloom, index) => <group key={bloom.id} position={[bloom.x, groundHeight(bloom.x, bloom.z) + 0.07, bloom.z]} scale={Math.min(1.25, 0.7 + index * 0.05)}><mesh scale={[0.52, 0.1, 0.52]}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial color="#5f914b" roughness={1} /></mesh>{index % 3 === 0 && <mesh position={[0.18, 0.17, 0]}><sphereGeometry args={[0.075, 6, 5]} /><meshStandardMaterial color="#e6dfbd" /></mesh>}</group>)}
    <group ref={player}><Fox action={action} /></group>
  </>;
}

function Sunlight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const action = useGameStore((state) => state.action);
  useFrame((_, rawDelta) => {
    if (!light.current) return;
    const target = action === "sniffing" ? 3.2 : 1.65;
    light.current.intensity += (target - light.current.intensity) * (1 - Math.exp(-1.1 * Math.min(rawDelta, 0.05)));
  });
  return <directionalLight ref={light} position={[-18, 14, 8]} intensity={1.65} color="#f6cc8b" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} />;
}

export function Scene() {
  return <>
    <color attach="background" args={["#9aa79e"]} />
    <fog attach="fog" args={["#9aa79e", 24, 68]} />
    <hemisphereLight args={["#b9c5bf", "#384237", 1.05]} />
    <Sunlight />
    <Environment resolution={64}><Lightformer intensity={1.4} color="#d5d0bd" position={[0, 8, 4]} scale={[18, 8, 1]} /><Lightformer intensity={0.65} color="#879f95" position={[-8, 3, -4]} rotation-y={Math.PI / 2} scale={[16, 4, 1]} /></Environment>
    <Terrain />
    <Forest />
    <Player />
  </>;
}