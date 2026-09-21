import {
  DEN_CENTER,
  DEN_EXIT,
  DEN_HEIGHT,
  DEN_MOUTH,
  DEN_RADIUS_X,
  DEN_RADIUS_Y,
  DEN_WIDTH,
  NICHES,
} from "./den";
import type { DenKeepsake, DenState } from "./types";

/** The opening in the forest floor, under the roots of a fallen pine. */
export function drawDenMouth(ctx: CanvasRenderingContext2D, time: number, discovered: boolean) {
  const { x, y } = DEN_MOUTH;
  ctx.save();
  ctx.translate(x, y);

  // fallen trunk lying across the slope
  ctx.fillStyle = "#4e3c2c";
  ctx.beginPath();
  ctx.ellipse(-8, -46, 96, 15, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5e4a36";
  ctx.beginPath();
  ctx.ellipse(-8, -50, 92, 10, -0.12, 0, Math.PI * 2);
  ctx.fill();

  // root plate
  ctx.strokeStyle = "#4a3828";
  ctx.lineWidth = 5;
  for (let index = 0; index < 9; index += 1) {
    const angle = Math.PI + (index / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(-70, -44);
    ctx.quadraticCurveTo(
      -70 + Math.cos(angle) * 40,
      -44 + Math.sin(angle) * 34,
      -70 + Math.cos(angle) * 72,
      -44 + Math.sin(angle) * 54,
    );
    ctx.stroke();
  }

  // the dark opening itself
  const mouth = ctx.createRadialGradient(0, 0, 3, 0, 0, 54);
  mouth.addColorStop(0, "#120e0b");
  mouth.addColorStop(0.62, "#1d1812");
  mouth.addColorStop(1, "rgba(29, 24, 18, 0)");
  ctx.fillStyle = mouth;
  ctx.beginPath();
  ctx.ellipse(0, 0, 54, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0c0a08";
  ctx.beginPath();
  ctx.ellipse(0, 2, 36, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  if (discovered) {
    const glow = 0.18 + Math.sin(time * 0.0014) * 0.06;
    const warm = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
    warm.addColorStop(0, `rgba(255, 206, 140, ${glow})`);
    warm.addColorStop(1, "rgba(255, 206, 140, 0)");
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  // ferns half-hiding the entrance
  ctx.strokeStyle = "#48633f";
  ctx.lineWidth = 2.2;
  for (let frond = 0; frond < 9; frond += 1) {
    const base = -50 + frond * 12;
    const sway = Math.sin(time * 0.0008 + frond) * 4;
    ctx.beginPath();
    ctx.moveTo(base, 22);
    ctx.quadraticCurveTo(base + sway, 2, base + sway * 2 + (frond - 4) * 3, -22);
    ctx.stroke();
  }
  ctx.restore();
}

/** A quiet, permanent trail of paw prints and scent leading back to the den. */
export function drawInvitation(
  ctx: CanvasRenderingContext2D,
  path: Array<{ x: number; y: number }>,
  time: number,
) {
  ctx.save();
  path.forEach((point, index) => {
    const pulse = 0.28 + Math.sin(time * 0.0016 - index * 0.5) * 0.14;
    const glow = ctx.createRadialGradient(point.x, point.y, 1, point.x, point.y, 26);
    glow.addColorStop(0, `rgba(238, 214, 158, ${pulse})`);
    glow.addColorStop(1, "rgba(238, 214, 158, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#3b4a34";
    ctx.beginPath();
    ctx.ellipse(point.x - 3, point.y, 3, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(point.x + 3, point.y + 3, 3, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function drawKeepsake(ctx: CanvasRenderingContext2D, item: DenKeepsake, time: number) {
  if (item === "pebble") {
    ctx.fillStyle = "#a7a396";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e3ded0";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.quadraticCurveTo(0, -4, 6, 0);
    ctx.stroke();
  } else if (item === "feather") {
    ctx.strokeStyle = "#cdc4ae";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.quadraticCurveTo(0, -2, 9, -8);
    ctx.stroke();
    ctx.fillStyle = "rgba(226, 219, 200, 0.75)";
    ctx.beginPath();
    ctx.ellipse(1, -1, 8, 3.4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (item === "cone") {
    ctx.fillStyle = "#6b4c33";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6543";
    ctx.lineWidth = 1;
    for (let scale = -6; scale < 7; scale += 3) {
      ctx.beginPath();
      ctx.moveTo(-5, scale);
      ctx.lineTo(5, scale + 1.5);
      ctx.stroke();
    }
  } else {
    const pulse = 0.7 + Math.sin(time * 0.0022) * 0.22;
    ctx.fillStyle = `rgba(190, 70, 78, ${pulse})`;
    ctx.beginPath();
    ctx.arc(-3, 1, 3.6, 0, Math.PI * 2);
    ctx.arc(3, -1, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7f9160";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(4, -8, 9, -9);
    ctx.stroke();
  }
}

/**
 * The sheltered chamber. Warmth grows with every armful of bedding carried in,
 * and nothing placed in the wall niches ever weathers away.
 */
export function drawDenInterior(
  ctx: CanvasRenderingContext2D,
  den: DenState,
  time: number,
  warmth: number,
) {
  // earth beyond the chamber
  ctx.fillStyle = "#15120e";
  ctx.fillRect(0, 0, DEN_WIDTH, DEN_HEIGHT);

  const floor = ctx.createRadialGradient(
    DEN_CENTER.x,
    DEN_CENTER.y,
    20,
    DEN_CENTER.x,
    DEN_CENTER.y,
    DEN_RADIUS_X,
  );
  floor.addColorStop(0, warmth > 0.5 ? "#5b4530" : "#4c3a29");
  floor.addColorStop(0.7, "#3b2e21");
  floor.addColorStop(1, "#221a13");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.ellipse(DEN_CENTER.x, DEN_CENTER.y, DEN_RADIUS_X, DEN_RADIUS_Y, 0, 0, Math.PI * 2);
  ctx.fill();

  // rock wall
  ctx.strokeStyle = "#221b15";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.ellipse(DEN_CENTER.x, DEN_CENTER.y, DEN_RADIUS_X + 6, DEN_RADIUS_Y + 6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#6c6156";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.4;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(
      DEN_CENTER.x + Math.cos(angle) * (DEN_RADIUS_X - 16),
      DEN_CENTER.y + Math.sin(angle) * (DEN_RADIUS_Y - 16),
    );
    ctx.lineTo(
      DEN_CENTER.x + Math.cos(angle + 0.18) * (DEN_RADIUS_X + 2),
      DEN_CENTER.y + Math.sin(angle + 0.18) * (DEN_RADIUS_Y + 2),
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // roots reaching across the ceiling
  ctx.strokeStyle = "#3a2b1f";
  ctx.lineWidth = 7;
  for (let index = 0; index < 6; index += 1) {
    const offset = -170 + index * 66;
    ctx.beginPath();
    ctx.moveTo(DEN_CENTER.x + offset - 40, DEN_CENTER.y - DEN_RADIUS_Y + 4);
    ctx.quadraticCurveTo(
      DEN_CENTER.x + offset,
      DEN_CENTER.y - DEN_RADIUS_Y + 54,
      DEN_CENTER.x + offset + 52,
      DEN_CENTER.y - DEN_RADIUS_Y + 10,
    );
    ctx.stroke();
  }

  // pressed hollow, once the fox has rested here a few times
  if (den.rests >= 2) {
    ctx.fillStyle = "rgba(30, 22, 16, 0.55)";
    ctx.beginPath();
    ctx.ellipse(DEN_CENTER.x, DEN_CENTER.y + 10, 82, 50, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // the bed, one armful at a time
  for (const pile of den.bedding) {
    const x = DEN_CENTER.x + pile.offsetX;
    const y = DEN_CENTER.y + 10 + pile.offsetY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(pile.angle);
    if (pile.material === "needles") {
      ctx.strokeStyle = "#7b6a3f";
      ctx.lineWidth = 1.4;
      for (let needle = 0; needle < 12; needle += 1) {
        const angle = (needle / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 2);
        ctx.lineTo(Math.cos(angle) * 17, Math.sin(angle) * 11);
        ctx.stroke();
      }
    } else if (pile.material === "moss") {
      ctx.fillStyle = "#5e7a4a";
      for (let clump = 0; clump < 6; clump += 1) {
        const angle = (clump / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * 9, Math.sin(angle) * 6, 8, 5, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#d8d2c2";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#49423a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-12, -1);
      ctx.lineTo(12, 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // niches along the wall and in the root net
  for (const niche of NICHES) {
    const keepsake = den.keepsakes.find((entry) => entry.nicheId === niche.id) ?? null;
    ctx.save();
    ctx.translate(niche.x, niche.y);
    ctx.fillStyle = "rgba(14, 11, 8, 0.85)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = keepsake ? "rgba(240, 206, 150, 0.4)" : "rgba(180, 168, 146, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (keepsake) drawKeepsake(ctx, keepsake.item, time);
    ctx.restore();
  }

  // daylight at the mouth
  const day = ctx.createRadialGradient(DEN_EXIT.x, DEN_EXIT.y + 18, 6, DEN_EXIT.x, DEN_EXIT.y + 18, 120);
  day.addColorStop(0, "rgba(226, 226, 205, 0.5)");
  day.addColorStop(1, "rgba(226, 226, 205, 0)");
  ctx.fillStyle = day;
  ctx.beginPath();
  ctx.arc(DEN_EXIT.x, DEN_EXIT.y + 18, 120, 0, Math.PI * 2);
  ctx.fill();

  // warm light, a little warmer with every material carried in
  const lamp = ctx.createRadialGradient(
    DEN_CENTER.x,
    DEN_CENTER.y - 20,
    10,
    DEN_CENTER.x,
    DEN_CENTER.y - 20,
    DEN_RADIUS_X,
  );
  lamp.addColorStop(0, `rgba(255, 198, 132, ${0.08 + warmth * 0.2})`);
  lamp.addColorStop(1, "rgba(255, 198, 132, 0)");
  ctx.fillStyle = lamp;
  ctx.beginPath();
  ctx.ellipse(DEN_CENTER.x, DEN_CENTER.y, DEN_RADIUS_X, DEN_RADIUS_Y, 0, 0, Math.PI * 2);
  ctx.fill();
}
