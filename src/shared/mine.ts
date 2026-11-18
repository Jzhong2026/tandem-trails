import { GAME_TICK_MS } from './game-levels.js';
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

interface Miner {
  x: number;
  firefly: boolean;
}

export interface MineView {
  level: 'mine';
  players: Record<Seat, Miner>;
  bridgeOpen: boolean;
  bridgeCrossed: boolean;
  liftHeld: boolean;
  liftProgress: number;
  finished: boolean;
  elapsedMs: number;
}

export function createMine(): MineView {
  return {
    level: 'mine',
    players: { left: { x: MINE.start, firefly: false }, right: { x: MINE.start, firefly: false } },
    bridgeOpen: false, bridgeCrossed: false, liftHeld: false, liftProgress: 0,
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

export function nearMineSwitch(playerX: number, switchX: number) {
  return Math.abs(playerX - switchX) <= MINE.interactRange;
}

export function minerY(run: MineView, seat: Seat) {
  return seat === 'right' ? MINE.upperY : MINE.lowerY + (MINE.upperY - MINE.lowerY) * run.liftProgress;
}

export function minerAtExit(run: MineView, seat: Seat) {
  return run.players[seat].x >= MINE.exit && (seat === 'right' || run.liftProgress === 1);
}

function walk(x: number, input: MovementInput, min: number, max: number) {
  const distance = movementDirection(input) * MINE.walkSpeed * GAME_TICK_MS / 1000;
  return Math.max(min, Math.min(max, x + distance));
}

export function stepMine(run: MineView, inputs: MovementInputs) {
  if (run.finished) return;
  run.elapsedMs += GAME_TICK_MS;
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
