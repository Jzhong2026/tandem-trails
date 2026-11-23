import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgg, EGG2, eggSlope, eggWind, eggWindDir, eggWindward, stepEgg } from '../src/shared/egg.js';

const idle = { left: false, right: false, interact: false };
const forward = { ...idle, right: true };
const raised = { ...forward, interact: true };

test('a gusting wind steadies only while the windward end lifts and the other rests', () => {
  const egg = createEgg('egg2');
  egg.x = EGG2.winds[0].from + 5;
  stepEgg(egg, { left: forward, right: forward });
  assert.ok(Math.abs(egg.tilt) > 0);
  const windward = eggWindward(EGG2.winds[0], egg.elapsedMs);
  const hold = { left: { ...forward, interact: windward === 'left' }, right: { ...forward, interact: windward === 'right' } };
  stepEgg(egg, hold);
  assert.equal(egg.tilt, 0);
  stepEgg(egg, { left: raised, right: raised });
  assert.ok(Math.abs(egg.tilt) > 0);
});

test('trading the windward lift carries the egg across the gust, while walking unbraced drops it', () => {
  const egg = createEgg('egg2');
  egg.x = EGG2.winds[0].from;
  egg.checkpoint = EGG2.winds[0].pad;
  for (let i = 0; egg.x < EGG2.winds[0].to && i < 400; i++) {
    const windward = eggWindward(EGG2.winds[0], egg.elapsedMs);
    stepEgg(egg, {
      left: { ...forward, interact: windward === 'left' },
      right: { ...forward, interact: windward === 'right' },
    });
  }
  assert.ok(egg.x >= EGG2.winds[0].to);
  assert.equal(egg.drops, 0);

  const gust = createEgg('egg2');
  gust.x = EGG2.winds[1].from;
  gust.checkpoint = EGG2.winds[1].pad;
  for (let i = 0; gust.drops === 0 && i < 200; i++) stepEgg(gust, { left: forward, right: forward });
  assert.equal(gust.drops, 1);
  assert.equal(gust.x, EGG2.winds[1].pad);
  assert.ok(gust.recoveryMs > 0);
});

test('the gust route mixes low-end slopes, trading wind gaps and ice and reaches the nest', () => {
  const egg = createEgg('egg2');
  const lifted = new Set<string>();
  const braced = new Set<number>();
  for (let i = 0; !egg.finished && i < 800; i++) {
    const slope = eggSlope(egg.x, 'egg2');
    const wind = eggWind(egg.x, 'egg2');
    if (slope) lifted.add(slope.low);
    if (wind) braced.add(wind.from);
    const windward = wind ? eggWindward(wind, egg.elapsedMs) : null;
    const left = slope?.low === 'left' || windward === 'left' ? raised : forward;
    const right = slope?.low === 'right' || windward === 'right' ? raised : forward;
    stepEgg(egg, { left, right });
  }
  assert.deepEqual([...lifted], ['left', 'right']);
  assert.equal(braced.size, 2);
  assert.equal(egg.drops, 0);
  assert.equal(egg.finished, true);
});
test('gusting wind flips direction and only the windward end steadies it', () => {
  const run = createEgg('egg2');
  run.x = 470;
  const wind = EGG2.winds[0];
  const first = eggWindDir(wind, 0);
  const flipped = eggWindDir(wind, wind.gustPeriodMs!);
  assert.notEqual(first, flipped);
  const windward = eggWindward(wind, 0);
  const leeward = windward === 'left' ? 'right' : 'left';
  const inputs = { left: { ...idle, right: true }, right: { ...idle, right: true } };
  inputs[windward].interact = true;
  stepEgg(run, inputs);
  assert.equal(run.tilt, 0);
  const both = { left: { ...idle, right: true, interact: true }, right: { ...idle, right: true, interact: true } };
  const slipped = createEgg('egg2');
  slipped.x = 470;
  stepEgg(slipped, both);
  assert.notEqual(slipped.tilt, 0);
  inputs[leeward].interact = true;
  const wrong = createEgg('egg2');
  wrong.x = 470;
  stepEgg(wrong, inputs);
  assert.notEqual(wrong.tilt, 0);
});

test('the ice segment keeps sliding after the players let go', () => {
  const run = createEgg('egg2');
  run.x = 570;
  const go = { left: { ...idle, right: true }, right: { ...idle, right: true } };
  for (let i = 0; i < 8; i++) stepEgg(run, go);
  assert.ok(run.velocity > 60, `velocity ${run.velocity}`);
  const before = run.x;
  stepEgg(run, { left: idle, right: idle });
  assert.ok(run.x > before, 'ice keeps carrying the stretcher');
  assert.ok(run.velocity > 0);
  const dry = createEgg('egg2');
  dry.x = 620;
  stepEgg(dry, go);
  const dryBefore = dry.x;
  stepEgg(dry, { left: idle, right: idle });
  assert.equal(dry.x, dryBefore);
});
