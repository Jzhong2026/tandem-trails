import { drawLandscape, drawModel, models } from './diorama.js';
import type { QuestEvent, QuestRun } from '../shared/quest.js';
import { activePlayers } from '../shared/quest.js';
import { ROWS, TILE, VIEW_HEIGHT, VIEW_WIDTH } from '../shared/quest-levels.js';
import {
  ellipse, glow, paintBody, paintCheckpoint, paintEnemy, paintGoal, paintHero, paintLink,
  paintPickup, paintShot, polygon, roundRect,
} from './quest-art.js';
import { paintDynamicTiles, paintParallax, paintSky, paintTiles, paintVignette, paintWeather, THEME_SKINS } from './quest-scenery.js';

type Context = CanvasRenderingContext2D;

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 'spark' | 'ring' | 'text' | 'star' | 'dust';
  text?: string; gravity: number; spin: number;
}

export class ParticleField {
  private items: Particle[] = [];

  clear() { this.items.length = 0; }

  get count() { return this.items.length; }

  burst(x: number, y: number, count: number, colors: string[], speed = 170, kind: Particle['kind'] = 'spark') {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const power = speed * (0.45 + Math.random() * 0.75);
      this.items.push({
        x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - 40,
        life: 0.42 + Math.random() * 0.4, max: 0.82, size: 2 + Math.random() * 3.4,
        color: colors[i % colors.length], kind, gravity: 420, spin: Math.random() * 6,
      });
    }
  }

  ring(x: number, y: number, color: string, size = 26) {
    this.items.push({ x, y, vx: 0, vy: 0, life: 0.36, max: 0.36, size, color, kind: 'ring', gravity: 0, spin: 0 });
  }

  float(x: number, y: number, text: string, color: string) {
    this.items.push({ x, y, vx: 0, vy: -58, life: 0.85, max: 0.85, size: 15, color, kind: 'text', text, gravity: -20, spin: 0 });
  }

  puff(x: number, y: number, color: string) {
    for (let i = 0; i < 6; i++) {
      this.items.push({
        x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 50,
        life: 0.3 + Math.random() * 0.25, max: 0.55, size: 3 + Math.random() * 4, color, kind: 'dust', gravity: 60, spin: 0,
      });
    }
  }

  fromEvent(event: QuestEvent, run: QuestRun) {
    const skin = THEME_SKINS[run.theme];
    const { x, y } = event;
    switch (event.kind) {
      case 'coin':
        this.burst(x, y, 7, ['#ffd166', '#fff3c4', '#f0a83a'], 130);
        this.float(x, y - 12, event.value && event.value > 1 ? '×2 +200' : '+100', '#ffe07a');
        break;
      case 'stomp':
        this.burst(x, y, 10, [skin.accent, '#fff3c4', '#ff8a63'], 190);
        this.ring(x, y, '#fff3c4', 22);
        if (event.value) this.float(x, y - 14, `+${event.value}`, '#ffe07a');
        break;
      case 'break':
        this.burst(x, y, 12, [skin.brick[0], skin.brick[1], '#fff3c4'], 230);
        break;
      case 'bump':
        this.puff(x, y, '#e0d2bc');
        break;
      case 'power':
        this.burst(x, y, 16, ['#ff7a6b', '#ffd166', '#fff3c4', '#7fe6bb'], 220, 'star');
        this.ring(x, y, '#ffd166', 40);
        this.float(x, y - 20, event.value === 2 ? '火花花！' : '长大了！', '#fff3c4');
        break;
      case 'heal':
        this.burst(x, y, 12, ['#ff4d6d', '#ffd9ec', '#fff3c4'], 160, 'star');
        this.float(x, y - 18, event.value === 2 ? '全员满血' : '+1 ♥', '#ff9db0');
        break;
      case 'star':
        this.burst(x, y, 22, ['#ff6b8a', '#ffb35c', '#ffe07a', '#7fe6bb', '#8fd8f0', '#c9a6ff'], 260, 'star');
        this.ring(x, y, '#ffe07a', 54);
        this.float(x, y - 22, '无敌星！', '#ffe07a');
        break;
      case 'hurt':
        this.burst(x, y, 12, ['#ff4d5e', '#ffb35c', '#fff3c4'], 200);
        this.ring(x, y, '#ff4d5e', 32);
        break;
      case 'spring':
        this.burst(x, y, 12, ['#e8503a', '#ffd166', '#fff3c4'], 210);
        this.ring(x, y, '#ff8a63', 30);
        break;
      case 'shoot':
        this.burst(x, y, 5, ['#ff8a3a', '#ffd166'], 110);
        break;
      case 'checkpoint':
        this.burst(x, y, 18, ['#3fbf8f', '#7fe6bb', '#fff3c4'], 200, 'star');
        this.float(x, y - 18, '存档旗！', '#7fe6bb');
        break;
      case 'win':
        this.burst(x, y, 40, ['#ff6b8a', '#ffb35c', '#ffe07a', '#7fe6bb', '#8fd8f0', '#c9a6ff'], 320, 'star');
        break;
      case 'boss':
        this.burst(x, y, 24, ['#ff8a3a', '#ffd166', '#e8503a'], 280);
        this.ring(x, y, '#ff8a3a', 70);
        if (event.value !== undefined && event.value >= 0) this.float(x, y - 40, `菇霸 ${event.value}/3`, '#ff9db0');
        break;
      case 'gate':
        this.burst(x, y, 34, ['#c9a6ff', '#8f6fd0', '#ffe07a'], 300, 'star');
        this.float(x, y - 40, '大门开了！', '#c9a6ff');
        break;
      case 'kick':
        this.burst(x, y, 9, ['#7fe6bb', '#fff3c4'], 180);
        break;
      case 'land':
        this.puff(x, y, skin.cap[0]);
        break;
      case 'jump':
        this.puff(x, y, '#ffffff');
        break;
      case 'fall':
        this.burst(x, y, 12, ['#8fd8f0', '#fff3c4'], 160);
        this.float(x, y - 20, '回到旗子', '#8fd8f0');
        break;
      case 'bubble':
        this.burst(x, y, 16, ['#8fd8f0', '#fff3c4', '#c9a6ff'], 180);
        this.float(x, y - 24, '变成泡泡了', '#8fd8f0');
        break;
      case 'revive':
        this.burst(x, y, 20, ['#7fe6bb', '#fff3c4', '#ffd166'], 230, 'star');
        this.float(x, y - 24, '复活！', '#7fe6bb');
        break;
      case 'partner':
        this.burst(x, y, 16, ['#ffd166', '#ff8a63', '#7fe6bb'], 240, 'star');
        this.float(x, y - 26, '接力跳！', '#ffd166');
        break;
      case 'dash':
        this.burst(x, y, 10, ['#ff8a63', '#ffd166', '#fff3c4'], 200);
        this.float(x, y - 26, '冲刺击', '#ff9db0');
        break;
      case 'guard':
        this.ring(x, y, '#7fe6bb', 60);
        this.burst(x, y, 18, ['#3fbf8f', '#7fe6bb', '#fff3c4'], 200, 'star');
        this.float(x, y - 34, '守护罩！', '#7fe6bb');
        break;
      case 'guardBreak':
        this.burst(x, y, 12, ['#ffe07a', '#fff3c4', '#7fe6bb'], 210);
        this.float(x, y - 18, event.value === 2 ? '罩内破防 +300' : '格挡 +150', '#ffe07a');
        break;
      case 'link':
        this.burst(x, y, 6, ['#ffd166', '#7fe6bb'], 110, 'star');
        break;
    }
  }

  update(dt: number) {
    for (const item of this.items) {
      item.life -= dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vy += item.gravity * dt;
      item.vx *= 1 - dt * 1.6;
    }
    this.items = this.items.filter(item => item.life > 0);
    if (this.items.length > 320) this.items.splice(0, this.items.length - 320);
  }

  paint(ctx: Context) {
    ctx.save();
    for (const item of this.items) {
      const t = Math.max(0, item.life / item.max);
      ctx.globalAlpha = Math.min(1, t * 1.4);
      if (item.kind === 'ring') {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3 * t;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size * (1.6 - t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.kind === 'text') {
        ctx.font = `800 ${item.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = '#2a1a1288';
        ctx.strokeText(item.text ?? '', item.x, item.y);
        ctx.fillStyle = item.color;
        ctx.fillText(item.text ?? '', item.x, item.y);
      } else if (item.kind === 'star') {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.spin + (1 - t) * 5);
        polygon(ctx, item.color, [[0, -item.size * 1.7], [item.size * 0.6, -item.size * 0.5], [item.size * 1.7, 0], [item.size * 0.6, item.size * 0.5], [0, item.size * 1.7], [-item.size * 0.6, item.size * 0.5], [-item.size * 1.7, 0], [-item.size * 0.6, -item.size * 0.5]]);
        ctx.restore();
      } else if (item.kind === 'dust') {
        ellipse(ctx, item.x, item.y, item.size * t, item.size * t * 0.8, item.color);
      } else {
        ellipse(ctx, item.x, item.y, item.size * t, item.size * t, item.color);
      }
    }
    ctx.restore();
  }
}

export function buildTerrain(run: QuestRun): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = run.level.width * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d');
  if (ctx) paintTiles(ctx, run);
  return canvas;
}

export function paintFrame(
  ctx: Context,
  run: QuestRun,
  terrain: HTMLCanvasElement,
  particles: ParticleField,
  seconds: number,
) {
  const cameraX = run.cameraX;
  const shakeX = run.shake > 0 ? (Math.random() - 0.5) * run.shake : 0;
  const shakeY = run.shake > 0 ? (Math.random() - 0.5) * run.shake : 0;

  ctx.save();
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.translate(shakeX, shakeY);
  paintSky(ctx, run.theme, seconds);
  drawLandscape(ctx,models.summit,VIEW_WIDTH,117,cameraX,.9);
  paintParallax(ctx, run.theme, cameraX, seconds, run.cameraY);
  for (let i=0;i<3;i++) {
    const x=(i*275+620-cameraX*.16)%825;
    drawModel(ctx,models.island,x< -70?x+825:x,86+i%2*31, .5+i*.13,.42+i);
  }

  ctx.save();
  ctx.translate(-cameraX, -run.cameraY);
  ctx.drawImage(terrain, 0, 0);
  paintDynamicTiles(ctx, run, seconds, cameraX);

  const fromX = cameraX - 120;
  const toX = cameraX + VIEW_WIDTH + 120;

  for (const checkpoint of run.checkpoints) {
    if (checkpoint.x < fromX || checkpoint.x > toX) continue;
    paintCheckpoint(ctx, checkpoint.x, checkpoint.y, checkpoint.active, seconds);
  }
  if (run.goal.x > fromX - 200 && run.goal.x < toX + 200) paintGoal(ctx, run.goal.x, run.goal.y, run, seconds);

  for (const body of run.bodies) {
    if (body.x + body.w < fromX || body.x > toX) continue;
    paintBody(ctx, body, seconds, run.theme);
  }
  for (const pickup of run.pickups) {
    if (pickup.x + pickup.w < fromX || pickup.x > toX) continue;
    paintPickup(ctx, pickup, seconds);
  }

  paintLink(ctx, run, seconds);

  for (const enemy of run.enemies) {
    if (enemy.x + enemy.w < fromX || enemy.x > toX) continue;
    paintEnemy(ctx, enemy, seconds, run.theme);
  }
  for (const shot of run.shots) paintShot(ctx, shot, seconds);

  for (const player of run.players) {
    if (player.x + player.w < fromX - 60 || player.x > toX + 60) continue;
    paintHero(ctx, player, seconds, run.coop, run.looks);
  }

  particles.paint(ctx);
  ctx.restore();

  paintWeather(ctx, run.theme, seconds, cameraX);
  paintVignette(ctx, run.theme);

  if (run.level.water) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#4fb8cc';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.restore();
  }

  const boss = run.enemies.find(enemy => enemy.kind === 'boss' && enemy.state !== 'dead');
  if (boss && run.bossId >= 0 && !run.gateOpen && boss.x > fromX && boss.x < toX) {
    ctx.save();
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const hint = boss.state === 'dizzy' ? '头晕了！跳到它头上！' : '躲开跳跃，等它落地头晕';
    const width = ctx.measureText(hint).width + 26;
    roundRect(ctx, run.viewWidth / 2 - width / 2, 16, width, 30, 15, boss.state === 'dizzy' ? '#3fbf8fee' : '#2a1a2ecc');
    ctx.fillStyle = boss.state === 'dizzy' ? '#fff8ec' : '#ffd9ec';
    ctx.fillText(hint, run.viewWidth / 2, 36);
    ctx.restore();
  }

  if (run.coop) {
    const live = activePlayers(run);
    if (live.length === 1 && run.players.length === 2) {
      ctx.save();
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const text = '碰到泡泡就能救回搭档';
      const width = ctx.measureText(text).width + 24;
      roundRect(ctx, run.viewWidth / 2 - width / 2, VIEW_HEIGHT - 42, width, 28, 14, '#2a1a2ecc');
      ctx.fillStyle = '#8fd8f0';
      ctx.fillText(text, run.viewWidth / 2, VIEW_HEIGHT - 23);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function paintPreview(ctx: Context, run: QuestRun, terrain: HTMLCanvasElement, seconds: number) {
  ctx.save();
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  paintSky(ctx, run.theme, seconds);
  paintParallax(ctx, run.theme, run.cameraX, seconds, run.cameraY);
  ctx.save();
  ctx.translate(-run.cameraX, -run.cameraY);
  ctx.drawImage(terrain, 0, 0);
  paintDynamicTiles(ctx, run, seconds, run.cameraX);
  for (const pickup of run.pickups) {
    if (pickup.x < run.cameraX - 60 || pickup.x > run.cameraX + VIEW_WIDTH + 60) continue;
    paintPickup(ctx, pickup, seconds);
  }
  for (const enemy of run.enemies) {
    if (enemy.x < run.cameraX - 60 || enemy.x > run.cameraX + VIEW_WIDTH + 60) continue;
    paintEnemy(ctx, enemy, seconds, run.theme);
  }
  for (const player of run.players) paintHero(ctx, player, seconds, run.coop, run.looks);
  ctx.restore();
  paintWeather(ctx, run.theme, seconds, run.cameraX);
  ctx.restore();
}

export const QUEST_SCENE_SIZE = { width: VIEW_WIDTH, height: VIEW_HEIGHT, rows: ROWS };
export { glow };