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
const SURFACE_NORMAL = new THREE.Vector3();
const SURFACE_RIGHT = new THREE.Vector3();
const SURFACE_BACK = new THREE.Vector3();
const TARGET_ROTATION = new THREE.Quaternion();
const ROTATION_MATRIX = new THREE.Matrix4();

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function groundHeight(x: number, z: number) {
  return Math.sin(x * 0.11) * 0.42 + Math.cos(z * 0.09) * 0.32 + Math.sin((x + z) * 0.055) * 0.26;
}

function groundNormal(x: number, z: number, target: THREE.Vector3) {
  const sample = 0.18;
  const dx = groundHeight(x + sample, z) - groundHeight(x - sample, z);
  const dz = groundHeight(x, z + sample) - groundHeight(x, z - sample);
  return target.set(-dx / (sample * 2), 1, -dz / (sample * 2)).normalize();
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

function Fox({ action, turn }: { action: FoxAction; turn: React.RefObject<number> }) {
  const body = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const ears = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime;
    const moving = action === "moving";
    const resting = action === "resting";
    const gait = moving ? Math.sin(t * 8.4) : 0;
    const breathe = Math.sin(t * 1.65) * 0.018;
    if (body.current) {
      const targetY = resting ? 0.28 : 0.76 + breathe;
      body.current.position.y += (targetY - body.current.position.y) * (1 - Math.exp(-5 * dt));
      body.current.rotation.x += ((resting ? 0.13 : moving ? gait * 0.018 : 0) - body.current.rotation.x) * (1 - Math.exp(-7 * dt));
      body.current.rotation.z += ((moving ? Math.sin(t * 8.4 + 1.2) * 0.025 : 0) - body.current.rotation.z) * (1 - Math.exp(-7 * dt));
    }
    if (spine.current) {
      spine.current.scale.y += ((resting ? 0.72 : 1 + breathe * 0.22) - spine.current.scale.y) * (1 - Math.exp(-5 * dt));
      spine.current.rotation.z += ((resting ? 0.1 : 0) - spine.current.rotation.z) * (1 - Math.exp(-5 * dt));
    }
    if (tail.current) {
      const steeringLag = THREE.MathUtils.clamp(turn.current * -0.24, -0.32, 0.32);
      const curl = resting ? -2.48 : -0.42 + Math.sin(t * (moving ? 3.8 : 1.8)) * (moving ? 0.14 : 0.07) + steeringLag;
      tail.current.rotation.y += (curl - tail.current.rotation.y) * (1 - Math.exp(-4 * dt));
      tail.current.rotation.x += ((resting ? 0.45 : 0.18 + (moving ? gait * 0.045 : 0)) - tail.current.rotation.x) * (1 - Math.exp(-5 * dt));
    }
    if (head.current) {
      const lift = action === "sniffing" ? -0.5 : resting ? 0.5 : moving ? gait * 0.025 : 0;
      head.current.rotation.x += (lift - head.current.rotation.x) * (1 - Math.exp(-4 * dt));
      head.current.position.y += ((resting ? 0.02 : 0.31) - head.current.position.y) * (1 - Math.exp(-5 * dt));
      head.current.position.z += ((resting ? -0.72 : -1.05) - head.current.position.z) * (1 - Math.exp(-5 * dt));
    }
    legs.current.forEach((leg, index) => {
      if (!leg) return;
      const phase = index === 0 || index === 3 ? 0 : Math.PI;
      const targetX = resting ? (index < 2 ? 0.95 : -0.95) : moving ? Math.sin(t * 8.4 + phase) * 0.48 : 0;
      leg.rotation.x += (targetX - leg.rotation.x) * (1 - Math.exp(-10 * dt));
      leg.rotation.z += ((resting ? (index % 2 ? -0.55 : 0.55) : 0) - leg.rotation.z) * (1 - Math.exp(-7 * dt));
    });
    ears.current.forEach((ear, index) => {
      if (!ear) return;
      const twitch = !moving && !resting && Math.sin(t * 0.72 + index * 2.8) > 0.965 ? Math.sin(t * 18) * 0.11 : 0;
      ear.rotation.z += ((index ? -0.12 : 0.12) + twitch - ear.rotation.z) * (1 - Math.exp(-12 * dt));
    });
  });
  const red = "#b9512d";
  const dark = "#252520";
  const cream = "#eee2c8";
  return (
    <group ref={body} position-y={0.74}>
      <group ref={spine}>
        <mesh castShadow scale={[0.5, 0.48, 1.22]}><sphereGeometry args={[0.72, 14, 9]} /><meshStandardMaterial color={red} roughness={0.9} flatShading /></mesh>
        <mesh position={[0, 0.04, 0.54]} castShadow scale={[0.54, 0.54, 0.7]}><sphereGeometry args={[0.68, 12, 8]} /><meshStandardMaterial color="#9e4127" roughness={0.92} flatShading /></mesh>
        <mesh position={[0, -0.29, -0.25]} scale={[0.35, 0.15, 0.78]}><sphereGeometry args={[0.72, 12, 7]} /><meshStandardMaterial color={cream} roughness={1} flatShading /></mesh>
        <mesh position={[0, 0.1, -0.76]} rotation-x={-0.16} scale={[0.42, 0.62, 0.48]}><sphereGeometry args={[0.68, 12, 8]} /><meshStandardMaterial color={cream} roughness={1} flatShading /></mesh>
      </group>
      <group ref={head} position={[0, 0.31, -1.05]}>
        <mesh castShadow rotation-x={-0.08} scale={[0.49, 0.54, 0.58]}><octahedronGeometry args={[0.72, 2]} /><meshStandardMaterial color={red} roughness={0.88} flatShading /></mesh>
        <mesh position={[0, -0.1, -0.62]} rotation-x={Math.PI / 2} scale={[1, 1, 1.2]}><coneGeometry args={[0.25, 0.72, 8]} /><meshStandardMaterial color="#d26b3e" roughness={0.9} flatShading /></mesh>
        <mesh position={[0, -0.11, -1.02]} scale={[0.11, 0.085, 0.1]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={dark} roughness={0.72} /></mesh>
        {[-1, 1].map((side, index) => <group ref={(node) => { ears.current[index] = node; }} key={side} position={[side * 0.31, 0.48, -0.02]} rotation-z={side * -0.12}><mesh castShadow><coneGeometry args={[0.19, 0.62, 7]} /><meshStandardMaterial color={dark} roughness={0.95} flatShading /></mesh><mesh position={[0, -0.055, -0.025]} scale={[0.62, 0.76, 0.64]}><coneGeometry args={[0.19, 0.58, 7]} /><meshStandardMaterial color="#c57970" roughness={1} flatShading /></mesh></group>)}
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.225, 0.105, -0.49]} rotation-z={side * 0.08} scale={[0.075, 0.038, 0.028]}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial color="#111714" roughness={0.42} /></mesh>)}
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.31, -0.13, -0.43]} rotation-z={side * 0.28} scale={[0.28, 0.23, 0.34]}><sphereGeometry args={[0.72, 10, 7]} /><meshStandardMaterial color={cream} roughness={1} flatShading /></mesh>)}
      </group>
      <group ref={tail} position={[0, 0.16, 0.82]} rotation={[0.18, -0.42, 0]}>
        <mesh position={[0, 0.02, 0.48]} rotation-x={Math.PI / 2} castShadow scale={[0.78, 1, 0.78]}><capsuleGeometry args={[0.28, 0.5, 5, 9]} /><meshStandardMaterial color="#a94529" roughness={0.94} flatShading /></mesh>
        <mesh position={[0, 0.01, 1.08]} rotation-x={Math.PI / 2} castShadow scale={[1.05, 1, 1.05]}><capsuleGeometry args={[0.31, 0.62, 5, 9]} /><meshStandardMaterial color={red} roughness={0.94} flatShading /></mesh>
        <mesh position={[0, 0, 1.7]} rotation-x={Math.PI / 2} castShadow scale={[0.78, 1, 0.78]}><capsuleGeometry args={[0.28, 0.48, 5, 9]} /><meshStandardMaterial color={cream} roughness={1} flatShading /></mesh>
      </group>
      {[-0.34, 0.34].flatMap((x) => [-0.53, 0.48].map((z) => {
        const index = (x > 0 ? 2 : 0) + (z > 0 ? 1 : 0);
        return <group ref={(node) => { legs.current[index] = node; }} key={`${x}-${z}`} position={[x, -0.22, z]}><mesh position-y={-0.22} castShadow><cylinderGeometry args={[0.075, 0.115, 0.48, 7]} /><meshStandardMaterial color={red} roughness={0.92} flatShading /></mesh><mesh position-y={-0.49} castShadow><cylinderGeometry args={[0.065, 0.082, 0.3, 7]} /><meshStandardMaterial color={dark} roughness={0.94} flatShading /></mesh><mesh position={[0, -0.65, -0.07]} scale={[0.11, 0.065, 0.19]}><sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color={dark} roughness={0.95} /></mesh></group>;
      }))}
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
  const velocity = useRef(new THREE.Vector3());
  const turnRate = useRef(0);
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
    const inputAmount = Math.hypot(forwardInput, sideInput);
    if (!resting && !sniffing && inputAmount > 0.08) {
      camera.getWorldDirection(FORWARD);
      FORWARD.y = 0;
      FORWARD.normalize();
      RIGHT.crossVectors(FORWARD, camera.up).normalize();
      MOVE.set(0, 0, 0).addScaledVector(FORWARD, forwardInput).addScaledVector(RIGHT, sideInput).normalize();
      MOVE.multiplyScalar(2.8);
      velocity.current.lerp(MOVE, 1 - Math.exp(-4.2 * dt));
    } else {
      velocity.current.multiplyScalar(Math.exp(-5.2 * dt));
    }
    const speed = velocity.current.length();
    const moving = speed > 0.08;
    if (moving) {
      const distance = speed * dt;
      object.position.addScaledVector(velocity.current, dt);
      const radius = Math.hypot(object.position.x, object.position.z);
      if (radius > 35) {
        object.position.x *= 35 / radius;
        object.position.z *= 35 / radius;
        velocity.current.multiplyScalar(0.4);
      }
      object.position.y = groundHeight(object.position.x, object.position.z);
      groundNormal(object.position.x, object.position.z, SURFACE_NORMAL);
      SURFACE_BACK.copy(velocity.current).normalize().multiplyScalar(-1).projectOnPlane(SURFACE_NORMAL).normalize();
      SURFACE_RIGHT.crossVectors(SURFACE_NORMAL, SURFACE_BACK).normalize();
      ROTATION_MATRIX.makeBasis(SURFACE_RIGHT, SURFACE_NORMAL, SURFACE_BACK);
      TARGET_ROTATION.setFromRotationMatrix(ROTATION_MATRIX);
      const oldYaw = object.rotation.y;
      object.quaternion.slerp(TARGET_ROTATION, 1 - Math.exp(-7 * dt));
      turnRate.current += ((object.rotation.y - oldYaw) / Math.max(dt, 0.001) - turnRate.current) * (1 - Math.exp(-5 * dt));
      trailDistance.current += distance;
      stepClock.current += dt;
      if (stepClock.current > 0.58) { forestAudio.footstep(); stepClock.current = 0; }
      if (trailDistance.current > 0.72) {
        trailDistance.current = 0;
        setTrails((previous) => [...previous.slice(-179), { id: Date.now() + previous.length, x: object.position.x, z: object.position.z, yaw: object.rotation.y }]);
      }
    } else turnRate.current *= Math.exp(-5 * dt);
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
    <group ref={player}><Fox action={action} turn={turnRate} /></group>
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