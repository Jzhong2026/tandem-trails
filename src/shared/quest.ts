import { GROUND_ROW, QUEST_LEVELS, ROWS, TILE, VIEW_HEIGHT, VIEW_WIDTH } from './quest-levels.js';
import type { QuestLevel, QuestTheme } from './quest-levels.js';
import { DEFAULT_APPEARANCE } from './buddy.js';
import type { BuddyLooks } from './buddy.js';

export const QUEST_STEP = 1 / 60;
export const SOLO_HEARTS = 5;
export const COOP_HEARTS = 3;
export const COOP_ENEMY_PACE = 0.82;
export const LINK_RANGE = TILE * 4.2;

export const ROLE = {
  dashMs: 250,
  dashSpeed: 580,
  dashCooldownMs: 1250,
  guardMs: 2600,
  guardRadius: 118,
  guardCooldownMs: 6200,
  shieldReach: 34,
  stunMs: 1500,
  rearSpawnMs: 7200,
  rearLimit: 3,
} as const;

export type QuestRole = 'striker' | 'guardian';

export const PHYS = {
  walk: 216,
  run: 294,
  accel: 1600,
  airAccel: 1150,
  friction: 1900,
  iceFriction: 340,
  gravity: 2400,
  riseGravity: 1400,
  maxFall: 920,
  jump: -662,
  spring: -1250,
  bounce: -430,
  bounceHeld: -680,
  partnerBounce: -840,
  coyoteMs: 130,
  bufferMs: 160,
  invulnMs: 1500,
  starMs: 9500,
  waterGravity: 540,
  waterMaxFall: 175,
  waterStroke: -238,
  waterSpeed: 178,
} as const;

const SOLID = new Set(['#', '=', 'B', '?', '!', '+', 'u', '[', ']', '(', ')', '{', '}', '>', '<', 'D']);
const HAZARD = new Set(['L', 'S']);
const BLOCK_CHARS = new Set(['?', '!', '+', 'B']);
const PICKUP_CHARS = new Set(['o', 'H', '*', 'm', 'w', '1']);
const ENEMY_CHARS = new Set(['g', 'k', 'f', 's', 'h', 'G']);

export type EnemyKind = 'walker' | 'shell' | 'flyer' | 'spiny' | 'hopper' | 'plant' | 'chaser' | 'boss';
export type PickupKind = 'coin' | 'heart' | 'star' | 'mushroom' | 'flower' | 'candy';
export type BodyKind = 'moverH' | 'moverV' | 'fragile' | 'phase' | 'spring';
export type Pose = 'idle' | 'run' | 'jump' | 'fall' | 'crouch' | 'hurt' | 'win' | 'swim' | 'bubble';

export interface QuestInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  fire: boolean;
  down: boolean;
}

export const IDLE_INPUT: QuestInput = { left: false, right: false, jump: false, run: false, fire: false, down: false };

export interface Player {
  index: number;
  role: QuestRole;
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  hearts: number;
  onGround: boolean; facing: 1 | -1; big: boolean; fire: boolean; crouch: boolean;
  starMs: number; invulnMs: number; hurtMs: number; winMs: number;
  airJump: boolean; coyoteMs: number; bufferMs: number; jumpHeld: boolean; springRise: boolean;
  animMs: number; pose: Pose; riding: number; fireCooldownMs: number; swimMs: number;
  bubbleMs: number; squashMs: number; linkMs: number; cheerMs: number;
  dashMs: number; dashCooldownMs: number; guardMs: number; guardCooldownMs: number;
  shieldFlashMs: number; guardBreakMs: number; fireHeld: boolean;
}

export interface Enemy {
  id: number; kind: EnemyKind; x: number; y: number; vx: number; vy: number;
  w: number; h: number; dir: 1 | -1; baseX: number; baseY: number; phase: number;
  state: 'walk' | 'shell' | 'slide' | 'squash' | 'dizzy' | 'air' | 'dead';
  timerMs: number; hopMs: number; hp: number; hurtMs: number; animMs: number; onGround: boolean;
  stunMs: number; rear: boolean;
}

export interface Pickup {
  id: number; kind: PickupKind; x: number; y: number; vx: number; vy: number;
  w: number; h: number; taken: boolean; emergeMs: number; float: boolean; animMs: number;
}

export interface Body {
  id: number; kind: BodyKind; x: number; y: number; w: number; h: number;
  ox: number; oy: number; range: number; speed: number; phase: number;
  dx: number; dy: number; solid: boolean; timerMs: number; broken: boolean; squashMs: number;
}

export interface Block { col: number; row: number; char: string; bumpMs: number; used: boolean }
export interface Checkpoint { x: number; y: number; active: boolean; animMs: number; giftGiven: boolean }
export interface Shot { id: number; x: number; y: number; vx: number; vy: number; lifeMs: number; animMs: number; owner: number }

export type QuestEventKind =
  | 'jump' | 'coin' | 'stomp' | 'bump' | 'break' | 'power' | 'hurt' | 'spring'
  | 'shoot' | 'checkpoint' | 'win' | 'boss' | 'kick' | 'heal' | 'star' | 'land' | 'gate' | 'fall'
  | 'bubble' | 'revive' | 'partner' | 'link' | 'dash' | 'guard' | 'guardBreak';

export interface QuestEvent { kind: QuestEventKind; x: number; y: number; value?: number; who?: number }

export interface QuestRun {
  levelIndex: number;
  level: QuestLevel;
  tiles: string[][];
  players: Player[];
  coop: boolean;
  maxHearts: number;
  enemies: Enemy[];
  pickups: Pickup[];
  bodies: Body[];
  blocks: Block[];
  checkpoints: Checkpoint[];
  shots: Shot[];
  goal: { x: number; y: number; slideMs: number };
  bossId: number;
  gateOpen: boolean;
  coins: number;
  score: number;
  stomps: number;
  combo: number;
  elapsedMs: number;
  status: 'playing' | 'dead' | 'won';
  deathMs: number;
  respawn: { x: number; y: number };
  events: QuestEvent[];
  cameraX: number;
  cameraY: number;
  shake: number;
  assist: boolean;
  theme: QuestTheme;
  nextId: number;
  rearSpawnMs: number;
  guardBreaks: number;
  viewWidth: number;
  looks: BuddyLooks;
}

export interface QuestOptions { assist?: boolean; coop?: boolean; keep?: { coins: number; score: number }; looks?: BuddyLooks }

function makePlayer(index: number, x: number, y: number, hearts: number, role: QuestRole): Player {
  return {
    index, role, x, y, vx: 0, vy: 0, w: 32, h: 42, hearts,
    onGround: false, facing: 1, big: false, fire: false, crouch: false,
    starMs: 0, invulnMs: 0, hurtMs: 0, winMs: 0,
    airJump: true, coyoteMs: 0, bufferMs: 0, jumpHeld: false, springRise: false,
    animMs: index * 320, pose: 'idle', riding: -1, fireCooldownMs: 0, swimMs: 0,
    bubbleMs: 0, squashMs: 0, linkMs: 0, cheerMs: 0,
    dashMs: 0, dashCooldownMs: 0, guardMs: 0, guardCooldownMs: 0,
    shieldFlashMs: 0, guardBreakMs: 0, fireHeld: false,
  };
}

const ENEMY_SIZE: Record<EnemyKind, [number, number]> = {
  walker: [30, 30], shell: [30, 34], flyer: [30, 26], spiny: [30, 26], hopper: [30, 30], plant: [26, 44],
  chaser: [30, 30], boss: [86, 84],
};
const ENEMY_SPEED: Record<EnemyKind, number> = {
  walker: 46, shell: 54, flyer: 62, spiny: 40, hopper: 44, plant: 0, chaser: 112, boss: 96,
};
const PICKUP_FROM_CHAR: Record<string, PickupKind> = {
  o: 'coin', H: 'heart', '*': 'star', m: 'mushroom', w: 'flower', '1': 'candy',
};
const ENEMY_FROM_CHAR: Record<string, EnemyKind> = {
  g: 'walker', k: 'shell', f: 'flyer', s: 'spiny', h: 'hopper', G: 'boss',
};

