import { useCallback, useRef } from 'react';
import { createMine, minerY, MINE, MINE2 } from '../shared/mine.js';
import type { MineView } from '../shared/mine.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { BuddyLooks } from '../shared/buddy.js';
import type { Seat } from '../shared/protocol.js';
import { buddyScale, CHAPTER_OUTFIT, paintBuddy } from './buddy.js';
import { PanoramaCanvas } from './panorama-canvas.js';
import { interpolateMine } from './panorama-motion.js';
import { animationSeconds, halo as glow, polygon } from './scenery.js';

type Context = CanvasRenderingContext2D;
const preview = createMine();

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

function caveBackdrop(ctx: Context, width: number, height: number, lowerY: number) {
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
}

function doorway(ctx: Context, exit: number, y: number) {
  block(ctx, exit - 1, y - 68, 52, 68, '#483a4d', 24);
  block(ctx, exit + 7, y - 59, 36, 58, '#201b2d', 17);
}

function paintSwitch(ctx: Context, x: number, y: number, color: string, active: boolean) {
  if (active) glow(ctx, x, y - 18, 34, color);
  block(ctx, x - 12, y - 7, 24, 7, '#645368');
  block(ctx, x - 3, y - 25, 6, 20, '#a296a4');
  block(ctx, x - 10, y - 29, 20, 9, color, 4);
}

