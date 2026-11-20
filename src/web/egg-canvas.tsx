import { createEgg, EGG, eggGroundY } from '../shared/egg.js';
import type { EggView } from '../shared/egg.js';
import type { Seat } from '../shared/protocol.js';
import { PanoramaCanvas } from './panorama-canvas.js';
import { interpolateEgg } from './panorama-motion.js';
import { animationSeconds, halo, polygon } from './scenery.js';

type Context = CanvasRenderingContext2D;
const preview = createEgg();
const roleColors = { left: '#edac73', right: '#b5e5d4' };

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function terrain(ctx: Context, color: string, yOffset: number) {
  ctx.beginPath();
  ctx.moveTo(0, EGG.height);
  for (let x = 0; x <= EGG.width; x += 5) ctx.lineTo(x, eggGroundY(x) + yOffset);
  ctx.lineTo(EGG.width, EGG.height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function paintLayout(ctx: Context) {
  const sky = ctx.createLinearGradient(0, 0, 0, EGG.height);
  sky.addColorStop(0, '#273458');
  sky.addColorStop(.32, '#926e90');
  sky.addColorStop(.61, '#f4b89c');
  sky.addColorStop(1, '#ffd595');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, EGG.width, EGG.height);
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
  terrain(ctx, '#9cab72', 0);
  terrain(ctx, '#566a59', 6);
  terrain(ctx, '#373c48', 16);
  for (let i = 0; i < 100; i++) {
    const x = (i * 139) % EGG.width;
    const y = eggGroundY(x) + 24 + (i * 91) % 95;
    ellipse(ctx, x, y, 3 + (i % 7), 2, i % 2 ? '#735d48' : '#806251');
  }
  for (const pad of [EGG.start, ...EGG.slopes.map(slope => slope.pad)]) {
    ellipse(ctx, pad, eggGroundY(pad) + 1, 27, 9, '#725943');
    ellipse(ctx, pad, eggGroundY(pad) - 2, 25, 7, '#edba79');
  }
  for (const { from, low } of EGG.slopes) {
    ctx.fillStyle = '#696147';
    ctx.fillRect(from, eggGroundY(from) - 48, 3, 48);
    ellipse(ctx, from + 2, eggGroundY(from) - 51, 29, 14, '#27463e');
    ctx.fillStyle = '#ffedc9';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(low === 'left' ? '抬左端' : '抬右端', from + 2, eggGroundY(from) - 46);
  }
  const nestY = eggGroundY(EGG.exit);
  ellipse(ctx, EGG.exit + 5, nestY - 5, 38, 12, '#75533b');
  ellipse(ctx, EGG.exit + 5, nestY - 11, 32, 8, '#c0935c');
  for (let i = -3; i <= 3; i++) {
    ctx.strokeStyle = '#edcc8f';
    ctx.beginPath();
    ctx.moveTo(EGG.exit + i * 7, nestY - 9);
    ctx.lineTo(EGG.exit + i * 8 + 7, nestY - 3);
    ctx.stroke();
  }
}

function paintRun(ctx: Context, run: EggView, seat: Seat) {
  const { x } = run;
  const y = eggGroundY(x);
  const boardY = (eggGroundY(x - 43) + eggGroundY(x + 43)) / 2 - 27;
  const angle = -run.tilt * .37;
  ellipse(ctx, run.checkpoint, eggGroundY(run.checkpoint) - 2, 21, 4, '#ffe1a4');
  if (!run.finished) {
    for (const role of ['left', 'right'] as const) {
      const side = role === 'left' ? -1 : 1;
      const playerX = x + side * 49;
      const feet = eggGroundY(playerX);
      ellipse(ctx, playerX, feet - 12, 10, 14, roleColors[role]);
      ellipse(ctx, playerX, feet - 30, 9, 9, '#f4dbb0');
      const handX = x + Math.cos(angle) * side * 43;
      const handY = boardY + Math.sin(angle) * side * 43;
      ctx.strokeStyle = roleColors[role];
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(playerX, feet - 16);
      ctx.lineTo(handX, handY);
      ctx.stroke();
      if (role === seat) ellipse(ctx, playerX, feet - 46, 3, 3, '#fff4d6');
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
  const seconds = animationSeconds(run.elapsedMs);
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

const focusX = (run: EggView) => run.x;

export function EggCanvas({ run = preview, seat, frozen = false }: { run?: EggView; seat: Seat; frozen?: boolean }) {
  return <PanoramaCanvas run={run} seat={seat} world={EGG} focusX={focusX}
    paintLayout={paintLayout} paintRun={paintRun} theme="egg-canvas" frozen={frozen} interpolate={interpolateEgg} />;
}