export function createQuest(levelIndex: number, options: QuestOptions | boolean = {}): QuestRun {
  const opts: QuestOptions = typeof options === 'boolean' ? { assist: options } : options;
  const coop = opts.coop ?? false;
  const level = QUEST_LEVELS[Math.max(0, Math.min(QUEST_LEVELS.length - 1, levelIndex))];
  const tiles = level.grid.map(row => [...row]);
  const maxHearts = coop ? COOP_HEARTS : SOLO_HEARTS;
  const startX = 3 * TILE;
  const startY = (GROUND_ROW - 1) * TILE;
  const run: QuestRun = {
    levelIndex: level.index,
    level,
    tiles,
    players: [makePlayer(0, startX, startY, maxHearts, 'striker')],
    coop,
    maxHearts,
    enemies: [], pickups: [], bodies: [], blocks: [], checkpoints: [], shots: [],
    goal: { x: (level.width - 6) * TILE, y: (GROUND_ROW - 1) * TILE, slideMs: 0 },
    bossId: -1, gateOpen: false,
    coins: opts.keep?.coins ?? 0, score: opts.keep?.score ?? 0, stomps: 0, combo: 0,
    elapsedMs: 0, status: 'playing', deathMs: 0,
    respawn: { x: startX, y: startY },
    events: [], cameraX: 0, cameraY: 0, shake: 0, assist: opts.assist ?? false, theme: level.theme, nextId: 1,
    rearSpawnMs: ROLE.rearSpawnMs * 0.7, guardBreaks: 0, viewWidth: VIEW_WIDTH,
    looks: opts.looks ?? DEFAULT_APPEARANCE,
  };

  let phaseGroup = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < level.width; col++) {
      const char = tiles[row][col];
      if (char === '.') continue;
      const x = col * TILE;
      const y = row * TILE;
      if (BLOCK_CHARS.has(char)) {
        run.blocks.push({ col, row, char, bumpMs: 0, used: false });
        continue;
      }
      if (char === '@') {
        tiles[row][col] = '.';
        const px = x + (TILE - 32) / 2;
        const py = y + TILE - 42;
        run.players[0] = makePlayer(0, px, py, maxHearts, 'striker');
        if (coop) run.players.push(makePlayer(1, px - 40, py, maxHearts, 'guardian'));
        run.respawn = { x: px, y: py };
        continue;
      }
      if (char === '{') {
        const [w] = ENEMY_SIZE.plant;
        run.enemies.push({
          id: run.nextId++, kind: 'plant', x: x + TILE - w / 2, y, vx: 0, vy: 0, w, h: 0,
          dir: 1, baseX: x + TILE - w / 2, baseY: y, phase: (col * 113) % 4600,
          state: 'walk', timerMs: 0, hopMs: 0, hp: 1, hurtMs: 0, animMs: 0, onGround: true,
          stunMs: 0, rear: false,
        });
        continue;
      }
      if (PICKUP_CHARS.has(char)) {
        tiles[row][col] = '.';
        const kind = PICKUP_FROM_CHAR[char];
        const size = kind === 'coin' ? 22 : 28;
        run.pickups.push({
          id: run.nextId++, kind, x: x + (TILE - size) / 2, y: y + (TILE - size) / 2,
          vx: 0, vy: 0, w: size, h: size, taken: false, emergeMs: 0, float: kind !== 'coin', animMs: (col * 137) % 1000,
        });
        continue;
      }
      if (ENEMY_CHARS.has(char)) {
        tiles[row][col] = '.';
        const kind = ENEMY_FROM_CHAR[char];
        const [w, h] = ENEMY_SIZE[kind];
        const enemy: Enemy = {
          id: run.nextId++, kind, x: x + (TILE - w) / 2, y: y + TILE - h, vx: -ENEMY_SPEED[kind], vy: 0,
          w, h, dir: -1, baseX: x + (TILE - w) / 2, baseY: y + TILE - h, phase: (col * 71) % 628 / 100,
          state: kind === 'flyer' ? 'air' : 'walk', timerMs: 0, hopMs: 900 + (col * 53) % 700,
          hp: kind === 'boss' ? 3 : 1, hurtMs: 0, animMs: (col * 91) % 1000, onGround: false,
          stunMs: 0, rear: false,
        };
        if (kind === 'boss') {
          enemy.y = GROUND_ROW * TILE - h;
          enemy.baseY = enemy.y;
          enemy.timerMs = 1400;
          run.bossId = enemy.id;
        }
        run.enemies.push(enemy);
        continue;
      }
      if (char === 'c') {
        tiles[row][col] = '.';
        run.checkpoints.push({ x: x + TILE / 2, y: y + TILE, active: false, animMs: 0, giftGiven: false });
        continue;
      }
      if (char === 'X') {
        tiles[row][col] = '.';
        run.goal = { x: x + TILE / 2, y: y + TILE, slideMs: 0 };
        continue;
      }
      if (char === '^') {
        tiles[row][col] = '.';
        const spring = makeBody(run, 'spring', x + 3, y + 14, TILE - 6, TILE - 14, 0, 0, 0);
        spring.solid = false;
        run.bodies.push(spring);
        continue;
      }
      if (char === 'M' || char === 'V') {
        tiles[row][col] = '.';
        run.bodies.push(makeBody(run, char === 'M' ? 'moverH' : 'moverV', x - TILE, y + 10, TILE * 3, 18, 1.8, 0.8, (col * 47) % 628 / 100));
        continue;
      }
      if (char === 'T') {
        tiles[row][col] = '.';
        run.bodies.push(makeBody(run, 'fragile', x, y, TILE, TILE, 0, 0, 0));
        continue;
      }
      if (char === '%') {
        let span = 1;
        while (col + span < level.width && tiles[row][col + span] === '%') span++;
        for (let offset = 0; offset < span; offset++) tiles[row][col + offset] = '.';
        run.bodies.push(makeBody(run, 'phase', x, y + 8, TILE * span, 20, 0, 0.62, phaseGroup * 1.35));
        phaseGroup++;
        col += span - 1;
        continue;
      }
    }
  }
  if (coop) {
    for (const checkpoint of run.checkpoints) {
      run.pickups.push({
        id: run.nextId++, kind: 'heart', x: checkpoint.x + 26, y: checkpoint.y - TILE * 2,
        vx: 0, vy: 0, w: 28, h: 28, taken: false, emergeMs: 0, float: true, animMs: 0,
      });
    }
  }
  run.cameraX = cameraTarget(run);
  run.cameraY = cameraTargetY(run);
  return run;
}

function makeBody(run: QuestRun, kind: BodyKind, x: number, y: number, w: number, h: number, range: number, speed: number, phase: number): Body {
  return { id: run.nextId++, kind, x, y, w, h, ox: x, oy: y, range, speed, phase, dx: 0, dy: 0, solid: true, timerMs: 0, broken: false, squashMs: 0 };
}

export function tileAt(run: QuestRun, col: number, row: number): string {
  if (row < 0 || row >= ROWS || col < 0 || col >= run.level.width) return '.';
  return run.tiles[row][col];
}

