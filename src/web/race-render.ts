import { generateObstacles, LANE_COUNT } from '../shared/race.js';
import type { Obstacle, PlayerStatus } from '../shared/race.js';
import type { RaceTrackDef, RaceTheme } from '../shared/race-tracks.js';
import { mulberry32 } from '../shared/race.js';

/* ---------- 伪 3D 投影 ----------
 * 摄像机在车后 CAM_BACK 个世界单位，俯视路面；
 * 近平面在摄像机处，远处向地平线收拢。
 * 画面比例随画布自适应，因此所有尺寸都从 Camera 推导。 */

export const ROAD_HALF_WORLD = 300;
export const LANE_WORLD = 200;
export const NEAR_DIST = 150;
export const CAM_BACK = 80;
export const DRAW_DIST = 4200;
export const SEG_LEN = 90;

export interface Camera {
  width: number;
  height: number;
  horizonY: number;
  roadHalfBottom: number;
  pxPerUnit: number;
  truckGroundY: number;
  truckLanePx: number;
  truckW: number;
}

export function createCamera(width: number, height: number): Camera {
  const w = Math.max(320, width);
  const h = Math.max(360, height);
  const horizonY = h * 0.187;
  const roadHalfBottom = w * 0.42;
  const pxPerUnit = roadHalfBottom / ROAD_HALF_WORLD;
  const depth = NEAR_DIST / (NEAR_DIST + CAM_BACK);
  const truckLanePx = LANE_WORLD * pxPerUnit * depth;
  return {
    width: w,
    height: h,
    horizonY,
    roadHalfBottom,
    pxPerUnit,
    truckGroundY: horizonY + (h - horizonY) * depth,
    truckLanePx,
    truckW: truckLanePx * 0.72,
  };
}

function depthAt(distance: number) {
  return NEAR_DIST / (NEAR_DIST + Math.max(0, distance));
}

function screenY(cam: Camera, distance: number) {
  return cam.horizonY + (cam.height - cam.horizonY) * depthAt(distance);
}

function screenX(cam: Camera, lateral: number, distance: number) {
  return cam.width / 2 + lateral * cam.pxPerUnit * depthAt(distance);
}

export const CAR_COLORS = ['#ffc233', '#38d6ff', '#ff5ca8', '#4ade80'];
export const CAR_DARK = ['#c78a12', '#1797bd', '#c93a7c', '#22a355'];
export const CAR_NAMES = ['琥珀', '疾风', '火箭', '流星'];

export interface ThemePalette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunGlow: string;
  hillFar: string;
  hillNear: string;
  treeLine: string;
  fieldNear: string;
  fieldFar: string;
  fieldStripe: string;
  road: string;
  edge: string;
  dash: string;
  rumbleA: string;
  rumbleB: string;
  guard: string;
  guardPost: string;
  lamp: string;
  lampGlow: string;
  tree: string;
  treeDark: string;
  trunk: string;
  building: string;
  buildingRoof: string;
  window: string;
  bush: string;
  rock: string;
  fog: string;
  night: boolean;
  ambient: string;
  cloud: string;
  star: string;
}

export const PALETTES: Record<RaceTheme, ThemePalette> = {
  day: {
    skyTop: '#3f7fc4', skyBottom: '#a9d4ee',
    sun: '#fff6c8', sunGlow: '#ffe9a855',
    hillFar: '#6f8f74', hillNear: '#4e7355', treeLine: '#3f6b46',
    fieldNear: '#6aa85f', fieldFar: '#5b9a52', fieldStripe: '#63a257',
    road: '#474c55', edge: '#eef1f4', dash: '#f2f2ea',
    rumbleA: '#c8453f', rumbleB: '#f2f2ea',
    guard: '#b8bec7', guardPost: '#8b939d',
    lamp: '#dfe4ea', lampGlow: '#ffe9a8',
    tree: '#3f7f42', treeDark: '#2f6634', trunk: '#6b4a2f',
    building: '#c9bfae', buildingRoof: '#8a6f57', window: '#e8f0ff',
    bush: '#4f8f4a', rock: '#8a8f96',
    fog: '#cfe2f0', night: false, ambient: '#fff6d81a',
    cloud: '#ffffffcc', star: '#ffffff',
  },
  sunset: {
    skyTop: '#2c3f6b', skyBottom: '#f79a4e',
    sun: '#ffd98a', sunGlow: '#ff9a4d77',
    hillFar: '#4c4463', hillNear: '#3a3350', treeLine: '#2e2a44',
    fieldNear: '#6b5a3f', fieldFar: '#5c4d36', fieldStripe: '#6e5c40',
    road: '#46414f', edge: '#ffe9c9', dash: '#ffcf6a',
    rumbleA: '#e05a3c', rumbleB: '#ffe9c9',
    guard: '#a89a86', guardPost: '#7e7361',
    lamp: '#ffd9a0', lampGlow: '#ffb86b',
    tree: '#4a5a3a', treeDark: '#35452a', trunk: '#5a4230',
    building: '#b08a6a', buildingRoof: '#6f4f3c', window: '#ffd9a0',
    bush: '#556b3c', rock: '#7a6e63',
    fog: '#f3a86a', night: false, ambient: '#ff8a4c2e',
    cloud: '#ffd9b899', star: '#ffeccf',
  },
  night: {
    skyTop: '#05080f', skyBottom: '#1b2b4a',
    sun: '#e8f0ff', sunGlow: '#9fb8e855',
    hillFar: '#16223a', hillNear: '#0d1526', treeLine: '#0a1220',
    fieldNear: '#17222f', fieldFar: '#131c28', fieldStripe: '#18232f',
    road: '#2b303c', edge: '#cfd8e6', dash: '#e8eef7',
    rumbleA: '#a8353f', rumbleB: '#cfd8e6',
    guard: '#6b7482', guardPost: '#4d545f',
    lamp: '#ffe9a8', lampGlow: '#ffd98a',
    tree: '#16281f', treeDark: '#0f1c16', trunk: '#221a12',
    building: '#222a3a', buildingRoof: '#171d29', window: '#ffd98a',
    bush: '#1a2b21', rock: '#333a46',
    fog: '#1b2b4a', night: true, ambient: '#0b1830aa',
    cloud: '#39496b88', star: '#dfe9ff',
  },
};

