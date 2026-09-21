import { useEffect, useRef } from "react";
import { audio } from "./audio";
import { worldEngine } from "./engine";
import { useUiStore } from "./ui-store";
import type { Feature, ParticipantId, Placement } from "./types";
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

function drawTree(ctx: CanvasRenderingContext2D, feature: Feature, time: number) {
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
      { r: 40, c: "#2f4732", a: 0.95 },
      { r: 29, c: "#3a5639", a: 1 },
      { r: 18, c: "#47653f", a: 1 },
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
    ctx.fillStyle = "#7c9455";
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
    ctx.fillStyle = "#93aa66";
    ctx.beginPath();
    ctx.ellipse(sway, -2, 19 * feature.scale, 15 * feature.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
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
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#1e2a1f";
  ctx.beginPath();
  ctx.ellipse(3, 5, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(angle);

  const bob = moving ? Math.sin(gait) * 1.2 : Math.sin(gait * 0.25) * 0.5;
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
  ctx.rotate(sway * 0.5);
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
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    const onPointerDown = (event: PointerEvent) => {
      audio.init();
      const rect = canvas.getBoundingClientRect();
      walkTarget = {
        x: cameraX + (event.clientX - rect.left),
        y: cameraY + (event.clientY - rect.top),
      };
      useUiStore.getState().markHintSeen();
    };
    canvas.addEventListener("pointerdown", onPointerDown);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      const ui = useUiStore.getState();
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
      const speed = WALK_SPEED - depth * (WALK_SPEED - WATER_SPEED);
      const targetVelocityX = inputX * speed;
      const targetVelocityY = inputY * speed;
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
          audio.footstep(depth > 0.15);
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
      ctx.clearRect(0, 0, viewWidth, viewHeight);
      ctx.save();
      ctx.translate(-Math.round(cameraX), -Math.round(cameraY));
      ctx.drawImage(ground, 0, 0);

      const state = worldEngine.state;
      const now2 = Date.now();

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

      const drawables: Array<{ y: number; draw: () => void }> = [];
      for (const feature of FEATURES) {
        if (feature.kind === "heather" || feature.kind === "reed") continue;
        if (feature.x < cameraX - 90 || feature.x > cameraX + viewWidth + 90) continue;
        if (feature.y < cameraY - 120 || feature.y > cameraY + viewHeight + 120) continue;
        drawables.push({
          y: feature.y,
          draw: () =>
            feature.kind === "rock" ? drawRock(ctx, feature) : drawTree(ctx, feature, now),
        });
      }
      for (const item of state.placements) {
        if (item.x < cameraX - 120 || item.x > cameraX + viewWidth + 120) continue;
        if (item.y < cameraY - 120 || item.y > cameraY + viewHeight + 120) continue;
        drawables.push({ y: item.y, draw: () => drawPlacement(ctx, item, now2) });
      }
      const foxTint = participant === "child" ? "#c9743a" : "#b75c32";
      drawables.push({
        y: current.y,
        draw: () => drawFox(ctx, current.x, current.y, angle, gait, moving, foxTint),
      });
      // the other participant rests quietly where they last wandered
      const other: ParticipantId = participant === "elder" ? "child" : "elder";
      const otherPosition = state.positions[other];
      drawables.push({
        y: otherPosition.y,
        draw: () => {
          ctx.globalAlpha = 0.45;
          drawFox(ctx, otherPosition.x, otherPosition.y, -0.4, 0, false, other === "child" ? "#c9743a" : "#b75c32");
          ctx.globalAlpha = 1;
        },
      });

      drawables.sort((a, b) => a.y - b.y);
      for (const drawable of drawables) drawable.draw();

      ctx.restore();

      // ---- weather ----
      const weather = state.weather.kind;
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