function cable(ctx: Context, switchX: number, targetX: number, y: number, targetY: number,
  active: boolean, color: string, seconds: number) {
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

function planks(ctx: Context, from: number, to: number, y: number) {
  block(ctx, from, y, to - from, 11, '#886548');
  for (let x = from + 3; x < to - 7; x += 13) {
    block(ctx, x, y, 10, 6, '#c7a471');
  }
}

function firefly(ctx: Context, x: number, y: number, seconds: number) {
  const fx = x + Math.sin(seconds * 2) * 4;
  const fy = y + Math.cos(seconds * 2.8) * 4;
  glow(ctx, fx, fy, 30, '#ffe086b8');
  block(ctx, fx - 6, fy - 5, 5, 3, '#def9dcc9');
  block(ctx, fx + 1, fy - 5, 5, 3, '#def9dcc9');
  block(ctx, fx - 3, fy - 3, 6, 7, '#fff2ae', 3);
}

type MinerMotion = Record<Seat, number | null>;

function paintMinerBuddy(ctx: Context, run: MineView, role: Seat, seat: Seat, looks: BuddyLooks, seconds: number, lastX: MinerMotion) {
  const x = run.players[role].x;
  const previous = lastX[role];
  const moving = previous !== null && Math.abs(x - previous) > 0.15;
  lastX[role] = x;
  paintBuddy(ctx, {
    x, feet: minerY(run, role), scale: buddyScale(looks[role].size),
    appearance: looks[role], outfit: CHAPTER_OUTFIT.mine,
    pose: moving ? 'walk' : 'idle', phase: (seconds * 1.6) % 1, seconds,
    tag: looks[role].name, tagColor: role === seat ? '#e8503ae6' : '#3a3355e6',
  });
}

function paintMineLayout(ctx: Context) {
  const { width, height, bridge, lift, upperY, lowerY, exit } = MINE;
  caveBackdrop(ctx, width, height, lowerY);
  floor(ctx, 45, bridge.start + 2, upperY);
  floor(ctx, bridge.end - 2, lift.x - 24, upperY);
  floor(ctx, lift.x + 23, 960, upperY);
  floor(ctx, 45, lift.x + 25, lowerY);
  block(ctx, lift.x - 22, upperY + 3, 44, lowerY - upperY - 2, '#57413d42', 0);
  for (const offset of [-20, 20]) {
    block(ctx, lift.x + offset - 1, upperY - 35, 2, lowerY - upperY + 35, '#ad86616b', 1);
  }
  doorway(ctx, exit, upperY);
  block(ctx, 0, 378, width, 22, '#1b182a', 0);
}

function paintMineRun(ctx: Context, run: MineView, seat: Seat, looks: BuddyLooks, lastX: MinerMotion) {
  const { bridge, lift, lowerY, upperY, fireflies, exit } = MINE;
  const seconds = animationSeconds(run.elapsedMs);
  cable(ctx, bridge.switchX, bridge.start, lowerY, upperY, run.bridgeOpen, '#b4f29c', seconds);
  cable(ctx, lift.switchX, lift.x, upperY, minerY(run, 'left'), run.liftHeld, '#ffd189', seconds);
  if (run.bridgeOpen) {
    planks(ctx, bridge.start, bridge.end, upperY);
  } else if (run.players.right.x > bridge.start) {
    block(ctx, run.players.right.x - 17, upperY, 34, 7, '#856c51');
  }
  const platformY = minerY(run, 'left');
  block(ctx, lift.x - 22, platformY, 44, 9, run.liftHeld ? '#f2bc79' : '#a48160');
  paintSwitch(ctx, bridge.switchX, lowerY, '#a7e1a0', run.bridgeOpen);
  paintSwitch(ctx, lift.switchX, upperY, '#f5bd80', run.liftHeld);

  if (run.players.left.firefly && run.players.right.firefly) glow(ctx, exit + 25, upperY - 32, 56, '#f6cd7666');
  for (const role of ['left', 'right'] as const) {
    if (!run.players[role].firefly) {
      firefly(ctx, fireflies[role], (role === 'left' ? lowerY : upperY) - 34, seconds);
    }
    paintMinerBuddy(ctx, run, role, seat, looks, seconds, lastX);
  }
}

function paintMine2Layout(ctx: Context) {
  const { width, height, bridge1, bridge2, cart, upperY, lowerY, exit } = MINE2;
  caveBackdrop(ctx, width, height, lowerY);
  floor(ctx, 45, bridge1.start + 2, upperY);
  floor(ctx, bridge1.end - 2, cart.from + 2, upperY);
  floor(ctx, cart.to - 2, 960, upperY);
  block(ctx, cart.from, upperY + 4, cart.to - cart.from, 3, '#ad866188', 1);
  for (let x = cart.from + 6; x < cart.to - 6; x += 18) block(ctx, x, upperY + 7, 8, 3, '#8a6a4a', 1);
  floor(ctx, 45, bridge2.start + 2, lowerY);
  floor(ctx, bridge2.end - 2, 960, lowerY);
  doorway(ctx, exit, upperY);
  doorway(ctx, exit, lowerY);
  block(ctx, 0, 378, width, 22, '#1b182a', 0);
}

function paintMine2Run(ctx: Context, run: MineView, seat: Seat, looks: BuddyLooks, lastX: MinerMotion) {
  const { bridge1, bridge2, cart, lowerY, upperY, fireflies, exit } = MINE2;
  const seconds = animationSeconds(run.elapsedMs);
  cable(ctx, bridge1.switchX, bridge1.start, lowerY, upperY, run.bridgeOpen, '#b4f29c', seconds);
  cable(ctx, bridge2.switchX, bridge2.start, upperY, lowerY, run.bridge2Open, '#ffd189', seconds);
  if (run.bridgeOpen) {
    planks(ctx, bridge1.start, bridge1.end, upperY);
  } else if (run.players.right.x > bridge1.start) {
    block(ctx, run.players.right.x - 17, upperY, 34, 7, '#856c51');
  }
  if (run.bridge2Open) {
    planks(ctx, bridge2.start, bridge2.end, lowerY);
  } else if (run.players.left.x > bridge2.start) {
    block(ctx, run.players.left.x - 17, lowerY, 34, 7, '#856c51');
  }
  paintSwitch(ctx, bridge1.switchX, lowerY, '#a7e1a0', run.bridgeOpen);
  paintSwitch(ctx, bridge2.switchX, upperY, '#f5bd80', run.bridge2Open);
  cable(ctx, cart.switchX, run.cartX, lowerY, upperY, run.cartHeld, '#8fe3ff', seconds);
  paintSwitch(ctx, cart.switchX, lowerY, '#8fe3ff', run.cartHeld);
  block(ctx, run.cartX - 24, upperY - 13, 48, 13, '#8a6a4a', 3);
  block(ctx, run.cartX - 24, upperY - 13, 48, 4, '#c7a471', 2);
  for (const offset of [-14, 14]) block(ctx, run.cartX + offset - 4, upperY - 2, 8, 6, '#3c3444', 3);
  const gateSlide = run.gateOpen ? 26 : 0;
  block(ctx, cart.gateX - 10 - gateSlide, lowerY - 58, 10, 58, '#7fe6bb88', 3);
  block(ctx, cart.gateX + gateSlide, lowerY - 58, 10, 58, '#7fe6bb88', 3);
  if (run.gateOpen) glow(ctx, cart.gateX, lowerY - 30, 40, '#7fe6bb44');

  if (run.players.left.firefly && run.players.right.firefly) {
    glow(ctx, exit + 25, upperY - 32, 56, '#f6cd7666');
    glow(ctx, exit + 25, lowerY - 32, 56, '#f6cd7666');
  }
  for (const role of ['left', 'right'] as const) {
    if (!run.players[role].firefly) {
      firefly(ctx, fireflies[role], (role === 'left' ? lowerY : upperY) - 34, seconds);
    }
    paintMinerBuddy(ctx, run, role, seat, looks, seconds, lastX);
  }
}

const paintLayouts = { mine: paintMineLayout, mine2: paintMine2Layout };

function focusX(run: MineView, seat: Seat) {
  return run.players[seat].x;
}

export function MineCanvas({ run = preview, seat, frozen = false, looks = DEFAULT_APPEARANCE }: {
  run?: MineView; seat: Seat; frozen?: boolean; looks?: BuddyLooks;
}) {
  const motion = useRef<{ level: MineView['level'] | null; lastX: MinerMotion }>({ level: null, lastX: { left: null, right: null } });
  const paintRun = useCallback((ctx: Context, view: MineView, viewSeat: Seat, viewLooks: BuddyLooks) => {
    const state = motion.current;
    if (state.level !== view.level) {
      state.level = view.level;
      state.lastX = { left: null, right: null };
    }
    (view.level === 'mine2' ? paintMine2Run : paintMineRun)(ctx, view, viewSeat, viewLooks, state.lastX);
  }, []);
  return <PanoramaCanvas run={run} seat={seat} world={run.level === 'mine2' ? MINE2 : MINE} focusX={focusX}
    paintLayout={paintLayouts[run.level]} paintRun={paintRun} theme="mine-canvas" frozen={frozen}
    interpolate={interpolateMine} looks={looks} />;
}