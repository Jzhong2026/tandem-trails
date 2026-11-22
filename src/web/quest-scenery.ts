import type { QuestRun } from '../shared/quest.js';
import { tileAt } from '../shared/quest.js';
import { ROWS, TILE, VIEW_HEIGHT, VIEW_WIDTH } from '../shared/quest-levels.js';
import type { QuestTheme } from '../shared/quest-levels.js';
import { ellipse, glow, polygon, roundRect } from './quest-art.js';

type Context = CanvasRenderingContext2D;

export interface ThemeSkin {
  sky: [string, string, string];
  far: string;
  mid: string;
  near: string;
  cap: [string, string];
  soil: [string, string, string];
  stone: [string, string];
  brick: [string, string];
  pipe: [string, string];
  accent: string;
  glowColor: string;
  weather: 'petals' | 'spores' | 'dust' | 'clouds' | 'sand' | 'snow' | 'sprinkles' | 'bubbles' | 'fireflies' | 'embers' | 'confetti' | 'ash';
  shape: 'hills' | 'mushrooms' | 'crystals' | 'clouds' | 'dunes' | 'pines' | 'candy' | 'coral' | 'trees' | 'volcano' | 'arcs' | 'towers';
  dark?: boolean;
}

export const THEME_SKINS: Record<QuestTheme, ThemeSkin> = {
  meadow: {
    sky: ['#8fd8f0', '#bfe9f5', '#e8f7dc'], far: '#8fc4d8', mid: '#6fb37f', near: '#4f9a5f',
    cap: ['#7fd48a', '#4f9a5f'], soil: ['#a9713f', '#8a5a34', '#6b4426'], stone: ['#c9bfa8', '#9a9080'],
    brick: ['#d18f57', '#a9673c'], pipe: ['#5cb85c', '#2f8f52'], accent: '#ffd166', glowColor: '#ffe08a',
    weather: 'petals', shape: 'hills',
  },
  hills: {
    sky: ['#7fc9e8', '#a9dff0', '#dff2d8'], far: '#7fb8cc', mid: '#5fa86f', near: '#3f8f52',
    cap: ['#8fdd8a', '#4f9a5f'], soil: ['#b3763f', '#8f5c30', '#6b4426'], stone: ['#cfc4ac', '#9a9080'],
    brick: ['#d18f57', '#a9673c'], pipe: ['#5cb85c', '#2f8f52'], accent: '#ff8a63', glowColor: '#ffd166',
    weather: 'spores', shape: 'mushrooms',
  },
  cave: {
    sky: ['#1a1830', '#241f3d', '#2e2647'], far: '#2a2444', mid: '#3a3055', near: '#4a3c66',
    cap: ['#6b5a8a', '#4a3c66'], soil: ['#4a3c55', '#3a2f44', '#2a2233'], stone: ['#6b5a7a', '#4a3c55'],
    brick: ['#7a5a4a', '#5a3f33'], pipe: ['#5a8f7a', '#3a6b58'], accent: '#7fe6bb', glowColor: '#8fd8f0',
    weather: 'dust', shape: 'crystals', dark: true,
  },
  sky: {
    sky: ['#5fb8e8', '#9fdcf5', '#e8f4ff'], far: '#b8dcf0', mid: '#d8ecfa', near: '#f0f8ff',
    cap: ['#ffffff', '#d8ecfa'], soil: ['#cfe4f5', '#a9c9e0', '#8fb0cc'], stone: ['#e8f2fa', '#c2d6e6'],
    brick: ['#f0d3a8', '#c9a67a'], pipe: ['#7fc9e8', '#4f9ac4'], accent: '#ffd166', glowColor: '#fff3c4',
    weather: 'clouds', shape: 'clouds',
  },
  desert: {
    sky: ['#f5b779', '#f8d9a0', '#fbeccb'], far: '#e0a86b', mid: '#d19a5c', near: '#b8823f',
    cap: ['#f0d3a0', '#d1a86b'], soil: ['#d1a86b', '#b8894f', '#96703c'], stone: ['#e0cba8', '#b8a080'],
    brick: ['#c99a63', '#a97a45'], pipe: ['#c9a24a', '#9a7a30'], accent: '#ff8a63', glowColor: '#ffd166',
    weather: 'sand', shape: 'dunes',
  },
  snow: {
    sky: ['#8fb8d8', '#c2dcee', '#eef7ff'], far: '#a9c9e0', mid: '#cfe4f2', near: '#e8f4fb',
    cap: ['#ffffff', '#cfe4f2'], soil: ['#a9c2d8', '#8aa8c2', '#6b8aa8'], stone: ['#dceaf5', '#b0c8dc'],
    brick: ['#b8d0e0', '#8fa9c0'], pipe: ['#8fd8e8', '#5fa9c4'], accent: '#8fd8f0', glowColor: '#e8f7ff',
    weather: 'snow', shape: 'pines',
  },
  candy: {
    sky: ['#ffb3d9', '#ffd9ec', '#fff0f7'], far: '#f5a0c8', mid: '#ffc4e0', near: '#ffe0f0',
    cap: ['#ff9dc8', '#e07ab0'], soil: ['#d1709f', '#b85a88', '#96486e'], stone: ['#ffe0f0', '#f0b8d4'],
    brick: ['#ffb3d9', '#e08fb8'], pipe: ['#a9f0c4', '#5fc48f'], accent: '#7fe6bb', glowColor: '#fff3c4',
    weather: 'sprinkles', shape: 'candy',
  },
  sea: {
    sky: ['#1a6b8f', '#2a8fb0', '#4fb8cc'], far: '#1f7a99', mid: '#2a94ad', near: '#3fa9bf',
    cap: ['#7fd8c4', '#3f9e8c'], soil: ['#c9b08a', '#a98f6b', '#8a7455'], stone: ['#8fd8c4', '#5fa99a'],
    brick: ['#e0a88f', '#b87f6b'], pipe: ['#5fc4a9', '#3a8f7a'], accent: '#ffd166', glowColor: '#a9f0e0',
    weather: 'bubbles', shape: 'coral',
  },
  night: {
    sky: ['#141a3a', '#1f2450', '#2e2a5c'], far: '#1a2044', mid: '#252a55', near: '#333066',
    cap: ['#4a5a8a', '#333f66'], soil: ['#2f3555', '#252a44', '#1a1e33'], stone: ['#4a4a7a', '#33335a'],
    brick: ['#5a4a6a', '#3f3350'], pipe: ['#4a7a6a', '#2f5a4c'], accent: '#c9a6ff', glowColor: '#ffe08a',
    weather: 'fireflies', shape: 'trees', dark: true,
  },
  lava: {
    sky: ['#3a1a22', '#5a2426', '#7a3428'], far: '#4a2028', mid: '#5f2a2a', near: '#743430',
    cap: ['#8a4a3a', '#5f2f28'], soil: ['#5a3a34', '#442a26', '#2f1e1c'], stone: ['#6b4a44', '#4a322e'],
    brick: ['#7a4a3a', '#5a3328'], pipe: ['#8a6a4a', '#5f4a30'], accent: '#ff8a3a', glowColor: '#ffb35c',
    weather: 'embers', shape: 'volcano', dark: true,
  },
  rainbow: {
    sky: ['#7fc9f0', '#b8e4f7', '#ffe8f4'], far: '#a9d8f0', mid: '#ffd9ec', near: '#fff0f7',
    cap: ['#ffd166', '#f0a83a'], soil: ['#c9a6ff', '#a986d6', '#8f6fd0'], stone: ['#fff0f7', '#e0c8e8'],
    brick: ['#ffb3d9', '#e08fb8'], pipe: ['#7fe6bb', '#3fbf8f'], accent: '#ff6b8a', glowColor: '#fff3c4',
    weather: 'confetti', shape: 'arcs',
  },
  castle: {
    sky: ['#1f1a2e', '#2e2440', '#3f2e4a'], far: '#2a2038', mid: '#3a2c48', near: '#4a3856',
    cap: ['#6b5a6a', '#4a3c4a'], soil: ['#4a3c4a', '#3a2f3a', '#2a222a'], stone: ['#6b5a6a', '#4a3c4a'],
    brick: ['#6b4a4a', '#4a3232'], pipe: ['#7a6a5a', '#5a4a3a'], accent: '#ff6b8a', glowColor: '#ffb35c',
    weather: 'ash', shape: 'towers', dark: true,
  },
};

