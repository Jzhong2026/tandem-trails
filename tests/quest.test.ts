import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activePlayers, createQuest, guardianOf, IDLE_INPUT, isProtected, questProgress, questStars,
  questProgress as progress, ROLE, SOLO_HEARTS, COOP_HEARTS, stepQuest, tileAt,
} from '../src/shared/quest.js';
import type { Player, QuestInput, QuestRun } from '../src/shared/quest.js';
import { QUEST_LEVELS, ROWS, TILE } from '../src/shared/quest-levels.js';

const SOLID = new Set(['#', '=', 'B', '?', '!', '+', 'u', '[', ']', '(', ')', '{', '}', '>', '<', 'D']);

function hero(run: QuestRun, index = 0): Player {
  return run.players[index];
}

function support(run: QuestRun, col: number, row: number) {
  const char = tileAt(run, col, row);
  if (char === 'D') return !run.gateOpen;
  if (SOLID.has(char) || char === '-') return true;
  const x = col * TILE;
  const y = row * TILE;
  return run.bodies.some(body => body.solid && !body.broken
    && x < body.x + body.w && x + TILE > body.x && y < body.y + body.h && y + TILE > body.y);
}

function botInput(run: QuestRun, player: Player, memory: { stuck: number; lastX: number }): QuestInput {
  const input: QuestInput = { ...IDLE_INPUT, right: true, run: true };
  const feetRow = Math.floor((player.y + player.h + 4) / TILE);
  const headRow = Math.floor((player.y + 6) / TILE);
  const frontCol = Math.floor((player.x + player.w + 2) / TILE);

  if (player.bubbleMs > 0) return IDLE_INPUT;

  if (run.level.water) {
    const bottomRow = Math.floor((player.y + player.h) / TILE);
    let wall = false;
    for (let c = frontCol; c <= frontCol + 1; c++) {
      for (let r = headRow; r <= bottomRow; r++) if (support(run, c, r)) wall = true;
    }
    if (wall || player.y > 5 * TILE) input.jump = true;
    return input;
  }

  const boss = run.enemies.find(enemy => enemy.kind === 'boss' && enemy.state !== 'dead');
  if (boss && !run.gateOpen && player.x > 58 * TILE) {
    const distance = boss.x + boss.w / 2 - (player.x + player.w / 2);
    input.right = distance > 24;
    input.left = distance < -24;
    input.run = Math.abs(distance) > 200;
    if (boss.state !== 'dizzy' && Math.abs(distance) < 150) {
      input.right = distance < 0;
      input.left = distance > 0;
      input.run = true;
    }
    if (boss.state === 'dizzy' && Math.abs(distance) < 76 && player.onGround) input.jump = true;
    if (boss.state === 'dizzy' && !player.onGround && player.vy > 0) input.jump = true;
    return input;
  }

  let wall = false;
  for (let c = frontCol; c <= frontCol + 2; c++) {
    for (let r = headRow; r < feetRow; r++) if (support(run, c, r)) wall = true;
  }
  let gap = true;
  let sleeping = false;
  for (let c = frontCol; c <= frontCol + 2; c++) {
    for (let r = feetRow; r <= feetRow + 3; r++) if (support(run, c, r)) gap = false;
    const x = c * TILE;
    for (const body of run.bodies) {
      if (body.kind !== 'phase') continue;
      if (x < body.x + body.w && x + TILE > body.x && Math.abs(body.y - feetRow * TILE) < TILE * 2.5) {
        gap = false;
        if (!body.solid) sleeping = true;
      }
    }
  }
  if (sleeping && player.onGround) return IDLE_INPUT;

  const threat = run.enemies.some(enemy => enemy.state !== 'dead' && enemy.state !== 'squash'
    && enemy.kind !== 'flyer' && enemy.kind !== 'plant' && enemy.stunMs <= 0
    && enemy.x - (player.x + player.w) > -10 && enemy.x - (player.x + player.w) < 96
    && Math.abs(enemy.y + enemy.h - (player.y + player.h)) < 50);

  if (Math.abs(player.x - memory.lastX) < 1.2) memory.stuck++; else memory.stuck = 0;
  memory.lastX = player.x;

  if (player.onGround && (wall || gap || threat || memory.stuck > 26)) input.jump = true;
  if (!player.onGround && player.vy < 0) input.jump = true;
  if (memory.stuck > 100) { input.left = true; input.right = false; }
  if (memory.stuck > 130) memory.stuck = 0;

  if (run.coop) {
    if (player.role === 'striker' && threat && player.dashCooldownMs <= 0) input.fire = true;
    if (player.role === 'guardian') {
      const rear = run.enemies.some(enemy => enemy.state !== 'dead' && enemy.stunMs <= 0
        && enemy.x < player.x && player.x - enemy.x < 190);
      if (rear && player.guardCooldownMs <= 0) input.fire = true;
      const striker = run.players[0];
      if (player.x > striker.x + TILE * 2) input.right = false;
    }
  }
  return input;
}

