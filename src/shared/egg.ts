import { GAME_TICK_MS } from './game-levels.js';
import { movementDirection } from './movement.js';
import type { MovementInputs } from './movement.js';

export const EGG = {
  width: 1000,
  height: 400,
  start: 105,
  exit: 895,
  groundY: 296,
  summitHeight: 72,
  carrySpeed: 126,
  rollRate: .92,
  settleRate: 3.5,
  recoveryMs: 750,
  slopes: [
    { from: 255, to: 430, low: 'left', pad: 204 },
    { from: 620, to: 805, low: 'right', pad: 566 },
  ],
} as const;

export interface EggView {
  level: 'egg';
  x: number;
  roll: number;
  tilt: number;
  drops: number;
  checkpoint: number;
  raised: { left: boolean; right: boolean };
  recoveryMs: number;
  finished: boolean;
  elapsedMs: number;
}

export function createEgg(): EggView {
  return {
    level: 'egg', x: EGG.start, roll: 0, tilt: 0, drops: 0, checkpoint: EGG.start,
    raised: { left: false, right: false }, recoveryMs: 0, finished: false, elapsedMs: 0,
  };
}

export function eggView(run: EggView): EggView {
  return { ...run, raised: { ...run.raised }, elapsedMs: Math.round(run.elapsedMs) };
}

export function eggSlope(x: number) {
  return EGG.slopes.find(slope => x >= slope.from && x < slope.to);
}

export function eggGroundY(x: number) {
  const [up, down] = EGG.slopes;
  const ascent = Math.max(0, Math.min(1, (x - up.from) / (up.to - up.from)));
  const descent = Math.max(0, Math.min(1, (x - down.from) / (down.to - down.from)));
  return EGG.groundY - EGG.summitHeight * (ascent - descent);
}

const seconds = GAME_TICK_MS / 1000;

export function stepEgg(run: EggView, inputs: MovementInputs) {
  if (run.finished) return;
  run.elapsedMs += GAME_TICK_MS;
  run.raised = { left: inputs.left.interact, right: inputs.right.interact };
  if (run.recoveryMs > 0) {
    run.recoveryMs = Math.max(0, run.recoveryMs - GAME_TICK_MS);
    return;
  }

  const slope = eggSlope(run.x);
  const slopeTilt = slope ? (slope.low === 'left' ? 1 : -1) : 0;
  run.tilt = slopeTilt + Number(run.raised.right) - Number(run.raised.left);
  const direction = movementDirection(inputs.left);
  if (direction && direction === movementDirection(inputs.right)) {
    const x = Math.max(EGG.start, Math.min(EGG.exit, run.x + direction * EGG.carrySpeed * seconds));
    if (x !== run.x) run.roll += run.tilt * EGG.rollRate * seconds;
    run.x = x;
  }
  // A level stretcher can settle even while the players stop to coordinate.
  if (run.tilt === 0) run.roll *= 1 - EGG.settleRate * seconds;
  const pad = EGG.slopes.findLast(section => section.pad <= run.x)?.pad;
  if (pad !== undefined) run.checkpoint = Math.max(run.checkpoint, pad);
  if (Math.abs(run.roll) >= 1) {
    run.x = run.checkpoint;
    run.roll = 0;
    run.tilt = 0;
    run.drops++;
    run.recoveryMs = EGG.recoveryMs;
    return;
  }
  run.finished = run.x === EGG.exit;
}