function hash(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function paintSky(ctx: Context, theme: QuestTheme, seconds: number) {
  const skin = THEME_SKINS[theme];
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, skin.sky[0]);
  gradient.addColorStop(0.55, skin.sky[1]);
  gradient.addColorStop(1, skin.sky[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  if (theme === 'night' || theme === 'cave') {
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * VIEW_WIDTH;
      const y = hash(i + 90) * VIEW_HEIGHT * 0.7;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(seconds * 1.4 + i));
      ctx.globalAlpha = twinkle * (theme === 'cave' ? 0.4 : 0.9);
      ellipse(ctx, x, y, 1.1 + hash(i + 7) * 1.2, 1.1 + hash(i + 7) * 1.2, '#fff8dc');
    }
    ctx.globalAlpha = 1;
    if (theme === 'night') {
      glow(ctx, 516, 84, 110, '#ffe08a44');
      ellipse(ctx, 516, 84, 38, 38, '#fff3c4');
      ellipse(ctx, 502, 76, 30, 30, skin.sky[0]);
    }
  }
  if (theme === 'lava' || theme === 'castle') {
    glow(ctx, VIEW_WIDTH * 0.5, VIEW_HEIGHT, 420, theme === 'lava' ? '#ff6b2a33' : '#ff6b8a22');
  }
  if (theme === 'sea') {
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 7; i++) {
      const x = 90 + i * 140 + Math.sin(seconds * 0.4 + i) * 24;
      polygon(ctx, '#d8f7ff', [[x, 0], [x + 54, 0], [x + 130, VIEW_HEIGHT], [x + 30, VIEW_HEIGHT]]);
    }
    ctx.restore();
  }
  if (theme === 'desert') {
    glow(ctx, 508, 96, 130, '#fff3c466');
    ellipse(ctx, 508, 96, 44, 44, '#fff3c4');
  }
  if (theme === 'rainbow') {
    ctx.save();
    ctx.globalAlpha = 0.3;
    const colors = ['#ff6b8a', '#ffb35c', '#ffe07a', '#7fe6bb', '#8fd8f0', '#c9a6ff'];
    colors.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(VIEW_WIDTH * 0.5, VIEW_HEIGHT + 120, 420 - i * 17, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    ctx.restore();
  }
}