function isSolid(run: QuestRun, col: number, row: number): boolean {
  const char = tileAt(run, col, row);
  if (char === 'D') return !run.gateOpen;
  return SOLID.has(char);
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function emit(run: QuestRun, kind: QuestEventKind, x: number, y: number, value?: number, who?: number) {
  run.events.push({ kind, x, y, value, who });
}

export function activePlayers(run: QuestRun): Player[] {
  return run.players.filter(player => player.bubbleMs <= 0);
}

function nearestPlayer(run: QuestRun, x: number, y: number): Player | undefined {
  let best: Player | undefined;
  let bestDistance = Infinity;
  for (const player of activePlayers(run)) {
    const distance = Math.hypot(player.x + player.w / 2 - x, player.y + player.h / 2 - y);
    if (distance < bestDistance) { bestDistance = distance; best = player; }
  }
  return best;
}

function cameraTarget(run: QuestRun) {
  const live = activePlayers(run);
  const focus = live.length ? live : run.players;
  const centre = focus.reduce((sum, player) => sum + player.x + player.w / 2, 0) / focus.length;
  const max = Math.max(0, run.level.width * TILE - run.viewWidth);
  return Math.max(0, Math.min(max, centre - run.viewWidth * 0.42));
}

function cameraTargetY(run: QuestRun) {
  const live = activePlayers(run);
  const focus = live.length ? live : run.players;
  const centre = focus.reduce((sum, player) => sum + player.y + player.h / 2, 0) / focus.length;
  const max = Math.max(0, ROWS * TILE - VIEW_HEIGHT);
  return Math.max(0, Math.min(max, centre - VIEW_HEIGHT * 0.58));
}

function setBig(player: Player, big: boolean) {
  if (player.big === big) return;
  const feet = player.y + player.h;
  player.big = big;
  player.w = big ? 38 : 32;
  player.h = big ? 62 : 42;
  player.y = feet - player.h;
}

function solidSpans(run: QuestRun, x: number, y: number, w: number, h: number) {
  const hits: { x: number; y: number; w: number; h: number; body: Body | null; col: number; row: number }[] = [];
  const fromCol = Math.floor(x / TILE);
  const toCol = Math.floor((x + w - 0.01) / TILE);
  const fromRow = Math.floor(y / TILE);
  const toRow = Math.floor((y + h - 0.01) / TILE);
  for (let row = fromRow; row <= toRow; row++) {
    for (let col = fromCol; col <= toCol; col++) {
      if (isSolid(run, col, row)) hits.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE, body: null, col, row });
    }
  }
  for (const body of run.bodies) {
    if (!body.solid || body.broken) continue;
    if (overlaps(x, y, w, h, body.x, body.y, body.w, body.h)) {
      hits.push({ x: body.x, y: body.y, w: body.w, h: body.h, body, col: -1, row: -1 });
    }
  }
  return hits;
}

function oneWaySpans(run: QuestRun, x: number, y: number, w: number, h: number, previousBottom: number) {
  const hits: { x: number; y: number; w: number }[] = [];
  const fromCol = Math.floor(x / TILE);
  const toCol = Math.floor((x + w - 0.01) / TILE);
  const row = Math.floor((y + h - 0.01) / TILE);
  for (let col = fromCol; col <= toCol; col++) {
    if (tileAt(run, col, row) === '-' && previousBottom <= row * TILE + 6) hits.push({ x: col * TILE, y: row * TILE, w: TILE });
  }
  return hits;
}

function moveBodies(run: QuestRun, dt: number, dtMs: number) {
  const seconds = run.elapsedMs / 1000;
  for (const body of run.bodies) {
    const previousX = body.x;
    const previousY = body.y;
    if (body.kind === 'moverH') body.x = body.ox + Math.sin(seconds * body.speed + body.phase) * body.range * TILE;
    if (body.kind === 'moverV') body.y = body.oy + Math.sin(seconds * body.speed + body.phase) * body.range * TILE;
    if (body.kind === 'phase') body.solid = ((seconds * body.speed + body.phase) % (Math.PI * 2)) < Math.PI * 1.72;
    if (body.kind === 'fragile') {
      if (body.broken) {
        body.timerMs -= dtMs;
        body.y += 260 * dt;
        if (body.timerMs <= 0) { body.broken = false; body.y = body.oy; body.timerMs = 0; body.solid = true; }
      } else if (body.timerMs > 0) {
        body.timerMs -= dtMs;
        if (body.timerMs <= 0) {
          body.broken = true; body.solid = false; body.timerMs = 2600;
          emit(run, 'break', body.x + body.w / 2, body.y);
        }
      }
    }
    if (body.squashMs > 0) body.squashMs = Math.max(0, body.squashMs - dtMs);
    body.dx = body.x - previousX;
    body.dy = body.y - previousY;
  }
}

function bumpBlock(run: QuestRun, player: Player, col: number, row: number) {
  const block = run.blocks.find(entry => entry.col === col && entry.row === row);
  const char = tileAt(run, col, row);
  const x = col * TILE + TILE / 2;
  const y = row * TILE;
  if (char === 'B') {
    if (block) block.bumpMs = 200;
    if (player.big) {
      run.tiles[row][col] = '.';
      if (block) block.used = true;
      run.score += 50;
      emit(run, 'break', x, y + TILE / 2, undefined, player.index);
      run.shake = Math.max(run.shake, 5);
    } else {
      emit(run, 'bump', x, y, undefined, player.index);
    }
    return;
  }
  if (!block || block.used) { emit(run, 'bump', x, y, undefined, player.index); return; }
  block.bumpMs = 200;
  block.used = true;
  run.tiles[row][col] = 'u';
  if (char === '?') {
    const bonus = player.linkMs > 0 ? 2 : 1;
    run.coins += bonus;
    run.score += 100 * bonus;
    emit(run, 'coin', x, y, bonus, player.index);
    return;
  }
  const kind: PickupKind = char === '+' ? 'candy' : player.big ? 'flower' : 'mushroom';
  run.pickups.push({
    id: run.nextId++, kind, x: x - 14, y, vx: kind === 'mushroom' ? 70 : 0, vy: 0,
    w: 28, h: 28, taken: false, emergeMs: 420, float: kind !== 'mushroom', animMs: 0,
  });
  emit(run, 'bump', x, y, undefined, player.index);
}

function collect(run: QuestRun, player: Player, pickup: Pickup) {
  pickup.taken = true;
  const x = pickup.x + pickup.w / 2;
  const y = pickup.y + pickup.h / 2;
  switch (pickup.kind) {
    case 'coin': {
      const bonus = player.linkMs > 0 ? 2 : 1;
      run.coins += bonus;
      run.score += 100 * bonus;
      emit(run, 'coin', x, y, bonus, player.index);
      if (bonus > 1) emit(run, 'link', x, y, undefined, player.index);
      break;
    }
    case 'heart':
      player.hearts = Math.min(run.maxHearts, player.hearts + 1);
      run.score += 300;
      emit(run, 'heal', x, y, 1, player.index);
      break;
    case 'candy':
      for (const hero of run.players) hero.hearts = run.maxHearts;
      run.score += 800;
      emit(run, 'heal', x, y, 2, player.index);
      break;
    case 'mushroom':
      if (player.big) { run.score += 500; emit(run, 'heal', x, y, 1, player.index); }
      else { setBig(player, true); emit(run, 'power', x, y, 1, player.index); }
      break;
    case 'flower':
      setBig(player, true);
      player.fire = true;
      run.score += 1000;
      emit(run, 'power', x, y, 2, player.index);
      break;
    case 'star':
      player.starMs = PHYS.starMs;
      if (run.coop) for (const hero of run.players) if (hero !== player) hero.starMs = Math.max(hero.starMs, PHYS.starMs * 0.6);
      run.score += 1000;
      emit(run, 'star', x, y, undefined, player.index);
      break;
  }
}

function bubblePlayer(run: QuestRun, player: Player) {
  player.bubbleMs = 1;
  player.vx = 0;
  player.vy = -40;
  player.starMs = 0;
  player.pose = 'bubble';
  setBig(player, false);
  player.fire = false;
  emit(run, 'bubble', player.x + player.w / 2, player.y, undefined, player.index);
  if (activePlayers(run).length === 0) {
    run.status = 'dead';
    run.deathMs = 0;
  }
}

function revivePlayer(run: QuestRun, player: Player, hearts: number, x: number, y: number) {
  player.bubbleMs = 0;
  player.hearts = hearts;
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = -180;
  player.invulnMs = 2200;
  player.hurtMs = 0;
  player.cheerMs = 900;
  emit(run, 'revive', x + player.w / 2, y, undefined, player.index);
}

export function guardianOf(run: QuestRun): Player | undefined {
  return run.players.find(player => player.role === 'guardian' && player.bubbleMs <= 0);
}

