import { FOG_FLAGS, FOG_GATE, RIVER_COURSES, RIVER_SIZE } from '../shared/river-levels.js';
import type { Channel, Flag, RiverLevel } from '../shared/river-levels.js';
import type { Paddles, RiverView } from '../shared/river.js';
import { raftY } from '../shared/river.js';
import { CHAPTER_OUTFIT, paintBuddy, paintNameTag } from './buddy.js';
import type { Looks } from './panorama-canvas.js';
import { animationSeconds, halo, polygon } from './scenery.js';

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

export function paintRiver(ctx: Context, level: RiverLevel) {
  const { width, height } = RIVER_SIZE;
  const { logs, start, dock, buoys } = RIVER_COURSES[level];
  const water = ctx.createLinearGradient(0, 0, width, height);
  water.addColorStop(0, '#136b74');
  water.addColorStop(.28, '#105470');
  water.addColorStop(.52, '#178e93');
  water.addColorStop(.78, '#12576b');
  water.addColorStop(1, '#174659');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  // Long, broken bands follow the same current as the small surface glints.
  for (let i = 0; i < 26; i++) {
    const y = i * 17 - 22;
    const phase = Math.sin(i * .65) * 80;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(280, y - 68 + phase, 390, y + 56, 598, y + 15);
    ctx.bezierCurveTo(774, y - 36, 871, y - 18 + phase, 1020, y + 9);
    ctx.lineTo(1020, y + 11);
    ctx.bezierCurveTo(824, y - 21 + phase, 713, y + 4, 596, y + 22);
    ctx.bezierCurveTo(371, y + 73, 248, y - 68 + phase, -20, y + 3);
    ctx.fillStyle = i % 4 ? '#8ef9d813' : '#a8fff42b';
    ctx.fill();
  }
  halo(ctx, 682, 152, 194, '#68ffd834');

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

  // Reeds, stones and small flowers break up the two shore silhouettes.
  for (let i = 0; i < 74; i++) {
    const x = (i * 163) % width;
    const side = i % 2 ? 1 : -1;
    const edge = 41 + 8 * Math.sin(x / 70) + i % 12;
    const y = side === 1 ? edge : height - edge;
    ellipse(ctx, x, y, 6 + i % 6, 3, '#153d4299');
    ellipse(ctx, x - 1, y - 1, 5 + i % 6, 2.2, i % 3 ? '#9fab80' : '#d2c699');
    polygon(ctx, '#aed17a', [[x, y], [x - 5, y - 10], [x + 2, y - 2], [x + 5, y - 15], [x + 4, y]]);
  }

  for (const buoy of buoys) {
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
  if (level === 'fog') paintFog(ctx);
}

function paintFog(ctx: Context) {
  const { startX, endX } = FOG_GATE;
  const fog = ctx.createLinearGradient(startX - 34, 0, endX + 34, 0);
  fog.addColorStop(0, '#c0d8ce00');
  fog.addColorStop(0.24, '#c0d8cea8');
  fog.addColorStop(0.74, '#c0d8cea8');
  fog.addColorStop(1, '#c0d8ce00');
  ctx.fillStyle = fog;
  ctx.fillRect(startX - 34, 52, endX - startX + 68, 296);
  for (let i = 0; i < 16; i++) {
    ellipse(ctx, startX + 13 + (i * 41 % 113), 65 + i * 18, 32 + i % 8 * 4, 6, '#ebf4e435');
  }
  for (const [flag, { x, y }] of Object.entries(FOG_FLAGS)) {
    roundRect(ctx, x - 26, y + 9, 52, 17, 3, '#5c4936');
    for (let board = x - 24; board < x + 24; board += 8) {
      roundRect(ctx, board, y + 10, 6, 14, 1, '#bc9661');
    }
    roundRect(ctx, x - 2, y - 24, 4, 38, 1, '#362d24');
    if (flag === 'triangle') {
      ctx.fillStyle = '#ffc97d';
      ctx.beginPath();
      ctx.moveTo(x, y - 24);
      ctx.lineTo(x + 22, y - 15);
      ctx.lineTo(x, y - 6);
      ctx.closePath();
      ctx.fill();
    } else {
      ellipse(ctx, x + 11, y - 15, 10, 10, '#bae9e3');
    }
  }
}

export function paintFogClues(ctx: Context, channel: Channel | null, flag: Flag | null) {
  if (channel) {
    const { startX, endX, lanes, halfWidth } = FOG_GATE;
    const y = lanes[channel];
    roundRect(ctx, startX - 11, y - halfWidth, endX - startX + 22, halfWidth * 2, 13, '#407a68a5');
    ctx.strokeStyle = '#e6f5cd';
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 9]);
    ctx.beginPath();
    ctx.moveTo(startX - 12, y);
    ctx.lineTo(endX + 12, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (flag) {
    const { x, y, radius } = FOG_FLAGS[flag];
    ctx.strokeStyle = '#fff1b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius - 4, 0, 2 * Math.PI);
    ctx.stroke();
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

export function paintActors(ctx: Context, run: RiverView, paddles: Paddles, looks: Looks) {
  const seconds = animationSeconds(run.elapsedMs);
  const course = RIVER_COURSES[run.level];
  for (const current of course.currents ?? []) {
    ctx.save();
    ctx.strokeStyle = '#bfeef5';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const dir = Math.sign(current.pushY);
    for (let i = 0; i < 5; i++) {
      const px = current.x - current.rx + (i + 0.5) * (2 * current.rx / 5);
      const travel = (seconds * 55 + i * 23) % (2 * current.ry);
      const py = dir > 0 ? current.y - current.ry + travel : current.y + current.ry - travel;
      ctx.globalAlpha = 0.55 * (1 - Math.abs(py - current.y) / current.ry);
      ctx.beginPath();
      ctx.moveTo(px, py - 9 * dir);
      ctx.lineTo(px, py);
      ctx.lineTo(px - 4, py - 5 * dir);
      ctx.moveTo(px, py);
      ctx.lineTo(px + 4, py - 5 * dir);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const raft of course.rafts ?? []) {
    const y = raftY(raft, run.elapsedMs);
    ellipse(ctx, raft.x + 4, y + 6, raft.rx + 9, raft.ry + 7, '#204e4a4f');
    ctx.save();
    ctx.translate(raft.x, y);
    for (const [x, length, angle, color] of [[-14, 78, -0.12, '#774e36'], [8, 84, 0.16, '#916042']] as const) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(angle);
      roundRect(ctx, -11, -length / 2, 22, length, 8, color);
      roundRect(ctx, -6, -length / 2 + 10, 2, length - 20, 1, '#e4b97888');
      ellipse(ctx, 0, length / 2 - 6, 9, 6, '#c89a61');
      ellipse(ctx, 0, length / 2 - 6, 4.5, 3, '#966849');
      ctx.restore();
    }
    ellipse(ctx, -18, -20, 5, 4, '#79a862');
    ellipse(ctx, 14, 16, 5, 4, '#79a862');
    ctx.restore();
  }
  const duck = course.duck;
  if (duck && !run.rescued) {
    const { x, y } = duck;
    ellipse(ctx, x, y, 30, 30, '#f4d77e26');
    ellipse(ctx, x, y, 22, 22, '#f4d77e26');
    paintDuck(ctx, x, y);
  }

  ctx.save();
  ctx.translate(run.x, run.y);
  ctx.rotate(run.heading);
  if (run.recoveryMs > 0) ctx.globalAlpha = 0.65;
  for (const [index, side] of [-1, 1].entries()) {
    if (!paddles[index]) continue;
    const moving = paddles[0] && paddles[1];
    const tint = index === 0 ? '#ffdfa7' : '#aaffed';
    ctx.save();
    ctx.strokeStyle = tint;
    for (let i = 0; i < 5; i++) {
      const age = (seconds * 1.32 + i / 5) % 1;
      const x = -8 - age * (moving ? 83 : 14);
      const y = side * (21 + age * (moving ? 11 : 7));
      ctx.globalAlpha = (1 - age) * .82;
      ctx.lineWidth = 2.4 - age;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + age * 13, 2 + age * 5, side * .14, .18, 5.1);
      ctx.stroke();
    }
    ctx.restore();
  }
  ellipse(ctx, -4, 5, 37, 15, '#23494480');
  for (const [index, side] of [-1, 1].entries()) {
    ctx.save();
    ctx.rotate(paddles[index] ? side * (-.35 + .43 * Math.sin(seconds * 8)) : side * .12);
    roundRect(ctx, -8, side < 0 ? -25 : 7, 3.5, 19, 1.5, '#e2c795');
    ellipse(ctx, -6, side * 24, 4, 8, index === 0 ? '#f2af74' : '#b2e0cf');
    ctx.restore();
  }
  ellipse(ctx, 0, 0, 29, 13, '#77452f');
  ellipse(ctx, 0, -1, 28, 11.5, '#e6ab6b');
  ellipse(ctx, 0, 0, 23, 8.4, '#a55a3d');
  roundRect(ctx, -8, -9, 4, 18, 1, '#efbd86');
  for (const [i, x] of [-15, 1].entries()) {
    const role = i === 0 ? 'left' : 'right';
    const side = i === 0 ? -1 : 1;
    const stroke = paddles[i] ? side * (-.35 + .43 * Math.sin(seconds * 8)) : side * .12;
    const gripX = -6 * Math.cos(stroke) - side * 12 * Math.sin(stroke);
    const gripY = -6 * Math.sin(stroke) + side * 12 * Math.cos(stroke);
    paintBuddy(ctx, {
      x, feet: 3, scale: looks[role].size === 'big' ? 0.95 : 0.8,
      appearance: looks[role], outfit: CHAPTER_OUTFIT.river,
      pose: 'paddle', phase: (seconds * 1.3) % 1, seconds,
      reach: { x: gripX, y: gripY },
    });
  }
  if (run.rescued) paintDuck(ctx, 13, 0, 0.67);
  ctx.restore();
  for (const [i, x] of [-20, 16].entries()) {
    const role = i === 0 ? 'left' : 'right';
    paintNameTag(ctx, run.x + x, run.y - 52, looks[role].name, i === 0 ? '#e8503ae6' : '#3fbf8fe6');
  }
}
