import { RIVER } from '../shared/river.js';
import type { Paddles, RiverView } from '../shared/river.js';

type Context = CanvasRenderingContext2D;

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.fill();
}

function roundRect(ctx: Context, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function bank(ctx: Context, bottom: boolean, width: number, height: number) {
  ctx.save();
  if (bottom) ctx.transform(1, 0, 0, -1, 0, height);
  for (const [depth, color] of [[57, '#aab66d'], [51, '#657b50'], [43, '#385d44'], [37, '#294b3c']] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    for (let x = width; x >= 0; x -= 5) ctx.lineTo(x, depth + 8 * Math.sin(x / 70) + 4 * Math.cos(x / 21));
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 29; i++) {
    const x = 7 + i * 35 + Math.sin(i * 21) * 9;
    const y = 26 + Math.sin(x / 70) * 6 + Math.sin(i * 8.7) * 8;
    const size = 8 + (i * 7 % 14);
    ellipse(ctx, x + 3, y + 7, size + 4, 7, '#254638');
    ellipse(ctx, x, y, size, 10 + i % 5, i % 3 ? '#466a4d' : '#5d8050');
    ellipse(ctx, x - 4, y - 3, size * 0.64, 5, '#70905a');
    if (i % 4 === 0) ellipse(ctx, x + 6, y + 9, 2, 2, '#e2bc6d');
  }
  ctx.restore();
}

export function paintRiver(ctx: Context) {
  const { width, height, logs, start, dock } = RIVER;
  const water = ctx.createLinearGradient(0, 46, 0, height - 38);
  water.addColorStop(0, '#447e78');
  water.addColorStop(0.57, '#397b76');
  water.addColorStop(1, '#2e6865');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 135; i++) {
    const x = ((i * 389) % 1009) - 10;
    const y = 41 + (i * 73) % 315;
    const length = 5 + (i * 17) % 34;
    ctx.strokeStyle = i % 3 ? '#a1ccc633' : '#a1ccc660';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + length / 2, y - 4, x + length, y - 1);
    ctx.stroke();
  }
  bank(ctx, false, width, height);
  bank(ctx, true, width, height);

  for (const buoy of [{ x: 231, y: 263 }, { x: 410, y: 254 }, { x: 510, y: 144 }, { x: 650, y: 144 }]) {
    ellipse(ctx, buoy.x, buoy.y + 5, 12, 4, '#cde2cf55');
    ellipse(ctx, buoy.x, buoy.y, 6.5, 7.5, '#f7d388');
    ellipse(ctx, buoy.x - 1.8, buoy.y - 2.1, 2.4, 2.4, '#ffedb4');
    roundRect(ctx, buoy.x - 7, buoy.y + 1.5, 14, 2.8, 1, '#ad572e');
  }

  for (const log of logs) {
    ellipse(ctx, log.x + 4, log.y + 6, log.rx + 9, log.ry + 7, '#204e4a4f');
    ctx.save();
    ctx.translate(log.x, log.y);
    for (const [x, length, angle, color] of [[-21, 117, -0.15, '#774e36'], [12, 130, 0.19, '#916042'],
      [30, 88, 0.29, '#a46b46']] as const) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(angle);
      roundRect(ctx, -12, -length / 2, 24, length, 8, color);
      roundRect(ctx, -7, -length / 2 + 13, 2, length - 25, 1, '#e4b97888');
      ellipse(ctx, 0, length / 2 - 7, 10, 7, '#c89a61');
      ellipse(ctx, 0, length / 2 - 7, 5, 3.5, '#966849');
      ctx.restore();
    }
    for (const [x, y] of [[-18, -34], [12, 33], [25, 5], [-27, 14]]) {
      ellipse(ctx, x, y, 10, 8, '#627b49');
      ellipse(ctx, x - 2, y - 2, 5, 4, '#9ca659');
    }
    ctx.restore();
  }

  ctx.strokeStyle = '#edeed2a0';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.arc(dock.x, dock.y, dock.radius - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const [x, y, end] of [[start.x - 29, 80, 168], [dock.x + 31, 231, 347]] as const) {
    roundRect(ctx, x - 20, y, 40, end - y, 5, '#274b40');
    for (let row = y; row < end - 3; row += 9) roundRect(ctx, x - 17, row, 34, 7, 2, '#ad8251');
    ellipse(ctx, x - 16, y, 4.8, 4.8, '#e1b978');
    ellipse(ctx, x + 16, y, 4.8, 4.8, '#e1b978');
    ellipse(ctx, x - 16, end - 3, 4.8, 4.8, '#e1b978');
    ellipse(ctx, x + 16, end - 3, 4.8, 4.8, '#e1b978');
  }
}

function paintDuck(ctx: Context, x: number, y: number, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ellipse(ctx, 0, 4, 16, 5, '#c4daba70');
  ellipse(ctx, -2, 1, 11, 7.5, '#f5ca64');
  ellipse(ctx, 5, -5, 7, 7, '#ffe592');
  ellipse(ctx, 11, -3, 4, 2, '#dd843e');
  ellipse(ctx, 7, -6, 1.1, 1.3, '#28362b');
  ctx.restore();
}

export function paintActors(ctx: Context, run: RiverView, paddles: Paddles) {
  if (!run.rescued) {
    const { x, y } = RIVER.duck;
    ellipse(ctx, x, y, 30, 30, '#f4d77e26');
    ellipse(ctx, x, y, 22, 22, '#f4d77e26');
    paintDuck(ctx, x, y);
  }

  ctx.save();
  ctx.translate(run.x, run.y);
  ctx.rotate(run.heading);
  if (run.recoveryMs > 0) ctx.globalAlpha = 0.65;
  ellipse(ctx, -4, 5, 37, 15, '#23494480');
  for (const [index, side] of [-1, 1].entries()) {
    ctx.save();
    ctx.rotate(paddles[index] ? side * -0.38 : side * 0.12);
    roundRect(ctx, -8, side < 0 ? -25 : 7, 3.5, 19, 1.5, '#e2c795');
    ellipse(ctx, -6, side * 24, 4, 8, index === 0 ? '#f2af74' : '#b2e0cf');
    ctx.restore();
  }
  ellipse(ctx, 0, 0, 29, 13, '#77452f');
  ellipse(ctx, 0, -1, 28, 11.5, '#e6ab6b');
  ellipse(ctx, 0, 0, 23, 8.4, '#a55a3d');
  roundRect(ctx, -8, -9, 4, 18, 1, '#efbd86');
  if (run.rescued) paintDuck(ctx, 13, 0, 0.67);
  ctx.restore();
}
