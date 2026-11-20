import { createMine, minerY, MINE } from '../shared/mine.js';
import type { MineView } from '../shared/mine.js';
import type { Seat } from '../shared/protocol.js';
import { PanoramaCanvas } from './panorama-canvas.js';
import { interpolateMine } from './panorama-motion.js';
import { animationSeconds, halo as glow, polygon } from './scenery.js';

type Context = CanvasRenderingContext2D;
const preview = createMine();
const colors = { left: '#f1b675', right: '#8bddd0' } as const;

function block(ctx: Context, x: number, y: number, w: number, h: number, color: string, r = 3) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function floor(ctx: Context, from: number, to: number, y: number) {
  block(ctx, from, y, to - from, 52, '#333147', 6);
  block(ctx, from, y, to - from, 5, '#696074');
  for (let x = from + 14; x < to - 10; x += 44) {
    block(ctx, x, y + 12, 22, 3, '#4a435b');
  }
}

function paintLayout(ctx: Context) {
  const { width, height, bridge, lift, upperY, lowerY, exit } = MINE;
  const cave = ctx.createLinearGradient(0, 0, 0, height);
  cave.addColorStop(0, '#10152a');
  cave.addColorStop(.48, '#254056');
  cave.addColorStop(1, '#251b36');
  ctx.fillStyle = cave;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 6; i++) {
    const x = i * 177 + 42;
    const shaft = ctx.createLinearGradient(x, 0, x + 78, 294);
    shaft.addColorStop(0, '#a3baff39');
    shaft.addColorStop(1, '#81e9eb00');
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 178, 322);
    ctx.lineTo(x + 67, 322);
    ctx.fill();
  }
  for (let cluster = 0; cluster < 10; cluster++) {
    const x = 20 + cluster * 107;
    const y = cluster % 2 ? lowerY + 36 : 373;
    const violet = cluster % 3 === 0;
    glow(ctx, x, y - 14, 43, violet ? '#9b71ef57' : '#45e8d85a');
    for (let shard = -1; shard <= 1; shard++) {
      const base = x + shard * 11;
      const tip = base + shard * 13;
      const top = y - 25 - (cluster * 13 + (shard + 1) * 19) % 39;
      polygon(ctx, violet ? '#7863ae' : '#378f9f', [[base - 7, y], [tip - 4, top + 7], [tip, top], [tip + 7, top + 8], [base + 8, y]]);
      polygon(ctx, violet ? '#c8a2f1' : '#8ee4dd', [[base - 3, y], [tip, top], [tip + 7, top + 8]]);
    }
  }
  for (let i = 0; i < 27; i++) {
    const x = i * 41;
    const depth = 18 + (i * 47) % 59;
    ctx.fillStyle = i % 3 ? '#28263c' : '#363049';
    ctx.beginPath();
    ctx.moveTo(x - 22, 0);
    ctx.lineTo(x + 20, 0);
    ctx.lineTo(x + 7, depth);
    ctx.lineTo(x - 9, depth * 0.76);
    ctx.fill();
  }
  for (let i = 0; i < 85; i++) {
    block(ctx, (i * 181) % width, 50 + (i * 41) % 330, 3 + i % 5, 2, '#a69fb222');
  }
  floor(ctx, 45, bridge.start + 2, upperY);
  floor(ctx, bridge.end - 2, lift.x - 24, upperY);
  floor(ctx, lift.x + 23, 960, upperY);
  floor(ctx, 45, lift.x + 25, lowerY);
  block(ctx, lift.x - 22, upperY + 3, 44, lowerY - upperY - 2, '#57413d42', 0);
  for (const offset of [-20, 20]) {
    block(ctx, lift.x + offset - 1, upperY - 35, 2, lowerY - upperY + 35, '#ad86616b', 1);
  }
  block(ctx, exit - 1, upperY - 68, 52, 68, '#483a4d', 24);
  block(ctx, exit + 7, upperY - 59, 36, 58, '#201b2d', 17);
  block(ctx, 0, 378, width, 22, '#1b182a', 0);
}

