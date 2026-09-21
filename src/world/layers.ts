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

/** The foreground branch-and-fern framing layer is currently unused so the
 *  bottom of the screen stays free of coloured bands. */


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
