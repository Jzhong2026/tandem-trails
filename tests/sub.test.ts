import assert from 'node:assert/strict';
import test from 'node:test';
import { createSub, stepSub, SUB, tentacleOpen } from '../src/shared/sub.js';
import { GAME_TICK_MS } from '../src/shared/game-levels.js';
import type { SubView } from '../src/shared/sub.js';
import type { MovementInput, MovementInputs } from '../src/shared/movement.js';

const idle: MovementInput = { left: false, right: false, interact: false };
const up: MovementInput = { ...idle, left: true };
const down: MovementInput = { ...idle, right: true };
const forward: MovementInput = { ...idle, right: true };
const back: MovementInput = { ...idle, left: true };

function tick(run: SubView, input: MovementInputs, until: () => boolean) {
  for (let i = 0; i < 900 && !until(); i++) stepSub(run, input);
  assert.ok(until(), JSON.stringify(run));
}

test('each seat pilots its own axis and releasing stops that axis', () => {
  const run = createSub();
  tick(run, { left: down, right: idle }, () => run.y >= 260);
  assert.equal(run.x, SUB.start.x);
  const depth = run.y;
  tick(run, { left: idle, right: forward }, () => run.x >= 150);
  assert.equal(run.y, depth);
  const stopped = { x: run.x, y: run.y };
  for (let i = 0; i < 10; i++) stepSub(run, { left: idle, right: idle });
  assert.deepEqual({ x: run.x, y: run.y }, stopped);
  tick(run, { left: up, right: back }, () => run.y < depth && run.x < stopped.x);
  assert.ok(run.y >= SUB.surface + SUB.radius && run.x >= 60);
});

test('a reef bumps the sub back to the last buoy and pauses briefly', () => {
  const run = createSub();
  tick(run, { left: idle, right: forward }, () => run.collisions === 1);
  assert.deepEqual({ x: run.x, y: run.y }, SUB.buoys[0]);
  assert.equal(run.recoveryMs, SUB.recoveryMs);
  stepSub(run, { left: idle, right: forward });
  assert.deepEqual({ x: run.x, y: run.y }, SUB.buoys[0]);
  assert.ok(run.recoveryMs < SUB.recoveryMs);
  tick(run, { left: idle, right: idle }, () => run.recoveryMs === 0);
  tick(run, { left: idle, right: forward }, () => run.x > SUB.buoys[0].x + 10);
});

test('bubbles are collected on contact and kept after a bump', () => {
  const run = createSub();
  tick(run, { left: down, right: forward }, () => run.y >= 280);
  tick(run, { left: idle, right: forward }, () => run.bubbles[0]);
  assert.equal(run.bubbles[1], false);
  tick(run, { left: idle, right: forward }, () => run.collisions === 1);
  assert.deepEqual({ x: run.x, y: run.y }, SUB.buoys[1]);
  assert.deepEqual(run.bubbles, [true, false]);
});

test('the coral station only opens with both bubbles and the seahorse aboard', () => {
  const run = createSub();
  run.x = SUB.dock.x;
  run.y = SUB.dock.y;
  run.rescued = true;
  stepSub(run, { left: idle, right: idle });
  assert.equal(run.finished, false);
  run.bubbles = [true, true];
  run.rescued = false;
  stepSub(run, { left: idle, right: idle });
  assert.equal(run.finished, false);
  run.rescued = true;
  stepSub(run, { left: idle, right: idle });
  assert.equal(run.finished, true);
});

test('a family can pilot the whole route to the coral station without a bump', () => {
  const run = createSub();
  tick(run, { left: down, right: forward }, () => run.y >= 280);
  tick(run, { left: idle, right: forward }, () => run.bubbles[0]);
  tick(run, { left: up, right: idle }, () => run.y <= 140);
  tick(run, { left: idle, right: forward }, () => run.bubbles[1]);
  tick(run, { left: down, right: idle }, () => run.y >= 180 && run.y <= 200);
  tick(run, { left: idle, right: forward }, () => run.x >= 700);
  tick(run, { left: idle, right: idle }, () => run.elapsedMs % SUB.tentacle.periodMs < 100);
  tick(run, { left: idle, right: forward }, () => run.rescued);
  assert.deepEqual(run.checkpoint, { x: SUB.seahorse.x + 28, y: SUB.seahorse.y });
  tick(run, { left: idle, right: forward }, () => run.finished);
  assert.equal(run.collisions, 0);
  assert.deepEqual(run.bubbles, [true, true]);
});
test('currents drift the sub unless the matching pilot holds thrust', () => {
  const drift = createSub();
  drift.x = 430; drift.y = 210;
  stepSub(drift, { left: idle, right: idle });
  assert.ok(drift.x > 430, `drift ${drift.x}`);
  const held = createSub();
  held.x = 430; held.y = 210;
  stepSub(held, { left: idle, right: forward });
  assert.equal(held.x, 430 + 126 * (GAME_TICK_MS / 1000));
  const sink = createSub();
  sink.x = 640; sink.y = 150;
  stepSub(sink, { left: idle, right: idle });
  assert.ok(sink.y > 150);
  const dive = createSub();
  dive.x = 640; dive.y = 150;
  stepSub(dive, { left: { ...idle, right: true }, right: idle });
  assert.equal(dive.y, 150 + 110 * (GAME_TICK_MS / 1000));
});

test('the tentacle gate blocks the column while closed and opens on its cycle', () => {
  assert.equal(tentacleOpen(0), true);
  assert.equal(tentacleOpen(SUB.tentacle.openMs), false);
  assert.equal(tentacleOpen(SUB.tentacle.periodMs), true);
  const closed = createSub();
  closed.x = SUB.tentacle.x; closed.y = 200; closed.elapsedMs = SUB.tentacle.openMs;
  closed.checkpoint = { x: 620, y: 200 };
  stepSub(closed, { left: idle, right: idle });
  assert.equal(closed.collisions, 1);
  assert.equal(closed.x, 620);
  const open = createSub();
  open.x = SUB.tentacle.x - 30; open.y = 200; open.elapsedMs = 0;
  stepSub(open, { left: idle, right: forward });
  assert.equal(open.collisions, 0);
  assert.ok(open.x > SUB.tentacle.x - 30);
});
