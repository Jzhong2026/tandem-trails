import { generateObstacles, LANE_COUNT } from '../shared/race.js';
import type { Obstacle, PlayerStatus } from '../shared/race.js';
import type { RaceTrackDef, RaceTheme } from '../shared/race-tracks.js';
import { mulberry32 } from '../shared/race.js';

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const ROAD_TOP = 150;
export const ROAD_BOTTOM = 450;
export const LANE_H = (ROAD_BOTTOM - ROAD_TOP) / LANE_COUNT;
export const CAR_SCREEN_X = 232;
export const CAR_W = 74;
export const CAR_H = 46;

export const laneCenter = (lane: number) => ROAD_TOP + LANE_H * (lane + 0.5);

export const CAR_COLORS = ['#ffc233', '#38d6ff', '#ff5ca8', '#4ade80'];
export const CAR_DARK = ['#c78a12', '#1797bd', '#c93a7c', '#22a355'];
export const CAR_NAMES = ['琥珀', '疾风', '火箭', '流星'];

interface ThemePalette {
  grassTop: string;
  grassBottom: string;
  grassSpeck: string;
  road: string;
  roadShade: string;
  edge: string;
  dash: string;
  rumbleA: string;
  rumbleB: string;
  ambient: string;
  scenery: string[];
  lamp: string;
  night: boolean;
}

const PALETTES: Record<RaceTheme, ThemePalette> = {
  day: {
    grassTop: '#5fbf6a', grassBottom: '#4ca857', grassSpeck: '#74d07e',
    road: '#4a5162', roadShade: '#3f4555', edge: '#f4f1e8', dash: '#ffd23f',
    rumbleA: '#ff4d4d', rumbleB: '#f4f1e8', ambient: '#fff6d822',
    scenery: ['#2f9e57', '#37b263', '#e8734a', '#5a8fd6', '#c9a24b'], lamp: '#ffe9a8', night: false,
  },
  sunset: {
    grassTop: '#b98a4e', grassBottom: '#a3763f', grassSpeck: '#cf9d5c',
    road: '#4b4356', roadShade: '#40394b', edge: '#ffe6c2', dash: '#ffb347',
    rumbleA: '#ff5c47', rumbleB: '#ffe6c2', ambient: '#ff8a4c33',
    scenery: ['#7a5a8a', '#9c6b4f', '#e07a52', '#6b5b95', '#c98a4b'], lamp: '#ffc27a', night: false,
  },
  night: {
    grassTop: '#274058', grassBottom: '#1f3448', grassSpeck: '#33506b',
    road: '#2c3140', roadShade: '#252a37', edge: '#9fe8ff', dash: '#38d6ff',
    rumbleA: '#ff4d6d', rumbleB: '#9fe8ff', ambient: '#1a2c4a55',
    scenery: ['#1f4a44', '#2a5a52', '#3a4a6b', '#4a3a6b', '#2a4a6b'], lamp: '#9fe8ff', night: true,
  },
};

export type SceneryKind = 'tree' | 'building' | 'lamp' | 'bush' | 'rock';

export interface SceneryItem {
  x: number;
  side: 'top' | 'bottom';
  kind: SceneryKind;
  depth: number;
  size: number;
  hue: number;
  offset: number;
}

export function buildScenery(track: RaceTrackDef): SceneryItem[] {
  const rand = mulberry32(track.seed ^ 0x9e3779b9);
  const items: SceneryItem[] = [];
  const kinds: SceneryKind[] = ['tree', 'tree', 'bush', 'building', 'lamp', 'rock'];
  for (let x = -200; x < track.length + 600; x += 90 + rand() * 130) {
    const side = rand() < 0.5 ? 'top' : 'bottom';
    const kind = kinds[Math.floor(rand() * kinds.length)];
    items.push({
      x, side, kind,
      depth: 0.55 + rand() * 0.3,
      size: 0.7 + rand() * 0.7,
      hue: Math.floor(rand() * 5),
      offset: rand() * 40,
    });
  }
  return items;
}

export interface RaceParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'plus' | 'confetti' | 'speed';
  spin: number;
}

