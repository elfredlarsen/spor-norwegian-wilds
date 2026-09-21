import { useEffect, useRef } from "react";
import { audio } from "./audio";
import {
  DEN_EXIT,
  DEN_HEIGHT,
  DEN_MOUTH,
  DEN_NEAR_RADIUS,
  DEN_WIDTH,
  KEEPSAKES,
  MATERIALS,
  clampInsideDen,
  invitationPath,
  nearestNiche,
} from "./den";
import { currentCycle, SEASON_PALETTE, type Season } from "./cycle";
import { drawBackdrop, drawDaylight, drawForeground } from "./layers";
import { drawDenInterior, drawDenMouth, drawInvitation } from "./DenScene";
import { worldEngine } from "./engine";
import { useUiStore, type Carried } from "./ui-store";
import type { DenKeepsake, Feature, ParticipantId, Placement, WeatherKind } from "./types";
import {
  FEATURES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  featureNote,
  nearestFeature,
  resolveCollisions,
  streamCenter,
  streamHalfWidth,
  waterDepth,
} from "./world";

const WALK_SPEED = 128;
const WATER_SPEED = 74;

type Bird = { x: number; y: number; homeX: number; homeY: number; vx: number; vy: number; airborne: boolean; kind: "tit" | "bullfinch" };
type Ripple = { x: number; y: number; born: number; strength: number };
type ScentWisp = { x: number; y: number; born: number; phase: number };
type Puddle = { x: number; y: number; size: number; wetness: number; lastSplash: number };

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

type Keys = Record<string, boolean>;

