import { GAME_TICK_MS } from './game-levels.js';
import type { EggLevel } from './game-levels.js';
import { movementDirection } from './movement.js';
import type { MovementInputs } from './movement.js';
import type { Seat } from './protocol.js';

export interface EggSlope { from: number; to: number; low: Seat; pad: number }
export interface EggWind { from: number; to: number; dir: 1 | -1; pad: number; gustPeriodMs?: number }
export interface EggLayout {
  width: number;
  height: number;
  start: number;
  exit: number;
  groundY: number;
  summitHeight: number;
  carrySpeed: number;
  rollRate: number;
  settleRate: number;
  recoveryMs: number;
  slopes: readonly EggSlope[];
  winds: readonly EggWind[];
  ice?: { from: number; to: number };
}

export const WIND = { tilt: 1.6, speed: .62 } as const;

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
  winds: [],
} as const satisfies EggLayout;

export const EGG2 = {
  width: 1000,
  height: 400,
  start: 105,
  exit: 940,
  groundY: 296,
  summitHeight: 72,
  carrySpeed: 126,
  rollRate: .92,
  settleRate: 3.5,
  recoveryMs: 750,
  slopes: [
    { from: 235, to: 395, low: 'left', pad: 180 },
    { from: 600, to: 760, low: 'right', pad: 545 },
  ],
  winds: [
    { from: 430, to: 560, dir: 1, pad: 410, gustPeriodMs: 2600 },
    { from: 800, to: 905, dir: -1, pad: 780, gustPeriodMs: 2600 },
  ],
  ice: { from: 560, to: 600 },
} as const satisfies EggLayout;

export const EGG_LAYOUTS: Record<EggLevel, EggLayout> = { egg: EGG, egg2: EGG2 };

export interface EggView {
  level: EggLevel;
  x: number;
  roll: number;
  tilt: number;
  drops: number;
  checkpoint: number;
  raised: { left: boolean; right: boolean };
  velocity: number;
  recoveryMs: number;
  finished: boolean;
  elapsedMs: number;
}

export function createEgg(level: EggLevel = 'egg'): EggView {
  const start = EGG_LAYOUTS[level].start;
  return {
    level, x: start, roll: 0, tilt: 0, drops: 0, checkpoint: start,
    raised: { left: false, right: false }, velocity: 0, recoveryMs: 0, finished: false, elapsedMs: 0,
  };
}

export function eggView(run: EggView): EggView {
  return { ...run, raised: { ...run.raised }, elapsedMs: Math.round(run.elapsedMs) };
}

export function isEggView(run: { level: string } | null | undefined): run is EggView {
  return run != null && (run.level === 'egg' || run.level === 'egg2');
}

export function eggSlope(x: number, level: EggLevel = 'egg') {
  return EGG_LAYOUTS[level].slopes.find(slope => x >= slope.from && x < slope.to);
}

export function eggWind(x: number, level: EggLevel = 'egg') {
  return EGG_LAYOUTS[level].winds.find(wind => x >= wind.from && x < wind.to);
}

export function eggWindDir(wind: EggWind, elapsedMs: number): 1 | -1 {
  if (!wind.gustPeriodMs) return wind.dir;
  return Math.floor(elapsedMs / wind.gustPeriodMs) % 2 === 0 ? wind.dir : (wind.dir === 1 ? -1 : 1);
}

export function eggWindward(wind: EggWind, elapsedMs: number): Seat {
  return eggWindDir(wind, elapsedMs) === 1 ? 'left' : 'right';
}

export function eggGroundY(x: number, level: EggLevel = 'egg') {
  const [up, down] = EGG_LAYOUTS[level].slopes;
  const ascent = Math.max(0, Math.min(1, (x - up.from) / (up.to - up.from)));
  const descent = Math.max(0, Math.min(1, (x - down.from) / (down.to - down.from)));
  return EGG_LAYOUTS[level].groundY - EGG_LAYOUTS[level].summitHeight * (ascent - descent);
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

  const layout = EGG_LAYOUTS[run.level];
  const slope = eggSlope(run.x, run.level);
  const wind = eggWind(run.x, run.level);
  const braced = run.raised.left && run.raised.right;
  const slopeTilt = slope ? (slope.low === 'left' ? 1 : -1) : 0;
  // A steady wind gap needs both players bracing; a gusting one needs only the windward end lifting
  // while the leeward end rests, so the pair must call out the flipping direction and trade turns.
  const gustDir = wind ? eggWindDir(wind, run.elapsedMs) : 0;
  const windward = wind ? eggWindward(wind, run.elapsedMs) : 'left';
  const leeward = windward === 'left' ? 'right' : 'left';
  const steady = wind
    ? (wind.gustPeriodMs ? run.raised[windward] && !run.raised[leeward] : braced)
    : false;
  run.tilt = wind ? (steady ? 0 : gustDir * WIND.tilt)
    : slopeTilt + Number(run.raised.right) - Number(run.raised.left);
  const direction = movementDirection(inputs.left);
  const sameDir = direction && direction === movementDirection(inputs.right) ? direction : 0;
  const pace = layout.carrySpeed * (wind && steady ? WIND.speed : 1);
  const onIce = layout.ice != null && run.x >= layout.ice.from && run.x < layout.ice.to;
  if (onIce) {
    const target = sameDir * pace;
    run.velocity += (target - run.velocity) * Math.min(1, (sameDir ? 6 : 3) * seconds);
    const x = Math.max(layout.start, Math.min(layout.exit, run.x + run.velocity * seconds));
    if (x !== run.x) run.roll += run.tilt * layout.rollRate * seconds;
    run.x = x;
  } else {
    run.velocity = 0;
    if (sameDir) {
      const x = Math.max(layout.start, Math.min(layout.exit, run.x + sameDir * pace * seconds));
      if (x !== run.x) run.roll += run.tilt * layout.rollRate * seconds;
      run.x = x;
    }
  }
  // A level stretcher can settle even while the players stop to coordinate.
  if (run.tilt === 0) run.roll *= 1 - layout.settleRate * seconds;
  const pad = [...layout.slopes, ...layout.winds].findLast(section => section.pad <= run.x)?.pad;
  if (pad !== undefined) run.checkpoint = Math.max(run.checkpoint, pad);
  if (Math.abs(run.roll) >= 1) {
    run.x = run.checkpoint;
    run.roll = 0;
    run.tilt = 0;
    run.drops++;
    run.recoveryMs = layout.recoveryMs;
    return;
  }
  run.finished = run.x === layout.exit;
}