import assert from 'node:assert/strict';
import test from 'node:test';
import { createRiverRun, stepRiver, RIVER_TICK_MS } from '../src/shared/river.js';
import type { RiverRun } from '../src/shared/river.js';

function paddle(run: RiverRun, ticks: number, left: boolean, right: boolean) {
  for (let i = 0; i < ticks; i++) stepRiver(run, [left, right]);
}

test('one paddle turns in place and both paddles propel the boat', () => {
  const run = createRiverRun();
  paddle(run, 18, true, false);
  assert.equal(run.x, 105);
  assert.ok(run.heading > 0.45);
  paddle(run, 15, true, true);
  assert.ok(run.x > 145);
  assert.ok(run.y > 220);
  const x = run.x;
  paddle(run, 30, false, false);
  assert.equal(run.x, x);
  assert.ok(run.elapsedMs > RIVER_TICK_MS);
});

test('striking the second obstacle returns to the nearby checkpoint', () => {
  const run = createRiverRun();
  run.x = 451;
  run.y = 282;
  paddle(run, 35, true, true);
  assert.equal(run.collisions, 1);
  assert.equal(run.x, 449);
  assert.equal(run.y, 230);
});

test('the duck must be rescued before docking can finish the run', () => {
  const run = createRiverRun();
  run.x = 720;
  run.y = 285;
  paddle(run, 85, true, true);
  assert.equal(run.rescued, false);
  assert.equal(run.finished, false);
  assert.ok(run.x < 820);
  run.y = 200;
  paddle(run, 60, true, true);
  assert.equal(run.rescued, true);
  assert.equal(run.finished, true);
});