function paintGround(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH * 0.4, WORLD_HEIGHT);
  gradient.addColorStop(0, "#5c6f54");
  gradient.addColorStop(0.5, "#54684f");
  gradient.addColorStop(1, "#4a5d48");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // soft moss patches
  for (let index = 0; index < 900; index += 1) {
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    const radius = 24 + Math.random() * 90;
    const tone = Math.random();
    ctx.globalAlpha = 0.07 + Math.random() * 0.08;
    ctx.fillStyle = tone > 0.66 ? "#6f8560" : tone > 0.33 ? "#465a44" : "#7a8a63";
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // stream
  const bank = new Path2D();
  const water = new Path2D();
  for (let y = -20; y <= WORLD_HEIGHT + 20; y += 8) {
    const x = streamCenter(y) - streamHalfWidth(y);
    if (y === -20) bank.moveTo(x - 16, y);
    else bank.lineTo(x - 16, y);
  }
  for (let y = WORLD_HEIGHT + 20; y >= -20; y -= 8) {
    bank.lineTo(streamCenter(y) + streamHalfWidth(y) + 16, y);
  }
  bank.closePath();
  ctx.fillStyle = "#6e6a5c";
  ctx.fill(bank);

  for (let y = -20; y <= WORLD_HEIGHT + 20; y += 8) {
    const x = streamCenter(y) - streamHalfWidth(y);
    if (y === -20) water.moveTo(x, y);
    else water.lineTo(x, y);
  }
  for (let y = WORLD_HEIGHT + 20; y >= -20; y -= 8) {
    water.lineTo(streamCenter(y) + streamHalfWidth(y), y);
  }
  water.closePath();
  const waterGradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, 0);
  waterGradient.addColorStop(0, "#7d98a3");
  waterGradient.addColorStop(1, "#6a8592");
  ctx.fillStyle = waterGradient;
  ctx.fill(water);

  // gravel along the banks
  ctx.globalAlpha = 0.5;
  for (let index = 0; index < 1400; index += 1) {
    const y = Math.random() * WORLD_HEIGHT;
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = streamCenter(y) + side * (streamHalfWidth(y) + Math.random() * 26);
    ctx.fillStyle = Math.random() > 0.5 ? "#8c8878" : "#767263";
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6 + Math.random() * 3, 1.2 + Math.random() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // low vegetation baked into the floor
  for (const feature of FEATURES) {
    if (feature.kind === "heather") {
      ctx.globalAlpha = 0.85;
      for (let leaf = 0; leaf < 16; leaf += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 22 * feature.scale;
        ctx.fillStyle = leaf % 4 === 0 ? "#6d8a52" : "#3f5738";
        ctx.beginPath();
        ctx.ellipse(
          feature.x + Math.cos(angle) * distance,
          feature.y + Math.sin(angle) * distance * 0.7,
          3.4 * feature.scale,
          2.2 * feature.scale,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#8e3b3b";
      for (let berry = 0; berry < 3; berry += 1) {
        ctx.beginPath();
        ctx.arc(
          feature.x + (Math.random() - 0.5) * 26,
          feature.y + (Math.random() - 0.5) * 18,
          1.8,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (feature.kind === "reed") {
      ctx.strokeStyle = "#7d8b54";
      ctx.lineWidth = 1.6;
      for (let blade = 0; blade < 7; blade += 1) {
        const bx = feature.x + (Math.random() - 0.5) * 16;
        const by = feature.y + (Math.random() - 0.5) * 12;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + (Math.random() - 0.5) * 12, by - 18, bx + (Math.random() - 0.5) * 18, by - 30 * feature.scale);
        ctx.stroke();
      }
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, feature: Feature, time: number, season: Season) {
  const palette = SEASON_PALETTE[season];
  const sway = Math.sin(time * 0.0006 + feature.x * 0.01) * 3 * feature.scale;
  ctx.save();
  ctx.translate(feature.x, feature.y);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#1e2a1f";
  ctx.beginPath();
  ctx.ellipse(6, 4, 30 * feature.scale, 16 * feature.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (feature.kind === "pine") {
    ctx.fillStyle = "#6b4a34";
    ctx.beginPath();
    ctx.ellipse(0, 0, 7 * feature.scale, 5 * feature.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    const layers = [
      { r: 40, c: palette.pine[0], a: 0.95 },
      { r: 29, c: palette.pine[1], a: 1 },
      { r: 18, c: palette.pine[2], a: 1 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.c;
      ctx.globalAlpha = layer.a;
      ctx.beginPath();
      for (let spoke = 0; spoke < 11; spoke += 1) {
        const angle = (spoke / 11) * Math.PI * 2;
        const radius = layer.r * feature.scale * (0.78 + ((spoke * 37) % 10) / 34);
        const px = Math.cos(angle) * radius + sway;
        const py = Math.sin(angle) * radius * 0.86;
        if (spoke === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#d9d5c8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5 * feature.scale, 4 * feature.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (palette.leaf) {
      ctx.fillStyle = palette.leaf;
      ctx.globalAlpha = 0.92;
      for (let clump = 0; clump < 6; clump += 1) {
        const angle = (clump / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(angle) * 20 * feature.scale + sway,
          Math.sin(angle) * 16 * feature.scale,
          17 * feature.scale,
          13 * feature.scale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = palette.leafHighlight ?? palette.leaf;
      ctx.beginPath();
      ctx.ellipse(sway, -2, 19 * feature.scale, 15 * feature.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // winter: bare branches, with a little snow resting on them
      ctx.strokeStyle = "#8d8577";
      ctx.lineWidth = 2;
      for (let branch = 0; branch < 7; branch += 1) {
        const angle = -Math.PI / 2 + (branch - 3) * 0.36;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(angle) * 14 * feature.scale + sway,
          Math.sin(angle) * 12 * feature.scale,
          Math.cos(angle) * 26 * feature.scale + sway,
          Math.sin(angle) * 22 * feature.scale,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#e6ecef";
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(sway, -8 * feature.scale, 14 * feature.scale, 5 * feature.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, feature: Feature) {
  ctx.save();
  ctx.translate(feature.x, feature.y);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#1e2a1f";
  ctx.beginPath();
  ctx.ellipse(5, 6, 30 * feature.scale, 15 * feature.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#8b8d89";
  ctx.beginPath();
  ctx.ellipse(0, 0, 28 * feature.scale, 20 * feature.scale, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a3a59f";
  ctx.beginPath();
  ctx.ellipse(-5 * feature.scale, -5 * feature.scale, 17 * feature.scale, 11 * feature.scale, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6f8355";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(8 * feature.scale, 7 * feature.scale, 11 * feature.scale, 6 * feature.scale, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPlacement(ctx: CanvasRenderingContext2D, item: Placement, time: number) {
  ctx.save();
  ctx.translate(item.x, item.y);
  const age = Math.min(1, (time - item.at) / 1200);
  const grow = 0.6 + age * 0.4;
  ctx.scale(grow, grow);

  if (item.kind === "stone") {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#1e2a1f";
    ctx.beginPath();
    ctx.ellipse(2, 3, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const tones = ["#9a9a93", "#87867e", "#adaca2"];
    ctx.fillStyle = tones[item.variant % 3] ?? "#9a9a93";
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, item.variant, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c2c1b6";
    ctx.beginPath();
    ctx.ellipse(-3, -3, 6, 4, item.variant, 0, Math.PI * 2);
    ctx.fill();
  }

  if (item.kind === "flower") {
    const petalColors = ["#f2efe4", "#d9a4b4", "#c8b6df"];
    ctx.strokeStyle = "#5b7048";
    ctx.lineWidth = 1.4;
    for (let stem = 0; stem < 3; stem += 1) {
      const angle = (stem / 3) * Math.PI * 2 + item.variant;
      const px = Math.cos(angle) * 9;
      const py = Math.sin(angle) * 7;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(px * 0.4, py * 0.4 - 3, px, py);
      ctx.stroke();
      const wobble = Math.sin(time * 0.002 + stem) * 0.6;
      ctx.fillStyle = petalColors[item.variant % 3] ?? "#f2efe4";
      for (let petal = 0; petal < 5; petal += 1) {
        const pa = (petal / 5) * Math.PI * 2 + wobble;
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(pa) * 2.6, py + Math.sin(pa) * 2.6, 2.1, 1.6, pa, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e8d48c";
      ctx.beginPath();
      ctx.arc(px, py, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (item.kind === "lantern") {
    const flicker = 0.85 + Math.sin(time * 0.004 + item.variant) * 0.15;
    const glow = ctx.createRadialGradient(0, -12, 2, 0, -12, 90);
    glow.addColorStop(0, `rgba(255, 214, 148, ${0.5 * flicker})`);
    glow.addColorStop(1, "rgba(255, 214, 148, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -12, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a4239";
    ctx.fillRect(-7, -22, 14, 20);
    ctx.fillStyle = `rgba(255, 206, 133, ${flicker})`;
    ctx.fillRect(-4.5, -19, 9, 14);
    ctx.fillStyle = "#3a342d";
    ctx.fillRect(-9, -25, 18, 4);
    ctx.fillRect(-9, -3, 18, 4);
    ctx.strokeStyle = "#3a342d";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -26, 6, Math.PI, 0);
    ctx.stroke();
  }
  if (item.kind === "berry") {
    const pulse = 0.82 + Math.sin(time * 0.0025 + item.variant) * 0.18;
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 28);
    glow.addColorStop(0, `rgba(220, 116, 118, ${0.38 * pulse})`);
    glow.addColorStop(1, "rgba(220, 116, 118, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9434d";
    for (let berry = 0; berry < 4; berry += 1) {
      const a = berry * 1.7 + item.variant;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 5, Math.sin(a) * 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#82935e";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-1, -2);
    ctx.quadraticCurveTo(2, -9, 8, -10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBird(ctx: CanvasRenderingContext2D, bird: Bird, time: number) {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  const flap = bird.airborne ? Math.sin(time * 0.025) * 6 : 1;
  ctx.fillStyle = bird.kind === "bullfinch" ? "#bd665c" : "#d7d0ba";
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 3.7, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#282d29";
  ctx.beginPath();
  ctx.arc(4, -1, 2.7, 0, Math.PI * 2);
  ctx.fill();
  if (bird.airborne) {
    ctx.strokeStyle = bird.kind === "bullfinch" ? "#80534e" : "#7a786d";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.quadraticCurveTo(-7, -flap, -12, -1);
    ctx.moveTo(-1, 1);
    ctx.quadraticCurveTo(-7, flap, -12, 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  gait: number,
  moving: boolean,
  tint: string,
  sensing: "sniff" | "drink" | "dig" | "rest" | null,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#1e2a1f";
  ctx.beginPath();
  ctx.ellipse(3, 5, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(angle + (sensing === "rest" ? 0.22 : 0));

  const bob = sensing === "drink" ? 4 : sensing === "rest" ? 5 : sensing === "dig" ? Math.sin(gait * 3) * 1.8 : moving ? Math.sin(gait) * 1.2 : Math.sin(gait * 0.25) * 0.5;
  const sway = moving ? Math.sin(gait * 0.5) * 0.28 : Math.sin(gait * 0.2) * 0.1;

  // tail
  ctx.save();
  ctx.rotate(sway * 1.6);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.quadraticCurveTo(-20, 6, -30, 2);
  ctx.quadraticCurveTo(-20, -6, -6, 0);
  ctx.fill();
  ctx.fillStyle = "#f0e6d2";
  ctx.beginPath();
  ctx.ellipse(-29, 1.5, 5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // legs
  ctx.fillStyle = "#3b2b22";
  const step = moving ? Math.sin(gait) * 3 : 0;
  ctx.beginPath();
  ctx.ellipse(6, -7 + step * 0.4, 3.2, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(6, 7 - step * 0.4, 3.2, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(-6, -7 - step * 0.4, 3.2, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(-6, 7 + step * 0.4, 3.2, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(0, bob * 0.2, 17, 10.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0e6d2";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(1, bob * 0.2, 12, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // head
  ctx.save();
  ctx.translate(16, bob * 0.5);
  ctx.rotate(sensing === "sniff" ? -0.28 : sensing === "drink" ? 0.42 : sway * 0.5);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.fillStyle = "#a6492c";
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(-6, -11.5);
  ctx.lineTo(1, -8);
  ctx.closePath();
  ctx.moveTo(-3, 6);
  ctx.lineTo(-6, 11.5);
  ctx.lineTo(1, 8);
  ctx.closePath();
  ctx.fill();
  // snout
  ctx.fillStyle = "#f0e6d2";
  ctx.beginPath();
  ctx.ellipse(7, 0, 6, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#26211c";
  ctx.beginPath();
  ctx.arc(12.4, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, -4.2, 1.5, 1.2, 0, 0, Math.PI * 2);
  ctx.ellipse(3, 4.2, 1.5, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    worldEngine.load();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ground = document.createElement("canvas");
    ground.width = WORLD_WIDTH;
    ground.height = WORLD_HEIGHT;
    paintGround(ground);

    const keys: Keys = {};
    let walkTarget: { x: number; y: number } | null = null;
    let raf = 0;
    let last = performance.now();
    let gait = 0;
    let angle = 0;
    let velocityX = 0;
    let velocityY = 0;
    let sinceFootprint = 0;
    let noteId: string | null = null;
    let cameraX = 0;
    let cameraY = 0;
    let cameraReady = false;
    let actionUntil = 0;
    let actionKind: "sniff" | "drink" | "dig" | "rest" | null = null;
    let lastSenseNonce = 0;
    let lastDenNonce = 0;
    let denFox = { x: DEN_EXIT.x, y: DEN_EXIT.y - 60 };
    let denAngle = -Math.PI / 2;
    let denWalkTarget: { x: number; y: number } | null = null;
    let denView = { scale: 1, offsetX: 0, offsetY: 0 };
    let denSinceFootstep = 0;
    let denActionUntil = 0;
    let denActionKind: "sniff" | "drink" | "dig" | "rest" | null = null;
    let lastWeather: WeatherKind = worldEngine.state.weather.kind;
    let lastRainAt = lastWeather === "rain" ? performance.now() : -Infinity;
    const random = seeded(7139);
    const birches = FEATURES.filter((feature) => feature.kind === "birch");
    const birds: Bird[] = birches.slice(0, 13).map((tree, index) => ({
      x: tree.x + (random() - 0.5) * 24,
      y: tree.y - 18 - random() * 18,
      homeX: tree.x + (random() - 0.5) * 24,
      homeY: tree.y - 18 - random() * 18,
      vx: 0,
      vy: 0,
      airborne: false,
      kind: index % 4 === 0 ? "bullfinch" : "tit",
    }));
    for (const bird of birds) {
      bird.homeX = bird.x;
      bird.homeY = bird.y;
    }
    const puddles: Puddle[] = Array.from({ length: 16 }, (_, index) => {
      const y = 100 + random() * (WORLD_HEIGHT - 200);
      const side = index % 2 ? 1 : -1;
      return { x: streamCenter(y) + side * (streamHalfWidth(y) + 54 + random() * 160), y, size: 18 + random() * 20, wetness: 0, lastSplash: 0 };
    });
    const ripples: Ripple[] = [];
    const scents: ScentWisp[] = [];
    const moths = Array.from({ length: 32 }, () => ({ x: random() * WORLD_WIDTH, y: random() * WORLD_HEIGHT, phase: random() * Math.PI * 2 }));
    const leaves = Array.from({ length: 34 }, () => { const y = random() * WORLD_HEIGHT; return { x: streamCenter(y) + (random() - 0.5) * streamHalfWidth(y), y, phase: random() * Math.PI * 2 }; });

    const rainDrops = Array.from({ length: 220 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.6 + Math.random() * 0.7,
      length: 8 + Math.random() * 14,
    }));
    const mistBlobs = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 120 + Math.random() * 260,
      drift: 0.004 + Math.random() * 0.01,
    }));

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onKeyDown = (event: KeyboardEvent) => {
      keys[event.key.toLowerCase()] = true;
      walkTarget = null;
      audio.init();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        useUiStore.getState().markHintSeen();
      }
      if (!event.repeat && event.key.toLowerCase() === "e") useUiStore.getState().requestSense("sniff");
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    const onPointerDown = (event: PointerEvent) => {
      audio.init();
      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      if (useUiStore.getState().denInside) {
        denWalkTarget = {
          x: (pointerX - denView.offsetX) / denView.scale,
          y: (pointerY - denView.offsetY) / denView.scale,
        };
      } else {
        walkTarget = { x: cameraX + pointerX, y: cameraY + pointerY };
      }
      useUiStore.getState().markHintSeen();
    };
    canvas.addEventListener("pointerdown", onPointerDown);

    const readInput = () => {
      let inputX = 0;
      let inputY = 0;
      if (keys["arrowleft"] || keys["a"]) inputX -= 1;
      if (keys["arrowright"] || keys["d"]) inputX += 1;
      if (keys["arrowup"] || keys["w"]) inputY -= 1;
      if (keys["arrowdown"] || keys["s"]) inputY += 1;
      inputX += padRef.current.x;
      inputY += padRef.current.y;
      return { inputX, inputY };
    };

    /** Inside the den: a small, quiet, sheltered room of its own. */
    const denFrame = (now: number, delta: number) => {
      const ui = useUiStore.getState();
      const participant: ParticipantId = ui.participant;
      const den = worldEngine.state.den;
      const warmth = Math.min(1, den.bedding.length / 6);
      audio.setShelter(1, warmth);

      let { inputX, inputY } = readInput();
      if (!inputX && !inputY && denWalkTarget) {
        const dx = denWalkTarget.x - denFox.x;
        const dy = denWalkTarget.y - denFox.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 10) denWalkTarget = null;
        else {
          inputX = dx / distance;
          inputY = dy / distance;
        }
      }
      const magnitude = Math.hypot(inputX, inputY);
      if (magnitude > 1) {
        inputX /= magnitude;
        inputY /= magnitude;
      }

      // requests from the quiet icon bar
      if (ui.denRequest && ui.denRequest.nonce !== lastDenNonce) {
        lastDenNonce = ui.denRequest.nonce;
        const request = ui.denRequest.kind;
        audio.init();
        if (request === "exit") {
          ui.setDenInside(false);
          ui.setNearNiche(false);
          audio.setShelter(0, warmth);
          denWalkTarget = null;
        } else if (request === "deposit" && ui.carried) {
          const carried = ui.carried;
          if (carried.category === "bedding") {
            worldEngine.addBedding(carried.kind, participant);
            audio.bedding();
            ui.setDiscovery(null);
          } else {
            const niche = nearestNiche(denFox.x, denFox.y, 120);
            const free = niche && !worldEngine.keepsakeAt(niche.id) ? niche : null;
            if (free) {
              worldEngine.placeKeepsake(free.id, carried.kind, participant);
              audio.keepsake();
            }
          }
          if (carried.category === "bedding" || nearestNiche(denFox.x, denFox.y, 120)) ui.setCarried(null);
        } else if (request === "invite") {
          const guest: ParticipantId = participant === "elder" ? "child" : "elder";
          const guestPosition = worldEngine.state.positions[guest];
          worldEngine.setInvitation(invitationPath(guestPosition.x, guestPosition.y), participant);
          audio.sniff();
          audio.discoveryResonance();
        }
        ui.clearDenRequest();
      }

      if (ui.senseRequest && ui.senseRequest.nonce !== lastSenseNonce) {
        lastSenseNonce = ui.senseRequest.nonce;
        denActionKind = ui.senseRequest.kind;
        denActionUntil = now + (denActionKind === "rest" ? 6000 : 2600);
        denWalkTarget = null;
        audio.init();
        if (denActionKind === "rest") {
          worldEngine.restInDen();
          audio.rest();
        } else if (denActionKind === "sniff") audio.sniff();
        else if (denActionKind === "dig") audio.dig();
        else audio.sip();
        ui.clearSenseRequest();
      }

      const resting = now < denActionUntil;
      const speed = resting ? 0 : 92;
      const moving = !resting && (Math.abs(inputX) > 0.01 || Math.abs(inputY) > 0.01);
      if (moving) {
        const next = clampInsideDen(denFox.x + inputX * speed * delta, denFox.y + inputY * speed * delta);
        denFox = next;
        const heading = Math.atan2(inputY, inputX);
        let difference = heading - denAngle;
        while (difference > Math.PI) difference -= Math.PI * 2;
        while (difference < -Math.PI) difference += Math.PI * 2;
        denAngle += difference * (1 - Math.exp(-9 * delta));
        gait += delta * 8;
        denSinceFootstep += speed * delta;
        if (denSinceFootstep > 34) {
          denSinceFootstep = 0;
          audio.footstep("moss", 0.35);
        }
      } else {
        gait += delta * 1.2;
      }

      const niche = nearestNiche(denFox.x, denFox.y, 110);
      const nicheFree = Boolean(niche && !worldEngine.keepsakeAt(niche.id));
      if (ui.nearNiche !== nicheFree) ui.setNearNiche(nicheFree);
      const atMouth = Math.hypot(denFox.x - DEN_EXIT.x, denFox.y - DEN_EXIT.y) < 90;
      if (ui.nearDen !== atMouth) ui.setNearDen(atMouth);

      // ---- draw ----
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      ctx.fillStyle = "#13100c";
      ctx.fillRect(0, 0, viewWidth, viewHeight);
      const scale = Math.min(viewWidth / DEN_WIDTH, viewHeight / DEN_HEIGHT) * 0.96;
      denView = {
        scale,
        offsetX: (viewWidth - DEN_WIDTH * scale) / 2,
        offsetY: (viewHeight - DEN_HEIGHT * scale) / 2,
      };
      ctx.save();
      ctx.translate(denView.offsetX, denView.offsetY);
      ctx.scale(scale, scale);
      drawDenInterior(ctx, den, now, warmth);
      drawFox(
        ctx,
        denFox.x,
        denFox.y,
        denAngle,
        gait,
        moving,
        participant === "child" ? "#c9743a" : "#b75c32",
        resting ? denActionKind : null,
      );
      ctx.restore();

      // softened edges: the room feels sheltered
      const edges = ctx.createRadialGradient(
        viewWidth / 2,
        viewHeight / 2,
        Math.min(viewWidth, viewHeight) * 0.22,
        viewWidth / 2,
        viewHeight / 2,
        Math.max(viewWidth, viewHeight) * 0.68,
      );
      edges.addColorStop(0, "rgba(18, 14, 10, 0)");
      edges.addColorStop(1, "rgba(14, 11, 8, 0.92)");
      ctx.fillStyle = edges;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    };


    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      const ui = useUiStore.getState();
      if (ui.denInside) {
        denFrame(now, delta);
        return;
      }
      audio.setShelter(0);
      const participant: ParticipantId = ui.participant;
      const position = worldEngine.position(participant);

      let inputX = 0;
      let inputY = 0;
      if (keys["arrowleft"] || keys["a"]) inputX -= 1;
      if (keys["arrowright"] || keys["d"]) inputX += 1;
      if (keys["arrowup"] || keys["w"]) inputY -= 1;
      if (keys["arrowdown"] || keys["s"]) inputY += 1;
      const pad = padRef.current;
      inputX += pad.x;
      inputY += pad.y;

      if (!inputX && !inputY && walkTarget) {
        const dx = walkTarget.x - position.x;
        const dy = walkTarget.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 12) walkTarget = null;
        else {
          inputX = dx / distance;
          inputY = dy / distance;
        }
      }

      const magnitude = Math.hypot(inputX, inputY);
      if (magnitude > 1) {
        inputX /= magnitude;
        inputY /= magnitude;
      }

      const depth = waterDepth(position.x, position.y);
      const nearWaterBank = Math.abs(position.x - streamCenter(position.y)) < streamHalfWidth(position.y) + 54;
      if (ui.nearWater !== nearWaterBank) ui.setNearWater(nearWaterBank);

      // the den mouth, and what the forest offers to carry inside
      const atDenMouth = Math.hypot(position.x - DEN_MOUTH.x, position.y - DEN_MOUTH.y) < DEN_NEAR_RADIUS;
      if (ui.nearDen !== atDenMouth) ui.setNearDen(atDenMouth);

      let gatherable: Carried | null = null;
      if (!ui.carried) {
        let bestDistance = 74;
        for (const feature of FEATURES) {
          const distance = Math.hypot(feature.x - position.x, feature.y - position.y);
          if (distance > bestDistance) continue;
          const material =
            feature.kind === "pine" ? "needles" : feature.kind === "birch" ? "bark" : feature.kind === "heather" ? "moss" : null;
          if (!material) continue;
          const entry = MATERIALS[material];
          bestDistance = distance;
          gatherable = { category: "bedding", kind: material, label: entry.label, norwegian: entry.norwegian };
        }
        for (const placement of worldEngine.state.placements) {
          if (placement.kind !== "berry" && placement.kind !== "stone") continue;
          const distance = Math.hypot(placement.x - position.x, placement.y - position.y);
          if (distance > bestDistance) continue;
          const item: DenKeepsake = placement.kind === "berry" ? "lingonberry" : "pebble";
          const entry = KEEPSAKES[item];
          bestDistance = distance;
          gatherable = { category: "keepsake", kind: item, label: entry.label, norwegian: entry.norwegian };
        }
      }
      if (ui.gatherable?.kind !== gatherable?.kind || ui.gatherable?.category !== gatherable?.category) {
        ui.setGatherable(gatherable);
      }

      if (ui.denRequest && ui.denRequest.nonce !== lastDenNonce) {
        lastDenNonce = ui.denRequest.nonce;
        const request = ui.denRequest.kind;
        audio.init();
        if (request === "enter" && atDenMouth) {
          worldEngine.discoverDen();
          denFox = { x: DEN_EXIT.x, y: DEN_EXIT.y - 70 };
          denWalkTarget = null;
          ui.setDenInside(true);
          ui.setDiscovery(null);
          audio.bedding();
        } else if (request === "gather" && gatherable) {
          ui.setCarried(gatherable);
          ui.setGatherable(null);
          audio.dig();
        } else if (request === "deposit" && ui.carried) {
          ui.setCarried(null);
        }
        ui.clearDenRequest();
      }


      if (ui.senseRequest && ui.senseRequest.nonce !== lastSenseNonce) {
        lastSenseNonce = ui.senseRequest.nonce;
        actionKind = ui.senseRequest.kind;
        actionUntil = now + (actionKind === "sniff" ? 4200 : actionKind === "rest" ? 6000 : 2400);
        walkTarget = null;
        audio.init();
        if (actionKind === "sniff") {
          const targets = worldEngine.state.placements.filter((item) => item.kind === "berry" || item.kind === "lantern");
          const target = targets.sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y) - Math.hypot(b.x - position.x, b.y - position.y))[0];
          const tx = target?.x ?? streamCenter(position.y + 220);
          const ty = target?.y ?? position.y + 220;
          for (let index = 1; index <= 12; index += 1) scents.push({ x: position.x + (tx - position.x) * index / 13, y: position.y + (ty - position.y) * index / 13, born: now, phase: random() * 6 });
          ui.setDiscovery(target ? "A quiet scent lingers between the trees." : "Cool water and bilberry drift on the air.");
          audio.sniff();
        } else if (actionKind === "drink") {
          if (nearWaterBank) {
            ripples.push({ x: streamCenter(position.y), y: position.y, born: now, strength: 1.3 });
            ui.setDiscovery("The fox drinks. Rings travel softly across the stream.");
            audio.sip();
          } else {
            ui.setDiscovery("The fox listens for running water.");
          }
        } else if (actionKind === "dig") {
          const found = random();
          const foundKind = found > 0.66 ? "a smooth quartz pebble" : found > 0.32 ? "a small pinecone" : "a cluster of glowing berries";
          ui.setDiscovery(`Beneath the moss: ${foundKind}.`);
          audio.dig();
          if (found <= 0.32) worldEngine.place("berry", position.x + 20, position.y + 10, participant);
          if (found > 0.66) worldEngine.place("stone", position.x + 18, position.y + 12, participant);
        } else {
          ui.setDiscovery("The fox curls into the moss and breathes with the quiet forest.");
          audio.rest();
        }
        ui.clearSenseRequest();
      }
      const speed = WALK_SPEED - depth * (WALK_SPEED - WATER_SPEED);
      const stillSensing = now < actionUntil;
      const targetVelocityX = stillSensing ? 0 : inputX * speed;
      const targetVelocityY = stillSensing ? 0 : inputY * speed;
      const smoothing = 1 - Math.exp(-6 * delta);
      velocityX += (targetVelocityX - velocityX) * smoothing;
      velocityY += (targetVelocityY - velocityY) * smoothing;

      const moving = Math.hypot(velocityX, velocityY) > 6;
      if (moving) {
        const resolved = resolveCollisions(
          position.x + velocityX * delta,
          position.y + velocityY * delta,
        );
        worldEngine.setPosition(participant, resolved.x, resolved.y);
        const heading = Math.atan2(velocityY, velocityX);
        let difference = heading - angle;
        while (difference > Math.PI) difference -= Math.PI * 2;
        while (difference < -Math.PI) difference += Math.PI * 2;
        angle += difference * (1 - Math.exp(-9 * delta));
        gait += delta * 9;
        sinceFootprint += Math.hypot(velocityX, velocityY) * delta;
        if (sinceFootprint > 30) {
          sinceFootprint = 0;
          worldEngine.addFootprint({
            x: resolved.x,
            y: resolved.y,
            angle,
            by: participant,
            at: Date.now(),
          });
          const gravel = nearestFeature(resolved.x, resolved.y, 52)?.kind === "rock";
          const recentlyWet = lastWeather === "rain" || now - lastRainAt < 22000;
          const pace = Math.hypot(velocityX, velocityY) / WALK_SPEED;
          audio.footstep(depth > 0.15 ? "water" : recentlyWet ? "wet" : gravel ? "gravel" : "moss", pace);
        }
      } else {
        gait += delta * 1.4;
      }

      const current = worldEngine.position(participant);
      audio.setWaterNearness(
        Math.max(0, 1 - Math.abs(current.x - streamCenter(current.y)) / 520),
      );

      // quiet nature notes
      const near = nearestFeature(current.x, current.y, 78);
      const nearWater = Math.abs(current.x - streamCenter(current.y)) < streamHalfWidth(current.y) + 46;
      const activeId = nearWater ? "water" : near ? near.id : null;
      if (activeId !== noteId) {
        noteId = activeId;
        if (!activeId) ui.setNote(null);
        else if (nearWater) ui.setNote(featureNote("reed"));
        else if (near) ui.setNote(featureNote(near.kind));
      }

      // camera
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      const desiredX = Math.min(
        Math.max(current.x - viewWidth / 2, 0),
        Math.max(0, WORLD_WIDTH - viewWidth),
      );
      const desiredY = Math.min(
        Math.max(current.y - viewHeight / 2, 0),
        Math.max(0, WORLD_HEIGHT - viewHeight),
      );
      if (!cameraReady) {
        cameraX = desiredX;
        cameraY = desiredY;
        cameraReady = true;
      } else {
        const follow = 1 - Math.exp(-4 * delta);
        cameraX += (desiredX - cameraX) * follow;
        cameraY += (desiredY - cameraY) * follow;
      }

      // ---- draw ----
      const cycle = currentCycle();
      const seasonPalette = SEASON_PALETTE[cycle.season];
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      // layer one: the painted backdrop
      drawBackdrop(ctx, cameraX, cameraY, viewWidth, viewHeight, cycle);
      ctx.save();
      ctx.translate(-Math.round(cameraX), -Math.round(cameraY));
      ctx.drawImage(ground, 0, 0);
      // the floor takes on the colour of the season
      ctx.save();
      ctx.globalAlpha = seasonPalette.groundAlpha;
      ctx.fillStyle = seasonPalette.ground;
      ctx.fillRect(cameraX - 20, cameraY - 20, viewWidth + 40, viewHeight + 40);
      ctx.restore();

      const state = worldEngine.state;
      const now2 = Date.now();
      const weather = state.weather.kind;
      if (weather === "rain") lastRainAt = now;
      if (weather !== lastWeather) lastWeather = weather;

      for (const puddle of puddles) {
        puddle.wetness += ((weather === "rain" ? 1 : 0) - puddle.wetness) * (1 - Math.exp(-0.35 * delta));
        if (puddle.wetness < 0.03) continue;
        ctx.save();
        ctx.globalAlpha = puddle.wetness * 0.5;
        ctx.fillStyle = "#718994";
        ctx.beginPath();
        ctx.ellipse(puddle.x, puddle.y, puddle.size, puddle.size * 0.38, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (moving && Math.hypot(current.x - puddle.x, current.y - puddle.y) < puddle.size && now - puddle.lastSplash > 900) {
          puddle.lastSplash = now;
          ripples.push({ x: puddle.x, y: puddle.y, born: now, strength: 0.75 });
          audio.splash();
        }
      }

      for (const leaf of leaves) {
        leaf.y += delta * 8;
        if (leaf.y > WORLD_HEIGHT) leaf.y = 0;
        leaf.x = streamCenter(leaf.y) + Math.sin(now * 0.0005 + leaf.phase) * streamHalfWidth(leaf.y) * 0.55;
        if (leaf.x < cameraX - 20 || leaf.x > cameraX + viewWidth + 20 || leaf.y < cameraY - 20 || leaf.y > cameraY + viewHeight + 20) continue;
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(Math.sin(now * 0.001 + leaf.phase));
        ctx.fillStyle = "#b88755";
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (weather === "rain" && random() < delta * 1.5) {
        const y = cameraY + random() * viewHeight;
        ripples.push({ x: streamCenter(y) + (random() - 0.5) * streamHalfWidth(y), y, born: now, strength: random() < 0.08 ? 1.25 : 0.7 });
      }
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        if (!ripple) continue;
        const age = (now - ripple.born) / 1000;
        if (age > 2.2) { ripples.splice(index, 1); continue; }
        ctx.strokeStyle = `rgba(215, 232, 230, ${Math.max(0, 0.55 - age * 0.25)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, age * 28 * ripple.strength, age * 10 * ripple.strength, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (ripple.strength > 1 && age < 0.35) {
          ctx.fillStyle = "#71828a";
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y - Math.sin(age / 0.35 * Math.PI) * 18, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // trails
      for (const print of state.trail) {
        if (print.x < cameraX - 40 || print.x > cameraX + viewWidth + 40) continue;
        if (print.y < cameraY - 40 || print.y > cameraY + viewHeight + 40) continue;
        const age = (now2 - print.at) / 1000;
        const alpha = Math.max(0.05, 0.3 - age * 0.0009);
        ctx.save();
        ctx.translate(print.x, print.y);
        ctx.rotate(print.angle);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = print.by === "child" ? "#3c4f38" : "#38452f";
        ctx.beginPath();
        ctx.ellipse(0, -5, 3, 2.2, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 5, 3, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (state.den.invitation) drawInvitation(ctx, state.den.invitation.path, now);

      const drawables: Array<{ y: number; draw: () => void }> = [];
      drawables.push({ y: DEN_MOUTH.y, draw: () => drawDenMouth(ctx, now, state.den.discovered) });
      for (const feature of FEATURES) {
        if (feature.kind === "heather" || feature.kind === "reed") continue;
        if (feature.x < cameraX - 90 || feature.x > cameraX + viewWidth + 90) continue;
        if (feature.y < cameraY - 120 || feature.y > cameraY + viewHeight + 120) continue;
        drawables.push({
          y: feature.y,
          draw: () =>
            feature.kind === "rock" ? drawRock(ctx, feature) : drawTree(ctx, feature, now, cycle.season),
        });
      }
      for (const item of state.placements) {
        if (item.x < cameraX - 120 || item.x > cameraX + viewWidth + 120) continue;
        if (item.y < cameraY - 120 || item.y > cameraY + viewHeight + 120) continue;
        drawables.push({ y: item.y, draw: () => drawPlacement(ctx, item, now2) });
      }
      const stones = state.placements.filter((item) => item.kind === "stone");
      for (const stone of stones) {
        const nearby = stones.filter((item) => Math.hypot(item.x - stone.x, item.y - stone.y) < 62);
        if (nearby.length < 3 || nearby[0]?.id !== stone.id) continue;
        const pulse = 0.5 + Math.sin(now * 0.0012) * 0.18;
        drawables.push({
          y: stone.y - 1,
          draw: () => {
            const aurora = ctx.createRadialGradient(stone.x, stone.y, 8, stone.x, stone.y, 150);
            aurora.addColorStop(0, `rgba(160, 222, 180, ${pulse})`);
            aurora.addColorStop(0.45, `rgba(124, 190, 169, ${pulse * 0.32})`);
            aurora.addColorStop(1, "rgba(124, 190, 169, 0)");
            ctx.fillStyle = aurora;
            ctx.beginPath();
            ctx.arc(stone.x, stone.y, 150, 0, Math.PI * 2);
            ctx.fill();
          },
        });
      }

      for (const bird of birds) {
        const distance = Math.hypot(current.x - bird.x, current.y - bird.y);
        if (!bird.airborne && distance < 112 * seasonPalette.birdActivity + 30 && moving) {
          bird.airborne = true;
          bird.vx = (bird.x - current.x) * 0.55;
          bird.vy = -70 - random() * 40;
          audio.flutter();
        }
        if (bird.airborne) {
          bird.x += bird.vx * delta;
          bird.y += bird.vy * delta;
          bird.vx += (bird.homeX - bird.x) * delta * 0.32;
          bird.vy += (bird.homeY - bird.y) * delta * 0.32;
          if (Math.hypot(bird.homeX - bird.x, bird.homeY - bird.y) < 9 && distance > 150) {
            bird.airborne = false;
            bird.x = bird.homeX;
            bird.y = bird.homeY;
          }
        }
        drawables.push({ y: bird.y, draw: () => drawBird(ctx, bird, now) });
      }
      const foxTint = participant === "child" ? "#c9743a" : "#b75c32";
      drawables.push({
        y: current.y,
        draw: () => drawFox(ctx, current.x, current.y, angle, gait, moving, foxTint, now < actionUntil ? actionKind : null),
      });
      // the other participant rests quietly where they last wandered
      const other: ParticipantId = participant === "elder" ? "child" : "elder";
      const otherPosition = state.positions[other];
      drawables.push({
        y: otherPosition.y,
        draw: () => {
          ctx.globalAlpha = 0.45;
          drawFox(ctx, otherPosition.x, otherPosition.y, -0.4, 0, false, other === "child" ? "#c9743a" : "#b75c32", null);
          ctx.globalAlpha = 1;
        },
      });

      drawables.sort((a, b) => a.y - b.y);
      for (const drawable of drawables) drawable.draw();

      for (let index = scents.length - 1; index >= 0; index -= 1) {
        const scent = scents[index];
        if (!scent) continue;
        const age = (now - scent.born) / 1000;
        if (age > 4.2) { scents.splice(index, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.sin(Math.min(1, age) * Math.PI) * Math.max(0, 1 - age / 4.2) * 0.45;
        ctx.fillStyle = "#dbe3c4";
        ctx.beginPath();
        ctx.arc(scent.x + Math.sin(now * 0.002 + scent.phase) * 10, scent.y - age * 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (weather === "mist") {
        for (const moth of moths) {
          const mx = moth.x + Math.sin(now * 0.0007 + moth.phase) * 26;
          const my = moth.y + Math.cos(now * 0.0009 + moth.phase) * 18;
          if (mx < cameraX || mx > cameraX + viewWidth || my < cameraY || my > cameraY + viewHeight) continue;
          const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 13);
          glow.addColorStop(0, "rgba(238, 220, 145, 0.65)");
          glow.addColorStop(1, "rgba(238, 220, 145, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(mx, my, 13, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // ---- weather ----
      if (weather === "rain") {
        ctx.save();
        ctx.strokeStyle = "rgba(210, 226, 232, 0.4)";
        ctx.lineWidth = 1;
        for (const drop of rainDrops) {
          drop.y += drop.speed * delta * 1.1;
          drop.x += delta * 0.02;
          if (drop.y > 1) {
            drop.y -= 1;
            drop.x = Math.random();
          }
          const px = drop.x * viewWidth;
          const py = drop.y * viewHeight;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - 3, py + drop.length);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(96, 116, 124, 0.16)";
        ctx.fillRect(0, 0, viewWidth, viewHeight);
        ctx.restore();
      }
      if (weather === "mist") {
        ctx.save();
        for (const blob of mistBlobs) {
          blob.x += blob.drift * delta;
          if (blob.x > 1.2) blob.x = -0.2;
          const px = blob.x * viewWidth;
          const py = blob.y * viewHeight;
          const gradient = ctx.createRadialGradient(px, py, 10, px, py, blob.radius);
          gradient.addColorStop(0, "rgba(226, 231, 230, 0.26)");
          gradient.addColorStop(1, "rgba(226, 231, 230, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(px, py, blob.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(222, 228, 226, 0.18)";
        ctx.fillRect(0, 0, viewWidth, viewHeight);
        ctx.restore();
      }
      if (weather === "sun") {
        const warm = ctx.createRadialGradient(
          viewWidth * 0.72,
          viewHeight * 0.18,
          40,
          viewWidth * 0.72,
          viewHeight * 0.18,
          Math.max(viewWidth, viewHeight) * 0.9,
        );
        warm.addColorStop(0, "rgba(255, 224, 168, 0.35)");
        warm.addColorStop(1, "rgba(255, 214, 148, 0.04)");
        ctx.fillStyle = warm;
        ctx.fillRect(0, 0, viewWidth, viewHeight);
      }

      // gentle vignette keeps the edges calm
      const vignette = ctx.createRadialGradient(
        viewWidth / 2,
        viewHeight / 2,
        Math.min(viewWidth, viewHeight) * 0.35,
        viewWidth / 2,
        viewHeight / 2,
        Math.max(viewWidth, viewHeight) * 0.78,
      );
      vignette.addColorStop(0, "rgba(20, 28, 22, 0)");
      vignette.addColorStop(1, "rgba(20, 28, 22, 0.34)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      worldEngine.save();
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full touch-none" />;
}

/** Shared virtual pad value, written by the HUD and read by the loop. */
export const padRef = { current: { x: 0, y: 0 } };
