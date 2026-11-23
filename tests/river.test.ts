import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_TICK_MS } from '../src/shared/game-levels.js';
import { createRiverRun, raftY, stepRiver } from '../src/shared/river.js';
import type { RiverRun } from '../src/shared/river.js';
import { RIVER_COURSES } from '../src/shared/river-levels.js';

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
  assert.ok(run.elapsedMs > GAME_TICK_MS);
});

test('striking the drifting raft returns to the nearby checkpoint', () => {
  const run = createRiverRun();
  run.x = 451;
  run.y = 282;
  run.elapsedMs = 2577;
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

test('practice waits for each player to try one paddle before allowing forward motion', () => {
  const run = createRiverRun('practice');
  paddle(run, 20, true, true);
  assert.equal(run.x, 105);
  paddle(run, 8, true, false);
  assert.deepEqual(run.practice, [true, false]);
  assert.ok(run.heading > 0);
  paddle(run, 5, false, true);
  assert.deepEqual(run.practice, [true, true]);
  assert.equal(run.heading, 0);
  paddle(run, 18, false, true);
  assert.ok(run.heading < -0.45);
  paddle(run, 140, true, true);
  assert.ok(run.finished);
  assert.equal(run.collisions, 0);
});

test('brief staggered inputs from one paired stroke are not two solo practices', () => {
  const run = createRiverRun('practice');
  paddle(run, 1, true, false);
  paddle(run, 12, true, true);
  paddle(run, 1, false, true);
  paddle(run, 1, false, false);
  assert.deepEqual(run.practice, [false, false]);
  assert.equal(run.x, 105);
});

test('fog waits for both clues, then rejects the shoal and saves the safe crossing', () => {
  const run = createRiverRun('fog', { flag: 'triangle', channel: 'upper' });
  run.fog!.shared[0] = true;
  paddle(run, 100, true, true);
  assert.equal(run.x, 345);
  assert.equal(run.collisions, 0);
  run.fog!.shared[1] = true;
  paddle(run, 13, true, true);
  assert.equal(run.recovery, 'shoal');
  assert.equal(run.x, 325);
  paddle(run, 25, false, false);
  run.y = 122;
  paddle(run, 55, true, true);
  assert.equal(run.pastFog, true);
  assert.equal(run.recovery, null);
  assert.equal(run.collisions, 1);
});

test('the other fog flag gives recoverable feedback and only the correct flag has the duck', () => {
  const run = createRiverRun('fog', { flag: 'circle', channel: 'upper' });
  run.fog!.shared = [true, true];
  run.pastFog = true;
  run.x = 720;
  run.y = 122;
  paddle(run, 25, true, true);
  assert.ok(run.wrongFlag);
  assert.equal(run.rescued, false);
  assert.equal(run.finished, false);
  run.y = 278;
  paddle(run, 1, true, true);
  assert.ok(run.rescued);
  assert.equal(run.wrongFlag, false);
  run.y = 200;
  paddle(run, 45, true, true);
  assert.ok(run.finished);
});

test('bend currents push the boat unless both paddles resist', () => {
  const idle = createRiverRun('bend');
  idle.x = 470; idle.y = 200;
  paddle(idle, 10, false, false);
  assert.ok(idle.y > 220, `idle drift ${idle.y}`);
  const held = createRiverRun('bend');
  held.x = 470; held.y = 200;
  paddle(held, 10, true, true);
  assert.equal(held.y, 200);
  const single = createRiverRun('bend');
  single.x = 470; single.y = 200;
  paddle(single, 10, true, false);
  assert.ok(single.y > 200 && single.y < idle.y, `single drift ${single.y}`);
});

test('the moving raft collides only at its current height', () => {
  const raft = RIVER_COURSES.bend.rafts![0];
  assert.ok(Math.abs(raftY(raft, 5236) - (raft.y - raft.range)) < 1);
  const hit = createRiverRun('bend');
  hit.x = raft.x; hit.y = raft.y;
  paddle(hit, 1, true, true);
  assert.equal(hit.recovery, 'logs');
  const miss = createRiverRun('bend');
  miss.x = raft.x; miss.y = raft.y; miss.elapsedMs = 5236;
  paddle(miss, 1, true, true);
  assert.equal(miss.recovery, null);
});