export type SceneryKind = 'tree' | 'pine' | 'bush' | 'rock' | 'building' | 'lamp' | 'sign';

export interface SceneryItem {
  z: number;
  side: -1 | 1;
  lateral: number;
  kind: SceneryKind;
  size: number;
  tone: number;
}

export function buildScenery(track: RaceTrackDef): SceneryItem[] {
  const rand = mulberry32(track.seed ^ 0x9e3779b9);
  const items: SceneryItem[] = [];
  const push = (kind: SceneryKind, z: number, lateral: number, size: number, tone = 0) => {
    items.push({ z, side: lateral < 0 ? -1 : 1, lateral: Math.abs(lateral), kind, size, tone });
  };

  for (let z = -600; z < track.length + 900; ) {
    const side = rand() < 0.5 ? -1 : 1;
    const roll = rand();
    if (roll < 0.34) {
      push(rand() < 0.45 ? 'pine' : 'tree', z, side * (340 + rand() * 380), 0.75 + rand() * 0.7, rand());
    } else if (roll < 0.6) {
      push('bush', z, side * (315 + rand() * 120), 0.7 + rand() * 0.6, rand());
    } else if (roll < 0.74) {
      push('rock', z, side * (330 + rand() * 200), 0.7 + rand() * 0.6, rand());
    } else {
      push('building', z, side * (760 + rand() * 900), 0.8 + rand() * 0.7, rand());
    }
    z += 18 + rand() * 56;
  }

  for (let z = -400; z < track.length + 700; z += 190) {
    push('lamp', z, -(318 + rand() * 14), 0.95 + rand() * 0.15);
    push('lamp', z + 95, 318 + rand() * 14, 0.95 + rand() * 0.15);
  }
  for (let z = 200; z < track.length + 500; z += 620) {
    push('sign', z, -(345 + rand() * 12), 0.9 + rand() * 0.2);
  }
  return items.sort((a, b) => b.z - a.z);
}

