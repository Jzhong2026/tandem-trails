import type { EggView } from '../shared/egg.js';
import type { MineView } from '../shared/mine.js';
import type { SubView } from '../shared/sub.js';

function approach(from: number, to: number, blend: number, tolerance: number) {
  const position = from + (to - from) * blend;
  return Math.abs(to - position) <= tolerance ? to : position;
}

export function interpolateMine(from: MineView, to: MineView, blend: number): MineView {
  if (to.finished) return to;
  const leftX = approach(from.players.left.x, to.players.left.x, blend, .15);
  const rightX = approach(from.players.right.x, to.players.right.x, blend, .15);
  const liftProgress = approach(from.liftProgress, to.liftProgress, blend, .001);
  if (leftX === to.players.left.x && rightX === to.players.right.x && liftProgress === to.liftProgress) return to;
  return {
    ...to, liftProgress,
    players: {
      left: { ...to.players.left, x: leftX },
      right: { ...to.players.right, x: rightX },
    },
  };
}

export function interpolateEgg(from: EggView, to: EggView, blend: number): EggView {
  if (to.finished || from.drops !== to.drops) return to;
  const x = approach(from.x, to.x, blend, .15);
  const roll = approach(from.roll, to.roll, blend, .002);
  const tilt = approach(from.tilt, to.tilt, blend, .002);
  if (x === to.x && roll === to.roll && tilt === to.tilt) return to;
  return { ...to, x, roll, tilt };
}

export function interpolateSub(from: SubView, to: SubView, blend: number): SubView {
  if (to.finished || from.collisions !== to.collisions) return to;
  const x = approach(from.x, to.x, blend, .15);
  const y = approach(from.y, to.y, blend, .15);
  if (x === to.x && y === to.y) return to;
  return { ...to, x, y };
}
