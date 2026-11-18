import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgg } from '../src/shared/egg.js';
import { createMine } from '../src/shared/mine.js';
import { interpolateEgg, interpolateMine } from '../src/web/panorama-motion.js';

test('mine positions and lift height ease toward the snapshot while flags update immediately', () => {
  const from = createMine();
  const to = createMine();
  to.players.left = { x: from.players.left.x + 12, firefly: true };
  to.players.right.x += 24;
  to.liftProgress = .4;
  to.bridgeOpen = true;
  const frame = interpolateMine(from, to, .5);
  assert.equal(frame.players.left.x, from.players.left.x + 6);
  assert.equal(frame.players.right.x, from.players.right.x + 12);
  assert.equal(frame.liftProgress, .2);
  assert.equal(frame.players.left.firefly, true);
  assert.equal(frame.bridgeOpen, true);
  assert.equal(from.players.left.firefly, false);
  assert.equal(interpolateMine(to, to, .5), to);
});

test('egg motion eases through ordinary snapshots and snaps to a new checkpoint or finish', () => {
  const from = { ...createEgg(), x: 350, roll: .5, tilt: 1 };
  const to = { ...from, x: 360, roll: .7, tilt: 0 };
  const frame = interpolateEgg(from, to, .5);
  assert.equal(frame.x, 355);
  assert.equal(frame.roll, .6);
  assert.equal(frame.tilt, .5);
  const dropped = { ...to, x: 204, roll: 0, drops: 1, recoveryMs: 750 };
  assert.equal(interpolateEgg(from, dropped, .5), dropped);
  const finished = { ...to, x: 895, finished: true };
  assert.equal(interpolateEgg(from, finished, .5), finished);
});
