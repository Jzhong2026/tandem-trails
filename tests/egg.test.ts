import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgg, EGG, eggSlope, stepEgg } from '../src/shared/egg.js';

const idle = { left: false, right: false, interact: false };
const forward = { ...idle, right: true };
const raised = { ...forward, interact: true };

test('the stretcher waits for matching movement and needs the low end raised on each slope', () => {
  const egg = createEgg();
  stepEgg(egg, { left: forward, right: idle });
  stepEgg(egg, { left: forward, right: { ...idle, left: true } });
  assert.equal(egg.x, EGG.start);
  const lifted = new Set<string>();
  for (let i = 0; !egg.finished && i < 350; i++) {
    const slope = eggSlope(egg.x);
    if (slope) lifted.add(slope.low);
    stepEgg(egg, { left: slope?.low === 'left' ? raised : forward, right: slope?.low === 'right' ? raised : forward });
  }
  assert.deepEqual([...lifted], ['left', 'right']);
  assert.equal(egg.drops, 0);
  assert.equal(egg.finished, true);
});

test('pausing on a slope holds the egg steady and a drop returns to the latest soft pad', () => {
  const egg = createEgg();
  egg.x = EGG.slopes[1].from + 15;
  for (let i = 0; i < 10; i++) stepEgg(egg, { left: forward, right: forward });
  const before = egg.roll;
  assert.ok(Math.abs(before) > 0);
  for (let i = 0; i < 90; i++) stepEgg(egg, { left: idle, right: idle });
  assert.equal(egg.roll, before);
  for (let i = 0; egg.drops === 0 && i < 45; i++) stepEgg(egg, { left: forward, right: forward });
  assert.equal(egg.drops, 1);
  assert.equal(egg.x, EGG.slopes[1].pad);
  assert.equal(egg.roll, 0);
  assert.ok(egg.recoveryMs > 0);
});

test('a drop after backtracking keeps the furthest soft pad reached', () => {
  const egg = createEgg();
  egg.x = EGG.slopes[1].from;
  stepEgg(egg, { left: idle, right: idle });
  const back = { ...idle, left: true };
  for (let i = 0; egg.drops === 0 && i < 60; i++) {
    stepEgg(egg, { left: back, right: { ...back, interact: true } });
  }
  assert.equal(egg.drops, 1);
  assert.equal(egg.x, EGG.slopes[1].pad);
});