export function paintParallax(ctx: Context, theme: QuestTheme, cameraX: number, seconds: number, cameraY = 0) {
  const skin = THEME_SKINS[theme];
  if (!skin.dark && theme !== 'sea') {
    const offset = cameraX * 0.08;
    ctx.save();
    for (let i = Math.floor(offset / 300) - 1; i < Math.floor(offset / 300) + 5; i++) {
      const x = i * 300 - offset + hash(i * 13) * 90;
      const y = 34 + hash(i * 7) * 104 + cameraY * 0.18;
      const s = 0.62 + hash(i * 3) * 0.7;
      const drift = Math.sin(seconds * 0.22 + i) * 10;
      ctx.globalAlpha = theme === 'sky' ? 0.85 : 0.62;
      for (const [dx, dy, r] of [[-30, 6, 20], [0, -8, 27], [28, 5, 19], [10, 12, 17]] as const) {
        ellipse(ctx, x + dx * s + drift, y + dy * s, r * s, r * s * 0.74, '#ffffff');
      }
      ctx.globalAlpha = theme === 'sky' ? 0.4 : 0.24;
      ellipse(ctx, x + 4 * s + drift, y + 16 * s, 40 * s, 7 * s, skin.far);
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = skin.far;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 211 + seconds * 26 - cameraX * 0.12) % (VIEW_WIDTH + 160) + VIEW_WIDTH + 160) % (VIEW_WIDTH + 160) - 80;
      const by = 46 + hash(i * 17) * 76 + Math.sin(seconds * 1.1 + i) * 7;
      const flap = Math.sin(seconds * 5 + i * 2) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by + flap);
      ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by + flap);
      ctx.stroke();
    }
    ctx.restore();
  }
  const layers: [number, string, number][] = [[0.16, skin.far, 0], [0.36, skin.mid, 1], [0.62, skin.near, 2]];
  for (const [depth, color, layer] of layers) {
    const offset = cameraX * depth;
    const spacing = layer === 0 ? 260 : layer === 1 ? 180 : 130;
    const horizon = 12 * TILE - cameraY;
    const baseY = horizon + (layer === 0 ? 30 : layer === 1 ? 18 : 8);
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = layer === 0 ? 0.5 : layer === 1 ? 0.72 : 0.95;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i < first + Math.ceil(VIEW_WIDTH / spacing) + 3; i++) {
      const x = i * spacing - offset;
      const seed = i * 7 + layer * 31;
      const scale = 0.7 + hash(seed) * 0.6;
      drawShape(ctx, skin.shape, x, baseY, scale, color, layer, seconds, seed, theme);
    }
    ctx.restore();
  }
}