export function isProtected(run: QuestRun, player: Player): boolean {
  if (player.starMs > 0 || player.invulnMs > 0 || player.dashMs > 0 || player.bubbleMs > 0) return true;
  const guardian = guardianOf(run);
  if (!guardian || guardian.guardMs <= 0) return false;
  return Math.hypot(player.x + player.w / 2 - (guardian.x + guardian.w / 2),
    player.y + player.h / 2 - (guardian.y + guardian.h / 2)) < ROLE.guardRadius;
}

function hurtPlayer(run: QuestRun, player: Player, sourceX: number) {
  if (isProtected(run, player) || run.status !== 'playing') return;
  if (player.big) {
    setBig(player, false);
    player.fire = false;
    player.invulnMs = PHYS.invulnMs;
    player.hurtMs = 320;
    emit(run, 'hurt', player.x + player.w / 2, player.y, undefined, player.index);
    run.shake = Math.max(run.shake, 7);
    return;
  }
  player.hearts--;
  run.combo = 0;
  player.invulnMs = PHYS.invulnMs;
  player.hurtMs = 420;
  player.vy = -300;
  player.vx = player.x + player.w / 2 < sourceX ? -170 : 170;
  emit(run, 'hurt', player.x + player.w / 2, player.y + player.h / 2, undefined, player.index);
  run.shake = Math.max(run.shake, 9);
  if (player.hearts > 0) return;
  if (run.assist) { player.hearts = 1; return; }
  if (run.coop) { bubblePlayer(run, player); return; }
  player.hearts = 0;
  run.status = 'dead';
  run.deathMs = 0;
  player.vy = -520;
  emit(run, 'fall', player.x + player.w / 2, player.y, undefined, player.index);
}

function respawnPlayer(run: QuestRun, player: Player) {
  setBig(player, false);
  player.fire = false;
  const base = run.respawn;
  const partner = run.coop
    ? activePlayers(run).find(hero => hero !== player && hero.onGround && hero.x > base.x + 40 && hero.y < ROWS * TILE)
    : undefined;
  player.x = partner ? partner.x - 34 : base.x;
  player.y = partner ? partner.y - 12 : base.y;
  player.vx = 0;
  player.vy = 0;
  player.invulnMs = 1500;
  player.starMs = 0;
  player.hurtMs = 0;
  player.bubbleMs = 0;
}

function hazardHit(run: QuestRun, player: Player) {
  if (run.status !== 'playing' || player.bubbleMs > 0 || player.invulnMs > 0) return;
  run.combo = 0;
  player.hearts--;
  player.invulnMs = PHYS.invulnMs;
  emit(run, 'hurt', player.x + player.w / 2, player.y + player.h / 2, undefined, player.index);
  run.shake = Math.max(run.shake, 10);
  if (player.hearts <= 0) {
    if (run.assist) player.hearts = 1;
    else if (run.coop) { bubblePlayer(run, player); return; }
    else {
      player.hearts = 0;
      run.status = 'dead';
      run.deathMs = 0;
      player.vy = -520;
      emit(run, 'fall', player.x + player.w / 2, player.y, undefined, player.index);
      return;
    }
  }
  respawnPlayer(run, player);
}

function fellOut(run: QuestRun, player: Player) {
  if (run.status !== 'playing' || player.bubbleMs > 0) return;
  run.combo = 0;
  emit(run, 'fall', player.x + player.w / 2, player.y, undefined, player.index);
  run.shake = Math.max(run.shake, 6);
  respawnPlayer(run, player);
}

function landOnTop(run: QuestRun, player: Player, y: number) {
  player.y = y;
  for (const hit of solidSpans(run, player.x, player.y, player.w, player.h)) {
    if (hit.y < y + player.h * 0.5) {
      player.y = hit.y + hit.h;
      player.vy = Math.max(0, player.vy);
      return;
    }
  }
}

function killEnemy(run: QuestRun, enemy: Enemy, byShot = false) {
  if (enemy.kind === 'boss') {
    enemy.hp--;
    enemy.hurtMs = 900;
    enemy.state = 'dizzy';
    enemy.timerMs = 1500;
    run.score += 1500;
    run.shake = Math.max(run.shake, 12);
    emit(run, 'boss', enemy.x + enemy.w / 2, enemy.y, enemy.hp);
    if (enemy.hp <= 0) {
      enemy.state = 'dead';
      enemy.timerMs = 1200;
      run.gateOpen = true;
      run.score += 5000;
      emit(run, 'gate', enemy.x + enemy.w / 2, enemy.y);
    }
    return;
  }
  enemy.state = byShot ? 'dead' : 'squash';
  enemy.timerMs = byShot ? 700 : 420;
  enemy.vy = byShot ? -260 : 0;
  run.combo = Math.min(8, run.combo + 1);
  const gain = 200 * run.combo;
  run.score += gain;
  run.stomps++;
  emit(run, 'stomp', enemy.x + enemy.w / 2, enemy.y, gain);
}

