import { GAME_TICK_MS } from './game-levels.js';
import { FOG_FLAGS, FOG_GATE, RIVER_COURSES, RIVER_SIZE } from './river-levels.js';
import type { FogLayout, Raft, RiverLevel } from './river-levels.js';

export type Paddles = [left: boolean, right: boolean];

export interface RiverView {
  level: RiverLevel;
  x: number;
  y: number;
  heading: number;
  rescued: boolean;
  finished: boolean;
  collisions: number;
  elapsedMs: number;
  recoveryMs: number;
  recovery: 'logs' | 'shoal' | null;
  practice: Paddles | null;
  pastFog: boolean;
  wrongFlag: boolean;
}

export interface RiverRun extends RiverView {
  checkpoint: { x: number; y: number };
  fog: (FogLayout & { shared: Paddles }) | null;
  practiceHold: { index: 0 | 1; ticks: number } | null;
}

export function initialRiverView(level: RiverLevel): RiverView {
  return {
    level, ...RIVER_COURSES[level].start, heading: 0, rescued: false,
    finished: false, collisions: 0, elapsedMs: 0, recoveryMs: 0,
    recovery: null, practice: level === 'practice' ? [false, false] : null,
    pastFog: false, wrongFlag: false,
  };
}

export function createRiverRun(level: RiverLevel = 'bend', layout?: FogLayout): RiverRun {
  if (level === 'fog' && !layout) throw new Error('Fog level requires a rescue layout');
  return {
    ...initialRiverView(level),
    checkpoint: RIVER_COURSES[level].start,
    fog: level === 'fog' && layout ? { ...layout, shared: [false, false] } : null,
    practiceHold: null,
  };
}

export function riverView(run: RiverRun): RiverView {
  return {
    level: run.level, x: run.x, y: run.y, heading: run.heading, rescued: run.rescued,
    finished: run.finished, collisions: run.collisions,
    elapsedMs: Math.round(run.elapsedMs), recoveryMs: Math.round(run.recoveryMs),
    recovery: run.recovery, practice: run.practice ? [...run.practice] : null,
    pastFog: run.pastFog, wrongFlag: run.wrongFlag,
  };
}

const stepSeconds = GAME_TICK_MS / 1000;
const boatRadius = 15;
const practiceHoldTicks = 5;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function near(run: RiverRun, target: { x: number; y: number; radius: number }) {
  return Math.hypot(run.x - target.x, run.y - target.y) <= target.radius;
}

function resetAtCheckpoint(run: RiverRun, reason: 'logs' | 'shoal') {
  run.x = run.checkpoint.x;
  run.y = run.checkpoint.y;
  run.heading = 0;
  run.collisions++;
  run.recoveryMs = 800;
  run.recovery = reason;
}

export function raftY(raft: Raft, elapsedMs: number) {
  return raft.y + Math.sin(elapsedMs / 1000 * raft.speed + raft.phase) * raft.range;
}

export function stepRiver(run: RiverRun, [left, right]: Paddles) {
  if (run.finished) return;
  run.elapsedMs += GAME_TICK_MS;
  if (run.recoveryMs > 0) {
    run.recoveryMs = Math.max(0, run.recoveryMs - GAME_TICK_MS);
    if (run.recoveryMs === 0) run.recovery = null;
    return;
  }

  const course = RIVER_COURSES[run.level];
  const { banks } = RIVER_SIZE;
  const resist = left && right ? 1 : left || right ? 0.5 : 0;
  for (const current of course.currents ?? []) {
    if (((run.x - current.x) / current.rx) ** 2 + ((run.y - current.y) / current.ry) ** 2 <= 1) {
      run.y = clamp(run.y + current.pushY * stepSeconds * (1 - resist), banks.top + boatRadius, banks.bottom - boatRadius);
    }
  }

  const learning = run.practice && !run.practice.every(Boolean);
  if (left !== right) {
    const turn = (left ? 1 : -1) * 2.15 * stepSeconds;
    run.heading = clamp(run.heading + turn, -0.78, 0.78);
    if (learning && run.practice) {
      const index = left ? 0 : 1;
      const ticks = run.practiceHold?.index === index ? run.practiceHold.ticks + 1 : 1;
      run.practiceHold = { index, ticks };
      if (ticks >= practiceHoldTicks) {
        run.practice[index] = true;
        if (run.practice.every(Boolean)) run.heading = 0;
      }
    }
    return;
  }
  run.practiceHold = null;
  if (!left || learning) return;

  // The training boat starts aligned even if one player presses a little early.
  if (run.practice && run.x === course.start.x) run.heading = 0;
  const fog = run.fog;
  const rescue = fog ? FOG_FLAGS[fog.flag] : course.duck;
  const target = !run.rescued && rescue ? rescue : course.dock;
  const distance = 126 * stepSeconds;
  const endX = fog && !fog.shared.every(Boolean) ? FOG_GATE.stagingX : target.x + 19;
  run.x = Math.min(endX, run.x + distance * Math.cos(run.heading));
  run.y = clamp(run.y + distance * Math.sin(run.heading), banks.top + boatRadius, banks.bottom - boatRadius);

  const hitLog = course.logs.some(log =>
    ((run.x - log.x) / (log.rx + boatRadius)) ** 2
      + ((run.y - log.y) / (log.ry + boatRadius)) ** 2 <= 1)
    || (course.rafts ?? []).some(raft =>
      ((run.x - raft.x) / (raft.rx + boatRadius)) ** 2
      + ((run.y - raftY(raft, run.elapsedMs)) / (raft.ry + boatRadius)) ** 2 <= 1);
  if (hitLog) {
    resetAtCheckpoint(run, 'logs');
    return;
  }

  if (!run.rescued && !run.pastFog && course.checkpoint && run.x >= course.checkpoint.x) {
    run.checkpoint = course.checkpoint;
  }
  if (fog && !run.pastFog && run.x >= FOG_GATE.startX) {
    const lane = FOG_GATE.lanes[fog.channel];
    if (Math.abs(run.y - lane) > FOG_GATE.halfWidth) {
      resetAtCheckpoint(run, 'shoal');
      return;
    }
    if (run.x >= FOG_GATE.endX) run.pastFog = true;
  }

  run.wrongFlag = Boolean(fog && !run.rescued && near(run, FOG_FLAGS[fog.flag === 'triangle' ? 'circle' : 'triangle']));
  if (!run.rescued && rescue && near(run, rescue)) {
    run.rescued = true;
    run.checkpoint = { x: rescue.x + 28, y: rescue.y };
  }
  if ((!rescue || run.rescued) && near(run, course.dock)) {
    run.finished = true;
  }
}