function drawShape(ctx: Context, shape: ThemeSkin['shape'], x: number, baseY: number, scale: number, color: string, layer: number, seconds: number, seed: number, theme: QuestTheme) {
  const s = scale * (layer === 0 ? 1.5 : layer === 1 ? 1.05 : 0.72);
  switch (shape) {
    case 'hills':
    case 'dunes': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - 170 * s, baseY + 70);
      ctx.quadraticCurveTo(x, baseY - 280 * s, x + 170 * s, baseY + 70);
      ctx.closePath();
      ctx.fill();
      if (shape === 'hills' && layer > 0) {
        ctx.fillStyle = '#ffffff26';
        ctx.beginPath();
        ctx.moveTo(x - 40 * s, baseY - 62 * s);
        ctx.quadraticCurveTo(x, baseY - 150 * s, x + 40 * s, baseY - 66 * s);
        ctx.closePath();
        ctx.fill();
      }
      if (shape === 'dunes') {
        ctx.strokeStyle = '#ffffff2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 96 * s, baseY - 20 * s);
        ctx.quadraticCurveTo(x, baseY - 120 * s, x + 96 * s, baseY - 14 * s);
        ctx.stroke();
      }
      break;
    }
    case 'mushrooms': {
      roundRect(ctx, x - 9 * s, baseY - 60 * s, 18 * s, 80 * s, 6 * s, '#f0e0c0');
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, baseY - 58 * s, 52 * s, 34 * s, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 4; i++) ellipse(ctx, x - 30 * s + i * 20 * s, baseY - 70 * s + (i % 2) * 10 * s, 8 * s, 6 * s, '#ffffff55');
      break;
    }
    case 'crystals': {
      polygon(ctx, color, [[x, baseY - 120 * s], [x + 26 * s, baseY - 30 * s], [x + 12 * s, baseY + 60], [x - 14 * s, baseY + 60], [x - 26 * s, baseY - 34 * s]]);
      polygon(ctx, '#ffffff22', [[x, baseY - 120 * s], [x + 8 * s, baseY - 30 * s], [x - 4 * s, baseY + 60], [x - 14 * s, baseY + 60]]);
      if (layer === 2) glow(ctx, x, baseY - 60 * s, 50 * s, '#7fe6bb22');
      break;
    }
    case 'clouds': {
      const drift = Math.sin(seconds * 0.3 + seed) * 8;
      ctx.fillStyle = color;
      for (const [dx, dy, r] of [[-34, 6, 26], [0, -10, 34], [32, 4, 24], [12, 12, 22]] as const) {
        ellipse(ctx, x + dx * s + drift, baseY - 40 * s + dy * s, r * s, r * s * 0.78, color);
      }
      break;
    }
    case 'pines': {
      roundRect(ctx, x - 5 * s, baseY - 20 * s, 10 * s, 50 * s, 3, '#6b4a34');
      for (let tier = 0; tier < 3; tier++) {
        const w = (46 - tier * 12) * s;
        const y = baseY - 20 * s - tier * 30 * s;
        polygon(ctx, color, [[x, y - 46 * s], [x + w, y], [x - w, y]]);
        polygon(ctx, '#ffffff66', [[x, y - 46 * s], [x + w * 0.5, y - 18 * s], [x - w * 0.5, y - 18 * s]]);
      }
      break;
    }
    case 'candy': {
      roundRect(ctx, x - 5 * s, baseY - 50 * s, 10 * s, 70 * s, 4, '#fff0f7');
      const hue = (seed * 47) % 360;
      ellipse(ctx, x, baseY - 62 * s, 30 * s, 30 * s, `hsl(${hue}, 80%, 76%)`);
      ctx.strokeStyle = '#ffffffaa';
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.arc(x, baseY - 62 * s, 18 * s, seconds * 0.4, seconds * 0.4 + 2.4);
      ctx.stroke();
      break;
    }
    case 'coral': {
      ctx.strokeStyle = color;
      ctx.lineWidth = 12 * s;
      ctx.lineCap = 'round';
      for (const dir of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, baseY + 50);
        ctx.quadraticCurveTo(x + dir * 26 * s, baseY - 30 * s, x + dir * 40 * s + Math.sin(seconds + seed) * 6, baseY - 80 * s);
        ctx.stroke();
      }
      ellipse(ctx, x, baseY - 20 * s, 20 * s, 14 * s, color);
      break;
    }
    case 'trees': {
      roundRect(ctx, x - 8 * s, baseY - 70 * s, 16 * s, 100 * s, 5, color);
      for (const [dx, dy, r] of [[-26, -84, 28], [24, -90, 26], [0, -110, 32]] as const) {
        ellipse(ctx, x + dx * s, baseY + dy * s, r * s, r * s * 0.82, color);
      }
      if (layer === 2) {
        for (let i = 0; i < 3; i++) {
          const fx = x + Math.sin(seconds * 0.8 + seed + i * 2) * 34;
          const fy = baseY - 60 * s + Math.cos(seconds * 1.1 + i) * 22;
          glow(ctx, fx, fy, 12, '#ffe08a66');
          ellipse(ctx, fx, fy, 2, 2, '#fff8dc');
        }
      }
      break;
    }
    case 'volcano': {
      polygon(ctx, color, [[x - 120 * s, baseY + 60], [x - 30 * s, baseY - 110 * s], [x + 30 * s, baseY - 110 * s], [x + 120 * s, baseY + 60]]);
      polygon(ctx, '#ff6b2a55', [[x - 30 * s, baseY - 110 * s], [x + 30 * s, baseY - 110 * s], [x + 16 * s, baseY - 92 * s], [x - 16 * s, baseY - 92 * s]]);
      if (layer === 0) glow(ctx, x, baseY - 110 * s, 70 * s, '#ff6b2a44');
      break;
    }
    case 'arcs': {
      ctx.save();
      ctx.globalAlpha = 0.5;
      const colors = ['#ff6b8a', '#ffb35c', '#ffe07a', '#7fe6bb', '#8fd8f0'];
      colors.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 9 * s;
        ctx.beginPath();
        ctx.arc(x, baseY + 40, (90 - i * 10) * s, Math.PI, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
      break;
    }
    case 'towers': {
      roundRect(ctx, x - 34 * s, baseY - 130 * s, 68 * s, 190 * s, 4, color);
      polygon(ctx, color, [[x - 42 * s, baseY - 130 * s], [x, baseY - 180 * s], [x + 42 * s, baseY - 130 * s]]);
      for (let i = 0; i < 3; i++) {
        const lit = hash(seed + i) > 0.4;
        roundRect(ctx, x - 16 * s + (i % 2) * 24 * s, baseY - 110 * s + i * 34 * s, 14 * s, 20 * s, 6 * s, lit ? '#ffb35c' : '#2a222a');
        if (lit) glow(ctx, x - 9 * s + (i % 2) * 24 * s, baseY - 100 * s + i * 34 * s, 22 * s, '#ffb35c44');
      }
      break;
    }
  }
}

