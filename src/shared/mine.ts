import { GAME_TICK_MS } from './game-levels.js';
import type { MineLevel } from './game-levels.js';
import { movementDirection } from './movement.js';
import type { MovementInput, MovementInputs } from './movement.js';
import type { Seat } from './protocol.js';

export const MINE = {
  width: 1000,
  height: 400,
  start: 105,
  end: 943,
  upperY: 148,
  lowerY: 316,
  bridge: { start: 308, end: 471, switchX: 266 },
  lift: { x: 674, switchX: 578, durationMs: 1400 },
  fireflies: { left: 191, right: 511 },
  fireflyRadius: 16,
  walkSpeed: 142,
  interactRange: 27,
  exit: 891,
} as const;

export const MINE2 = {
  width: 1000,
  height: 400,
  start: 105,
  end: 943,
  upperY: 148,
  lowerY: 316,
  bridge1: { start: 300, end: 455, switchX: 258 },
  bridge2: { start: 560, end: 715, switchX: 520 },
  cart: { from: 760, to: 860, switchX: 740, gateX: 860, speed: 120 },
  fireflies: { left: 820, right: 490 },
  fireflyRadius: 16,
  walkSpeed: 142,
  interactRange: 27,
  exit: 891,
} as const;

interface Miner {
  x: number;
  firefly: boolean;
}

export interface MineView {
  level: MineLevel;
  players: Record<Seat, Miner>;
  bridgeOpen: boolean;
  bridgeCrossed: boolean;
  bridge2Open: boolean;
  bridge2Crossed: boolean;
  liftHeld: boolean;
  liftProgress: number;
  cartX: number;
  cartHeld: boolean;
  gateOpen: boolean;
  finished: boolean;
  elapsedMs: number;
}

export function createMine(level: MineLevel = 'mine'): MineView {
  const start = level === 'mine2' ? MINE2.start : MINE.start;
  return {
    level,
    players: { left: { x: start, firefly: false }, right: { x: start, firefly: false } },
    bridgeOpen: false, bridgeCrossed: false, bridge2Open: false, bridge2Crossed: false,
    liftHeld: false, liftProgress: 0,
    cartX: MINE2.cart.from, cartHeld: false, gateOpen: false,
    finished: false, elapsedMs: 0,
  };
}

export function mineView(run: MineView): MineView {
  return {
    ...run,
    elapsedMs: Math.round(run.elapsedMs),
    players: { left: { ...run.players.left }, right: { ...run.players.right } },
  };
}

export function isMineView(run: { level: string } | null | undefined): run is MineView {
  return run != null && (run.level === 'mine' || run.level === 'mine2');
}

export function nearMineSwitch(playerX: number, switchX: number) {
  return Math.abs(playerX - switchX) <= MINE.interactRange;
}

export function minerY(run: MineView, seat: Seat) {
  if (run.level === 'mine2') return seat === 'right' ? MINE2.upperY : MINE2.lowerY;
  return seat === 'right' ? MINE.upperY : MINE.lowerY + (MINE.upperY - MINE.lowerY) * run.liftProgress;
}

export function minerAtExit(run: MineView, seat: Seat) {
  if (run.level === 'mine2') return run.players[seat].x >= MINE2.exit;
  return run.players[seat].x >= MINE.exit && (seat === 'right' || run.liftProgress === 1);
}

function walk(x: number, input: MovementInput, min: number, max: number) {
  const distance = movementDirection(input) * MINE.walkSpeed * GAME_TICK_MS / 1000;
  return Math.max(min, Math.min(max, x + distance));
}