function playThrough(index: number, options: { assist?: boolean; coop?: boolean }, maxSeconds = 180) {
  const run = createQuest(index, options);
  const memories = run.players.map(player => ({ stuck: 0, lastX: player.x }));
  const frames = maxSeconds * 60;
  let furthest = 0;
  for (let frame = 0; frame < frames; frame++) {
    stepQuest(run, run.players.map((player, i) => botInput(run, player, memories[i])));
    run.events.length = 0;
    furthest = Math.max(furthest, progress(run));
    if (run.status !== 'playing') return { run, frames: frame, furthest };
  }
  return { run, frames, furthest };
}

test('every level declares one start, one goal and a readable coin count', () => {
  assert.equal(QUEST_LEVELS.length, 12);
  for (const level of QUEST_LEVELS) {
    const flat = level.grid.join('');
    assert.equal(level.grid.length, ROWS, level.id);
    assert.ok(level.grid.every(row => row.length === level.width), level.id);
    assert.equal([...flat].filter(char => char === '@').length, 1, `${level.id} start`);
    assert.equal([...flat].filter(char => char === 'X').length, 1, `${level.id} goal`);
    assert.ok(level.coinTotal >= 12, `${level.id} coins ${level.coinTotal}`);
    assert.ok(level.hint.length > 8, level.id);
  }
});

test('no enemy or pickup is buried inside solid terrain', () => {
  for (const level of QUEST_LEVELS) {
    const run = createQuest(level.index);
    for (const enemy of run.enemies) {
      if (enemy.kind === 'plant') continue;
      const col = Math.floor((enemy.x + enemy.w / 2) / TILE);
      const row = Math.floor((enemy.y + enemy.h / 2) / TILE);
      assert.ok(!SOLID.has(tileAt(run, col, row)), `${level.id} enemy ${enemy.kind} at ${col},${row}`);
    }
    for (const pickup of run.pickups) {
      const col = Math.floor((pickup.x + pickup.w / 2) / TILE);
      const row = Math.floor((pickup.y + pickup.h / 2) / TILE);
      assert.ok(!SOLID.has(tileAt(run, col, row)), `${level.id} pickup ${pickup.kind} at ${col},${row}`);
    }
  }
});

test('a held jump clears four tiles and a short hop stays under two', () => {
  const run = createQuest(0);
  const groundY = hero(run).y;
  let apex = groundY;
  for (let frame = 0; frame < 130; frame++) {
    stepQuest(run, { ...IDLE_INPUT, jump: true });
    apex = Math.min(apex, hero(run).y);
  }
  const held = (groundY - apex) / TILE;
  assert.ok(held > 4 && held < 5.2, `held jump ${held.toFixed(2)} tiles`);

  const short = createQuest(0);
  let shortApex = groundY;
  for (let frame = 0; frame < 130; frame++) {
    stepQuest(short, { ...IDLE_INPUT, jump: frame < 4 });
    shortApex = Math.min(shortApex, hero(short).y);
  }
  const tapped = (groundY - shortApex) / TILE;
  assert.ok(tapped > 0.8 && tapped < 2.4, `tapped jump ${tapped.toFixed(2)} tiles`);
});