function terrainTop(ctx: Context, skin: ThemeSkin, x: number, y: number, theme: QuestTheme, col: number) {
  const gradient = ctx.createLinearGradient(x, y, x, y + 12);
  gradient.addColorStop(0, skin.cap[0]);
  gradient.addColorStop(1, skin.cap[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, TILE, 12);
  if (theme === 'meadow' || theme === 'hills' || theme === 'night' || theme === 'rainbow') {
    ctx.fillStyle = skin.cap[0];
    for (let i = 0; i < 4; i++) {
      const bx = x + 4 + i * 8 + hash(col * 4 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(bx, y + 2);
      ctx.quadraticCurveTo(bx + 2, y - 5 - hash(col + i) * 4, bx + 4, y + 2);
      ctx.closePath();
      ctx.fill();
    }
    if (hash(col * 3) > 0.78) {
      const fx = x + 10 + hash(col) * 16;
      ellipse(ctx, fx, y - 4, 3, 3, theme === 'night' ? '#c9a6ff' : '#ffd166');
      ellipse(ctx, fx, y - 4, 1.2, 1.2, '#fff8dc');
    }
  } else if (theme === 'snow') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    for (let i = 0; i <= 4; i++) ctx.quadraticCurveTo(x + i * 9 + 4, y - 3, x + (i + 1) * 9, y + 5);
    ctx.lineTo(x + TILE, y + 12);
    ctx.lineTo(x, y + 12);
    ctx.closePath();
    ctx.fill();
  } else if (theme === 'desert') {
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 4 + i * 3);
      ctx.quadraticCurveTo(x + TILE / 2, y + 1 + i * 3, x + TILE - 3, y + 4 + i * 3);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#ffffff18';
    ctx.fillRect(x, y, TILE, 3);
  }
}

