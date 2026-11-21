import { isEggLevel, isMineLevel } from '../shared/game-levels.js';
import type { GameLevel } from '../shared/game-levels.js';
import { halo, polygon } from './scenery.js';

type Context = CanvasRenderingContext2D;

function progress(time: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function shape(ctx: Context, color: string, path: string) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(path));
}

function oval(ctx: Context, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: Context, color: string, width: number, path: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(path));
}

function sparkle(ctx: Context, x: number, y: number, size: number, color: string) {
  polygon(ctx, color, [[x, y - size], [x + size * .25, y - size * .24], [x + size * .8, y],
  [x + size * .22, y + size * .25], [x, y + size], [x - size * .22, y + size * .25],
  [x - size * .8, y], [x - size * .25, y - size * .24]]);
}

function dock(ctx: Context, time: number, rescued: boolean) {
  const arrive = progress(time, 0, .49);
  const hop = progress(time, .43, .78);
  oval(ctx, 0, 40, 121, 16, '#123e4b');
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-8 + arrive * 14, 37);
    ctx.scale(1, side);
    line(ctx, side < 0 ? '#a9f4dc' : '#ffd6a3', 2,
      `M -112 ${13 - arrive * 6} Q -64 ${22 - arrive * 8} -16 0`);
    ctx.restore();
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#cb9368' : '#e5b681';
    ctx.fillRect(56 + i * 8, 18, 7, 13);
  }
  line(ctx, '#886447', 4, 'M 60 30 v 9 M 98 30 v 7');
  line(ctx, '#eac693', 1.5, 'M 56 16 Q 78 22 102 16');
  line(ctx, '#efcca0', 2, 'M 96 18 v -62');
  shape(ctx, '#ffab76', 'M 97 -44 Q 111 -50 122 -43 L 115 -39 L 121 -36 Q 109 -40 97 -33 Z');
  ctx.save();
  ctx.translate(-49 + 40 * arrive, 0);
  shape(ctx, '#88503e', 'M -43 17 Q -12 29 42 12 Q 32 45 -14 42 Q -39 39 -43 17 Z');
  shape(ctx, '#ffd39a', 'M -45 13 Q -9 23 44 8 L 42 17 Q 5 34 -35 26 Z');
  line(ctx, '#bd8060', 1.4, 'M -30 30 Q -5 40 25 26 M -22 34 Q -1 41 13 35');
  for (const [x, coat] of [[-22, '#e9a16b'], [0, '#8ad5bd']] as const) {
    oval(ctx, x, 9, 8, 11, coat);
    oval(ctx, x + 1, -2, 6, 7, '#edc09c');
    shape(ctx, '#494454', `M ${x - 6} -2 q -1 -12 9 -7 l 4 6 l -7 -2 z`);
    oval(ctx, x + 4, -1, .85, 1.1, '#3a3540');
    line(ctx, coat, 4, `M ${x + 3} 8 l 6 -4 l 3 ${-3 - arrive * 6}`);
  }
  ctx.restore();
  if (rescued) {
    ctx.save();
    ctx.translate(13 + hop * 61, 13 - Math.sin(hop * Math.PI) * 35);
    ctx.scale(1 - 2 * progress(time, .78, .9), 1);
    oval(ctx, 0, -4, 13, 9, '#ffc563');
    oval(ctx, -3, -5, 8, 4, '#efac53');
    oval(ctx, 6, -15, 8, 9, '#ffe69a');
    oval(ctx, 13, -13, 6, 2.5, '#ed9252');
    oval(ctx, 8, -16, 1.4, 1.8, '#362f38');
    ctx.restore();
    ctx.globalAlpha = Math.sin(progress(time, .84, 1) * Math.PI);
    line(ctx, '#fff2b4', 2, 'M 54 -8 l -8 -4 M 52 -2 h -9');
    ctx.globalAlpha = 1;
  }
}

function grotto(ctx: Context, time: number) {
  const meet = progress(time, 0, .56);
  oval(ctx, 0, 48, 90, 10, '#202036');
  shape(ctx, '#403857', 'M -64 45 L -60 -13 L -41 -44 L -10 -61 L 21 -57 L 53 -33 L 66 45 Z');
  shape(ctx, '#152035', 'M -40 45 L -38 -6 Q -27 -44 0 -44 Q 28 -43 41 -9 L 42 45 Z');
  ctx.save();
  ctx.globalAlpha = meet;
  halo(ctx, 0, 18, 40, '#76d7bf6b');
  shape(ctx, '#579b9f', 'M -9 43 L -6 31 L 12 31 L 21 43 Z');
  line(ctx, '#c5d8ab', 1, 'M -6 34 h 19 M -8 38 h 25');
  ctx.restore();
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + i * Math.PI / 8;
    const x = Math.cos(angle) * 51;
    const y = 10 + Math.sin(angle) * 59;
    const lit = progress(time, .43 + i * .045, .62 + i * .045);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    shape(ctx, '#645a83', 'M -8 0 L -5 -11 L 2 -16 L 9 -5 L 6 6 L -2 9 Z');
    ctx.globalAlpha = lit;
    halo(ctx, 0, -2, 22, '#80f9e888');
    shape(ctx, '#79daca', 'M -8 0 L -5 -11 L 2 -16 L 9 -5 L 6 6 L -2 9 Z');
    shape(ctx, '#e2ffdc', 'M -5 -11 L 2 -16 L 0 2 L -2 9 Z');
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 87, 32);
    line(ctx, '#e6bb85', 1.6, 'M -5 -6 Q -6 -17 0 -17 Q 6 -17 5 -6');
    shape(ctx, '#ac876d', 'M -9 -7 L 8 -7 L 6 7 L -6 7 Z');
    shape(ctx, '#ffe1a1', 'M -5 -5 L 5 -5 L 3 4 L -3 4 Z');
    ctx.restore();
    const x = side * (87 - meet * 76);
    const y = 29 - meet * 41 - Math.sin(meet * Math.PI) * 27;
    halo(ctx, x, y, 28, '#ffcc68a8');
    oval(ctx, x - 4, y - 4, 4, 2.5, '#f1ffe1');
    oval(ctx, x + 4, y - 4, 4, 2.5, '#f1ffe1');
    oval(ctx, x, y, 3, 4, '#fff4a6');
    sparkle(ctx, x + side * 8, y + 11, 3, '#ffe09c');
  }
}