test('running jump spans a five tile gap', () => {
  const run = createQuest(0);
  hero(run).x = 32 * TILE;
  hero(run).y = 12 * TILE - hero(run).h;
  hero(run).vx = 294;
  let crossed = false;
  for (let frame = 0; frame < 200; frame++) {
    stepQuest(run, { ...IDLE_INPUT, right: true, run: true, jump: frame < 40 });
    if (hero(run).x > 37 * TILE && hero(run).onGround) crossed = true;
  }
  assert.ok(crossed, `ended at ${(hero(run).x / TILE).toFixed(1)}`);
  assert.equal(hero(run).hearts, SOLO_HEARTS);
});

test('coins, blocks and growth power-ups all resolve', () => {
  const run = createQuest(0);
  const coin = run.pickups.find(pickup => pickup.kind === 'coin')!;
  hero(run).x = coin.x;
  hero(run).y = coin.y;
  stepQuest(run, IDLE_INPUT);
  assert.equal(run.coins, 1);

  const block = run.blocks.find(entry => entry.char === '!')!;
  hero(run).x = block.col * TILE + 4;
  hero(run).y = (block.row + 1) * TILE + 2;
  hero(run).vy = -200;
  for (let frame = 0; frame < 40; frame++) stepQuest(run, { ...IDLE_INPUT, jump: true });
  assert.ok(run.pickups.some(pickup => pickup.kind === 'mushroom'), 'mushroom released');
  assert.equal(tileAt(run, block.col, block.row), 'u');

  const mushroom = run.pickups.find(pickup => pickup.kind === 'mushroom')!;
  for (let frame = 0; frame < 240 && !hero(run).big; frame++) {
    hero(run).x = mushroom.x;
    hero(run).y = mushroom.y;
    stepQuest(run, IDLE_INPUT);
  }
  assert.ok(hero(run).big, 'player grew');
  assert.equal(hero(run).h, 62);
});

test('stomping a walker bounces the player and scores a combo', () => {
  const run = createQuest(0);
  const walker = run.enemies.find(enemy => enemy.kind === 'walker')!;
  hero(run).x = walker.x;
  hero(run).y = walker.y - hero(run).h - 6;
  hero(run).vy = 300;
  for (let frame = 0; frame < 8 && walker.state === 'walk'; frame++) stepQuest(run, IDLE_INPUT);
  assert.equal(walker.state, 'squash');
  assert.ok(hero(run).vy < 0, 'bounced');
  assert.equal(run.stomps, 1);
  assert.equal(hero(run).hearts, SOLO_HEARTS);
});

test('a spiny cannot be stomped and costs a heart instead', () => {
  const run = createQuest(2);
  const spiny = run.enemies.find(enemy => enemy.kind === 'spiny')!;
  hero(run).x = spiny.x;
  hero(run).y = spiny.y - hero(run).h - 6;
  hero(run).vy = 300;
  for (let frame = 0; frame < 8 && hero(run).hearts === SOLO_HEARTS; frame++) stepQuest(run, IDLE_INPUT);
  assert.equal(hero(run).hearts, SOLO_HEARTS - 1);
  assert.notEqual(spiny.state, 'squash');
});

test('a star makes contact harmless and clears enemies', () => {
  const run = createQuest(0);
  hero(run).starMs = 9000;
  const walker = run.enemies.find(enemy => enemy.kind === 'walker')!;
  hero(run).x = walker.x;
  hero(run).y = walker.y;
  stepQuest(run, IDLE_INPUT);
  assert.equal(hero(run).hearts, SOLO_HEARTS);
  assert.ok(walker.state === 'dead' || walker.state === 'squash');
});

