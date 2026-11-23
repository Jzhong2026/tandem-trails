import { createEgg, EGG_LAYOUTS, eggGroundY } from '../shared/egg.js';
import type { EggLayout, EggView, EggWind } from '../shared/egg.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { EggLevel } from '../shared/game-levels.js';
import type { Seat } from '../shared/protocol.js';
import { buddyScale, CHAPTER_OUTFIT, paintBuddy } from './buddy.js';
import { PanoramaCanvas } from './panorama-canvas.js';
import type { Looks } from './panorama-canvas.js';
import { interpolateEgg } from './panorama-motion.js';
import { animationSeconds, halo, polygon } from './scenery.js';

type Context = CanvasRenderingContext2D;
const preview = createEgg();

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function terrain(ctx: Context, color: string, yOffset: number, level: EggLevel) {
  const { width, height } = EGG_LAYOUTS[level];
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 5) ctx.lineTo(x, eggGroundY(x, level) + yOffset);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function signPost(ctx: Context, x: number, y: number, text: string, board: string, ink: string) {
  ctx.fillStyle = '#696147';
  ctx.fillRect(x, y - 48, 3, 48);
  ellipse(ctx, x + 2, y - 51, 30, 14, board);
  ctx.fillStyle = ink;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + 2, y - 46);
}

function paintLayout(ctx: Context, level: EggLevel) {
  const layout = EGG_LAYOUTS[level];
  const sky = ctx.createLinearGradient(0, 0, 0, layout.height);
  sky.addColorStop(0, '#273458');
  sky.addColorStop(.32, '#926e90');
  sky.addColorStop(.61, '#f4b89c');
  sky.addColorStop(1, '#ffd595');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, layout.width, layout.height);
  for (let i = 0; i < 56; i++) {
    ellipse(ctx, i * 197 % 997, i * 47 % 112, .7 + i % 3 * .25, .9, '#ffe6ca9c');
  }
  halo(ctx, 754, 84, 138, '#ffd0a179');
  ellipse(ctx, 754, 84, 34, 34, '#ffe4af');
  for (let i = 0; i < 9; i++) {
    const x = i * 141 - 36;
    const y = 80 + i * 43 % 63;
    polygon(ctx, '#796f91', [[x - 160, 249], [x - 45, y + 41], [x, y], [x + 30, y + 32], [x + 138, 246]]);
    polygon(ctx, '#bb8c9c', [[x, y], [x + 30, y + 32], [x + 138, 246], [x + 22, y + 74]]);
    polygon(ctx, '#f4d6c5', [[x - 45, y + 41], [x, y], [x + 31, y + 33], [x + 8, y + 20],
      [x + 6, y + 30], [x - 7, y + 19], [x - 17, y + 29], [x - 18, y + 25]]);
  }
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 57; i++) {
      const x = i * 19 + layer * 8;
      const y = 171 + 25 * Math.sin(x / 93 + layer) + layer * 32;
      const h = 20 + (i * 13) % 23;
      const color = layer ? '#375e61' : '#647987';
      polygon(ctx, color, [[x - 22, 322], [x - 18, y + 23], [x - 8, y + 3],
        [x - 12, y + 8], [x, y - h], [x + 12, y + 5], [x + 8, y + 1], [x + 20, y + 26], [x + 23, 322]]);
    }
  }
  terrain(ctx, '#9cab72', 0, level);
  terrain(ctx, '#566a59', 6, level);
  terrain(ctx, '#373c48', 16, level);
  for (let i = 0; i < 100; i++) {
    const x = (i * 139) % layout.width;
    const y = eggGroundY(x, level) + 24 + (i * 91) % 95;
    ellipse(ctx, x, y, 3 + (i % 7), 2, i % 2 ? '#735d48' : '#806251');
  }
  for (const pad of [layout.start, ...layout.slopes.map(slope => slope.pad), ...layout.winds.map(wind => wind.pad)]) {
    ellipse(ctx, pad, eggGroundY(pad, level) + 1, 27, 9, '#725943');
    ellipse(ctx, pad, eggGroundY(pad, level) - 2, 25, 7, '#edba79');
  }
  for (const { from, low } of layout.slopes) {
    signPost(ctx, from, eggGroundY(from, level), low === 'left' ? '抬左端' : '抬右端', '#27463e', '#ffedc9');
  }
  for (const wind of layout.winds) {
    signPost(ctx, wind.from, eggGroundY(wind.from, level), '一起扶稳', '#2b5a5e', '#e8fbff');
  }
  const nestY = eggGroundY(layout.exit, level);
  ellipse(ctx, layout.exit + 5, nestY - 5, 38, 12, '#75533b');
  ellipse(ctx, layout.exit + 5, nestY - 11, 32, 8, '#c0935c');
  for (let i = -3; i <= 3; i++) {
    ctx.strokeStyle = '#edcc8f';
    ctx.beginPath();
    ctx.moveTo(layout.exit + i * 7, nestY - 9);
    ctx.lineTo(layout.exit + i * 8 + 7, nestY - 3);
    ctx.stroke();
  }
}

