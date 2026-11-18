export const RIVER_TICK_MS = 1000 / 30;
export type Paddles = [left: boolean, right: boolean];

export const RIVER = {
  width: 1000,
  height: 400,
  banks: { top: 52, bottom: 348 },
  start: { x: 105, y: 200 },
  bendCheckpoint: { x: 449, y: 230 },
  rescueCheckpoint: { x: 769, y: 200 },
  duck: { x: 741, y: 200, radius: 45 },
  dock: { x: 881, y: 200, radius: 47 },
  logs: [
    { x: 313, y: 129, rx: 47, ry: 76 },
    { x: 582, y: 276, rx: 47, ry: 77 },
  ],
} as const;

export interface RiverView {
  x: number;
  y: number;
  heading: number;
  rescued: boolean;
  finished: boolean;
  collisions: number;
  elapsedMs: number;
  recoveryMs: number;
}

export interface RiverRun extends RiverView {
  checkpoint: { x: number; y: number };
}

export function createRiverRun(): RiverRun {
  return {
    ...RIVER.start, checkpoint: RIVER.start, heading: 0, rescued: false,
    finished: false, collisions: 0, elapsedMs: 0, recoveryMs: 0,
  };
}

export function riverView(run: RiverRun): RiverView {
  return {
    x: run.x, y: run.y, heading: run.heading, rescued: run.rescued,
    finished: run.finished, collisions: run.collisions,
    elapsedMs: Math.round(run.elapsedMs), recoveryMs: Math.round(run.recoveryMs),
  };
}

const stepSeconds = RIVER_TICK_MS / 1000;
const boatRadius = 15;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function stepRiver(run: RiverRun, [left, right]: Paddles) {
  if (run.finished) return;
  run.elapsedMs += RIVER_TICK_MS;
  if (run.recoveryMs > 0) {
    run.recoveryMs = Math.max(0, run.recoveryMs - RIVER_TICK_MS);
    return;
  }

  if (left !== right) {
    const turn = (left ? 1 : -1) * 2.15 * stepSeconds;
    run.heading = clamp(run.heading + turn, -0.78, 0.78);
    return;
  }
  if (!left) return;

  const distance = 126 * stepSeconds;
  const endX = run.rescued ? RIVER.dock.x + 20 : RIVER.duck.x + 19;
  run.x = Math.min(endX, run.x + distance * Math.cos(run.heading));
  run.y = clamp(run.y + distance * Math.sin(run.heading),
    RIVER.banks.top + boatRadius, RIVER.banks.bottom - boatRadius);

  const hitLog = RIVER.logs.some(log =>
    ((run.x - log.x) / (log.rx + boatRadius)) ** 2
      + ((run.y - log.y) / (log.ry + boatRadius)) ** 2 <= 1);
  if (hitLog) {
    run.x = run.checkpoint.x;
    run.y = run.checkpoint.y;
    run.heading = 0;
    run.collisions++;
    run.recoveryMs = 800;
    return;
  }

  if (!run.rescued && run.x >= RIVER.bendCheckpoint.x) run.checkpoint = RIVER.bendCheckpoint;
  if (!run.rescued && Math.hypot(run.x - RIVER.duck.x, run.y - RIVER.duck.y) <= RIVER.duck.radius) {
    run.rescued = true;
    run.checkpoint = RIVER.rescueCheckpoint;
  }
  if (run.rescued && Math.hypot(run.x - RIVER.dock.x, run.y - RIVER.dock.y) <= RIVER.dock.radius) {
    run.finished = true;
  }
}