function stepPlayer(run: QuestRun, player: Player, input: QuestInput, dt: number, dtMs: number) {
  const level = run.level;
  const water = level.water;
  player.animMs += dtMs;
  player.squashMs = Math.max(0, player.squashMs - dtMs);
  player.cheerMs = Math.max(0, player.cheerMs - dtMs);
  player.linkMs = Math.max(0, player.linkMs - dtMs);

  if (player.bubbleMs > 0) {
    player.bubbleMs += dtMs;
    const partner = activePlayers(run).find(hero => hero !== player);
    if (partner) {
      const dx = partner.x - player.x;
      const dy = partner.y - 26 - player.y;
      player.x += Math.max(-150, Math.min(150, dx * 1.6)) * dt;
      player.y += Math.max(-120, Math.min(120, dy * 1.6)) * dt;
      player.facing = dx > 0 ? 1 : -1;
      if (Math.hypot(dx, dy) < 40) revivePlayer(run, player, Math.max(1, run.maxHearts - 1), partner.x - 30, partner.y - 12);
      else if (player.bubbleMs > 9000) revivePlayer(run, player, 1, partner.x - 30, partner.y - 12);
    } else {
      player.y -= 26 * dt;
    }
    player.pose = 'bubble';
    return;
  }

  if (run.status === 'won') {
    player.winMs += dtMs;
    if (run.goal.slideMs < 900) {
      player.y = Math.min(run.goal.y - player.h, player.y + 220 * dt);
      player.pose = 'win';
      player.vx = 0;
      player.vy = 0;
    } else {
      player.vx = 130;
      player.x += player.vx * dt;
      player.pose = 'run';
      player.facing = 1;
    }
    return;
  }
  if (run.status === 'dead') {
    player.vy = Math.min(PHYS.maxFall, player.vy + PHYS.gravity * dt);
    player.y += player.vy * dt;
    player.pose = 'hurt';
    return;
  }

  player.invulnMs = Math.max(0, player.invulnMs - dtMs);
  player.hurtMs = Math.max(0, player.hurtMs - dtMs);
  player.starMs = Math.max(0, player.starMs - dtMs);
  player.fireCooldownMs = Math.max(0, player.fireCooldownMs - dtMs);
  player.bufferMs = Math.max(0, player.bufferMs - dtMs);
  player.swimMs = Math.max(0, player.swimMs - dtMs);
  player.dashMs = Math.max(0, player.dashMs - dtMs);
  player.dashCooldownMs = Math.max(0, player.dashCooldownMs - dtMs);
  player.guardMs = Math.max(0, player.guardMs - dtMs);
  player.guardCooldownMs = Math.max(0, player.guardCooldownMs - dtMs);
  player.shieldFlashMs = Math.max(0, player.shieldFlashMs - dtMs);
  player.guardBreakMs = Math.max(0, player.guardBreakMs - dtMs);

  const riding = run.bodies.find(body => body.id === player.riding);
  if (riding && riding.solid && !riding.broken) {
    player.x += riding.dx;
    player.y += riding.dy;
  }
  player.riding = -1;

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.crouch = input.down && player.onGround && player.big && !water;
  const topSpeed = water ? PHYS.waterSpeed : input.run ? PHYS.run : PHYS.walk;
  const accel = player.onGround ? PHYS.accel : PHYS.airAccel;
  const target = player.crouch ? 0 : direction * topSpeed;

  if (direction !== 0 && !player.crouch) {
    player.facing = direction > 0 ? 1 : -1;
    const rate = Math.sign(target - player.vx) === Math.sign(player.vx) || player.vx === 0 ? accel : accel * 1.7;
    player.vx += Math.sign(target - player.vx) * rate * dt;
    if (Math.abs(player.vx) > Math.abs(target) && Math.sign(player.vx) === Math.sign(target)) player.vx = target;
  } else {
    const friction = (level.ice && player.onGround ? PHYS.iceFriction : water ? 700 : PHYS.friction) * dt;
    player.vx = Math.abs(player.vx) <= friction ? 0 : player.vx - Math.sign(player.vx) * friction;
  }

  const jumpPressed = input.jump && !player.jumpHeld;
  if (jumpPressed) player.bufferMs = PHYS.bufferMs;
  if (!input.jump && player.jumpHeld && player.vy < -230 && !player.springRise) player.vy = -230;
  player.jumpHeld = input.jump;

  if (water) {
    if (input.jump && player.swimMs <= 0) {
      player.vy = PHYS.waterStroke;
      player.bufferMs = 0;
      player.swimMs = 250;
      player.springRise = false;
      emit(run, 'jump', player.x + player.w / 2, player.y + player.h, undefined, player.index);
    }
    player.vy = Math.min(PHYS.waterMaxFall, player.vy + PHYS.waterGravity * dt);
  } else {
    if (player.onGround) { player.coyoteMs = PHYS.coyoteMs; player.airJump = true; }
    else player.coyoteMs = Math.max(0, player.coyoteMs - dtMs);
    const extraJump = run.assist && jumpPressed && player.airJump && player.coyoteMs <= 0 && player.vy >= 0;
    if (player.bufferMs > 0 && (player.coyoteMs > 0 || extraJump)) {
      if (extraJump) player.airJump = false;
      player.vy = PHYS.jump * (extraJump ? .82 : 1);
      player.onGround = false;
      player.coyoteMs = 0;
      player.bufferMs = 0;
      player.springRise = false;
      emit(run, 'jump', player.x + player.w / 2, player.y + player.h, undefined, player.index);
    }
    const gravity = player.vy < 0 && input.jump && !player.springRise ? PHYS.riseGravity : PHYS.gravity;
    player.vy = Math.min(PHYS.maxFall, player.vy + gravity * dt);
    if (player.vy >= 0) player.springRise = false;
  }

  if (player.dashMs > 0) player.vx = player.facing * ROLE.dashSpeed;

  const firePressed = input.fire && !player.fireHeld;
  player.fireHeld = input.fire;
  if (run.coop && player.role === 'guardian') {
    if (firePressed && player.guardCooldownMs <= 0) {
      player.guardMs = ROLE.guardMs;
      player.guardCooldownMs = ROLE.guardCooldownMs;
      player.cheerMs = 700;
      run.shake = Math.max(run.shake, 5);
      emit(run, 'guard', player.x + player.w / 2, player.y + player.h / 2, undefined, player.index);
    }
  } else if (player.fire) {
    if (input.fire && player.fireCooldownMs <= 0 && run.shots.length < 6) {
      player.fireCooldownMs = 320;
      run.shots.push({
        id: run.nextId++, x: player.x + player.w / 2 + player.facing * 14, y: player.y + player.h * 0.4,
        vx: player.facing * 400, vy: -60, lifeMs: 2600, animMs: 0, owner: player.index,
      });
      emit(run, 'shoot', player.x + player.w / 2, player.y + player.h * 0.4, undefined, player.index);
    }
  } else if (firePressed && player.dashCooldownMs <= 0) {
    player.dashMs = ROLE.dashMs;
    player.dashCooldownMs = ROLE.dashCooldownMs;
    player.vx = player.facing * ROLE.dashSpeed;
    emit(run, 'dash', player.x + player.w / 2, player.y + player.h / 2, undefined, player.index);
  }

  const previousBottom = player.y + player.h;
  const wasOnGround = player.onGround;
  player.onGround = false;

  player.x += player.vx * dt;
  for (const hit of solidSpans(run, player.x, player.y, player.w, player.h)) {
    if (player.vx > 0) player.x = hit.x - player.w;
    else if (player.vx < 0) player.x = hit.x + hit.w;
    player.vx = 0;
  }
  player.x = Math.max(0, Math.min(level.width * TILE - player.w, player.x));

  player.y += player.vy * dt;
  for (const hit of solidSpans(run, player.x, player.y, player.w, player.h)) {
    if (player.vy > 0) {
      player.y = hit.y - player.h;
      player.onGround = true;
      if (hit.body) {
        player.riding = hit.body.id;
        if (hit.body.kind === 'fragile' && hit.body.timerMs <= 0) hit.body.timerMs = 620;
      }
      const belt = tileAt(run, Math.floor((player.x + player.w / 2) / TILE), Math.floor((player.y + player.h + 2) / TILE));
      if (belt === '>') player.x += 105 * dt;
      if (belt === '<') player.x -= 105 * dt;
      if (!wasOnGround && player.vy > 380) emit(run, 'land', player.x + player.w / 2, player.y + player.h, undefined, player.index);
      player.vy = 0;
    } else if (player.vy < 0) {
      player.y = hit.y + hit.h;
      player.vy = 60;
      if (hit.col >= 0) bumpBlock(run, player, hit.col, hit.row);
      break;
    }
  }
  if (player.vy >= 0) {
    for (const hit of oneWaySpans(run, player.x, player.y, player.w, player.h, previousBottom)) {
      player.y = hit.y - player.h;
      player.vy = 0;
      player.onGround = true;
      if (!wasOnGround) emit(run, 'land', player.x + player.w / 2, player.y + player.h, undefined, player.index);
    }
    for (const body of run.bodies) {
      if (body.kind !== 'spring' || player.vy < -40) continue;
      if (!overlaps(player.x, player.y, player.w, player.h, body.x, body.y - 8, body.w, body.h + 8)) continue;
      player.y = body.y - player.h;
      player.vy = PHYS.spring;
      player.onGround = false;
      player.springRise = true;
      body.squashMs = 280;
      emit(run, 'spring', body.x + body.w / 2, body.y, undefined, player.index);
      break;
    }
  }

  if (!player.onGround && wasOnGround && player.vy >= 0) player.coyoteMs = PHYS.coyoteMs;

  for (let row = Math.floor(player.y / TILE); row <= Math.floor((player.y + player.h - 1) / TILE); row++) {
    for (let col = Math.floor(player.x / TILE); col <= Math.floor((player.x + player.w - 1) / TILE); col++) {
      if (!HAZARD.has(tileAt(run, col, row)) || player.starMs > 0) continue;
      hazardHit(run, player);
      return;
    }
  }
  if (player.y > ROWS * TILE + 80 || player.y + player.h < -40) { fellOut(run, player); return; }

  player.pose = water ? 'swim'
    : player.hurtMs > 0 ? 'hurt'
      : player.crouch ? 'crouch'
        : !player.onGround ? (player.vy < 0 ? 'jump' : 'fall')
          : Math.abs(player.vx) > 12 ? 'run' : 'idle';
}