function hatch(ctx: Context, time: number) {
  const shake = Math.sin(time * Math.PI * 10) * (1 - progress(time, .25, .42));
  const rise = progress(time, .4, .78);
  const blink = Math.sin(progress(time, .8, .94) * Math.PI);
  oval(ctx, 0, 49, 76, 13, '#503e49');
  shape(ctx, '#956451', 'M -69 34 Q -43 24 -2 31 Q 35 19 66 32 Q 54 61 -5 58 Q -48 61 -69 34 Z');
  line(ctx, '#d6a171', 3, 'M -60 38 Q -22 56 36 42 M -36 51 Q 12 59 54 37');
  ctx.save();
  ctx.rotate(shake * .075);
  halo(ctx, 0, 6, 64, '#ffce7755');
  ctx.save();
  ctx.translate(0, 15 - rise * 33);
  ctx.globalAlpha = rise;
  shape(ctx, '#649e9b', 'M -12 32 Q -28 7 -45 4 Q -40 14 -41 21 Q -35 19 -31 27 Q -24 24 -19 35 Z');
  shape(ctx, '#e1be9a', 'M -17 28 L -40 9 Q -32 14 -31 22 Q -24 20 -17 28 Z');
  shape(ctx, '#76c9af', 'M -18 39 Q -22 15 -14 3 Q -21 -3 -22 -14 Q -10 -13 -4 -6 Q 6 -11 15 -7 Q 25 -19 31 -17 Q 30 -7 22 -1 Q 30 7 25 17 Q 19 25 9 25 L 20 40 Z');
  shape(ctx, '#ebba79', 'M -9 -6 L -6 -18 L 1 -8 Z M 9 -8 L 16 -20 L 18 -6 Z');
  oval(ctx, 7, 13, 19, 11, '#a8e3bb');
  for (const x of [-5, 16]) {
    oval(ctx, x, 4, 2.7, 3.7 - blink * 3.2, '#343b4a');
    oval(ctx, x + .7, 3, .8, .8 * (1 - blink), '#fffbde');
  }
  oval(ctx, -10, 12, 4, 2, '#e9ad94');
  oval(ctx, 17, 11, 1, .8, '#649283');
  line(ctx, '#48766c', 1.5, 'M 0 16 Q 5 20 11 16');
  ctx.restore();
  shape(ctx, '#f9daab', 'M -33 7 L -21 14 L -10 5 L 0 14 L 11 5 L 21 14 L 32 6 Q 37 48 0 49 Q -32 48 -33 7 Z');
  shape(ctx, '#e7b29c', 'M 32 7 Q 37 48 0 49 Q -19 49 -25 39 Q 7 53 24 29 Z');
  oval(ctx, -18, 26, 5, 3, '#d6a3a5');
  oval(ctx, 11, 33, 6, 5, '#e4b2ac');
  ctx.save();
  ctx.translate(-rise * 23, -rise * 38 - Math.sin(rise * Math.PI) * 10);
  ctx.rotate(-rise * .66);
  shape(ctx, '#ffe5b6', 'M -33 8 Q -29 -25 -12 -35 Q 7 -50 24 -19 Q 30 -8 32 7 L 21 15 L 11 6 L 0 15 L -10 6 L -21 15 Z');
  oval(ctx, -8, -24, 5, 3, '#e9bbb0');
  ctx.restore();
  ctx.restore();
}

export function paintFinish(ctx: Context, level: GameLevel, time: number) {
  const mine = isMineLevel(level);
  const egg = isEggLevel(level);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  halo(ctx, 0, 0, 101, mine ? '#8b81d24d' : egg ? '#f2b78240' : '#7de8d747');
  for (let i = 0; i < 20; i++) {
    const angle = i * 2.4;
    const x = Math.cos(angle) * (65 + i % 5 * 14);
    const y = Math.sin(angle) * (45 + i % 4 * 10);
    const shine = .65 + .35 * Math.sin(time * Math.PI * 2 + i);
    sparkle(ctx, x, y, (i % 5 === 0 ? 4 : 1.7) * shine, i % 3 ? '#b2ddd4' : '#ffdb98');
  }
  if (mine) grotto(ctx, time);
  else if (egg) hatch(ctx, time);
  else dock(ctx, time, level !== 'practice');
  ctx.restore();
}