export function paintTiles(ctx: Context, run: QuestRun) {
  const skin = THEME_SKINS[run.theme];
  const width = run.level.width;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < width; col++) {
      const char = tileAt(run, col, row);
      if (char === '.') continue;
      const x = col * TILE;
      const y = row * TILE;
      switch (char) {
        case '#': {
          const gradient = ctx.createLinearGradient(x, y, x, y + TILE);
          gradient.addColorStop(0, skin.soil[0]);
          gradient.addColorStop(1, skin.soil[1]);
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = skin.soil[2];
          for (let i = 0; i < 3; i++) {
            const px = x + 5 + hash(col * 9 + row * 3 + i) * 24;
            const py = y + 12 + hash(col + row * 7 + i) * 20;
            ellipse(ctx, px, py, 2.4 + hash(i + col) * 2, 1.8 + hash(i + row) * 1.4, skin.soil[2]);
          }
          if (tileAt(run, col, row - 1) !== '#') terrainTop(ctx, skin, x, y, run.theme, col);
          if (tileAt(run, col - 1, row) !== '#') { ctx.fillStyle = '#ffffff14'; ctx.fillRect(x, y, 3, TILE); }
          if (tileAt(run, col + 1, row) !== '#') { ctx.fillStyle = '#00000022'; ctx.fillRect(x + TILE - 3, y, 3, TILE); }
          break;
        }
        case '=': {
          roundRect(ctx, x, y, TILE, TILE, 4, skin.stone[1]);
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 6, 3, skin.stone[0]);
          ctx.fillStyle = '#ffffff30';
          ctx.fillRect(x + 4, y + 4, TILE - 8, 3);
          ctx.strokeStyle = '#00000018';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 6, y + TILE - 8);
          ctx.lineTo(x + TILE - 6, y + TILE - 8);
          ctx.stroke();
          break;
        }
        case 'B': {
          roundRect(ctx, x, y, TILE, TILE, 3, skin.brick[1]);
          ctx.fillStyle = skin.brick[0];
          for (let r = 0; r < 3; r++) {
            const offset = r % 2 ? -8 : 0;
            for (let c = 0; c < 3; c++) {
              const bx = x + 2 + c * 12 + offset;
              const bw = Math.min(11, x + TILE - 2 - bx);
              if (bw > 2) roundRect(ctx, Math.max(x + 2, bx), y + 2 + r * 11, bw, 9, 2, skin.brick[0]);
            }
          }
          ctx.fillStyle = '#ffffff20';
          ctx.fillRect(x + 2, y + 2, TILE - 4, 2);
          break;
        }
        case 'u': {
          roundRect(ctx, x, y, TILE, TILE, 4, '#7a6a5a');
          roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 8, 3, '#9a8a76');
          ellipse(ctx, x + TILE / 2, y + TILE / 2, 4, 4, '#6b5a4a');
          break;
        }
        case '-': {
          if (run.theme === 'sky' || run.theme === 'rainbow') {
            ctx.fillStyle = '#ffffff';
            for (const [dx, dy, r] of [[6, 10, 11], [18, 6, 14], [30, 10, 11]] as const) ellipse(ctx, x + dx, y + dy, r, r * 0.7, '#ffffff');
            ctx.fillStyle = '#d8ecfa';
            ctx.fillRect(x, y + 14, TILE, 4);
          } else {
            roundRect(ctx, x, y + 4, TILE, 12, 4, skin.stone[1]);
            roundRect(ctx, x + 1, y + 5, TILE - 2, 6, 3, skin.cap[0]);
            ctx.fillStyle = '#ffffff30';
            ctx.fillRect(x + 3, y + 6, TILE - 6, 2);
          }
          break;
        }
        case '[': case ']': case '{': case '}': {
          const left = char === '[' || char === '{';
          const gradient = ctx.createLinearGradient(x, y, x + TILE, y);
          gradient.addColorStop(0, left ? skin.pipe[0] : skin.pipe[1]);
          gradient.addColorStop(1, left ? skin.pipe[1] : skin.pipe[0]);
          roundRect(ctx, x - (left ? 4 : 0), y, TILE + 4, TILE, 4, gradient);
          ctx.fillStyle = '#ffffff35';
          ctx.fillRect(x + (left ? 2 : 6), y + 3, 6, TILE - 6);
          ctx.fillStyle = '#00000025';
          ctx.fillRect(x + (left ? TILE - 6 : 0), y + 3, 5, TILE - 6);
          roundRect(ctx, x - (left ? 5 : 0), y, TILE + 5, 7, 3, skin.pipe[0]);
          break;
        }
        case '(': case ')': {
          const left = char === '(';
          const gradient = ctx.createLinearGradient(x, y, x + TILE, y);
          gradient.addColorStop(0, left ? skin.pipe[0] : skin.pipe[1]);
          gradient.addColorStop(1, left ? skin.pipe[1] : skin.pipe[0]);
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#ffffff28';
          ctx.fillRect(x + (left ? 5 : 9), y, 5, TILE);
          ctx.fillStyle = '#00000022';
          ctx.fillRect(x + (left ? TILE - 5 : 0), y, 4, TILE);
          break;
        }
        case 'S': {
          for (let i = 0; i < 3; i++) {
            const sx = x + 4 + i * 11;
            polygon(ctx, '#c9d6e2', [[sx, y + TILE], [sx + 5, y + 6], [sx + 10, y + TILE]]);
            polygon(ctx, '#ffffff88', [[sx + 2, y + TILE], [sx + 5, y + 8], [sx + 5, y + TILE]]);
          }
          roundRect(ctx, x, y + TILE - 6, TILE, 6, 2, '#6b5a4a');
          break;
        }
      }
    }
  }
}