export class RaceParticles {
  items: RaceParticle[] = [];

  spawn(particle: RaceParticle) {
    if (this.items.length < 320) this.items.push(particle);
  }

  burst(x: number, y: number, color: string, count: number, kind: RaceParticle['kind'] = 'spark') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = kind === 'confetti' ? 60 + Math.random() * 160 : 40 + Math.random() * 150;
      this.spawn({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (kind === 'confetti' ? 120 : 0),
        life: 0, max: kind === 'smoke' ? 1.1 : 0.5 + Math.random() * 0.4,
        size: kind === 'confetti' ? 5 + Math.random() * 5 : 3 + Math.random() * 4,
        color, kind, spin: Math.random() * Math.PI,
      });
    }
  }

  refuel(x: number, y: number) {
    this.spawn({ x, y, vx: 0, vy: -55, life: 0, max: 0.9, size: 18, color: '#4ade80', kind: 'plus', spin: 0 });
  }

  exhaust(x: number, y: number, boost: boolean) {
    this.spawn({
      x, y, vx: -70 - Math.random() * 60, vy: (Math.random() - 0.5) * 24,
      life: 0, max: boost ? 0.35 : 0.5, size: boost ? 5 : 4,
      color: boost ? '#ffd23f' : '#9aa3b5', kind: 'smoke', spin: 0,
    });
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life += dt;
      if (p.life >= p.max) { this.items.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'confetti') p.vy += 320 * dt;
      if (p.kind === 'smoke') { p.vx *= 0.94; p.size += 8 * dt; }
      p.spin += dt * 6;
    }
  }

  paint(ctx: CanvasRenderingContext2D, cameraX: number) {
    for (const p of this.items) {
      const alpha = 1 - p.life / p.max;
      const x = p.x - cameraX;
      ctx.globalAlpha = p.kind === 'smoke' ? alpha * 0.5 : alpha;
      if (p.kind === 'plus') {
        ctx.fillStyle = p.color;
        ctx.font = `900 ${p.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('+1', x, p.y);
      } else if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.items.length = 0; }
}

export interface RaceFrame {
  track: RaceTrackDef;
  obstacles: Obstacle[];
  scenery: SceneryItem[];
  cameraX: number;
  laneY: number;
  color: number;
  status: PlayerStatus;
  hitFlash: number;
  boost: boolean;
  stationActive: number | null;
  time: number;
  particles: RaceParticles;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintTerrain(ctx: CanvasRenderingContext2D, frame: RaceFrame, palette: ThemePalette) {
  const { cameraX, track } = frame;
  ctx.fillStyle = palette.grassTop;
  ctx.fillRect(0, 0, VIEW_WIDTH, ROAD_TOP);
  ctx.fillStyle = palette.grassBottom;
  ctx.fillRect(0, ROAD_BOTTOM, VIEW_WIDTH, VIEW_HEIGHT - ROAD_BOTTOM);

  ctx.fillStyle = palette.grassSpeck;
  const speckOffset = (-cameraX * 0.9) % 60;
  for (let x = speckOffset - 60; x < VIEW_WIDTH + 60; x += 60) {
    for (let y = 18; y < ROAD_TOP - 10; y += 42) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + (y % 84 ? 20 : 0), y, 16, 4);
    }
    for (let y = ROAD_BOTTOM + 16; y < VIEW_HEIGHT - 8; y += 40) {
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x + (y % 80 ? 24 : 0), y, 14, 4);
    }
  }
  ctx.globalAlpha = 1;

  for (const item of frame.scenery) {
    const x = item.x - cameraX * item.depth;
    if (x < -120 || x > VIEW_WIDTH + 120) continue;
    const baseY = item.side === 'top' ? 118 - item.offset : ROAD_BOTTOM + 26 + item.offset;
    paintScenery(ctx, item, x, baseY, palette);
  }
  void track;
}

function paintScenery(ctx: CanvasRenderingContext2D, item: SceneryItem, x: number, y: number, palette: ThemePalette) {
  const s = item.size;
  const color = palette.scenery[item.hue];
  ctx.save();
  if (item.kind === 'tree') {
    ctx.fillStyle = '#00000022';
    ctx.beginPath(); ctx.ellipse(x, y + 6, 26 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - 4 * s, y - 20 * s, 8 * s, 24 * s);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - 30 * s, 24 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff22';
    ctx.beginPath(); ctx.arc(x - 8 * s, y - 38 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'bush') {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x - 10 * s, y, 13 * s, 0, Math.PI * 2); ctx.arc(x + 8 * s, y - 4 * s, 15 * s, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'building') {
    const w = 60 * s, h = 64 * s;
    ctx.fillStyle = '#00000022';
    ctx.fillRect(x - w / 2 + 5, y - h + 5, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(x - w / 2, y - h, w, 8 * s);
    ctx.fillStyle = palette.night ? '#ffe9a8' : '#ffffffaa';
    for (let wy = y - h + 16 * s; wy < y - 10 * s; wy += 18 * s) {
      for (let wx = x - w / 2 + 9 * s; wx < x + w / 2 - 9 * s; wx += 18 * s) {
        ctx.fillRect(wx, wy, 9 * s, 9 * s);
      }
    }
  } else if (item.kind === 'lamp') {
    ctx.fillStyle = '#3d4456';
    ctx.fillRect(x - 2, y - 52 * s, 4, 52 * s);
    ctx.fillRect(x - 2, y - 52 * s, 18 * s, 4);
    ctx.fillStyle = palette.lamp;
    ctx.beginPath(); ctx.arc(x + 16 * s, y - 48 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
    if (palette.night) {
      const glow = ctx.createRadialGradient(x + 16 * s, y - 48 * s, 2, x + 16 * s, y - 48 * s, 46 * s);
      glow.addColorStop(0, '#9fe8ff55'); glow.addColorStop(1, '#9fe8ff00');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x + 16 * s, y - 48 * s, 46 * s, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 16 * s, y); ctx.lineTo(x - 6 * s, y - 16 * s); ctx.lineTo(x + 8 * s, y - 12 * s);
    ctx.lineTo(x + 16 * s, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function paintRoad(ctx: CanvasRenderingContext2D, frame: RaceFrame, palette: ThemePalette) {
  const { cameraX, track } = frame;
  ctx.fillStyle = palette.road;
  ctx.fillRect(0, ROAD_TOP, VIEW_WIDTH, ROAD_BOTTOM - ROAD_TOP);
  const shade = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
  shade.addColorStop(0, '#ffffff10');
  shade.addColorStop(0.5, '#00000000');
  shade.addColorStop(1, '#00000030');
  ctx.fillStyle = shade;
  ctx.fillRect(0, ROAD_TOP, VIEW_WIDTH, ROAD_BOTTOM - ROAD_TOP);

  const rumbleOffset = (-cameraX) % 40;
  for (let x = rumbleOffset - 40; x < VIEW_WIDTH + 40; x += 40) {
    ctx.fillStyle = (Math.floor((x + cameraX) / 40) % 2 === 0) ? palette.rumbleA : palette.rumbleB;
    ctx.fillRect(x, ROAD_TOP - 8, 40, 8);
    ctx.fillRect(x, ROAD_BOTTOM, 40, 8);
  }
  ctx.fillStyle = palette.edge;
  ctx.fillRect(0, ROAD_TOP, VIEW_WIDTH, 4);
  ctx.fillRect(0, ROAD_BOTTOM - 4, VIEW_WIDTH, 4);

  ctx.fillStyle = palette.dash;
  const dashOffset = (-cameraX) % 70;
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const y = ROAD_TOP + LANE_H * lane;
    for (let x = dashOffset - 70; x < VIEW_WIDTH + 70; x += 70) {
      ctx.globalAlpha = 0.85;
      roundRect(ctx, x, y - 3, 38, 6, 3);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  paintChecker(ctx, 0 - cameraX, palette, 'start');
  paintChecker(ctx, track.length - cameraX, palette, 'finish');
  track.stations.forEach((station, index) => paintStation(ctx, station - cameraX, index, frame, palette));
}

function paintChecker(ctx: CanvasRenderingContext2D, x: number, palette: ThemePalette, kind: 'start' | 'finish') {
  if (x < -60 || x > VIEW_WIDTH + 60) return;
  const cell = 15;
  for (let row = 0; row < (ROAD_BOTTOM - ROAD_TOP) / cell; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f4f1e8' : '#1a1d24';
      ctx.fillRect(x + col * cell, ROAD_TOP + row * cell, cell, cell);
    }
  }
  if (kind === 'finish') {
    ctx.fillStyle = '#1a1d24';
    roundRect(ctx, x - 70, 40, 180, 46, 10); ctx.fill();
    ctx.fillStyle = palette.dash;
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('终点 FINISH', x + 20, 72);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(x - 4, ROAD_TOP - 60, 8, 60);
    ctx.beginPath(); ctx.moveTo(x + 4, ROAD_TOP - 60); ctx.lineTo(x + 54, ROAD_TOP - 48); ctx.lineTo(x + 4, ROAD_TOP - 34); ctx.closePath();
    ctx.fillStyle = '#ffc233'; ctx.fill();
  }
}

function paintStation(ctx: CanvasRenderingContext2D, x: number, index: number, frame: RaceFrame, palette: ThemePalette) {
  if (x < -260 || x > VIEW_WIDTH + 260) return;
  const active = frame.stationActive === index;
  const glow = active ? '#4ade80' : palette.dash;

  ctx.fillStyle = '#00000026';
  roundRect(ctx, x - 150, 24, 300, 116, 12); ctx.fill();
  ctx.fillStyle = active ? '#2c4a3a' : '#3d4456';
  roundRect(ctx, x - 156, 18, 312, 116, 12); ctx.fill();
  ctx.fillStyle = active ? '#4ade80' : '#5a6274';
  roundRect(ctx, x - 156, 18, 312, 26, 12); ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`服务区 ${index + 1} · 加满油再出发`, x, 92);

  for (let pump = -1; pump <= 1; pump++) {
    const px = x + pump * 84;
    ctx.fillStyle = '#f4f1e8';
    roundRect(ctx, px - 14, 100, 28, 30, 5); ctx.fill();
    ctx.fillStyle = glow;
    roundRect(ctx, px - 9, 105, 18, 12, 3); ctx.fill();
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(px + 10, 104, 5, 18);
  }

  ctx.strokeStyle = glow;
  ctx.lineWidth = active ? 7 : 4;
  ctx.globalAlpha = active ? 1 : 0.7;
  ctx.beginPath();
  ctx.moveTo(x - 120, ROAD_TOP);
  ctx.lineTo(x - 120, ROAD_TOP - 26);
  ctx.lineTo(x + 120, ROAD_TOP - 26);
  ctx.lineTo(x + 120, ROAD_TOP);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (active) {
    const beam = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    beam.addColorStop(0, '#4ade8033'); beam.addColorStop(1, '#4ade8000');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 120, ROAD_TOP, 240, ROAD_BOTTOM - ROAD_TOP);
  }
}

function paintObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, x: number, palette: ThemePalette) {
  const y = laneCenter(obstacle.lane);
  ctx.fillStyle = '#00000033';
  ctx.beginPath(); ctx.ellipse(x, y + 16, obstacle.w * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
  if (obstacle.kind === 'cone') {
    ctx.fillStyle = '#ff7a33';
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7a33';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  } else if (obstacle.kind === 'barrel') {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath(); ctx.arc(x, y, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1a1d24';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#8a93a5';
    ctx.beginPath();
    ctx.moveTo(x - 22, y + 12); ctx.lineTo(x - 14, y - 16); ctx.lineTo(x + 6, y - 20);
    ctx.lineTo(x + 22, y - 4); ctx.lineTo(x + 16, y + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff33';
    ctx.beginPath(); ctx.moveTo(x - 14, y - 16); ctx.lineTo(x + 6, y - 20); ctx.lineTo(x - 2, y - 4); ctx.closePath(); ctx.fill();
  }
  void palette;
}

function paintCar(ctx: CanvasRenderingContext2D, frame: RaceFrame) {
  const x = CAR_SCREEN_X;
  const y = laneCenter(frame.laneY);
  const color = CAR_COLORS[frame.color] ?? CAR_COLORS[0];
  const dark = CAR_DARK[frame.color] ?? CAR_DARK[0];
  const eliminated = frame.status === 'eliminated';

  ctx.save();
  ctx.translate(x, y);
  if (eliminated) ctx.rotate(0.16);

  ctx.fillStyle = '#00000040';
  ctx.beginPath(); ctx.ellipse(2, 20, CAR_W * 0.55, 13, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#1a1d24';
  roundRect(ctx, -CAR_W / 2 + 6, -CAR_H / 2 - 5, 16, 8, 3); ctx.fill();
  roundRect(ctx, -CAR_W / 2 + 6, CAR_H / 2 - 3, 16, 8, 3); ctx.fill();
  roundRect(ctx, CAR_W / 2 - 22, -CAR_H / 2 - 5, 16, 8, 3); ctx.fill();
  roundRect(ctx, CAR_W / 2 - 22, CAR_H / 2 - 3, 16, 8, 3); ctx.fill();

  const body = ctx.createLinearGradient(0, -CAR_H / 2, 0, CAR_H / 2);
  body.addColorStop(0, color);
  body.addColorStop(1, dark);
  ctx.fillStyle = eliminated ? '#6b7280' : body;
  roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 12); ctx.fill();

  ctx.fillStyle = '#ffffffcc';
  roundRect(ctx, -CAR_W / 2 + 8, -4, CAR_W - 16, 8, 4); ctx.fill();

  ctx.fillStyle = '#1a2c3a';
  roundRect(ctx, -6, -CAR_H / 2 + 6, 22, CAR_H - 12, 7); ctx.fill();
  ctx.fillStyle = '#9fe8ff66';
  roundRect(ctx, -2, -CAR_H / 2 + 9, 8, CAR_H - 18, 4); ctx.fill();

  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath(); ctx.arc(-CAR_W / 2 + 16, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1d24';
  ctx.font = '900 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(frame.color + 1), -CAR_W / 2 + 16, 1);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#fff6d8';
  roundRect(ctx, CAR_W / 2 - 6, -CAR_H / 2 + 6, 5, 9, 2); ctx.fill();
  roundRect(ctx, CAR_W / 2 - 6, CAR_H / 2 - 15, 5, 9, 2); ctx.fill();
  ctx.fillStyle = '#ff4d4d';
  roundRect(ctx, -CAR_W / 2 + 1, -CAR_H / 2 + 6, 4, 9, 2); ctx.fill();
  roundRect(ctx, -CAR_W / 2 + 1, CAR_H / 2 - 15, 4, 9, 2); ctx.fill();

  if (frame.hitFlash > 0) {
    ctx.globalAlpha = frame.hitFlash * 0.7;
    ctx.fillStyle = '#ff4d4d';
    roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 12); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (frame.boost && !eliminated && frame.status === 'racing') {
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const ly = y - 14 + i * 14;
      ctx.beginPath();
      ctx.moveTo(x - CAR_W / 2 - 14 - i * 6, ly);
      ctx.lineTo(x - CAR_W / 2 - 40 - i * 12, ly);
      ctx.stroke();
    }
  }
}

export function paintRaceFrame(ctx: CanvasRenderingContext2D, frame: RaceFrame) {
  const palette = PALETTES[frame.track.theme];
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  paintTerrain(ctx, frame, palette);
  paintRoad(ctx, frame, palette);
  for (const obstacle of frame.obstacles) {
    const x = obstacle.x - frame.cameraX;
    if (x < -60 || x > VIEW_WIDTH + 60) continue;
    paintObstacle(ctx, obstacle, x, palette);
  }
  frame.particles.paint(ctx, frame.cameraX);
  paintCar(ctx, frame);
  ctx.fillStyle = palette.ambient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  if (palette.night) {
    const vignette = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 200, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 620);
    vignette.addColorStop(0, '#00000000');
    vignette.addColorStop(1, '#0a142488');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
}

export function buildObstacles(track: RaceTrackDef): Obstacle[] {
  return generateObstacles(track, track.seed);
}