function paintSwitch(ctx: Context, x: number, y: number, color: string, active: boolean) {
  if (active) glow(ctx, x, y - 18, 34, color);
  block(ctx, x - 12, y - 7, 24, 7, '#645368');
  block(ctx, x - 3, y - 25, 6, 20, '#a296a4');
  block(ctx, x - 10, y - 29, 20, 9, color, 4);
}

function paintRun(ctx: Context, run: MineView, seat: Seat) {
  const { bridge, lift, lowerY, upperY, fireflies, exit } = MINE;
  const seconds = animationSeconds(run.elapsedMs);
  for (const [switchX, targetX, y, targetY, active, color] of [
    [bridge.switchX, bridge.start, lowerY, upperY, run.bridgeOpen, '#b4f29c'],
    [lift.switchX, lift.x, upperY, minerY(run, 'left'), run.liftHeld, '#ffd189'],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(switchX, y + 3);
    ctx.lineTo(switchX, y + 20);
    ctx.lineTo(targetX, y + 20);
    ctx.lineTo(targetX, targetY + 4);
    ctx.strokeStyle = '#9185a553';
    ctx.stroke();
    if (active) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 11]);
      ctx.lineDashOffset = -seconds * 25;
      ctx.stroke();
      glow(ctx, targetX, targetY, 29, color + '66');
    }
    ctx.restore();
  }
  if (run.bridgeOpen) {
    block(ctx, bridge.start, upperY, bridge.end - bridge.start, 11, '#886548');
    for (let x = bridge.start + 3; x < bridge.end - 7; x += 13) {
      block(ctx, x, upperY, 10, 6, '#c7a471');
    }
  } else if (run.players.right.x > bridge.start) {
    block(ctx, run.players.right.x - 17, upperY, 34, 7, '#856c51');
  }
  const platformY = minerY(run, 'left');
  block(ctx, lift.x - 22, platformY, 44, 9, run.liftHeld ? '#f2bc79' : '#a48160');
  paintSwitch(ctx, bridge.switchX, lowerY, '#a7e1a0', run.bridgeOpen);
  paintSwitch(ctx, lift.switchX, upperY, '#f5bd80', run.liftHeld);

  if (run.players.left.firefly && run.players.right.firefly) glow(ctx, exit + 25, upperY - 32, 56, '#f6cd7666');
  for (const role of ['left', 'right'] as const) {
    const targetY = (role === 'left' ? lowerY : upperY) - 34;
    if (!run.players[role].firefly) {
      const x = fireflies[role] + Math.sin(seconds * 2) * 4;
      const y = targetY + Math.cos(seconds * 2.8) * 4;
      glow(ctx, x, y, 30, '#ffe086b8');
      block(ctx, x - 6, y - 5, 5, 3, '#def9dcc9');
      block(ctx, x + 1, y - 5, 5, 3, '#def9dcc9');
      block(ctx, x - 3, y - 3, 6, 7, '#fff2ae', 3);
    }
    const { x } = run.players[role];
    const y = minerY(run, role);
    const color = colors[role];
    const beam = ctx.createLinearGradient(x + 8, 0, x + 92, 0);
    beam.addColorStop(0, '#ffe5a06b');
    beam.addColorStop(1, '#ffdca300');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 26);
    ctx.lineTo(x + 92, y - 40);
    ctx.lineTo(x + 92, y + 1);
    ctx.fill();
    glow(ctx, x + 12, y - 25, 29, '#ffdc833d');
    block(ctx, x - 9, y - 19, 18, 18, color, 5);
    block(ctx, x - 10, y - 31, 20, 13, color, 6);
    block(ctx, x - 7, y - 24, 14, 6, '#3c3444', 3);
    block(ctx, x + 6, y - 28, 7, 6, '#fff0b4');
    if (role === seat) block(ctx, x - 2, y - 42, 4, 6, '#fff1ca');
  }
}

function focusX(run: MineView, seat: Seat) {
  return run.players[seat].x;
}

export function MineCanvas({ run = preview, seat, frozen = false }: { run?: MineView; seat: Seat; frozen?: boolean }) {
  return <PanoramaCanvas run={run} seat={seat} world={MINE} focusX={focusX}
    paintLayout={paintLayout} paintRun={paintRun} theme="mine-canvas" frozen={frozen} interpolate={interpolateMine} />;
}