function stepEnemies(run: QuestRun, dt: number, dtMs: number) {
  const pace = run.coop ? COOP_ENEMY_PACE : 1;
  for (const enemy of run.enemies) {
    enemy.animMs += dtMs;
    enemy.hurtMs = Math.max(0, enemy.hurtMs - dtMs);
    if (enemy.state === 'squash' || enemy.state === 'dead') {
      enemy.timerMs -= dtMs;
      if (enemy.state === 'dead') {
        enemy.vy += PHYS.gravity * dt;
        enemy.y += enemy.vy * dt;
        enemy.x += enemy.vx * dt * 0.4;
      }
      continue;
    }
    const focus = nearestPlayer(run, enemy.x, enemy.y);
    if (!focus || Math.abs(enemy.x - focus.x) > VIEW_WIDTH * 1.35) continue;

    if (enemy.stunMs > 0) {
      enemy.stunMs = Math.max(0, enemy.stunMs - dtMs);
      enemy.vx = 0;
      enemy.vy = Math.min(PHYS.maxFall, enemy.vy + PHYS.gravity * dt);
      enemy.y += enemy.vy * dt;
      const row = Math.floor((enemy.y + enemy.h) / TILE);
      for (let col = Math.floor(enemy.x / TILE); col <= Math.floor((enemy.x + enemy.w - 1) / TILE); col++) {
        if (isSolid(run, col, row) || tileAt(run, col, row) === '-') { enemy.y = row * TILE - enemy.h; enemy.vy = 0; break; }
      }
      continue;
    }

    if (enemy.kind === 'plant') {
      const cycle = (run.elapsedMs + enemy.phase) % 4600;
      const near = Math.abs(focus.x + focus.w / 2 - (enemy.baseX + enemy.w / 2)) < 54 && focus.y + focus.h < enemy.baseY + 20;
      let extension = 0;
      if (!near) {
        if (cycle >= 2400 && cycle < 2900) extension = (cycle - 2400) / 500;
        else if (cycle >= 2900 && cycle < 4100) extension = 1;
        else if (cycle >= 4100) extension = 1 - (cycle - 4100) / 500;
      }
      enemy.h = Math.round(ENEMY_SIZE.plant[1] * extension);
      enemy.y = enemy.baseY - enemy.h;
      continue;
    }

    if (enemy.kind === 'flyer') {
      const seconds = run.elapsedMs / 1000;
      enemy.x = enemy.baseX + Math.sin(seconds * 0.7 * pace + enemy.phase) * TILE * 3;
      enemy.y = enemy.baseY + Math.sin(seconds * 1.5 * pace + enemy.phase * 1.7) * TILE * 1.4;
      enemy.dir = Math.cos(seconds * 0.7 * pace + enemy.phase) > 0 ? 1 : -1;
      continue;
    }

    if (enemy.kind === 'boss') { stepBoss(run, enemy, focus, dt, dtMs); continue; }

    if (enemy.kind === 'chaser') {
      enemy.dir = focus.x + focus.w / 2 > enemy.x + enemy.w / 2 ? 1 : -1;
      enemy.vx = enemy.dir * ENEMY_SPEED.chaser * pace;
      enemy.vy = Math.min(PHYS.maxFall, enemy.vy + PHYS.gravity * dt);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      const row = Math.floor((enemy.y + enemy.h) / TILE);
      enemy.onGround = false;
      for (let col = Math.floor(enemy.x / TILE); col <= Math.floor((enemy.x + enemy.w - 1) / TILE); col++) {
        if (isSolid(run, col, row) || tileAt(run, col, row) === '-') {
          enemy.y = row * TILE - enemy.h;
          enemy.vy = 0;
          enemy.onGround = true;
          break;
        }
      }
      if (enemy.onGround) {
        const aheadCol = Math.floor((enemy.dir > 0 ? enemy.x + enemy.w + 6 : enemy.x - 6) / TILE);
        const wallRow = Math.floor((enemy.y + enemy.h - 6) / TILE);
        if (isSolid(run, aheadCol, wallRow)) enemy.vy = -560;
      }
      if (enemy.y > ROWS * TILE + 120) { enemy.state = 'dead'; enemy.timerMs = 0; }
      continue;
    }

    const lead = run.players.reduce((best, hero) => hero.x > best.x ? hero : best, run.players[0]);
    const rearPressure = run.coop && enemy.x < lead.x - TILE * 2 && lead.x - enemy.x < TILE * 10
      && (enemy.kind === 'walker' || enemy.kind === 'spiny');
    if (rearPressure) enemy.dir = 1;

    if (enemy.state === 'shell') {
      enemy.vx = 0;
      enemy.timerMs -= dtMs;
      if (enemy.timerMs <= 0) {
        enemy.state = 'walk'; enemy.vx = -ENEMY_SPEED.shell; enemy.dir = -1;
        enemy.h = ENEMY_SIZE.shell[1]; enemy.y -= 12;
      }
    } else if (enemy.state === 'slide') {
      enemy.vx = enemy.dir * 380;
    } else {
      enemy.vx = enemy.dir * ENEMY_SPEED[enemy.kind] * pace * (rearPressure ? 1.3 : 1);
      if (enemy.kind === 'hopper') {
        enemy.hopMs -= dtMs;
        if (enemy.hopMs <= 0 && enemy.onGround) {
          enemy.vy = -520;
          enemy.hopMs = 1700;
          enemy.onGround = false;
        }
      }
    }

    enemy.vy = Math.min(PHYS.maxFall, enemy.vy + PHYS.gravity * dt);
    enemy.x += enemy.vx * dt;
    const fromRow = Math.floor(enemy.y / TILE);
    const toRow = Math.floor((enemy.y + enemy.h - 1) / TILE);
    const frontCol = Math.floor((enemy.dir > 0 ? enemy.x + enemy.w : enemy.x) / TILE);
    for (let row = fromRow; row <= toRow; row++) {
      if (isSolid(run, frontCol, row)) {
        enemy.dir = enemy.dir > 0 ? -1 : 1;
        enemy.x = enemy.dir > 0 ? frontCol * TILE + TILE : frontCol * TILE - enemy.w;
        if (enemy.state === 'slide') emit(run, 'bump', enemy.x + enemy.w / 2, enemy.y);
        break;
      }
    }
    enemy.y += enemy.vy * dt;
    enemy.onGround = false;
    if (enemy.vy > 0) {
      const row = Math.floor((enemy.y + enemy.h) / TILE);
      for (let col = Math.floor(enemy.x / TILE); col <= Math.floor((enemy.x + enemy.w - 1) / TILE); col++) {
        if (isSolid(run, col, row) || tileAt(run, col, row) === '-') {
          enemy.y = row * TILE - enemy.h;
          enemy.vy = 0;
          enemy.onGround = true;
          break;
        }
      }
    }
    if (enemy.onGround && enemy.state === 'walk' && !rearPressure) {
      const aheadCol = Math.floor((enemy.dir > 0 ? enemy.x + enemy.w + 4 : enemy.x - 4) / TILE);
      const belowRow = Math.floor((enemy.y + enemy.h + 4) / TILE);
      if (!isSolid(run, aheadCol, belowRow) && tileAt(run, aheadCol, belowRow) !== '-') enemy.dir = enemy.dir > 0 ? -1 : 1;
    }
    if (enemy.y > ROWS * TILE + 120) { enemy.state = 'dead'; enemy.timerMs = 0; }

    if (enemy.state === 'slide') {
      for (const other of run.enemies) {
        if (other === enemy || other.state === 'dead' || other.state === 'squash' || other.kind === 'boss') continue;
        if (overlaps(enemy.x, enemy.y, enemy.w, enemy.h, other.x, other.y, other.w, other.h)) killEnemy(run, other, true);
      }
    }
  }
  run.enemies = run.enemies.filter(enemy => !((enemy.state === 'dead' || enemy.state === 'squash') && enemy.timerMs <= 0));
}