function windStreaks(ctx: Context, wind: EggWind, level: EggLevel, seconds: number, active: boolean) {
  const span = wind.to - wind.from;
  const gy = eggGroundY((wind.from + wind.to) / 2, level);
  ctx.save();
  ctx.strokeStyle = active ? '#e8fbffc9' : '#e8fbff59';
  ctx.lineWidth = active ? 2.4 : 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const t = ((seconds * (62 + i * 13) + i * 47) % span + span) % span;
    const x = wind.dir > 0 ? wind.from + t : wind.to - t;
    const y = gy - 26 - (i * 19) % 56;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + wind.dir * 15, y - 5, x + wind.dir * 30, y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintRun(ctx: Context, run: EggView, seat: Seat, looks: Looks) {
  const level = run.level;
  const layout: EggLayout = EGG_LAYOUTS[level];
  const seconds = animationSeconds(run.elapsedMs);
  for (const wind of layout.winds) {
    windStreaks(ctx, wind, level, seconds, run.x >= wind.from && run.x < wind.to);
  }
  const { x } = run;
  const y = eggGroundY(x, level);
  const boardY = (eggGroundY(x - 43, level) + eggGroundY(x + 43, level)) / 2 - 27;
  const angle = -run.tilt * .37;
  ellipse(ctx, run.checkpoint, eggGroundY(run.checkpoint, level) - 2, 21, 4, '#ffe1a4');
  if (!run.finished) {
    for (const role of ['left', 'right'] as const) {
      const side = role === 'left' ? -1 : 1;
      const playerX = x + side * 49;
      const feet = eggGroundY(playerX, level);
      const handX = x + Math.cos(angle) * side * 43;
      const handY = boardY + Math.sin(angle) * side * 43;
      paintBuddy(ctx, {
        x: playerX, feet, scale: buddyScale(looks[role].size),
        facing: side === -1 ? 1 : -1,
        appearance: looks[role], outfit: CHAPTER_OUTFIT.egg,
        pose: 'carry', phase: (seconds * 1.6) % 1, seconds,
        reach: { x: handX, y: handY }, reachBack: { x: handX, y: handY },
        tag: looks[role].name, tagColor: role === seat ? '#e8503ae6' : '#3a3355e6',
      });
      if (run.raised[role]) ellipse(ctx, handX, handY, 4, 4, '#f5dfac');
    }
  }
  ctx.save();
  ctx.translate(x, run.finished ? y - 4 : boardY);
  if (!run.finished) {
    ctx.rotate(angle);
    ctx.fillStyle = '#754e3d';
    ctx.beginPath();
    ctx.roundRect(-46, -3, 92, 8, 4);
    ctx.fill();
  }
  const roll = run.finished ? 0 : -run.roll * 31;
  const slipping = Math.abs(run.roll) > .62;
  const balanced = (run.raised.left || run.raised.right) && Math.abs(run.tilt) < .15;
  halo(ctx, roll, -18, balanced ? 48 : 32, slipping ? '#ff834f9c' : '#ffe5a594');
  const shell = ctx.createLinearGradient(roll - 10, -30, roll + 11, 0);
  shell.addColorStop(0, '#ffffcc');
  shell.addColorStop(.38, '#ffe09c');
  shell.addColorStop(.70, '#e8a7a9');
  shell.addColorStop(1, '#98749a');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(roll, -15, 13, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  if (balanced) {
    for (let i = 0; i < 9; i++) {
      const phase = i * 2.4 + seconds;
      const px = roll + Math.cos(phase) * (21 + i % 3 * 4);
      const py = -18 + Math.sin(phase) * 14 - (seconds * 13 + i * 7) % 18;
      ellipse(ctx, px, py, 1.1, 2.4, '#fff3bd');
    }
  }
  ellipse(ctx, roll - 4, -21, 4, 6, '#fff0c0');
  ellipse(ctx, roll + 5, -13, 3, 5, '#b193a7');
  ellipse(ctx, roll - 5, -7, 3, 3, '#bb9ab2');
  ctx.restore();
}

const paintEggLayout = (ctx: Context) => paintLayout(ctx, 'egg');
const paintGustLayout = (ctx: Context) => paintLayout(ctx, 'egg2');
const focusX = (run: EggView) => run.x;

export function EggCanvas({ run = preview, seat, frozen = false, looks = DEFAULT_APPEARANCE }: {
  run?: EggView; seat: Seat; frozen?: boolean; looks?: Looks;
}) {
  return <PanoramaCanvas run={run} seat={seat} world={EGG_LAYOUTS[run.level]} focusX={focusX}
    paintLayout={run.level === 'egg2' ? paintGustLayout : paintEggLayout} paintRun={paintRun}
    theme="egg-canvas" frozen={frozen} interpolate={interpolateEgg} looks={looks} />;
}