test('falling out returns to the checkpoint without costing a heart', () => {
  const run = createQuest(0);
  const checkpoint = run.checkpoints[0];
  hero(run).x = checkpoint.x - 13;
  hero(run).y = checkpoint.y - 34;
  stepQuest(run, IDLE_INPUT);
  assert.ok(checkpoint.active);
  const respawnX = run.respawn.x;
  hero(run).y = ROWS * TILE + 200;
  stepQuest(run, IDLE_INPUT);
  assert.equal(hero(run).hearts, SOLO_HEARTS);
  assert.equal(hero(run).x, respawnX);
  assert.equal(run.status, 'playing');
});

test('lava costs a heart and returns to the checkpoint, pits stay free', () => {
  const run = createQuest(9);
  const lavaCol = 22;
  hero(run).x = lavaCol * TILE;
  hero(run).y = 13 * TILE - hero(run).h + 4;
  stepQuest(run, IDLE_INPUT);
  assert.equal(hero(run).hearts, SOLO_HEARTS - 1);
  assert.equal(hero(run).x, run.respawn.x);
  assert.equal(run.status, 'playing');
  hero(run).invulnMs = 0;
  hero(run).y = ROWS * TILE + 200;
  stepQuest(run, IDLE_INPUT);
  assert.equal(hero(run).hearts, SOLO_HEARTS - 1, 'pit fall is free');
});

test('running out of hearts ends the run', () => {
  const run = createQuest(9);
  for (let hit = 0; hit < SOLO_HEARTS; hit++) {
    hero(run).invulnMs = 0;
    hero(run).x = 22 * TILE;
    hero(run).y = 13 * TILE - hero(run).h + 4;
    stepQuest(run, IDLE_INPUT);
  }
  assert.equal(run.status, 'dead');
  assert.equal(hero(run).hearts, 0);
});

test('a spring launches high enough for the upper coin shelf', () => {
  const run = createQuest(0);
  const spring = run.bodies.find(body => body.kind === 'spring')!;
  hero(run).x = spring.x + 4;
  hero(run).y = spring.y - hero(run).h - 4;
  hero(run).vy = 120;
  let apex = hero(run).y;
  for (let frame = 0; frame < 150; frame++) {
    stepQuest(run, IDLE_INPUT);
    apex = Math.min(apex, hero(run).y);
  }
  assert.ok(apex < 6 * TILE, `spring apex row ${(apex / TILE).toFixed(2)}`);
});

test('the boss takes three stomps and opens the gate', () => {
  const run = createQuest(11, { assist: true });
  const boss = run.enemies.find(enemy => enemy.kind === 'boss')!;
  assert.equal(boss.hp, 3);
  assert.equal(run.gateOpen, false);
  hero(run).x = 72 * TILE;
  hero(run).y = 11 * TILE;
  for (let hit = 0; hit < 3; hit++) {
    for (let frame = 0; frame < 1200 && boss.state !== 'dizzy'; frame++) {
      hero(run).invulnMs = 4000;
      stepQuest(run, IDLE_INPUT);
    }
    assert.equal(boss.state, 'dizzy', `hit ${hit} never became dizzy`);
    hero(run).x = boss.x + boss.w / 2 - hero(run).w / 2;
    hero(run).y = boss.y - hero(run).h - 8;
    hero(run).vy = 320;
    hero(run).invulnMs = 4000;
    for (let frame = 0; frame < 8 && boss.hp === 3 - hit; frame++) stepQuest(run, IDLE_INPUT);
    assert.equal(boss.hp, 2 - hit);
  }
  assert.equal(run.gateOpen, true);
});

