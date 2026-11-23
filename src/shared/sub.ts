import { GAME_TICK_MS } from './game-levels.js';
import type { SubLevel } from './game-levels.js';
import { movementDirection } from './movement.js';
import type { MovementInputs } from './movement.js';

export const SUB = {
  width: 1000,
  height: 400,
  surface: 52,
  seabed: 348,
  start: { x: 105, y: 200 },
  dock: { x: 900, y: 200, radius: 52 },
  radius: 16,
  diveSpeed: 110,
  cruiseSpeed: 126,
  recoveryMs: 800,
  reefs: [
    { x: 300, y: 118, rx: 42, ry: 112 },
    { x: 520, y: 302, rx: 42, ry: 102 },
    { x: 700, y: 88, rx: 36, ry: 72 },
    { x: 700, y: 342, rx: 36, ry: 62 },
  ],
  bubbles: [{ x: 400, y: 288 }, { x: 610, y: 140 }],
  bubbleRadius: 34,
  seahorse: { x: 790, y: 212, radius: 42 },
  buoys: [{ x: 200, y: 200 }, { x: 430, y: 200 }, { x: 620, y: 200 }],
  currents: [
    { x: 430, y: 210, rx: 80, ry: 90, pushX: 70, pushY: 0 },
    { x: 640, y: 150, rx: 70, ry: 80, pushX: 0, pushY: 60 },
  ],
  tentacle: { x: 760, y: 200, rx: 18, ry: 160, periodMs: 3200, openMs: 1400 },
} as const;

export interface SubView {
  level: SubLevel;
  x: number;
  y: number;
  checkpoint: { x: number; y: number };
  bubbles: [boolean, boolean];
  rescued: boolean;
  finished: boolean;
  collisions: number;
  elapsedMs: number;
  recoveryMs: number;
}

export function createSub(level: SubLevel = 'sub'): SubView {
  return {
    level, ...SUB.start, checkpoint: { ...SUB.start },
    bubbles: [false, false], rescued: false, finished: false,
    collisions: 0, elapsedMs: 0, recoveryMs: 0,
  };
}

export function subView(run: SubView): SubView {
  return {
    ...run,
    checkpoint: { ...run.checkpoint },
    bubbles: [run.bubbles[0], run.bubbles[1]],
    elapsedMs: Math.round(run.elapsedMs),
    recoveryMs: Math.round(run.recoveryMs),
  };
}

export function isSubView(run: { level: string } | null | undefined): run is SubView {
  return run != null && run.level === 'sub';
}

const seconds = GAME_TICK_MS / 1000;

export function tentacleOpen(elapsedMs: number) {
  return elapsedMs % SUB.tentacle.periodMs < SUB.tentacle.openMs;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function near(run: SubView, target: { x: number; y: number }, radius: number) {
  return Math.hypot(run.x - target.x, run.y - target.y) <= radius;
}

// The left seat pilots depth and the right seat pilots thrust; neither axis moves without its own pilot.
export function stepSub(run: SubView, inputs: MovementInputs) {
  if (run.finished) return;
  run.elapsedMs += GAME_TICK_MS;
  if (run.recoveryMs > 0) {
    run.recoveryMs = Math.max(0, run.recoveryMs - GAME_TICK_MS);
    return;
  }

  const dive = movementDirection(inputs.left);
  const thrust = movementDirection(inputs.right);
  run.x = clamp(run.x + thrust * SUB.cruiseSpeed * seconds, 60, SUB.width - 40);
  run.y = clamp(run.y + dive * SUB.diveSpeed * seconds, SUB.surface + SUB.radius, SUB.seabed - SUB.radius);
  for (const current of SUB.currents) {
    if (((run.x - current.x) / current.rx) ** 2 + ((run.y - current.y) / current.ry) ** 2 <= 1) {
      run.x = clamp(run.x + current.pushX * seconds * (thrust === 0 ? 1 : 0), 60, SUB.width - 40);
      run.y = clamp(run.y + current.pushY * seconds * (dive === 0 ? 1 : 0), SUB.surface + SUB.radius, SUB.seabed - SUB.radius);
    }
  }

  const hitReef = SUB.reefs.some(reef =>
    ((run.x - reef.x) / (reef.rx + SUB.radius)) ** 2
    + ((run.y - reef.y) / (reef.ry + SUB.radius)) ** 2 <= 1)
    || (!tentacleOpen(run.elapsedMs)
      && ((run.x - SUB.tentacle.x) / (SUB.tentacle.rx + SUB.radius)) ** 2
      + ((run.y - SUB.tentacle.y) / (SUB.tentacle.ry + SUB.radius)) ** 2 <= 1);
  if (hitReef) {
    run.x = run.checkpoint.x;
    run.y = run.checkpoint.y;
    run.collisions++;
    run.recoveryMs = SUB.recoveryMs;
    return;
  }

  for (const buoy of SUB.buoys) {
    if (run.x >= buoy.x && buoy.x > run.checkpoint.x) run.checkpoint = { ...buoy };
  }
  SUB.bubbles.forEach((bubble, index) => {
    if (!run.bubbles[index] && near(run, bubble, SUB.bubbleRadius)) run.bubbles[index] = true;
  });
  if (!run.rescued && near(run, SUB.seahorse, SUB.seahorse.radius)) {
    run.rescued = true;
    run.checkpoint = { x: SUB.seahorse.x + 28, y: SUB.seahorse.y };
  }
  run.finished = run.rescued && run.bubbles[0] && run.bubbles[1] && near(run, SUB.dock, SUB.dock.radius);
}