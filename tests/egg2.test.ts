import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgg, EGG2, eggSlope, eggWind, stepEgg } from '../src/shared/egg.js';

const idle = { left: false, right: false, interact: false };
const forward = { ...idle, right: true };
const raised = { ...forward, interact: true };

test('a wind gap steadies only when both players brace together', () => {
  const egg = createEgg('egg2');
  egg.x = EGG2.winds[0].from + 5;
  stepEgg(egg, { left: raised, right: forward });
  assert.ok(Math.abs(egg.tilt) > 0);
  stepEgg(egg, { left: raised, right: raised });
  assert.equal(egg.tilt, 0);
});

test('bracing together carries the egg across the wind, while walking unbraced drops it', () => {
  const egg = createEgg('egg2');
  egg.x = EGG2.winds[0].from;
  egg.checkpoint = EGG2.winds[0].pad;
  for (let i = 0; egg.x < EGG2.winds[0].to && i < 400; i++) stepEgg(egg, { left: raised, right: raised });
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

test('the gust route mixes low-end slopes and shared wind gaps and reaches the nest', () => {
  const egg = createEgg('egg2');
  const lifted = new Set<string>();
  const braced = new Set<number>();
  for (let i = 0; !egg.finished && i < 800; i++) {
    const slope = eggSlope(egg.x, 'egg2');
    const wind = eggWind(egg.x, 'egg2');
    if (slope) lifted.add(slope.low);
    if (wind) braced.add(wind.from);
    const left = slope?.low === 'left' || wind ? raised : forward;
    const right = slope?.low === 'right' || wind ? raised : forward;
    stepEgg(egg, { left, right });
  }
  assert.deepEqual([...lifted], ['left', 'right']);
  assert.equal(braced.size, 2);
  assert.equal(egg.drops, 0);
  assert.equal(egg.finished, true);
});