test('finishing awards stars and stops the clock', () => {
  const run = createQuest(0);
  run.coins = run.level.coinTotal;
  hero(run).x = run.goal.x - 20;
  hero(run).y = run.goal.y - 34;
  stepQuest(run, IDLE_INPUT);
  assert.equal(run.status, 'won');
  assert.equal(questStars(run), 3);
  const elapsed = run.elapsedMs;
  for (let frame = 0; frame < 60; frame++) stepQuest(run, IDLE_INPUT);
  assert.equal(run.elapsedMs, elapsed);
});

test('solo dash attack clears the enemy in front without taking damage', () => {
  const run = createQuest(0);
  const walker = run.enemies.find(enemy => enemy.kind === 'walker')!;
  hero(run).x = walker.x - 70;
  hero(run).y = walker.y;
  hero(run).facing = 1;
  stepQuest(run, { ...IDLE_INPUT, fire: true });
  assert.ok(hero(run).dashMs > 0, 'dash started');
  for (let frame = 0; frame < 30 && walker.state === 'walk'; frame++) stepQuest(run, IDLE_INPUT);
  assert.ok(walker.state === 'dead' || walker.state === 'squash', 'walker cleared');
  assert.equal(hero(run).hearts, SOLO_HEARTS);
});

test('co-op assigns striker and guardian roles with separate cooldowns', () => {
  const run = createQuest(0, { coop: true });
  assert.equal(run.players.length, 2);
  assert.equal(run.players[0].role, 'striker');
  assert.equal(run.players[1].role, 'guardian');
  assert.equal(run.maxHearts, COOP_HEARTS);
  assert.ok(guardianOf(run));
  assert.ok(run.pickups.filter(pickup => pickup.kind === 'heart').length >= run.checkpoints.length);
});

test('guardian shield stuns a rear attacker instead of taking a hit', () => {
  const run = createQuest(0, { coop: true });
  const guardian = run.players[1];
  const walker = run.enemies.find(enemy => enemy.kind === 'walker')!;
  guardian.x = walker.x + 60;
  guardian.y = walker.y;
  guardian.facing = 1;
  walker.x = guardian.x - ROLE.shieldReach - 6;
  walker.dir = 1;
  const before = guardian.hearts;
  for (let frame = 0; frame < 6; frame++) stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(walker.stunMs > 0, 'rear enemy stunned');
  assert.equal(guardian.hearts, before);
  assert.ok(run.guardBreaks > 0);
});

test('guardian dome protects the striker standing inside it', () => {
  const run = createQuest(0, { coop: true });
  const striker = run.players[0];
  const guardian = run.players[1];
  const walker = run.enemies.find(enemy => enemy.kind === 'walker')!;
  guardian.x = walker.x - 40;
  guardian.y = walker.y;
  striker.x = walker.x - 60;
  striker.y = walker.y;
  stepQuest(run, [IDLE_INPUT, { ...IDLE_INPUT, fire: true }]);
  assert.ok(guardian.guardMs > 0, 'dome deployed');
  assert.ok(isProtected(run, striker), 'striker covered');
  striker.x = walker.x;
  striker.y = walker.y;
  walker.stunMs = 0;
  stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.equal(striker.hearts, COOP_HEARTS);
});

test('a downed partner becomes a bubble and is revived on contact', () => {
  const run = createQuest(0, { coop: true });
  const striker = run.players[0];
  const guardian = run.players[1];
  striker.hearts = 1;
  const walker = run.enemies.find(enemy => enemy.kind === 'walker')!;
  striker.x = walker.x;
  striker.y = walker.y;
  stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(striker.bubbleMs > 0, 'striker bubbled');
  assert.equal(run.status, 'playing');
  assert.equal(activePlayers(run).length, 1);
  guardian.x = striker.x;
  guardian.y = striker.y;
  for (let frame = 0; frame < 10 && striker.bubbleMs > 0; frame++) stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.equal(striker.bubbleMs, 0);
  assert.ok(striker.hearts >= 1);
  assert.equal(run.status, 'playing');
});

