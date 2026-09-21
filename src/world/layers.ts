import type { Cycle } from "./cycle";
import { SEASON_PALETTE } from "./cycle";

/**
 * The picture-book has three layers: a distant painted backdrop, the forest
 * floor the fox walks on, and a few near branches and ferns framing the view.
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number,
  cycle: Cycle,
) {
  const palette = SEASON_PALETTE[cycle.season];
  const sky = ctx.createLinearGradient(0, 0, 0, viewHeight);
  if (cycle.daylight > 0.75) {
    sky.addColorStop(0, "#c8d6cf");
    sky.addColorStop(1, "#9db08f");
  } else if (cycle.daylight > 0.25) {
    sky.addColorStop(0, "#e3bd93");
    sky.addColorStop(1, "#8e9a80");
  } else {
    sky.addColorStop(0, "#1d2a3c");
    sky.addColorStop(1, "#29352f");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  // far ridge, drifting slowly behind the wood
  const shiftX = -cameraX * 0.18;
  const shiftY = -cameraY * 0.08;
  const horizon = viewHeight * 0.42 + shiftY * 0.4;
  ctx.save();
  ctx.globalAlpha = cycle.daylight > 0.25 ? 0.5 : 0.35;
  ctx.fillStyle = cycle.season === "winter" ? "#8e9aa2" : "#67796c";
  ctx.beginPath();
  ctx.moveTo(-200, viewHeight);
  for (let x = -200; x <= viewWidth + 200; x += 40) {
    const wave = Math.sin((x + shiftX) * 0.004) * 42 + Math.sin((x + shiftX) * 0.0011) * 70;
    ctx.lineTo(x, horizon + wave);
  }
  ctx.lineTo(viewWidth + 200, viewHeight);
  ctx.closePath();
  ctx.fill();

  // a band of distant pines
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = cycle.season === "winter" ? "#4d5b57" : "#3c4e3c";
  for (let index = -4; index < 40; index += 1) {
    const x = index * 78 + ((shiftX * 1.6) % 78);
    const height = 70 + ((index * 37) % 46);
    const base = horizon + 62;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + 26, base - height);
    ctx.lineTo(x + 52, base);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // the ground plane the middle layer sits on
  ctx.fillStyle = palette.ground;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, horizon + 54, viewWidth, viewHeight);
  ctx.globalAlpha = 1;
}

/** Near branches and ferns, softly out of focus at the screen corners. */
export function drawForeground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number,
  cycle: Cycle,
  time: number,
) {
  const palette = SEASON_PALETTE[cycle.season];
  const shift = -cameraX * 0.16;
  const bob = Math.sin(time * 0.0004) * 5;
  const leaf = palette.leaf ?? "#43533f";
  ctx.save();
  ctx.filter = "blur(7px)";
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = leaf;

  const clusters: { x: number; y: number; r: number }[] = [
    { x: -30 + shift * 0.3, y: -20, r: 120 },
    { x: 90 + shift * 0.3, y: -60, r: 90 },
    { x: viewWidth + 30 - shift * 0.3, y: viewHeight + 20, r: 140 },
    { x: viewWidth - 90 - shift * 0.3, y: viewHeight + 60, r: 100 },
    { x: -40 + shift * 0.2, y: viewHeight + 40, r: 130 },
  ];
  for (const cluster of clusters) {
    for (let blob = 0; blob < 6; blob += 1) {
      const angle = (blob / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        cluster.x + Math.cos(angle) * cluster.r * 0.6,
        cluster.y + Math.sin(angle) * cluster.r * 0.5 + bob,
        cluster.r * 0.55,
        cluster.r * 0.38,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.filter = "none";
  ctx.restore();
}

/** The hour of the actual day, laid over everything as a colour wash. */
export function drawDaylight(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  viewHeight: number,
  cycle: Cycle,
) {
  ctx.save();
  ctx.globalAlpha = cycle.tintAlpha;
  ctx.fillStyle = cycle.tint;
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.restore();
}