function stepBoss(run: QuestRun, boss: Enemy, focus: Player, dt: number, dtMs: number) {
  const pace = run.coop ? COOP_ENEMY_PACE : 1;
  boss.timerMs -= dtMs;
  if (boss.state === 'dizzy') {
    boss.vx = 0;
    if (boss.timerMs <= 0) { boss.state = 'walk'; boss.timerMs = 1100; }
  } else if (boss.state === 'walk') {
    boss.dir = focus.x + focus.w / 2 < boss.x + boss.w / 2 ? -1 : 1;
    boss.vx = boss.dir * ENEMY_SPEED.boss * pace;
    if (boss.timerMs <= 0) {
      boss.state = 'air';
      boss.vy = -760;
      boss.vx = boss.dir * 190 * pace;
      boss.timerMs = 2600;
    }
  }
  boss.vy = Math.min(PHYS.maxFall, boss.vy + PHYS.gravity * dt);
  boss.x += boss.vx * dt;
  boss.x = Math.max(boss.baseX - TILE * 12, Math.min(boss.baseX + TILE * 12, boss.x));
  boss.y += boss.vy * dt;
  const floor = GROUND_ROW * TILE - boss.h;
  if (boss.y >= floor) {
    const landing = boss.state === 'air';
    boss.y = floor;
    boss.vy = 0;
    if (landing) {
      boss.state = 'dizzy';
      boss.timerMs = run.coop ? 2600 : 2100;
      run.shake = Math.max(run.shake, 14);
      emit(run, 'boss', boss.x + boss.w / 2, boss.y + boss.h, -1);
    } else if (boss.state !== 'dizzy') {
      boss.state = 'walk';
    }
  }
}

function stepPickups(run: QuestRun, dt: number, dtMs: number) {
  for (const pickup of run.pickups) {
    if (pickup.taken) continue;
    pickup.animMs += dtMs;
    if (pickup.emergeMs > 0) {
      pickup.emergeMs = Math.max(0, pickup.emergeMs - dtMs);
      pickup.y -= 68 * dt;
      continue;
    }
    if ((pickup.kind === 'mushroom' || pickup.kind === 'candy') && pickup.vx !== 0) {
      pickup.vy = Math.min(PHYS.maxFall, pickup.vy + PHYS.gravity * dt);
      pickup.x += pickup.vx * dt;
      const col = Math.floor((pickup.vx > 0 ? pickup.x + pickup.w : pickup.x) / TILE);
      for (let row = Math.floor(pickup.y / TILE); row <= Math.floor((pickup.y + pickup.h - 1) / TILE); row++) {
        if (isSolid(run, col, row)) { pickup.vx = -pickup.vx; break; }
      }
      pickup.y += pickup.vy * dt;
      const row = Math.floor((pickup.y + pickup.h) / TILE);
      for (let c = Math.floor(pickup.x / TILE); c <= Math.floor((pickup.x + pickup.w - 1) / TILE); c++) {
        if (isSolid(run, c, row) || tileAt(run, c, row) === '-') { pickup.y = row * TILE - pickup.h; pickup.vy = 0; break; }
      }
      if (pickup.y > ROWS * TILE + 60) { pickup.taken = true; continue; }
    }
    if (run.status !== 'playing') continue;
    for (const player of activePlayers(run)) {
      if (Math.abs(pickup.x - player.x) > VIEW_WIDTH) continue;
      if (overlaps(player.x, player.y, player.w, player.h, pickup.x, pickup.y, pickup.w, pickup.h)) {
        collect(run, player, pickup);
        break;
      }
    }
  }
  run.pickups = run.pickups.filter(pickup => !pickup.taken);
}

function stepShots(run: QuestRun, dt: number, dtMs: number) {
  for (const shot of run.shots) {
    shot.lifeMs -= dtMs;
    shot.animMs += dtMs;
    shot.vy = Math.min(560, shot.vy + 1500 * dt);
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    const col = Math.floor(shot.x / TILE);
    const row = Math.floor(shot.y / TILE);
    if (isSolid(run, col, row)) { shot.lifeMs = 0; emit(run, 'bump', shot.x, shot.y); }
    const floorRow = Math.floor((shot.y + 8) / TILE);
    if (isSolid(run, col, floorRow) || tileAt(run, col, floorRow) === '-') { shot.y = floorRow * TILE - 8; shot.vy = -300; }
    for (const enemy of run.enemies) {
      if (enemy.state === 'dead' || enemy.state === 'squash') continue;
      if (enemy.kind === 'boss' && enemy.state !== 'dizzy') continue;
      if (overlaps(shot.x - 8, shot.y - 8, 16, 16, enemy.x, enemy.y, enemy.w, enemy.h)) {
        killEnemy(run, enemy, true);
        shot.lifeMs = 0;
        break;
      }
    }
  }
  run.shots = run.shots.filter(shot => shot.lifeMs > 0 && shot.x > run.cameraX - 120 && shot.x < run.cameraX + VIEW_WIDTH + 240);
}

function stunEnemy(run: QuestRun, enemy: Enemy, fromX: number, strong = false) {
  if (enemy.kind === 'boss' || enemy.kind === 'plant') return false;
  enemy.stunMs = ROLE.stunMs;
  enemy.vx = 0;
  enemy.vy = -220;
  enemy.x += enemy.x + enemy.w / 2 < fromX ? -14 : 14;
  enemy.dir = enemy.x + enemy.w / 2 < fromX ? -1 : 1;
  run.guardBreaks++;
  run.score += strong ? 300 : 150;
  emit(run, 'guardBreak', enemy.x + enemy.w / 2, enemy.y, strong ? 2 : 1);
  return true;
}

function guardSweep(run: QuestRun) {
  const guardian = guardianOf(run);
  if (!guardian) return;
  const cx = guardian.x + guardian.w / 2;
  const cy = guardian.y + guardian.h / 2;
  const back = guardian.facing > 0 ? -1 : 1;
  const shieldX = back > 0 ? guardian.x + guardian.w : guardian.x - ROLE.shieldReach;
  for (const enemy of run.enemies) {
    if (enemy.state === 'dead' || enemy.state === 'squash' || enemy.h <= 0 || enemy.stunMs > 0) continue;
    if (enemy.kind === 'boss') continue;
    if (guardian.guardMs > 0 && Math.hypot(enemy.x + enemy.w / 2 - cx, enemy.y + enemy.h / 2 - cy) < ROLE.guardRadius) {
      if (stunEnemy(run, enemy, cx, true)) guardian.shieldFlashMs = 300;
      continue;
    }
    if (overlaps(shieldX, guardian.y - 6, ROLE.shieldReach, guardian.h + 12, enemy.x, enemy.y, enemy.w, enemy.h)) {
      if (stunEnemy(run, enemy, cx)) guardian.shieldFlashMs = 260;
    }
  }
}