test('the level only fails when both partners are down', () => {
  const run = createQuest(0, { coop: true });
  const walkers = run.enemies.filter(enemy => enemy.kind === 'walker');
  const striker = run.players[0];
  const guardian = run.players[1];
  striker.hearts = 1;
  striker.x = walkers[0].x;
  striker.y = walkers[0].y;
  stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(striker.bubbleMs > 0, 'striker down');
  assert.equal(run.status, 'playing');
  striker.x = 3 * TILE;
  striker.y = 11 * TILE;
  guardian.hearts = 1;
  guardian.invulnMs = 0;
  guardian.x = walkers[walkers.length - 1].x;
  guardian.y = walkers[walkers.length - 1].y;
  stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(guardian.bubbleMs > 0, 'guardian down');
  assert.equal(run.status, 'dead');
});

test('bouncing on a partner gives a super jump', () => {
  const run = createQuest(0, { coop: true });
  const striker = run.players[0];
  const guardian = run.players[1];
  guardian.x = 6 * TILE;
  guardian.y = 11 * TILE;
  striker.x = guardian.x;
  striker.y = guardian.y - striker.h - 6;
  striker.vy = 320;
  for (let frame = 0; frame < 8 && striker.vy > 0; frame++) stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(striker.vy < -700, `partner bounce ${striker.vy}`);
});

test('co-op link doubles coin value while the pair stays close', () => {
  const run = createQuest(0, { coop: true });
  const coin = run.pickups.find(pickup => pickup.kind === 'coin')!;
  run.players[0].x = coin.x;
  run.players[0].y = coin.y;
  run.players[1].x = coin.x - 40;
  run.players[1].y = coin.y;
  stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(run.coins >= 2, `linked coins ${run.coins}`);
});

test('co-op rear chasers arrive and pressure the back line', () => {
  const run = createQuest(0, { coop: true });
  for (let frame = 0; frame < 60 * 12; frame++) stepQuest(run, [IDLE_INPUT, IDLE_INPUT]);
  assert.ok(run.enemies.some(enemy => enemy.kind === 'chaser'), 'rear chaser spawned');
});

for (const level of QUEST_LEVELS) {
  test(`solo bot clears ${level.id} (${level.name})`, () => {
    const { run, furthest } = playThrough(level.index, { assist: true });
    assert.equal(run.status, 'won',
      `${level.id} stalled at ${(furthest * 100).toFixed(0)}% x=${(hero(run).x / TILE).toFixed(1)}`);
  });
}

for (const level of QUEST_LEVELS) {
  test(`co-op pair clears ${level.id} (${level.name})`, () => {
    const { run, furthest } = playThrough(level.index, { coop: true, assist: true });
    assert.equal(run.status, 'won',
      `${level.id} co-op stalled at ${(furthest * 100).toFixed(0)}% x=${(hero(run).x / TILE).toFixed(1)}`);
    assert.ok(run.players.length === 2);
  });
}

test('co-op is gentler than solo: slower enemies and no heart loss from falls', () => {
  const solo = createQuest(1);
  const coop = createQuest(1, { coop: true });
  const soloWalker = solo.enemies.find(enemy => enemy.kind === 'walker')!;
  const coopWalker = coop.enemies.find(enemy => enemy.kind === 'walker')!;
  for (let frame = 0; frame < 60; frame++) {
    stepQuest(solo, IDLE_INPUT);
    stepQuest(coop, [IDLE_INPUT, IDLE_INPUT]);
  }
  assert.ok(Math.abs(coopWalker.vx) < Math.abs(soloWalker.vx), 'co-op enemies are slower');
  for (const player of coop.players) {
    player.y = ROWS * TILE + 200;
    stepQuest(coop, [IDLE_INPUT, IDLE_INPUT]);
    assert.equal(player.hearts, COOP_HEARTS);
  }
  assert.ok(questProgress(coop) >= 0);
});