export function paintDynamicTiles(ctx: Context, run: QuestRun, seconds: number, cameraX: number) {
  const skin = THEME_SKINS[run.theme];
  const fromCol = Math.max(0, Math.floor(cameraX / TILE) - 1);
  const toCol = Math.min(run.level.width - 1, Math.ceil((cameraX + VIEW_WIDTH) / TILE) + 1);
  for (let row = 0; row < ROWS; row++) {
    for (let col = fromCol; col <= toCol; col++) {
      const char = run.tiles[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (char === '?' || char === '!' || char === '+') {
        const block = run.blocks.find(entry => entry.col === col && entry.row === row);
        const bump = block && block.bumpMs > 0 ? Math.sin((1 - block.bumpMs / 200) * Math.PI) * 7 : 0;
        const pulse = 0.5 + 0.5 * Math.sin(seconds * 3.4 + col);
        ctx.save();
        ctx.translate(0, -bump);
        glow(ctx, x + TILE / 2, y + TILE / 2, 26, `#ffd166${Math.round(20 + pulse * 30).toString(16)}`);
        roundRect(ctx, x, y, TILE, TILE, 5, '#c98a2a');
        const face = ctx.createLinearGradient(x, y, x, y + TILE);
        face.addColorStop(0, '#ffe07a');
        face.addColorStop(1, '#f0a83a');
        roundRect(ctx, x + 2.5, y + 2.5, TILE - 5, TILE - 7, 4, face);
        for (const [bx, by] of [[5, 5], [TILE - 8, 5], [5, TILE - 10], [TILE - 8, TILE - 10]] as const) ellipse(ctx, x + bx, y + by, 1.8, 1.8, '#a9713f');
        ctx.fillStyle = '#8a5a1a';
        ctx.font = '800 21px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char === '?' ? '?' : char === '!' ? '★' : '♥', x + TILE / 2, y + TILE / 2 + 1);
        ctx.fillStyle = `#ffffff${Math.round(pulse * 70).toString(16).padStart(2, '0')}`;
        ctx.fillRect(x + 4, y + 4, TILE - 8, 4);
        ctx.restore();
      } else if (char === '>' || char === '<') {
        roundRect(ctx, x, y, TILE, TILE, 3, '#4a3c55');
        roundRect(ctx, x + 1, y + 2, TILE - 2, 12, 5, '#6b5a7a');
        const dir = char === '>' ? 1 : -1;
        const shift = ((seconds * 60 * dir) % 12 + 12) % 12;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 2, TILE - 2, 12);
        ctx.clip();
        ctx.fillStyle = skin.accent;
        for (let i = -1; i < 4; i++) {
          const ax = x + i * 12 + shift;
          polygon(ctx, skin.accent, [[ax, y + 4], [ax + dir * 6, y + 8], [ax, y + 12]]);
        }
        ctx.restore();
        for (const bx of [x + 5, x + TILE - 5]) ellipse(ctx, bx, y + 20, 4, 4, '#8a7a94');
      } else if (char === 'L') {
        const wave = Math.sin(seconds * 3 + col * 0.7) * 3;
        const gradient = ctx.createLinearGradient(x, y, x, y + TILE);
        gradient.addColorStop(0, '#ffd166');
        gradient.addColorStop(0.35, '#ff8a3a');
        gradient.addColorStop(1, '#c92a1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y + (tileAt(run, col, row - 1) === 'L' ? 0 : wave), TILE, TILE);
        if (tileAt(run, col, row - 1) !== 'L') {
          glow(ctx, x + TILE / 2, y, 30, '#ff8a3a55');
          ellipse(ctx, x + TILE / 2, y + wave, TILE / 2, 4, '#ffe07a');
          for (let i = 0; i < 2; i++) {
            const t = (seconds * 0.7 + hash(col + i)) % 1;
            ellipse(ctx, x + 8 + i * 18, y - t * 26, 2.4 * (1 - t), 2.4 * (1 - t), '#ffb35c');
          }
        }
      } else if (char === 'D') {
        paintGateTile(ctx, x, y, run.gateOpen, seconds);
      }
    }
  }
}

function paintGateTile(ctx: Context, x: number, y: number, open: boolean, seconds: number) {
  ctx.save();
  ctx.globalAlpha = open ? 0.16 : 1;
  const gradient = ctx.createLinearGradient(x, y, x + TILE, y);
  gradient.addColorStop(0, '#5a4a6a');
  gradient.addColorStop(0.5, '#8f6fd0');
  gradient.addColorStop(1, '#5a4a6a');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = '#e8dcff';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = seconds * 18;
  ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
  ctx.setLineDash([]);
  ctx.restore();
}

export function paintWeather(ctx: Context, theme: QuestTheme, seconds: number, cameraX: number) {
  const kind = THEME_SKINS[theme].weather;
  const count = kind === 'clouds' ? 10 : kind === 'bubbles' ? 46 : kind === 'confetti' ? 40 : 54;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const speed = 18 + hash(i) * 46;
    const drift = kind === 'snow' || kind === 'petals' || kind === 'sprinkles' || kind === 'confetti' || kind === 'ash';
    const rise = kind === 'bubbles' || kind === 'embers' || kind === 'fireflies' || kind === 'spores' || kind === 'dust';
    const x = ((hash(i + 3) * (VIEW_WIDTH + 120) + seconds * (rise ? 6 : speed) * (kind === 'sand' ? 3 : 1) - cameraX * 0.25) % (VIEW_WIDTH + 120) + VIEW_WIDTH + 120) % (VIEW_WIDTH + 120) - 60;
    const y = ((hash(i + 11) * (VIEW_HEIGHT + 80) + seconds * (rise ? -speed : drift ? speed * 0.7 : 4)) % (VIEW_HEIGHT + 80) + VIEW_HEIGHT + 80) % (VIEW_HEIGHT + 80) - 40;
    const size = 1.4 + hash(i + 5) * 2.6;
    switch (kind) {
      case 'snow':
        ctx.globalAlpha = 0.55 + hash(i) * 0.4;
        ellipse(ctx, x + Math.sin(seconds * 1.2 + i) * 12, y, size, size, '#ffffff');
        break;
      case 'petals':
        ctx.globalAlpha = 0.6;
        ctx.save();
        ctx.translate(x + Math.sin(seconds + i) * 16, y);
        ctx.rotate(seconds * 1.6 + i);
        ellipse(ctx, 0, 0, size * 1.8, size * 0.9, i % 3 ? '#ffd9ec' : '#fff3c4');
        ctx.restore();
        break;
      case 'spores':
        ctx.globalAlpha = 0.45;
        glow(ctx, x, y, size * 4, '#a9f0c455');
        ellipse(ctx, x, y, size * 0.7, size * 0.7, '#e8f7dc');
        break;
      case 'dust':
        ctx.globalAlpha = 0.3;
        ellipse(ctx, x, y, size * 0.8, size * 0.8, '#c9b08a');
        break;
      case 'sand':
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#f0d3a0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 14 + size * 3, y + 1);
        ctx.stroke();
        break;
      case 'sprinkles':
        ctx.globalAlpha = 0.75;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(i + seconds);
        roundRect(ctx, -size, -size * 0.4, size * 2.4, size * 0.9, size * 0.4, `hsl(${(i * 47) % 360}, 85%, 72%)`);
        ctx.restore();
        break;
      case 'bubbles':
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#d8f7ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x + Math.sin(seconds * 1.6 + i) * 8, y, size * 1.8, 0, Math.PI * 2);
        ctx.stroke();
        ellipse(ctx, x + Math.sin(seconds * 1.6 + i) * 8 - size * 0.6, y - size * 0.6, size * 0.4, size * 0.4, '#ffffffaa');
        break;
      case 'fireflies': {
        const pulse = 0.35 + 0.65 * Math.abs(Math.sin(seconds * 2 + i * 1.7));
        ctx.globalAlpha = pulse;
        const fx = x + Math.sin(seconds * 0.7 + i) * 26;
        const fy = y + Math.cos(seconds * 0.9 + i * 2) * 18;
        glow(ctx, fx, fy, 14, '#ffe08a77');
        ellipse(ctx, fx, fy, 1.8, 1.8, '#fff8dc');
        break;
      }
      case 'embers':
        ctx.globalAlpha = 0.7;
        glow(ctx, x + Math.sin(seconds * 2 + i) * 10, y, size * 4, '#ff8a3a66');
        ellipse(ctx, x + Math.sin(seconds * 2 + i) * 10, y, size * 0.8, size * 0.8, '#ffd166');
        break;
      case 'confetti':
        ctx.globalAlpha = 0.8;
        ctx.save();
        ctx.translate(x + Math.sin(seconds * 1.4 + i) * 14, y);
        ctx.rotate(seconds * 2.4 + i);
        ctx.fillStyle = `hsl(${(i * 63) % 360}, 90%, 68%)`;
        ctx.fillRect(-size, -size * 1.6, size * 2, size * 3.2);
        ctx.restore();
        break;
      case 'ash':
        ctx.globalAlpha = 0.35;
        ellipse(ctx, x + Math.sin(seconds * 0.8 + i) * 10, y, size * 0.9, size * 0.9, '#8a7a8a');
        break;
      case 'clouds':
        ctx.globalAlpha = 0.5;
        for (const [dx, dy, r] of [[-18, 4, 14], [0, -6, 20], [18, 4, 14]] as const) ellipse(ctx, x + dx, y + dy, r, r * 0.7, '#ffffff');
        break;
    }
  }
  ctx.restore();
}

export function paintVignette(ctx: Context, theme: QuestTheme) {
  const skin = THEME_SKINS[theme];
  if (!skin.dark) return;
  const gradient = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.34, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH * 0.72);
  gradient.addColorStop(0, '#00000000');
  gradient.addColorStop(1, '#00000088');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}