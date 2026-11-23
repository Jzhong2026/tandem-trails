import assert from 'node:assert/strict';
import test from 'node:test';
import { createMine, MINE2, stepMine } from '../src/shared/mine.js';
import type { MineView } from '../src/shared/mine.js';
import type { MovementInputs } from '../src/shared/movement.js';

const idle = { left: false, right: false, interact: false };
const walk = { ...idle, right: true };
const hold = { ...idle, interact: true };

function tick(run: MineView, input: MovementInputs, until: () => boolean) {
  for (let i = 0; i < 400 && !until(); i++) stepMine(run, input);
  assert.ok(until(), JSON.stringify(run));
}

test('the lower player holds the first bridge for the upper player, who waits if it is released', () => {
  const mine = createMine('mine2');
  tick(mine, { left: idle, right: walk }, () => mine.players.right.x === MINE2.bridge1.start);
  stepMine(mine, { left: idle, right: { ...walk, interact: true } });
  assert.equal(mine.players.right.x, MINE2.bridge1.start);
  assert.equal(mine.bridgeOpen, false);

  tick(mine, { left: walk, right: idle }, () => mine.players.left.x >= MINE2.bridge1.switchX);
  tick(mine, { left: hold, right: walk }, () => mine.players.right.x >= MINE2.bridge1.start + 30);
  const crossing = mine.players.right.x;
  stepMine(mine, { left: idle, right: walk });
  assert.equal(mine.players.right.x, crossing);
  assert.equal(mine.bridgeOpen, false);
  tick(mine, { left: hold, right: walk }, () => mine.bridgeCrossed);
  stepMine(mine, { left: idle, right: idle });
  assert.equal(mine.bridgeOpen, true);
});

test('the upper player then holds the second bridge, rides the cart and both leave with their firefly', () => {
  const mine = createMine('mine2');
  tick(mine, { left: walk, right: walk }, () => mine.players.left.x >= MINE2.bridge1.switchX);
  tick(mine, { left: hold, right: walk }, () => mine.players.right.x >= MINE2.bridge2.switchX);
  assert.equal(mine.players.right.firefly, true);
  tick(mine, { left: walk, right: idle }, () => mine.players.left.x === MINE2.bridge2.start);
  tick(mine, { left: walk, right: hold }, () => mine.bridge2Crossed);
  tick(mine, { left: walk, right: idle }, () => mine.players.left.firefly);
  tick(mine, { left: { ...idle, left: true }, right: idle }, () => mine.players.left.x <= MINE2.cart.switchX);
  tick(mine, { left: idle, right: walk }, () => mine.players.right.x === MINE2.cart.from);
  tick(mine, { left: hold, right: idle }, () => mine.cartX === MINE2.cart.to);
  tick(mine, { left: idle, right: walk }, () => mine.players.right.x >= MINE2.exit);
  tick(mine, { left: walk, right: idle }, () => mine.finished);
  assert.ok(mine.players.left.firefly && mine.players.right.firefly);
});

test('the cart waits for the lower switch and the crystal gate needs both fireflies', () => {
  const mine = createMine('mine2');
  mine.bridgeCrossed = true;
  mine.bridge2Crossed = true;
  mine.players.left.x = 800;
  mine.players.right.x = MINE2.cart.from;
  stepMine(mine, { left: walk, right: walk });
  assert.equal(mine.players.right.x, MINE2.cart.from);
  assert.equal(mine.cartHeld, false);
  mine.players.left.x = MINE2.cart.switchX;
  stepMine(mine, { left: hold, right: idle });
  assert.equal(mine.cartHeld, true);
  assert.ok(mine.cartX > MINE2.cart.from);

  const gated = createMine('mine2');
  gated.bridgeCrossed = true;
  gated.bridge2Crossed = true;
  gated.players.left.x = 880;
  gated.players.right.x = 500;
  gated.players.right.firefly = true;
  stepMine(gated, { left: walk, right: idle });
  assert.equal(gated.players.left.x, MINE2.cart.gateX);
  assert.equal(gated.gateOpen, false);
  gated.players.left.firefly = true;
  stepMine(gated, { left: walk, right: idle });
  assert.equal(gated.gateOpen, true);
  assert.ok(gated.players.left.x > MINE2.cart.gateX);
});

test('the lower bridge only opens while the upper player holds its own switch', () => {
  const mine = createMine('mine2');
  mine.bridgeCrossed = true;
  mine.players.left.x = MINE2.bridge2.start;
  mine.players.right.x = MINE2.bridge2.switchX;
  stepMine(mine, { left: { ...walk, interact: true }, right: idle });
  assert.equal(mine.bridge2Open, false);
  assert.equal(mine.players.left.x, MINE2.bridge2.start);
  stepMine(mine, { left: walk, right: hold });
  assert.equal(mine.bridge2Open, true);
});