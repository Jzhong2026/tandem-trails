import { BUDDY_PALETTE_COUNT, DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { Appearance, BuddyBody, BuddyLooks } from '../shared/buddy.js';
import type { RoomView, Seat } from '../shared/protocol.js';

export type { BuddyLooks } from '../shared/buddy.js';

type Context = CanvasRenderingContext2D;

export type BuddyOutfit = 'sprout' | 'miner' | 'sailor' | 'carrier' | 'pilot';
export type BuddyPose = 'walk' | 'idle' | 'win' | 'paddle' | 'carry' | 'bust';

export const CHAPTER_OUTFIT = { river: 'sailor', mine: 'miner', egg: 'carrier', sub: 'pilot' } as const;

export const BUDDY_PALETTES = [
  { cap: '#e8503a', capDark: '#b32e22', capLight: '#ff8a63', suit: '#2f7f8c', suitDark: '#1d5a66', shirt: '#fdf1dc', skin: '#ffd9b0', skinDark: '#e8b183', hair: '#5a3320', boot: '#7a4326', trim: '#ffd166', scarf: '#ffd166' },
  { cap: '#3fbf8f', capDark: '#22876a', capLight: '#7fe6bb', suit: '#7a4f9c', suitDark: '#573573', shirt: '#fdf1dc', skin: '#ffd9b0', skinDark: '#e8b183', hair: '#3d2a1c', boot: '#4a3a6b', trim: '#ffe08a', scarf: '#8fe3ff' },
  { cap: '#f2a13c', capDark: '#b3762a', capLight: '#ffd98a', suit: '#4a6fa5', suitDark: '#33517d', shirt: '#fdf1dc', skin: '#ffd9b0', skinDark: '#e8b183', hair: '#4a3320', boot: '#6b4a2f', trim: '#ffe08a', scarf: '#ff8a63' },
  { cap: '#4aa3e8', capDark: '#2b6fa8', capLight: '#8fd0ff', suit: '#e8705a', suitDark: '#b34a38', shirt: '#fdf1dc', skin: '#ffd9b0', skinDark: '#e8b183', hair: '#2f2a26', boot: '#35506b', trim: '#ffd166', scarf: '#ffe08a' },
  { cap: '#b0609c', capDark: '#7d3f6e', capLight: '#e09cc8', suit: '#3f8f6b', suitDark: '#2a6b4e', shirt: '#fdf1dc', skin: '#ffd9b0', skinDark: '#e8b183', hair: '#4a2c3c', boot: '#5a3a50', trim: '#ffe08a', scarf: '#8fe3ff' },
  { cap: '#6b8f3f', capDark: '#4a6b2a', capLight: '#a8c878', suit: '#8a5c3c', suitDark: '#6b4429', shirt: '#fdf1dc', skin: '#ffd9b0', skinDark: '#e8b183', hair: '#3d2a1c', boot: '#4a3a2b', trim: '#ffd166', scarf: '#ff8a63' },
] as const;

export const BUDDY_SPECIES: Record<Exclude<BuddyBody, 'kid'>, { fur: string; furDark: string; muzzle: string }> = {
  bear: { fur: '#b9825a', furDark: '#8a5c3c', muzzle: '#e8c9a4' },
  fox: { fur: '#e8874a', furDark: '#b35c2a', muzzle: '#fff0dc' },
  penguin: { fur: '#2b3440', furDark: '#1b222c', muzzle: '#ffffff' },
};
const SPECIES = BUDDY_SPECIES;

export function looksOf(room: RoomView | null): BuddyLooks {
  return {
    left: room?.players.left?.appearance ?? DEFAULT_APPEARANCE.left,
    right: room?.players.right?.appearance ?? DEFAULT_APPEARANCE.right,
  };
}

export function buddyScale(size: Appearance['size']) {
  return size === 'big' ? 1.37 : 1;
}

export function paletteOf(appearance: Appearance) {
  return BUDDY_PALETTES[Math.min(BUDDY_PALETTE_COUNT - 1, Math.max(0, appearance.palette))];
}

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}
function roundRect(ctx: Context, x: number, y: number, w: number, h: number, r: number, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function polygon(ctx: Context, color: string | CanvasGradient, points: readonly (readonly [number, number])[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}
function limb(ctx: Context, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function star(ctx: Context, x: number, y: number, radius: number, inner: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function glow(ctx: Context, x: number, y: number, radius: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, '#0000');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

interface Pose {
  bob: number; lean: number;
  legA: number; legB: number; kneeA: number; kneeB: number;
  armA: number; armB: number; elbowA: number; elbowB: number;
  blink: boolean; mouth: 'smile' | 'open'; eye: 'open' | 'shut' | 'happy';
}

function poseOf(pose: BuddyPose, phase: number, seconds: number): Pose {
  const p: Pose = {
    bob: 0, lean: 0, legA: 0.12, legB: -0.12, kneeA: 0.1, kneeB: 0.1,
    armA: 0.22, armB: -0.22, elbowA: 0.25, elbowB: 0.25,
    blink: (seconds % 3.6) > 3.44, mouth: 'smile', eye: 'open',
  };
  if (pose === 'walk') {
    const swing = Math.sin(phase * Math.PI * 2);
    p.legA = swing * 0.85; p.legB = -swing * 0.85;
    p.kneeA = 0.3 + Math.max(0, -swing) * 0.75; p.kneeB = 0.3 + Math.max(0, swing) * 0.75;
    p.armA = -swing * 0.8; p.armB = swing * 0.8;
    p.elbowA = 0.55; p.elbowB = 0.55;
    p.bob = Math.abs(swing) * 1.3; p.lean = 0.13; p.mouth = 'open';
  } else if (pose === 'win') {
    p.armA = -2.3; p.armB = -2.1; p.elbowA = 0.2; p.elbowB = 0.2;
    p.bob = Math.abs(Math.sin(seconds * 7)) * 3; p.eye = 'happy'; p.mouth = 'open';
    p.legA = 0.2; p.legB = -0.2;
  } else if (pose === 'paddle') {
    const stroke = Math.sin(phase * Math.PI * 2);
    p.lean = 0.16; p.bob = stroke * 0.8;
    p.armA = -0.9 + stroke * 0.7; p.armB = -0.7 + stroke * 0.7;
    p.elbowA = 0.7; p.elbowB = 0.7; p.mouth = 'open';
  } else if (pose === 'carry') {
    p.lean = 0.05; p.armA = -1.9; p.armB = -1.7; p.elbowA = 0.35; p.elbowB = 0.35;
    p.bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.9;
    p.legA = Math.sin(phase * Math.PI * 2) * 0.5; p.legB = -Math.sin(phase * Math.PI * 2) * 0.5;
    p.kneeA = 0.3; p.kneeB = 0.3;
  } else {
    p.bob = Math.sin(seconds * 2.4) * 0.7;
    p.armA = 0.24 + Math.sin(seconds * 2.4) * 0.06;
    p.armB = -0.24 - Math.sin(seconds * 2.4) * 0.06;
    if (p.blink) p.eye = 'shut';
  }
  return p;
}

function armIK(ctx: Context, sx: number, sy: number, tx: number, ty: number, bend: number,
  upper: string, lower: string, hand: string, handR: number) {
  const l1 = 6, l2 = 5.4;
  const dx = tx - sx, dy = ty - sy;
  const d = Math.min(l1 + l2 - 0.05, Math.max(0.5, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const off = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const ex = sx + Math.cos(base + off * bend) * l1;
  const ey = sy + Math.sin(base + off * bend) * l1;
  limb(ctx, sx, sy, ex, ey, 4.8, upper);
  limb(ctx, ex, ey, tx, ty, 4.3, lower);
  ellipse(ctx, tx, ty, handR, handR, hand);
}

export interface HeadOptions {
  body: BuddyBody;
  pal: typeof BUDDY_PALETTES[number];
  eye: 'open' | 'shut' | 'happy' | 'cross';
  mouth: 'smile' | 'open' | 'grit' | 'flat';
  outfit: BuddyOutfit;
  lean: number;
  seconds: number;
}

export function paintHead(ctx: Context, h: HeadOptions) {
  const { body, pal, eye, mouth, outfit, lean, seconds } = h;
  const species = body === 'kid' ? null : SPECIES[body];
  const fur = species?.fur ?? pal.suit;
  const furDark = species?.furDark ?? pal.suitDark;
  const muzzle = species?.muzzle ?? pal.shirt;
  ctx.save();
  ctx.save();
  ctx.rotate(lean * 0.2);
  if (body === 'bear') {
    ellipse(ctx, -5.6, -5.4, 2.8, 2.8, furDark);
    ellipse(ctx, 5.6, -5.4, 2.8, 2.8, furDark);
    ellipse(ctx, -5.6, -5.4, 1.4, 1.4, muzzle);
    ellipse(ctx, 5.6, -5.4, 1.4, 1.4, muzzle);
  }
  if (body === 'fox') {
    polygon(ctx, furDark, [[-7, -3], [-5.4, -9.6], [-2.2, -4.4]]);
    polygon(ctx, furDark, [[7, -3], [5.4, -9.6], [2.2, -4.4]]);
    polygon(ctx, muzzle, [[-5.8, -4], [-5.2, -7.6], [-3.4, -4.6]]);
    polygon(ctx, muzzle, [[5.8, -4], [5.2, -7.6], [3.4, -4.6]]);
  }
  ellipse(ctx, -0.4, 0.6, 7.4, 7.2, species ? furDark : pal.skinDark);
  const face = ctx.createRadialGradient(-2, -2.4, 1, 0, 0, 8.4);
  if (body === 'penguin') { face.addColorStop(0, '#ffffff'); face.addColorStop(1, '#e8eef2'); }
  else if (species) { face.addColorStop(0, muzzle); face.addColorStop(1, fur); }
  else { face.addColorStop(0, '#fff0dc'); face.addColorStop(1, pal.skin); }
  ellipse(ctx, 0, 0, 7.2, 7, face);
  if (body === 'penguin') {
    ellipse(ctx, 0, -4.6, 7.2, 3.6, fur);
    polygon(ctx, '#f2a13c', [[-1.6, 1.2], [1.8, 1.2], [0.1, 3.6]]);
  }
  if (!species) {
    ellipse(ctx, -6.4, 1.2, 1.9, 2.4, pal.skin);
    ellipse(ctx, 6.4, 1.2, 1.9, 2.4, pal.skin);
    polygon(ctx, pal.hair, [[-6.6, -1.6], [-5.2, -4.6], [-3.4, -1.8], [-1.6, -4.8], [0.2, -1.9], [2, -4.6], [3.6, -1.7], [5.4, -4.2], [6.6, -1.4], [6.6, -3.4], [-6.6, -3.4]]);
  }
  if (species && body !== 'penguin') ellipse(ctx, 0.6, 2.4, 3.4, 2.5, muzzle);
  ellipse(ctx, -3.6, 2.4, 1.9, 1.2, '#ff9d8a55');
  ellipse(ctx, 3.8, 2.4, 1.9, 1.2, '#ff9d8a55');
  if (eye === 'shut') {
    ctx.strokeStyle = '#4a2c1c'; ctx.lineWidth = 1.1;
    for (const ex of [-2.5, 2.9]) { ctx.beginPath(); ctx.arc(ex, -0.2, 1.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  } else if (eye === 'happy') {
    ctx.strokeStyle = '#4a2c1c'; ctx.lineWidth = 1.2;
    for (const ex of [-2.5, 2.9]) { ctx.beginPath(); ctx.arc(ex, 0.6, 1.6, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  } else {
    for (const [ex, size] of [[-2.5, 1], [2.9, 1.08]] as const) {
      ellipse(ctx, ex, -0.4, 1.85 * size, 2.25 * size, '#fffaf2');
      ellipse(ctx, ex + 0.35, -0.25, 1.15 * size, 1.5 * size, '#3b2418');
      ellipse(ctx, ex + 0.6, -0.85, 0.45, 0.55, '#ffffff');
    }
    if (!species) {
      ctx.strokeStyle = '#5a3320'; ctx.lineWidth = 0.85; ctx.beginPath();
      ctx.moveTo(-4.2, -3.2); ctx.lineTo(-1.2, -3.7);
      ctx.moveTo(1.4, -3.7); ctx.lineTo(4.4, -3.1); ctx.stroke();
    }
  }
  if (body === 'bear') ellipse(ctx, 0.6, 1.5, 1.3, 1.0, '#4a2c1c');
  else if (body === 'fox') polygon(ctx, '#4a2c1c', [[-0.4, 1.2], [1.8, 1.2], [0.7, 2.5]]);
  else if (body !== 'penguin') ellipse(ctx, 0.6, 1.4, 0.85, 0.7, pal.skinDark);
  if (body !== 'penguin') {
    ctx.strokeStyle = '#8a4a34'; ctx.lineWidth = 0.95; ctx.beginPath();
    if (mouth === 'open') ctx.arc(0.8, 2.8, 1.9, 0.1 * Math.PI, 0.9 * Math.PI);
    else ctx.arc(0.8, 2.4, 1.7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    if (mouth === 'open') ellipse(ctx, 0.8, 3.6, 1.2, 0.8, '#c4553f');
  }

  if (outfit === 'sprout' || outfit === 'sailor' || outfit === 'pilot') {
    const g = ctx.createLinearGradient(0, -8, 0, -1);
    if (outfit === 'sailor') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe6ee'); }
    else { g.addColorStop(0, pal.capLight); g.addColorStop(1, pal.cap); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -3.2, 7.6, 5.4, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, -7.8, -3.6, 15.6, 2.2, 1.1, outfit === 'sailor' ? '#2b4a7a' : pal.capDark);
    ctx.fillStyle = outfit === 'sailor' ? '#dfe6ee' : pal.cap;
    ctx.beginPath();
    ctx.ellipse(5.6, -2.6, 5.2, 1.9, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, 5.6, -3.1, 4.4, 1.1, outfit === 'sailor' ? '#ffffff' : pal.capLight);
    if (outfit === 'sprout') {
      star(ctx, -0.4, -5.6, 2.5, 1.1, pal.trim);
      ellipse(ctx, -0.4, -5.6, 0.9, 0.9, '#fff8dc');
      ctx.strokeStyle = '#3f8f4f'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(-1.2, -8.2); ctx.quadraticCurveTo(-2.4, -11.4, -0.6, -12.6); ctx.stroke();
      ellipse(ctx, 1.1, -12.4, 2.6, 1.5, '#5cb85c');
      ellipse(ctx, 0.6, -12.8, 1.4, 0.8, '#8ede8a');
    }
    if (outfit === 'sailor') star(ctx, -0.4, -5.4, 2.2, 1.0, '#2b4a7a');
    if (outfit === 'pilot') {
      roundRect(ctx, -6.4, -6.6, 12.8, 3.2, 1.6, '#3a4656');
      ellipse(ctx, -3.2, -5, 2.2, 1.5, '#8fe3ff');
      ellipse(ctx, 3.2, -5, 2.2, 1.5, '#8fe3ff');
      limb(ctx, -7.4, -1, -7.4, 2.6, 1.6, '#3a4656');
      ellipse(ctx, -7.4, 3.2, 2.2, 2.2, '#3a4656');
      limb(ctx, -7.4, 3.2, -2.5, 4.6, 1.2, '#3a4656');
      ellipse(ctx, -2.2, 4.7, 1.2, 1.2, '#ffc247');
    }
  }
  if (outfit === 'miner') {
    const g = ctx.createLinearGradient(0, -9, 0, -1);
    g.addColorStop(0, '#ffd98a');
    g.addColorStop(1, '#e8a33c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -3.0, 7.8, 5.8, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, -8.2, -3.6, 16.4, 2.4, 1.2, '#b3762a');
    limb(ctx, 0, -8.6, 0, -3.6, 1.6, '#b3762a');
    roundRect(ctx, 4.6, -6.4, 4.4, 3.6, 1.2, '#5a4a33');
    ellipse(ctx, 7.0, -4.6, 1.7, 1.7, '#fff0b4');
  }
  if (outfit === 'carrier') {
    roundRect(ctx, -7.4, -6.2, 14.8, 3.0, 1.5, '#8a5c3c');
    ellipse(ctx, 0, -6.4, 3.2, 2.2, '#f4e3c2');
    ellipse(ctx, -1, -6.8, 0.8, 0.6, '#c9a06a');
    ellipse(ctx, 1.2, -6.2, 0.7, 0.5, '#c9a06a');
  }
  ctx.restore();
}
export interface BuddyOptions {
  x: number;
  feet: number;
  scale: number;
  facing?: 1 | -1;
  appearance: Appearance;
  outfit: BuddyOutfit;
  pose: BuddyPose;
  phase?: number;
  seconds: number;
  reach?: { x: number; y: number };
  reachBack?: { x: number; y: number };
  tag?: string | null;
  tagColor?: string;
}

export function paintBuddy(ctx: Context, o: BuddyOptions) {
  const pal = paletteOf(o.appearance);
  const body = o.appearance.body;
  const species = body === 'kid' ? null : SPECIES[body];
  const fur = species?.fur ?? pal.suit;
  const furDark = species?.furDark ?? pal.suitDark;
  const muzzle = species?.muzzle ?? pal.shirt;
  const scale = o.scale;
  const facing = o.facing ?? 1;
  const p = poseOf(o.pose, o.phase ?? 0, o.seconds);
  const seated = o.pose === 'paddle' || o.pose === 'bust';

  ctx.save();
  if (!seated) ellipse(ctx, o.x, o.feet + 2 * scale, 12 * scale, 3.4 * scale, '#00000030');
  ctx.translate(o.x, o.feet);
  ctx.scale(facing * scale, scale);
  ctx.rotate(p.lean * 0.35);
  ctx.translate(0, -p.bob);

  const hipY = -13, shoulderY = -24, headY = -28.5;
  const local = (point: { x: number; y: number }) => ({
    x: (point.x - o.x) / (facing * scale),
    y: (point.y - o.feet) / scale + p.bob,
  });

  if (!seated) {
    for (const [angle, knee, back] of [[p.legB, p.kneeB, true], [p.legA, p.kneeA, false]] as const) {
      const hipX = back ? -3.2 : 3.2;
      const kneeX = hipX + Math.sin(angle) * 6, kneeY = hipY + Math.cos(angle) * 6;
      const ankleX = kneeX + Math.sin(angle - knee) * 6, ankleY = kneeY + Math.cos(angle - knee) * 6;
      const shade = back ? furDark : fur;
      limb(ctx, hipX, hipY, kneeX, kneeY, 6.2, shade);
      limb(ctx, kneeX, kneeY, ankleX, ankleY, 5.2, shade);
      ctx.save();
      ctx.translate(ankleX, ankleY);
      ctx.rotate(angle * 0.3);
      if (body === 'penguin') {
        polygon(ctx, back ? '#d9822b' : '#f2a13c', [[-4.4, -1.2], [5.8, -0.6], [6.6, 2.2], [3.4, 3.4], [-4.4, 3.4]]);
      } else if (species) {
        roundRect(ctx, -4.2, -1.4, 9.4, 5.2, 2.6, back ? furDark : fur);
        for (const toe of [-1.6, 1.2, 4]) ellipse(ctx, toe, -1.2, 1.3, 1.1, back ? furDark : fur);
        ellipse(ctx, 1, 1.6, 2.4, 1.5, muzzle);
      } else {
        roundRect(ctx, -4.2, -1.4, 9.4, 5.2, 2.2, back ? '#5d3520' : pal.boot);
        roundRect(ctx, -4.2, 2.4, 9.4, 1.8, 0.9, '#3a2415');
        ellipse(ctx, 2.6, 0.4, 1.7, 1.2, '#ffffff30');
      }
      ctx.restore();
    }
  }

  const bsx = -5.4, bsy = shoulderY + 1;
  if (o.reachBack && !seated) {
    const t = local(o.reachBack);
    armIK(ctx, bsx, bsy, t.x, t.y, -1, species ? furDark : pal.suitDark, species ? furDark : pal.skinDark, species ? furDark : pal.skinDark, 2.9);
  } else if (!seated || o.pose === 'paddle') {
    const bex = bsx + Math.sin(p.armB) * 6, bey = bsy + Math.cos(p.armB) * 6;
    const bhx = bex + Math.sin(p.armB + p.elbowB) * 5.4, bhy = bey + Math.cos(p.armB + p.elbowB) * 5.4;
    limb(ctx, bsx, bsy, bex, bey, 4.6, species ? furDark : pal.suitDark);
    limb(ctx, bex, bey, bhx, bhy, 4.2, species ? furDark : pal.skinDark);
    ellipse(ctx, bhx, bhy, 2.9, 2.9, species ? furDark : pal.skinDark);
  }

  {
    const torso = ctx.createLinearGradient(0, shoulderY, 0, hipY + 2);
    torso.addColorStop(0, fur);
    torso.addColorStop(1, furDark);
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(-7.4, shoulderY + 2);
    ctx.quadraticCurveTo(-8.6, hipY - 2, -6.4, hipY + 1.5);
    ctx.lineTo(6.4, hipY + 1.5);
    ctx.quadraticCurveTo(8.6, hipY - 2, 7.4, shoulderY + 2);
    ctx.quadraticCurveTo(0, shoulderY - 1.6, -7.4, shoulderY + 2);
    ctx.closePath();
    ctx.fill();
    if (species) {
      ellipse(ctx, 0.6, hipY - 4.5, 4.6, 5.2, muzzle);
    } else {
      roundRect(ctx, -7.6, shoulderY - 1.4, 15.2, 5.4, 2.4, pal.shirt);
      limb(ctx, -4.4, shoulderY + 0.4, -3.4, hipY - 3, 2.2, pal.suit);
      limb(ctx, 4.4, shoulderY + 0.4, 3.4, hipY - 3, 2.2, pal.suit);
      ellipse(ctx, -3.4, hipY - 3.4, 1.35, 1.35, pal.trim);
      ellipse(ctx, 3.4, hipY - 3.4, 1.35, 1.35, pal.trim);
      roundRect(ctx, -3.2, hipY - 6.4, 6.4, 4.6, 1.4, pal.suitDark);
    }
    if (o.outfit === 'miner') {
      limb(ctx, -6.2, shoulderY + 3, -5.2, hipY, 2.4, '#ffc247');
      limb(ctx, 6.2, shoulderY + 3, 5.2, hipY, 2.4, '#ffc247');
      limb(ctx, -6.6, hipY - 5, 6.6, hipY - 5, 2.2, '#ffc247');
    }
    if (o.outfit === 'carrier') {
      limb(ctx, -5.6, shoulderY + 1, 4.8, hipY - 2, 2.6, '#8a5c3c');
      limb(ctx, 5.6, shoulderY + 1, -4.8, hipY - 2, 2.6, '#8a5c3c');
      roundRect(ctx, -8.4, shoulderY - 1.8, 5, 4.4, 2, '#d9a878');
      roundRect(ctx, 3.4, shoulderY - 1.8, 5, 4.4, 2, '#d9a878');
    }
    if (o.outfit === 'sailor') {
      polygon(ctx, '#2b4a7a', [[-6, shoulderY - 1], [6, shoulderY - 1], [0, shoulderY + 6]]);
      ellipse(ctx, 0, shoulderY + 1.4, 1.5, 1.5, '#ffd166');
    }
    if (o.outfit === 'sprout') {
      const flutter = Math.sin(o.seconds * 9) * 0.35;
      polygon(ctx, pal.scarf, [[-2, shoulderY - 1], [-9, shoulderY + 1 + flutter * 3], [-8, shoulderY + 4 + flutter * 2], [-1, shoulderY + 2]]);
    }
  }

  const fsx = 5.4, fsy = shoulderY + 1;
  if (o.reach && !seated) {
    const t = local(o.reach);
    armIK(ctx, fsx, fsy, t.x, t.y, 1, species ? fur : pal.shirt, species ? fur : pal.skin, species ? fur : pal.skin, 3.1);
  } else if (!seated || o.pose === 'paddle') {
    const fex = fsx + Math.sin(p.armA) * 6, fey = fsy + Math.cos(p.armA) * 6;
    const fhx = fex + Math.sin(p.armA + p.elbowA) * 5.4, fhy = fey + Math.cos(p.armA + p.elbowA) * 5.4;
    limb(ctx, fsx, fsy, fex, fey, 4.8, species ? fur : pal.shirt);
    limb(ctx, fex, fey, fhx, fhy, 4.3, species ? fur : pal.skin);
    if (body === 'penguin') polygon(ctx, furDark, [[fhx - 2, fhy - 2], [fhx + 3.4, fhy], [fhx - 1, fhy + 3.4]]);
    else ellipse(ctx, fhx, fhy, 3.1, 3.1, species ? fur : pal.skin);
  }

  ctx.save();
  ctx.translate(0, headY);
  paintHead(ctx, { body, pal, eye: p.eye, mouth: p.mouth, outfit: o.outfit, lean: p.lean, seconds: o.seconds });
  ctx.restore();
  ctx.restore();

  if (o.outfit === 'miner' && !seated) {
    const beam = ctx.createLinearGradient(o.x + 8 * scale, 0, o.x + 92 * scale, 0);
    beam.addColorStop(0, '#ffe5a06b');
    beam.addColorStop(1, '#ffdca300');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(o.x + 10 * scale, o.feet - 33 * scale);
    ctx.lineTo(o.x + 92 * scale, o.feet - 44 * scale);
    ctx.lineTo(o.x + 92 * scale, o.feet - 6 * scale);
    ctx.fill();
    glow(ctx, o.x + 8 * scale, o.feet - 33 * scale, 26 * scale, '#ffdc833d');
  }

  if (o.tag) {
    paintNameTag(ctx, o.x, o.feet - (seated ? 30 : 46) * scale - 14, o.tag, o.tagColor);
  }
}

export function paintNameTag(ctx: Context, x: number, tagY: number, name: string, color?: string) {
  ctx.save();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const width = ctx.measureText(name).width + 12;
  roundRect(ctx, x - width / 2, tagY, width, 15, 7, color ?? '#3a3355e6');
  ctx.fillStyle = '#fff8ec';
  ctx.fillText(name, x, tagY + 11);
  ctx.restore();
}