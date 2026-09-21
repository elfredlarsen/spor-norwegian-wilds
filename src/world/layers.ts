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

/** Near branches and ferns, softly out of focus at the screen edges. */
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
  const shift = -cameraX * 0.22;
  const bob = Math.sin(time * 0.0005) * 6;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = palette.leaf ?? "#3c4b3a";

  // a branch leaning in from the top left
  ctx.strokeStyle = "#2d2318";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-40 + shift * 0.2, -20);
  ctx.quadraticCurveTo(viewWidth * 0.22 + shift * 0.2, 40 + bob, viewWidth * 0.42 + shift * 0.2, 10 + bob);
  ctx.stroke();
  for (let index = 0; index < 9; index += 1) {
    const t = index / 9;
    const x = -20 + shift * 0.2 + t * viewWidth * 0.44;
    const y = 18 + Math.sin(t * Math.PI) * 30 + bob;
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 22, 9, 0.5 + t, 0, Math.PI * 2);
    ctx.fill();
  }

  // ferns along the bottom corners
  ctx.strokeStyle = palette.leaf ?? "#41513c";
  ctx.lineWidth = 6;
  for (let frond = 0; frond < 12; frond += 1) {
    const side = frond < 6 ? 0 : 1;
    const base = side === 0 ? 20 + frond * 34 : viewWidth - 20 - (frond - 6) * 34;
    const lean = side === 0 ? 40 : -40;
    ctx.beginPath();
    ctx.moveTo(base + shift * 0.1, viewHeight + 20);
    ctx.quadraticCurveTo(
      base + lean + shift * 0.1,
      viewHeight - 70,
      base + lean * 1.8 + bob + shift * 0.1,
      viewHeight - 140,
    );
    ctx.stroke();
  }
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
