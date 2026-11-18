import assert from 'node:assert/strict';
import test from 'node:test';
import { createMine, MINE, stepMine } from '../src/shared/mine.js';
import type { MineView } from '../src/shared/mine.js';
import type { MovementInputs } from '../src/shared/movement.js';

const idle = { left: false, right: false, interact: false };
const walk = { ...idle, right: true };
const hold = { ...idle, interact: true };

function tick(run: MineView, input: MovementInputs, until: () => boolean) {
  for (let i = 0; i < 300 && !until(); i++) stepMine(run, input);
  assert.ok(until(), JSON.stringify(run));
}

test('the lower player must hold the bridge while the upper player crosses', () => {
  const mine = createMine();
  tick(mine, { left: idle, right: walk }, () => mine.players.right.x === MINE.bridge.start);
  stepMine(mine, { left: idle, right: { ...walk, interact: true } });
  assert.equal(mine.players.right.x, MINE.bridge.start);
  assert.equal(mine.bridgeOpen, false);

  tick(mine, { left: walk, right: idle }, () => mine.players.left.x >= MINE.bridge.switchX);
  tick(mine, { left: hold, right: walk }, () => mine.players.right.x >= MINE.bridge.start + 30);
  const crossing = mine.players.right.x;
  stepMine(mine, { left: idle, right: walk });
  assert.equal(mine.players.right.x, crossing);
  assert.equal(mine.bridgeOpen, false);
  tick(mine, { left: hold, right: walk }, () => mine.bridgeCrossed);
  stepMine(mine, { left: idle, right: idle });
  assert.equal(mine.bridgeOpen, true);
});

test('the upper player can stop and resume the lift, and both must reach the exit', () => {
  const mine = createMine();
  tick(mine, { left: walk, right: walk }, () => mine.players.left.x >= MINE.bridge.switchX);
  tick(mine, { left: hold, right: walk }, () => mine.players.right.x >= MINE.lift.switchX);
  tick(mine, { left: walk, right: idle }, () => mine.players.left.x === MINE.lift.x);
  stepMine(mine, { left: hold, right: idle });
  assert.equal(mine.liftProgress, 0);

  tick(mine, { left: idle, right: hold }, () => mine.liftProgress >= 0.35);
  const stopped = mine.liftProgress;
  stepMine(mine, { left: walk, right: idle });
  assert.equal(mine.liftProgress, stopped);
  assert.equal(mine.players.left.x, MINE.lift.x);
  tick(mine, { left: idle, right: hold }, () => mine.liftProgress === 1);
  tick(mine, { left: idle, right: walk }, () => mine.players.right.x >= MINE.exit);
  assert.equal(mine.finished, false);
  tick(mine, { left: walk, right: idle }, () => mine.finished);
  assert.ok(mine.players.left.firefly && mine.players.right.firefly);
});