export function stepMine(run: MineView, inputs: MovementInputs) {
  if (run.finished) return;
  run.elapsedMs += GAME_TICK_MS;
  if (run.level === 'mine2') return stepDoubleBridge(run, inputs);
  const { left: lower, right: upper } = run.players;
  const { bridge, lift } = MINE;

  if (run.liftProgress === 1) {
    lower.x = walk(lower.x, inputs.left, lift.x, MINE.end);
  } else if (run.liftProgress === 0) {
    lower.x = walk(lower.x, inputs.left, 60, lift.x);
  }
  run.bridgeOpen = run.bridgeCrossed || (inputs.left.interact && nearMineSwitch(lower.x, bridge.switchX));
  if (run.bridgeOpen) {
    const end = run.liftProgress === 1 ? MINE.end : lift.x - 24;
    upper.x = walk(upper.x, inputs.right, 60, end);
  } else if (upper.x <= bridge.start) {
    upper.x = walk(upper.x, inputs.right, 60, bridge.start);
  }
  // If the bridge is released mid-crossing, the upper player waits at that spot.
  if (upper.x >= bridge.end) run.bridgeCrossed = true;

  run.liftHeld = run.bridgeCrossed && run.liftProgress < 1
    && inputs.right.interact && nearMineSwitch(upper.x, lift.switchX);
  if (lower.x === lift.x && run.liftHeld) {
    run.liftProgress = Math.min(1, run.liftProgress + GAME_TICK_MS / lift.durationMs);
  }

  if (Math.abs(lower.x - MINE.fireflies.left) < MINE.fireflyRadius) lower.firefly = true;
  if (Math.abs(upper.x - MINE.fireflies.right) < MINE.fireflyRadius) upper.firefly = true;
  run.finished = minerAtExit(run, 'left') && minerAtExit(run, 'right') && lower.firefly && upper.firefly;
}

// Each seat holds a switch for the other: lower opens the upper bridge, then upper opens the lower bridge.
// The upper tail is a cart gap only the lower switch can drive, and the lower exit gate needs both fireflies.
function stepDoubleBridge(run: MineView, inputs: MovementInputs) {
  const { left: lower, right: upper } = run.players;
  const { bridge1, bridge2, cart, fireflies, end } = MINE2;

  run.bridgeOpen = run.bridgeCrossed || (inputs.left.interact && nearMineSwitch(lower.x, bridge1.switchX));
  if (run.bridgeOpen) {
    upper.x = walk(upper.x, inputs.right, 60, end);
  } else if (upper.x <= bridge1.start) {
    upper.x = walk(upper.x, inputs.right, 60, bridge1.start);
  }
  if (upper.x >= bridge1.end) run.bridgeCrossed = true;

  run.bridge2Open = run.bridge2Crossed || (inputs.right.interact && nearMineSwitch(upper.x, bridge2.switchX));
  if (run.bridge2Open) {
    lower.x = walk(lower.x, inputs.left, 60, end);
  } else if (lower.x <= bridge2.start) {
    lower.x = walk(lower.x, inputs.left, 60, bridge2.start);
  }
  if (lower.x >= bridge2.end) run.bridge2Crossed = true;

  if (Math.abs(lower.x - fireflies.left) < MINE2.fireflyRadius) lower.firefly = true;
  if (Math.abs(upper.x - fireflies.right) < MINE2.fireflyRadius) upper.firefly = true;
  run.gateOpen = lower.firefly && upper.firefly;
  if (!run.gateOpen && lower.x > cart.gateX) lower.x = cart.gateX;

  const aboard = upper.x >= cart.from - 2;
  run.cartHeld = aboard && upper.x <= run.cartX + 24
    && inputs.left.interact && nearMineSwitch(lower.x, cart.switchX);
  if (run.cartHeld) run.cartX = Math.min(cart.to, run.cartX + cart.speed * GAME_TICK_MS / 1000);
  if (aboard && run.cartX < cart.to) {
    upper.x = run.cartX;
  } else if (run.bridgeOpen) {
    upper.x = walk(upper.x, inputs.right, 60, run.cartX >= cart.to ? end : cart.from);
  }

  run.finished = minerAtExit(run, 'left') && minerAtExit(run, 'right') && lower.firefly && upper.firefly;
}