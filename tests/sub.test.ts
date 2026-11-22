import assert from 'node:assert/strict';
import test from 'node:test';
import { createSub, stepSub, SUB } from '../src/shared/sub.js';
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
  tick(run, { left: down, right: idle }, () => run.y >= 200 && run.y <= 250);
  tick(run, { left: idle, right: forward }, () => run.rescued);
  assert.deepEqual(run.checkpoint, { x: SUB.seahorse.x + 28, y: SUB.seahorse.y });
  tick(run, { left: idle, right: forward }, () => run.finished);
  assert.equal(run.collisions, 0);
  assert.deepEqual(run.bubbles, [true, true]);
});