export interface RaceParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  kind: 'spark' | 'smoke' | 'plus' | 'confetti' | 'speed';
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
      x, y, vx: (Math.random() - 0.5) * 26, vy: 40 + Math.random() * 50,
      life: 0, max: boost ? 0.5 : 0.8, size: boost ? 6 : 5,
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
      if (p.kind === 'smoke') { p.vx *= 0.94; p.size += 10 * dt; }
      p.spin += dt * 6;
    }
  }

  paint(ctx: CanvasRenderingContext2D) {
    for (const p of this.items) {
      const alpha = 1 - p.life / p.max;
      ctx.globalAlpha = p.kind === 'smoke' ? alpha * 0.45 : alpha;
      if (p.kind === 'plus') {
        ctx.fillStyle = p.color;
        ctx.font = `900 ${p.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('+1', p.x, p.y);
      } else if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
  camera: Camera;
  cameraX: number;
  laneY: number;
  color: number;
  status: PlayerStatus;
  hitFlash: number;
  boost: boolean;
  stationActive: number | null;
  time: number;
  particles: RaceParticles;
  fuel: number;
  fuelMax: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

function mixColor(from: string, to: string, amount: number) {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const a = parse(from);
  const b = parse(to);
  const t = Math.max(0, Math.min(1, amount));
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/* ---------- 天空 ---------- */

interface Cloud { x: number; y: number; scale: number; }

const CLOUDS: Cloud[] = (() => {
  const rand = mulberry32(0x5bf03);
  const clouds: Cloud[] = [];
  for (let i = 0; i < 16; i++) {
    clouds.push({ x: rand() * 2400, y: 0, scale: 0.42 + rand() * 0.5 });
  }
  return clouds;
})();

function paintSky(ctx: CanvasRenderingContext2D, cam: Camera, palette: ThemePalette, cameraX: number, time: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 30);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cam.width, cam.horizonY + 30);

  if (palette.night) {
    const rand = mulberry32(0x2f6b1c);
    for (let i = 0; i < 90; i++) {
      const x = rand() * cam.width;
      const y = rand() * cam.horizonY * 0.92;
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * 1.6 + i));
      ctx.globalAlpha = twinkle * (0.35 + rand() * 0.65);
      ctx.fillStyle = palette.star;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  const sunX = cam.width * 0.74 - (cameraX * 0.012) % (cam.width * 1.6);
  const sunY = cam.horizonY * 0.46;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
  glow.addColorStop(0, palette.sunGlow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, palette.night ? 17 : 22, 0, Math.PI * 2);
  ctx.fill();

  const span = cam.width * 1.2;
  for (const cloud of CLOUDS) {
    const x = (((cloud.x - cameraX * 0.02) % span) + span) % span - cam.width * 0.1;
    const y = cam.horizonY * (0.08 + (cloud.scale % 0.5) * 0.55);
    paintCloud(ctx, x, y, cloud.scale * (cam.width / 800), palette);
  }
}

function paintCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, palette: ThemePalette) {
  ctx.fillStyle = palette.cloud;
  ctx.beginPath();
  ctx.arc(x, y, 26 * scale, 0, Math.PI * 2);
  ctx.arc(x + 26 * scale, y + 5 * scale, 20 * scale, 0, Math.PI * 2);
  ctx.arc(x - 26 * scale, y + 7 * scale, 17 * scale, 0, Math.PI * 2);
  ctx.arc(x + 8 * scale, y - 13 * scale, 18 * scale, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- 远山与地平线 ---------- */

function paintRidge(ctx: CanvasRenderingContext2D, cam: Camera, cameraX: number, parallax: number,
  baseY: number, height: number, color: string, seed: number, span: number) {
  const rand = mulberry32(seed);
  const step = span / 10;
  const offset = -(cameraX * parallax) % step;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-step, cam.horizonY + 40);
  for (let i = -1; i < 14; i++) {
    const x = offset + i * step;
    const peak = baseY - height * (0.35 + rand() * 0.65);
    ctx.lineTo(x + step * 0.5, peak);
    ctx.lineTo(x + step, baseY - height * 0.15 * rand());
  }
  ctx.lineTo(cam.width + step, cam.horizonY + 40);
  ctx.closePath();
  ctx.fill();
}

function paintHorizon(ctx: CanvasRenderingContext2D, cam: Camera, palette: ThemePalette, cameraX: number) {
  paintRidge(ctx, cam, cameraX, 0.05, cam.horizonY + 6, cam.horizonY * 0.47, palette.hillFar, 0x1234, cam.width * 1.7);
  paintRidge(ctx, cam, cameraX, 0.11, cam.horizonY + 12, cam.horizonY * 0.3, palette.hillNear, 0x9876, cam.width * 1.1);

  const rand = mulberry32(0x51a7);
  const step = Math.max(16, cam.width / 34);
  const offset = -(cameraX * 0.18) % step;
  ctx.fillStyle = palette.treeLine;
  for (let i = -1; i < cam.width / step + 2; i++) {
    const x = offset + i * step;
    const h = 8 + rand() * 11;
    ctx.beginPath();
    ctx.moveTo(x, cam.horizonY + 10);
    ctx.lineTo(x + step * 0.5, cam.horizonY + 10 - h);
    ctx.lineTo(x + step, cam.horizonY + 10);
    ctx.closePath();
    ctx.fill();
  }
}

/* ---------- 路面 ---------- */

function paintRoad(ctx: CanvasRenderingContext2D, cam: Camera, frame: RaceFrame, palette: ThemePalette) {
  const center = cam.width / 2;
  const segments = Math.ceil(DRAW_DIST / SEG_LEN);

  ctx.fillStyle = palette.fieldFar;
  ctx.fillRect(0, cam.horizonY, cam.width, cam.height - cam.horizonY);

  for (let i = segments - 1; i >= 0; i--) {
    const d0 = i * SEG_LEN;
    const d1 = d0 + SEG_LEN;
    const f0 = depthAt(d0);
    const f1 = depthAt(d1);
    const y0 = screenY(cam, d0);
    const y1 = screenY(cam, d1);
    if (y1 < cam.horizonY - 2) continue;
    const half0 = cam.roadHalfBottom * f0;
    const half1 = cam.roadHalfBottom * f1;
    const stripe = Math.floor(i / 2) % 2 === 0;
    const fade = Math.max(0, Math.min(1, (0.16 - f1) / 0.16));
    const terrain = stripe ? mixColor(palette.fieldStripe, palette.fieldFar, fade) : palette.fieldFar;

    ctx.fillStyle = terrain;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(center - half0, y0);
    ctx.lineTo(center - half1, y1);
    ctx.lineTo(0, y1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cam.width, y0);
    ctx.lineTo(center + half0, y0);
    ctx.lineTo(center + half1, y1);
    ctx.lineTo(cam.width, y1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.road;
    ctx.beginPath();
    ctx.moveTo(center - half0, y0);
    ctx.lineTo(center + half0, y0);
    ctx.lineTo(center + half1, y1);
    ctx.lineTo(center - half1, y1);
    ctx.closePath();
    ctx.fill();

    const rumble = 13 * f1 + 3;
    ctx.fillStyle = stripe ? palette.rumbleA : palette.rumbleB;
    ctx.beginPath();
    ctx.moveTo(center - half0 - rumble, y0);
    ctx.lineTo(center - half0, y0);
    ctx.lineTo(center - half1, y1);
    ctx.lineTo(center - half1 - rumble, y1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(center + half0 + rumble, y0);
    ctx.lineTo(center + half0, y0);
    ctx.lineTo(center + half1, y1);
    ctx.lineTo(center + half1 + rumble, y1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.edge;
    ctx.fillRect(center - half0 - 2, y0 - 1, Math.max(1, 3 * f0 + 1), Math.max(1, y0 - y1 + 2));
    ctx.fillRect(center + half0 - 1, y0 - 1, Math.max(1, 3 * f0 + 1), Math.max(1, y0 - y1 + 2));

    if (stripe) {
      for (const divider of [-LANE_WORLD / 2, LANE_WORLD / 2]) {
        const x0 = center + divider * cam.pxPerUnit * f0;
        const x1 = center + divider * cam.pxPerUnit * f1;
        ctx.fillStyle = palette.dash;
        ctx.beginPath();
        ctx.moveTo(x0 - 4 * f0 - 1, y0);
        ctx.lineTo(x0 + 4 * f0 + 1, y0);
        ctx.lineTo(x1 + 4 * f1 + 1, y1);
        ctx.lineTo(x1 - 4 * f1 - 1, y1);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (Math.floor(i / 5) % 4 === 1) {
      ctx.fillStyle = '#00000018';
      const patchW = (40 + (i % 7) * 26) * cam.pxPerUnit * f0;
      const patchX = center + (((i * 37) % 100) / 100 - 0.5) * cam.roadHalfBottom * f0 * 1.4;
      ctx.beginPath();
      ctx.moveTo(patchX - patchW, y0);
      ctx.lineTo(patchX + patchW, y0);
      ctx.lineTo(patchX + patchW * 0.94, y1);
      ctx.lineTo(patchX - patchW * 0.94, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/* ---------- 两侧场景 ---------- */

function paintScenery(ctx: CanvasRenderingContext2D, cam: Camera, frame: RaceFrame, palette: ThemePalette) {
  for (const item of frame.scenery) {
    const distance = item.z - frame.cameraX;
    if (distance < -160 || distance > DRAW_DIST) continue;
    const f = depthAt(distance);
    const lateral = item.side * item.lateral;
    const x = screenX(cam, lateral, distance);
    const y = screenY(cam, distance);
    const scale = f * cam.pxPerUnit * item.size;
    if (scale < 0.5) continue;
    paintSceneryItem(ctx, item, x, y, scale, palette);
  }
}

function paintSceneryItem(ctx: CanvasRenderingContext2D, item: SceneryItem, x: number, y: number,
  scale: number, palette: ThemePalette) {
  if (item.kind === 'lamp') {
    const height = 330 * scale;
    ctx.fillStyle = '#00000022';
    ellipse(ctx, x, y + 2, 12 * scale, 4 * scale);
    ctx.fill();
    ctx.fillStyle = palette.guardPost;
    ctx.fillRect(x - 4 * scale, y - height, 8 * scale, height);
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.quadraticCurveTo(x + 26 * scale, y - height - 9 * scale, x + 40 * scale, y - height - 3 * scale);
    ctx.lineWidth = 6 * scale;
    ctx.strokeStyle = palette.guardPost;
    ctx.stroke();
    ctx.fillStyle = palette.lamp;
    ellipse(ctx, x + 42 * scale, y - height - 3 * scale, 8 * scale, 5 * scale);
    ctx.fill();
    if (palette.night) {
      const glow = ctx.createRadialGradient(x + 42 * scale, y - height - 3 * scale, 1,
        x + 42 * scale, y - height - 3 * scale, 90 * scale);
      glow.addColorStop(0, '#ffe9a866');
      glow.addColorStop(1, '#ffe9a800');
      ctx.fillStyle = glow;
      ctx.fillRect(x + 42 * scale - 92 * scale, y - height - 95 * scale, 184 * scale, 184 * scale);
    }
    return;
  }

  if (item.kind === 'building') {
    const w = 240 * scale;
    const h = 200 * scale;
    ctx.fillStyle = '#00000022';
    ctx.fillRect(x - w / 2 + 6 * scale, y - h + 6 * scale, w, h);
    ctx.fillStyle = palette.building;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = palette.buildingRoof;
    ctx.fillRect(x - w / 2 - 4 * scale, y - h - 10 * scale, w + 8 * scale, 13 * scale);
    const light = palette.night ? palette.window : '#ffffffaa';
    for (let wy = y - h + 24 * scale; wy < y - 20 * scale; wy += 34 * scale) {
      for (let wx = x - w / 2 + 20 * scale; wx < x + w / 2 - 20 * scale; wx += 36 * scale) {
        ctx.fillStyle = light;
        ctx.fillRect(wx, wy, 17 * scale, 19 * scale);
      }
    }
    return;
  }

  if (item.kind === 'sign') {
    const h = 190 * scale;
    ctx.fillStyle = palette.guardPost;
    ctx.fillRect(x - 3 * scale, y - h, 6 * scale, h);
    ctx.fillStyle = '#2f6f4a';
    roundRect(ctx, x - 48 * scale, y - h - 40 * scale, 96 * scale, 34 * scale, 5 * scale);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `900 ${Math.max(5, 17 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('前方施工', x, y - h - 17 * scale);
    return;
  }

  if (item.kind === 'bush') {
    ctx.fillStyle = '#00000022';
    ellipse(ctx, x, y + 1, 34 * scale, 8 * scale);
    ctx.fill();
    ctx.fillStyle = palette.bush;
    ctx.beginPath();
    ctx.arc(x - 18 * scale, y - 10 * scale, 21 * scale, 0, Math.PI * 2);
    ctx.arc(x + 17 * scale, y - 15 * scale, 25 * scale, 0, Math.PI * 2);
    ctx.arc(x, y - 26 * scale, 19 * scale, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (item.kind === 'rock') {
    const s = 34 * scale;
    ctx.fillStyle = '#00000026';
    ellipse(ctx, x, y + 1, s * 1.3, s * 0.35);
    ctx.fill();
    ctx.fillStyle = palette.rock;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s * 0.6, y - s * 0.9);
    ctx.lineTo(x + s * 0.15, y - s * 1.15);
    ctx.lineTo(x + s * 0.95, y - s * 0.55);
    ctx.lineTo(x + s * 0.8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff26';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y - s * 0.9);
    ctx.lineTo(x + s * 0.15, y - s * 1.15);
    ctx.lineTo(x - s * 0.05, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (item.kind === 'pine') {
    const h = 400 * scale;
    ctx.fillStyle = '#00000022';
    ellipse(ctx, x, y + 1, 26 * scale, 7 * scale);
    ctx.fill();
    ctx.fillStyle = palette.trunk;
    ctx.fillRect(x - 5 * scale, y - h * 0.3, 10 * scale, h * 0.3);
    ctx.fillStyle = palette.treeDark;
    for (let i = 0; i < 3; i++) {
      const t = i / 3;
      const top = y - h + t * h * 0.42;
      const wide = (52 - i * 12) * scale;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + wide, top + h * 0.42);
      ctx.lineTo(x - wide, top + h * 0.42);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  const h = 340 * scale;
  ctx.fillStyle = '#00000022';
  ellipse(ctx, x, y + 1, 40 * scale, 9 * scale);
  ctx.fill();
  ctx.fillStyle = palette.trunk;
  ctx.fillRect(x - 10 * scale, y - h * 0.24, 20 * scale, h * 0.24);
  ctx.fillStyle = palette.tree;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.58, 60 * scale, 0, Math.PI * 2);
  ctx.arc(x - 42 * scale, y - h * 0.46, 42 * scale, 0, Math.PI * 2);
  ctx.arc(x + 42 * scale, y - h * 0.46, 42 * scale, 0, Math.PI * 2);
  ctx.arc(x - 14 * scale, y - h * 0.74, 38 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.treeDark;
  ctx.beginPath();
  ctx.arc(x + 27 * scale, y - h * 0.52, 33 * scale, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- 障碍物 ---------- */

const OBSTACLE_SIZE: Record<Obstacle['kind'], { width: number; height: number }> = {
  cone: { width: 150, height: 78 },
  barrel: { width: 116, height: 92 },
  rock: { width: 176, height: 104 },
};

function paintObstacle(ctx: CanvasRenderingContext2D, cam: Camera, obstacle: Obstacle, distance: number,
  palette: ThemePalette) {
  const f = depthAt(distance);
  const x = screenX(cam, (obstacle.lane - 1) * LANE_WORLD, distance);
  const y = screenY(cam, distance);
  const size = OBSTACLE_SIZE[obstacle.kind];
  const w = size.width * cam.pxPerUnit * f;
  const h = size.height * cam.pxPerUnit * f;
  if (w < 1.2 || y < cam.horizonY) return;

  ctx.fillStyle = '#00000033';
  ellipse(ctx, x, y + 2, w * 0.52, h * 0.14);
  ctx.fill();

  if (obstacle.kind === 'cone') {
    const coneW = w * 0.22;
    for (let i = -1; i <= 1; i++) {
      const cx = x + i * w * 0.33;
      const scale = i === 0 ? 1 : 0.86;
      ctx.fillStyle = '#d9571f';
      ctx.beginPath();
      ctx.moveTo(cx, y - h * scale);
      ctx.lineTo(cx + coneW * scale, y - h * 0.12);
      ctx.lineTo(cx - coneW * scale, y - h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f6f2e6';
      ctx.beginPath();
      ctx.moveTo(cx, y - h * scale);
      ctx.lineTo(cx + coneW * scale * 0.66, y - h * scale * 0.62);
      ctx.lineTo(cx - coneW * scale * 0.66, y - h * scale * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, y - h * scale);
      ctx.lineTo(cx + coneW * scale * 0.9, y - h * scale * 0.36);
      ctx.lineTo(cx - coneW * scale * 0.9, y - h * scale * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(cx - coneW * scale * 1.15, y - h * 0.12, coneW * scale * 2.3, Math.max(1, h * 0.12));
    }
    return;
  }

  if (obstacle.kind === 'barrel') {
    const drumW = w * 0.44;
    ctx.fillStyle = '#b8332f';
    ctx.beginPath();
    ctx.moveTo(x - drumW, y);
    ctx.lineTo(x - drumW, y - h * 0.72);
    ctx.ellipse(x, y - h * 0.72, drumW, h * 0.16, 0, Math.PI, 0);
    ctx.lineTo(x + drumW, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f6f2e6';
    ctx.fillRect(x - drumW, y - h * 0.46, drumW * 2, h * 0.14);
    ctx.fillRect(x - drumW, y - h * 0.22, drumW * 2, h * 0.1);
    ctx.fillStyle = '#d9571f';
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.72, drumW, h * 0.16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(x - drumW * 0.72, y - h * 0.68, drumW * 0.22, h * 0.62);
    return;
  }

  const s = w * 0.5;
  ctx.fillStyle = palette.rock;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s * 0.72, y - h * 0.58);
  ctx.lineTo(x - s * 0.16, y - h);
  ctx.lineTo(x + s * 0.62, y - h * 0.74);
  ctx.lineTo(x + s, y - h * 0.26);
  ctx.lineTo(x + s * 0.74, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff2e';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.72, y - h * 0.58);
  ctx.lineTo(x - s * 0.16, y - h);
  ctx.lineTo(x + s * 0.1, y - h * 0.42);
  ctx.closePath();
  ctx.fill();
}

/* ---------- 服务区 ---------- */

function paintStation(ctx: CanvasRenderingContext2D, cam: Camera, frame: RaceFrame, palette: ThemePalette) {
  const track = frame.track;
  for (let index = 0; index < track.stations.length; index++) {
    const stationZ = track.stations[index];
    const distance = stationZ - frame.cameraX;
    if (distance < -420 || distance > DRAW_DIST) continue;
    const f = depthAt(distance);
    const x = screenX(cam, 470, distance);
    const y = screenY(cam, distance);
    const scale = cam.pxPerUnit * f;
    if (scale < 0.5) continue;
    const active = frame.stationActive === index;

    ctx.fillStyle = active ? '#3c5c46' : palette.road;
    ctx.fillRect(x - 150 * scale, y - 26 * scale, 300 * scale, 26 * scale);

    const canopyW = 170 * scale;
    const canopyH = 96 * scale;
    ctx.fillStyle = active ? '#2f6f4a' : '#8f9aa8';
    roundRect(ctx, x - canopyW, y - canopyH - 30 * scale, canopyW * 2, 26 * scale, 6 * scale);
    ctx.fill();
    ctx.fillStyle = '#dfe4ea';
    ctx.fillRect(x - canopyW + 12 * scale, y - canopyH, 9 * scale, canopyH);
    ctx.fillRect(x + canopyW - 21 * scale, y - canopyH, 9 * scale, canopyH);

    for (let pump = -1; pump <= 1; pump += 2) {
      const px = x + pump * 62 * scale;
      ctx.fillStyle = '#f4f1e8';
      roundRect(ctx, px - 16 * scale, y - 62 * scale, 32 * scale, 62 * scale, 5 * scale);
      ctx.fill();
      ctx.fillStyle = active ? '#4ade80' : '#5a6274';
      roundRect(ctx, px - 10 * scale, y - 52 * scale, 20 * scale, 20 * scale, 4 * scale);
      ctx.fill();
      ctx.fillStyle = '#1a1d24';
      ctx.fillRect(px + 12 * scale, y - 56 * scale, 5 * scale, 22 * scale);
    }

    ctx.fillStyle = '#2f6f4a';
    roundRect(ctx, x - 56 * scale, y - 190 * scale, 112 * scale, 34 * scale, 5 * scale);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `900 ${Math.max(5, 15 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`服务区 ${index + 1}`, x, y - 168 * scale);

    if (active) {
      const beam = ctx.createLinearGradient(0, y - 140 * scale, 0, y);
      beam.addColorStop(0, '#4ade8055');
      beam.addColorStop(1, '#4ade8000');
      ctx.fillStyle = beam;
      ctx.fillRect(x - 120 * scale, y - 140 * scale, 240 * scale, 140 * scale);
    }
  }
}

/* ---------- Scania 卡车 ---------- */

function paintTruck(ctx: CanvasRenderingContext2D, cam: Camera, frame: RaceFrame) {
  const x = cam.width / 2 + (frame.laneY - 1) * cam.truckLanePx;
  const groundY = cam.truckGroundY;
  const color = CAR_COLORS[frame.color] ?? CAR_COLORS[0];
  const dark = CAR_DARK[frame.color] ?? CAR_DARK[0];
  const gone = frame.status === 'eliminated';

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(cam.truckW / 100, (cam.truckW / 100) * 0.86);

  ctx.fillStyle = '#00000044';
  ellipse(ctx, 0, 6, 52, 13);
  ctx.fill();

  if (frame.status !== 'racing') ctx.rotate(Math.sin(frame.time * 9) * 0.004);

  /* 轮胎与挡泥板 */
  ctx.fillStyle = '#15181d';
  roundRect(ctx, -50, -34, 24, 34, 5); ctx.fill();
  roundRect(ctx, 26, -34, 24, 34, 5); ctx.fill();
  roundRect(ctx, -30, -28, 18, 28, 4); ctx.fill();
  roundRect(ctx, 12, -28, 18, 28, 4); ctx.fill();
  ctx.fillStyle = '#2a2f36';
  ctx.fillRect(-46, -34, 16, 3);
  ctx.fillRect(30, -34, 16, 3);

  /* 尾门与底盘 */
  ctx.fillStyle = '#22262d';
  roundRect(ctx, -50, -52, 100, 20, 5); ctx.fill();
  ctx.fillStyle = '#3a4048';
  roundRect(ctx, -10, -58, 20, 12, 3); ctx.fill();
  ctx.fillStyle = '#191c22';
  roundRect(ctx, -52, -50, 20, 20, 3); ctx.fill();
  roundRect(ctx, 32, -50, 20, 20, 3); ctx.fill();

  /* 驾驶室主体 */
  const shell = ctx.createLinearGradient(-44, -160, 44, -40);
  shell.addColorStop(0, body(gone, color));
  shell.addColorStop(1, body(gone, dark));
  ctx.fillStyle = shell;
  roundRect(ctx, -44, -160, 88, 112, 7); ctx.fill();

  /* 高顶导流罩 */
  const roof = ctx.createLinearGradient(0, -192, 0, -156);
  roof.addColorStop(0, gone ? '#5c626b' : '#ffffff55');
  roof.addColorStop(1, gone ? '#4a505a' : dark);
  ctx.fillStyle = roof;
  roundRect(ctx, -42, -192, 84, 38, 12); ctx.fill();
  ctx.fillStyle = gone ? '#565c65' : color;
  roundRect(ctx, -38, -158, 76, 8, 3); ctx.fill();

  /* 顶部标记灯 */
  ctx.fillStyle = gone ? '#6b7280' : '#ffb347';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * 15, -160, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 后窗 */
  ctx.fillStyle = gone ? '#3b4149' : '#16202b';
  roundRect(ctx, -28, -146, 56, 24, 4); ctx.fill();
  ctx.fillStyle = gone ? '#4b515a' : '#9fe8ff55';
  roundRect(ctx, -24, -142, 20, 16, 3); ctx.fill();

  /* 格栅与标识 */
  ctx.fillStyle = '#1b1e24';
  roundRect(ctx, -27, -112, 54, 17, 3); ctx.fill();
  ctx.fillStyle = '#e8eef7';
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCANIA', 0, -99);
  ctx.fillStyle = gone ? '#6b7280' : '#ffd23f';
  ctx.beginPath();
  ctx.arc(-38, -103, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2f37';
  ctx.beginPath();
  ctx.arc(-38, -103, 3, 0, Math.PI * 2);
  ctx.fill();

  /* 尾灯 */
  for (const side of [-1, 1]) {
    for (const dy of [-46, -30]) {
      ctx.fillStyle = gone ? '#4a5058' : '#ff4d4d';
      ctx.beginPath();
      ctx.arc(side * 34, dy, 6, 0, Math.PI * 2);
      ctx.fill();
      if (!gone) {
        ctx.fillStyle = '#ff9a4d';
        ctx.beginPath();
        ctx.arc(side * 34, dy, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* 后视镜 */
  ctx.strokeStyle = '#2f343c';
  ctx.lineWidth = 3.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 42, -134);
    ctx.lineTo(side * 54, -130);
    ctx.stroke();
  }
  ctx.fillStyle = '#262b33';
  roundRect(ctx, -70, -144, 16, 26, 4); ctx.fill();
  roundRect(ctx, 54, -144, 16, 26, 4); ctx.fill();
  ctx.fillStyle = '#7fa6c9';
  roundRect(ctx, -67, -140, 10, 18, 3); ctx.fill();
  roundRect(ctx, 57, -140, 10, 18, 3); ctx.fill();

  /* 排气立管 */
  ctx.fillStyle = '#3c424b';
  roundRect(ctx, -56, -112, 9, 70, 4); ctx.fill();
  ctx.fillStyle = '#2a2f36';
  roundRect(ctx, -58, -118, 13, 10, 3); ctx.fill();
  ctx.fillStyle = '#585f69';
  ctx.fillRect(-55, -106, 2, 58);

  /* 车牌 */
  ctx.fillStyle = '#f4f1e8';
  roundRect(ctx, -15, -44, 30, 14, 3); ctx.fill();
  ctx.fillStyle = '#1a1d24';
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.fillText(String(frame.color + 1), 0, -33);

  if (frame.hitFlash > 0) {
    ctx.globalAlpha = frame.hitFlash * 0.65;
    ctx.fillStyle = '#ff4d4d';
    roundRect(ctx, -44, -192, 88, 152, 8); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  paintFuelGaugeAt(ctx, x, groundY, cam.truckW / 100, frame.fuel, frame.fuelMax);
}

function body(gone: boolean, color: string) {
  return gone ? '#6b7280' : color;
}

export function paintFuelGaugeAt(ctx: CanvasRenderingContext2D, x: number, groundY: number,
  scale: number, fuel: number, fuelMax: number, roofY?: number) {
  const gaugeW = Math.max(76, 92 * scale);
  const gaugeY = (roofY ?? groundY - 191 * scale) - 24 * scale;
  ctx.fillStyle = '#0d0f15cc';
  roundRect(ctx, x - gaugeW / 2, gaugeY - 15, gaugeW, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.font = `900 ${Math.max(9, 11 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('油', x - gaugeW / 2 + 8, gaugeY + 3);
  const pips = fuelMax;
  const pipW = (gaugeW - 32) / pips;
  for (let i = 0; i < pips; i++) {
    ctx.fillStyle = i < fuel
      ? (fuel > 6 ? '#4ade80' : fuel > 3 ? '#ffc233' : '#ff4d4d')
      : '#2a2f3c';
    roundRect(ctx, x - gaugeW / 2 + 22 + i * pipW, gaugeY - 8, pipW - 2, 10, 2);
    ctx.fill();
  }
}

/* ---------- 帧合成（2D 回退渲染器，WebGL 不可用时使用） ---------- */

export function paintRaceFrame2D(ctx: CanvasRenderingContext2D, frame: RaceFrame) {
  const cam = frame.camera;
  const palette = PALETTES[frame.track.theme];
  ctx.clearRect(0, 0, cam.width, cam.height);
  paintSky(ctx, cam, palette, frame.cameraX, frame.time);
  paintHorizon(ctx, cam, palette, frame.cameraX);
  paintRoad(ctx, cam, frame, palette);
  paintScenery(ctx, cam, frame, palette);
  paintStation(ctx, cam, frame, palette);

  const sorted = frame.obstacles
    .map(obstacle => ({ obstacle, distance: obstacle.x - frame.cameraX }))
    .filter(entry => entry.distance > -140 && entry.distance < DRAW_DIST)
    .sort((a, b) => b.distance - a.distance);
  for (const entry of sorted) paintObstacle(ctx, cam, entry.obstacle, entry.distance, palette);

  const fog = ctx.createLinearGradient(0, cam.horizonY - 4, 0, cam.horizonY + 84);
  fog.addColorStop(0, `${palette.fog}d0`);
  fog.addColorStop(0.42, `${palette.fog}5c`);
  fog.addColorStop(1, `${palette.fog}00`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, cam.horizonY - 4, cam.width, 88);

  if (palette.night) {
    const pool = ctx.createRadialGradient(cam.width / 2, cam.truckGroundY - 150, 10,
      cam.width / 2, cam.truckGroundY - 150, 260);
    pool.addColorStop(0, '#ffe9a83d');
    pool.addColorStop(0.6, '#ffe9a81c');
    pool.addColorStop(1, '#ffe9a800');
    ctx.fillStyle = pool;
    ctx.fillRect(cam.width / 2 - 280, cam.truckGroundY - 300, 560, 320);
  }

  if (frame.boost && frame.status === 'racing') {
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = cam.truckGroundY - 40 - (i * 37) % 260;
      const len = 30 + ((i * 53) % 60);
      ctx.beginPath();
      ctx.moveTo(cam.width / 2 + side * (170 + (i * 29) % 260), y);
      ctx.lineTo(cam.width / 2 + side * (170 + (i * 29) % 260), y + len);
      ctx.stroke();
    }
  }

  paintTruck(ctx, cam, frame);
  frame.particles.paint(ctx);

  ctx.fillStyle = palette.ambient;
  ctx.fillRect(0, 0, cam.width, cam.height);

  const vignette = ctx.createRadialGradient(cam.width / 2, cam.height * 0.52, 210, cam.width / 2, cam.height * 0.52, 640);
  vignette.addColorStop(0, '#00000000');
  vignette.addColorStop(1, '#05070c88');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, cam.width, cam.height);
}

export function buildObstacles(track: RaceTrackDef): Obstacle[] {
  return generateObstacles(track, track.seed);
}

/* ---------- 2D 特效叠加层（覆盖在 3D 画面之上） ---------- */

export interface RaceOverlayOptions {
  width: number;
  height: number;
  palette: ThemePalette;
  particles: RaceParticles;
  gauge: { x: number; groundY: number; scale: number; fuel: number; fuelMax: number; roofY?: number } | null;
  boost: boolean;
  shake: number;
  hitFlash: number;
}

export function paintRaceOverlay(ctx: CanvasRenderingContext2D, opts: RaceOverlayOptions) {
  const { width, height, palette } = opts;
  ctx.save();
  if (opts.shake > 0) ctx.translate((Math.random() - 0.5) * opts.shake * 9, (Math.random() - 0.5) * opts.shake * 9);

  if (opts.boost) {
    ctx.strokeStyle = '#ffffff2e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = height * 0.62 - 40 - (i * 37) % 260;
      const len = 30 + ((i * 53) % 60);
      const x = width / 2 + side * (170 + (i * 29) % 260);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }

  opts.particles.paint(ctx);
  if (opts.gauge) {
    paintFuelGaugeAt(ctx, opts.gauge.x, opts.gauge.groundY, opts.gauge.scale, opts.gauge.fuel, opts.gauge.fuelMax, opts.gauge.roofY);
  }

  if (opts.hitFlash > 0) {
    ctx.globalAlpha = opts.hitFlash * 0.28;
    const flash = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.85);
    flash.addColorStop(0, '#ff4d4d00');
    flash.addColorStop(1, '#ff4d4d');
    ctx.fillStyle = flash;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = palette.ambient;
  ctx.fillRect(-12, -12, width + 24, height + 24);

  const vignette = ctx.createRadialGradient(width / 2, height * 0.52, height * 0.35, width / 2, height * 0.52, height * 1.05);
  vignette.addColorStop(0, '#00000000');
  vignette.addColorStop(1, '#05070c88');
  ctx.fillStyle = vignette;
  ctx.fillRect(-12, -12, width + 24, height + 24);
  ctx.restore();
}
