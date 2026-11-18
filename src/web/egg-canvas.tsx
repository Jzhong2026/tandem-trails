import { createEgg, EGG, eggGroundY } from '../shared/egg.js';
import type { EggView } from '../shared/egg.js';
import type { Seat } from '../shared/protocol.js';
import { PanoramaCanvas } from './panorama-canvas.js';

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
  sky.addColorStop(0, '#789f98');
  sky.addColorStop(1, '#ead3a2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, EGG.width, EGG.height);
  ellipse(ctx, 754, 95, 37, 37, '#f1d8a1');
  for (let i = 0; i < 6; i++) {
    ellipse(ctx, 53 + i * 173, 255 - (i % 3) * 16, 161, 115 - (i % 2) * 32, i % 2 ? '#94aa83' : '#829f82');
  }
  terrain(ctx, '#819256', 0);
  terrain(ctx, '#584638', 14);
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
  ellipse(ctx, roll, -15, 13, 17, '#f3dba5');
  ellipse(ctx, roll - 4, -21, 4, 6, '#fff0c0');
  ellipse(ctx, roll + 5, -13, 3, 5, '#b193a7');
  ellipse(ctx, roll - 5, -7, 3, 3, '#bb9ab2');
  ctx.restore();
}

const focusX = (run: EggView) => run.x;

export function EggCanvas({ run = preview, seat }: { run?: EggView; seat: Seat }) {
  return <PanoramaCanvas run={run} seat={seat} world={EGG} focusX={focusX}
    paintLayout={paintLayout} paintRun={paintRun} theme="egg-canvas" />;
}