function stepInteractions(run: QuestRun, player: Player) {
  if (run.status !== 'playing' || player.bubbleMs > 0) return;
  const previousBottom = player.y + player.h - player.vy * QUEST_STEP;

  for (const enemy of run.enemies) {
    if (enemy.state === 'dead' || enemy.state === 'squash' || enemy.h <= 0) continue;
    if (!overlaps(player.x, player.y, player.w, player.h, enemy.x, enemy.y, enemy.w, enemy.h)) continue;
    if (player.starMs > 0 || player.dashMs > 0) {
      if (enemy.kind === 'boss' && enemy.state !== 'dizzy') { hurtPlayer(run, player, enemy.x + enemy.w / 2); continue; }
      killEnemy(run, enemy, true);
      continue;
    }
    if (enemy.stunMs > 0) {
      killEnemy(run, enemy, true);
      run.score += 200;
      player.vy = Math.min(player.vy, PHYS.bounce);
      continue;
    }
    const stompable = enemy.kind !== 'spiny' && enemy.kind !== 'plant'
      && !(enemy.kind === 'boss' && enemy.state !== 'dizzy');
    const fromAbove = player.vy > 40 && previousBottom <= enemy.y + enemy.h * 0.55;
    if (enemy.kind === 'shell' && enemy.state === 'shell' && !fromAbove) {
      enemy.state = 'slide';
      enemy.dir = player.x + player.w / 2 < enemy.x + enemy.w / 2 ? 1 : -1;
      enemy.timerMs = 6000;
      player.vx = -enemy.dir * 90;
      emit(run, 'kick', enemy.x + enemy.w / 2, enemy.y, undefined, player.index);
      run.score += 100;
      continue;
    }
    if (stompable && fromAbove) {
      if (enemy.kind === 'shell' && enemy.state === 'walk') {
        enemy.state = 'shell';
        enemy.timerMs = 5200;
        enemy.h = 22;
        enemy.y += ENEMY_SIZE.shell[1] - 22;
        run.combo = Math.min(8, run.combo + 1);
        run.score += 200 * run.combo;
        run.stomps++;
        emit(run, 'stomp', enemy.x + enemy.w / 2, enemy.y, 200 * run.combo, player.index);
      } else {
        killEnemy(run, enemy);
      }
      player.vy = player.jumpHeld ? PHYS.bounceHeld : PHYS.bounce;
      player.springRise = false;
      landOnTop(run, player, enemy.y - player.h);
      run.shake = Math.max(run.shake, 4);
      continue;
    }
    if (enemy.kind === 'boss' && enemy.state === 'dizzy') {
      player.vy = PHYS.bounce;
      landOnTop(run, player, enemy.y - player.h);
      continue;
    }
    if (isProtected(run, player)) {
      if (stunEnemy(run, enemy, player.x + player.w / 2)) continue;
    }
    hurtPlayer(run, player, enemy.x + enemy.w / 2);
  }

  for (const partner of run.players) {
    if (partner === player) continue;
    if (partner.bubbleMs > 0) {
      if (overlaps(player.x, player.y, player.w, player.h, partner.x - 12, partner.y - 12, partner.w + 24, partner.h + 24)) {
        revivePlayer(run, partner, Math.max(1, run.maxHearts - 1), partner.x, partner.y);
      }
      continue;
    }
    if (!overlaps(player.x, player.y, player.w, player.h, partner.x, partner.y, partner.w, partner.h)) continue;
    if (player.vy > 60 && previousBottom <= partner.y + 16) {
      player.vy = PHYS.partnerBounce;
      player.springRise = true;
      landOnTop(run, player, partner.y - player.h);
      partner.squashMs = 300;
      partner.cheerMs = 600;
      run.score += 150;
      emit(run, 'partner', partner.x + partner.w / 2, partner.y, undefined, player.index);
    }
  }

  for (const checkpoint of run.checkpoints) {
    if (checkpoint.active) continue;
    if (Math.abs(player.x + player.w / 2 - checkpoint.x) < 36 && Math.abs(player.y + player.h - checkpoint.y) < 76) {
      checkpoint.active = true;
      run.respawn = { x: checkpoint.x - player.w / 2, y: checkpoint.y - player.h };
      run.score += 200;
      emit(run, 'checkpoint', checkpoint.x, checkpoint.y - 60);
      if (run.coop) {
        for (const hero of run.players) hero.hearts = Math.min(run.maxHearts, hero.hearts + 1);
        emit(run, 'heal', checkpoint.x, checkpoint.y - 90, 2);
      }
    }
  }

  const goal = run.goal;
  const poleTop = run.level.water ? 0 : goal.y - 320;
  if (Math.abs(player.x + player.w / 2 - goal.x) < 42 && player.y + player.h > poleTop && player.y < goal.y + 24) {
    if (run.bossId >= 0 && !run.gateOpen) return;
    run.status = 'won';
    for (const hero of run.players) {
      hero.bubbleMs = 0;
      hero.vx = 0;
      hero.vy = 0;
      hero.winMs = 0;
      hero.hearts = Math.max(1, hero.hearts);
    }
    player.x = goal.x - player.w - 6;
    run.score += 1000 + Math.max(0, 240 - Math.floor(run.elapsedMs / 1000)) * 10;
    emit(run, 'win', goal.x, goal.y - 120);
  }
}

function spawnRearChaser(run: QuestRun) {
  const x = Math.max(TILE, run.cameraX - 40);
  const col = Math.floor(x / TILE);
  let row = 0;
  while (row < ROWS && !isSolid(run, col, row) && tileAt(run, col, row) !== '-') row++;
  if (row >= ROWS) return;
  const [w, h] = ENEMY_SIZE.chaser;
  run.enemies.push({
    id: run.nextId++, kind: 'chaser', x, y: row * TILE - h, vx: ENEMY_SPEED.chaser, vy: 0, w, h,
    dir: 1, baseX: x, baseY: row * TILE - h, phase: 0, state: 'walk', timerMs: 0, hopMs: 0,
    hp: 1, hurtMs: 0, animMs: 0, onGround: true, stunMs: 0, rear: true,
  });
  emit(run, 'bubble', x, row * TILE - h, 0);
}

export function stepQuest(run: QuestRun, inputs: QuestInput | QuestInput[], dt = QUEST_STEP) {
  const dtMs = dt * 1000;
  const list = Array.isArray(inputs) ? inputs : [inputs];
  run.elapsedMs += run.status === 'playing' ? dtMs : 0;
  run.shake = Math.max(0, run.shake - dt * 26);
  moveBodies(run, dt, dtMs);
  for (const player of run.players) stepPlayer(run, player, list[player.index] ?? IDLE_INPUT, dt, dtMs);

  if (run.coop && run.status === 'playing') {
    const live = activePlayers(run);
    if (live.length === 2) {
      const distance = Math.hypot(live[0].x - live[1].x, live[0].y - live[1].y);
      if (distance < LINK_RANGE) for (const hero of live) hero.linkMs = 140;
    }
    run.rearSpawnMs -= dtMs;
    if (run.rearSpawnMs <= 0) {
      run.rearSpawnMs = ROLE.rearSpawnMs;
      if (run.enemies.filter(enemy => enemy.rear && enemy.state !== 'dead').length < ROLE.rearLimit) spawnRearChaser(run);
    }
    guardSweep(run);
  }

  stepEnemies(run, dt, dtMs);
  stepPickups(run, dt, dtMs);
  stepShots(run, dt, dtMs);
  for (const player of run.players) stepInteractions(run, player);

  if (run.status === 'dead') run.deathMs += dtMs;
  for (const block of run.blocks) if (block.bumpMs > 0) block.bumpMs = Math.max(0, block.bumpMs - dtMs);
  for (const checkpoint of run.checkpoints) if (checkpoint.active) checkpoint.animMs += dtMs;

  const target = cameraTarget(run);
  run.cameraX += (target - run.cameraX) * Math.min(1, dt * 7.5);
  run.cameraX = Math.max(0, Math.min(Math.max(0, run.level.width * TILE - run.viewWidth), run.cameraX));
  const targetY = cameraTargetY(run);
  run.cameraY += (targetY - run.cameraY) * Math.min(1, dt * 4.2);
  run.cameraY = Math.max(0, Math.min(Math.max(0, ROWS * TILE - VIEW_HEIGHT), run.cameraY));

  if (run.coop && run.status === 'playing') {
    for (const player of activePlayers(run)) {
      if (player.x + player.w < run.cameraX - 8) {
        const partner = activePlayers(run).find(hero => hero !== player);
        emit(run, 'fall', player.x + player.w / 2, player.y, undefined, player.index);
        player.x = partner ? partner.x - 30 : run.cameraX + 20;
        player.y = partner ? partner.y - 12 : run.respawn.y;
        player.vx = 0;
        player.vy = 0;
        player.invulnMs = 1400;
      }
    }
  }
}

export function teamHearts(run: QuestRun): number {
  return run.players.reduce((sum, player) => sum + Math.max(0, player.hearts), 0);
}

export function questStars(run: QuestRun): number {
  let stars = 1;
  if (run.level.coinTotal > 0 && run.coins >= Math.ceil(run.level.coinTotal * 0.6)) stars++;
  if (teamHearts(run) >= run.maxHearts * run.players.length - 1) stars++;
  return stars;
}

export function questProgress(run: QuestRun): number {
  const lead = Math.max(...run.players.map(player => player.x));
  return Math.max(0, Math.min(1, (lead - 3 * TILE) / Math.max(1, run.goal.x - 3 * TILE)));
}

export function bossOf(run: QuestRun): Enemy | undefined {
  return run.enemies.find(enemy => enemy.id === run.bossId);
}

export { SOLID as QUEST_SOLID_TILES, HAZARD as QUEST_HAZARD_TILES };
export type { QuestLevel, QuestTheme };