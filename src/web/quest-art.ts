import type { Body, Enemy, Pickup, Player, QuestRun, Shot } from '../shared/quest.js';
import { ROLE } from '../shared/quest.js';
import { TILE } from '../shared/quest-levels.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import { paletteOf, BUDDY_PALETTES, BUDDY_SPECIES } from './buddy.js';
import type { BuddyLooks } from './buddy.js';

type Context = CanvasRenderingContext2D;

export function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx: Context, x: number, y: number, w: number, h: number, r: number, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function polygon(ctx: Context, color: string | CanvasGradient, points: readonly (readonly [number, number])[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

export function glow(ctx: Context, x: number, y: number, radius: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, '#0000');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
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

function star(ctx: Context, x: number, y: number, radius: number, inner: number, points: number, color: string, rotation = -Math.PI / 2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const angle = rotation + (i * Math.PI) / points;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

interface HeroPose {
  bob: number; lean: number; crouch: number;
  legA: number; legB: number; kneeA: number; kneeB: number;
  armA: number; armB: number; elbowA: number; elbowB: number;
  blink: number; mouth: 'smile' | 'open' | 'grit' | 'flat';
  eye: 'open' | 'shut' | 'cross' | 'happy';
}

function heroPose(player: Player, seconds: number): HeroPose {
  const phase = (player.animMs / 1000) * (player.pose === 'run' ? 11 : 2.2);
  const base: HeroPose = {
    bob: 0, lean: 0, crouch: 0,
    legA: 0.12, legB: -0.12, kneeA: 0.1, kneeB: 0.1,
    armA: 0.22, armB: -0.22, elbowA: 0.25, elbowB: 0.25,
    blink: 0, mouth: 'smile', eye: 'open',
  };
  const blinkCycle = seconds % 3.6;
  base.blink = blinkCycle > 3.44 ? 1 : 0;

  switch (player.pose) {
    case 'run': {
      const swing = Math.sin(phase);
      base.legA = swing * 0.85;
      base.legB = -swing * 0.85;
      base.kneeA = 0.3 + Math.max(0, -swing) * 0.75;
      base.kneeB = 0.3 + Math.max(0, swing) * 0.75;
      base.armA = -swing * 0.8;
      base.armB = swing * 0.8;
      base.elbowA = 0.55;
      base.elbowB = 0.55;
      base.bob = Math.abs(Math.sin(phase)) * 1.3;
      base.lean = 0.13;
      base.mouth = 'open';
      break;
    }
    case 'jump':
      base.legA = 0.75; base.legB = -0.35; base.kneeA = 1.0; base.kneeB = 0.5;
      base.armA = -1.5; base.armB = -1.1; base.elbowA = 0.3; base.elbowB = 0.4;
      base.lean = 0.1; base.mouth = 'open'; base.bob = -1;
      break;
    case 'fall':
      base.legA = 0.4; base.legB = -0.5; base.kneeA = 0.35; base.kneeB = 0.6;
      base.armA = -0.9; base.armB = 0.7; base.elbowA = 0.5; base.elbowB = 0.5;
      base.lean = -0.06; base.mouth = 'open';
      break;
    case 'crouch':
      base.crouch = 1; base.legA = 1.1; base.legB = -1.1; base.kneeA = 1.5; base.kneeB = 1.5;
      base.armA = 0.9; base.armB = 0.5; base.mouth = 'flat';
      break;
    case 'hurt':
      base.legA = 0.9; base.legB = -0.9; base.armA = -1.9; base.armB = -1.6;
      base.eye = 'cross'; base.mouth = 'grit'; base.lean = -0.25;
      break;
    case 'win':
      base.armA = -2.3; base.armB = -2.1; base.elbowA = 0.2; base.elbowB = 0.2;
      base.bob = Math.abs(Math.sin(seconds * 7)) * 3; base.eye = 'happy'; base.mouth = 'open';
      base.legA = 0.2; base.legB = -0.2;
      break;
    case 'swim': {
      const stroke = Math.sin(seconds * 6);
      base.lean = 0.42; base.bob = stroke * 1.2;
      base.armA = -1.2 + stroke * 0.9; base.armB = 0.6 - stroke * 0.9;
      base.legA = 0.3 + stroke * 0.35; base.legB = -0.3 - stroke * 0.35;
      base.kneeA = 0.5; base.kneeB = 0.5; base.mouth = 'open';
      break;
    }
    default:
      base.bob = Math.sin(seconds * 2.4) * 0.7;
      base.armA = 0.24 + Math.sin(seconds * 2.4) * 0.06;
      base.armB = -0.24 - Math.sin(seconds * 2.4) * 0.06;
      if (base.blink) base.eye = 'shut';
  }
  if (player.dashMs > 0) { base.lean = 0.42; base.armA = -1.7; base.armB = 1.2; base.mouth = 'grit'; }
  if (player.squashMs > 0) base.crouch = Math.max(base.crouch, player.squashMs / 300 * 0.7);
  return base;
}

export function paintHero(ctx: Context, player: Player, seconds: number, coop: boolean, looks: BuddyLooks = DEFAULT_APPEARANCE) {
  const appearance = looks[player.index === 0 ? 'left' : 'right'];
  const skin = paletteOf(appearance);
  const scale = (player.h / 34) * (appearance.size === 'big' ? 1.12 : 0.94);
  const pose = heroPose(player, seconds);
  const cx = player.x + player.w / 2;
  const feet = player.y + player.h;

  if (player.bubbleMs > 0) {
    paintBubble(ctx, cx, feet - 18, seconds, skin);
    return;
  }

  ctx.save();
  ellipse(ctx, cx, feet + 2, 12 * scale, 3.4 * scale, '#00000030');

  if (player.starMs > 0) {
    const hue = (seconds * 420) % 360;
    glow(ctx, cx, feet - 18 * scale, 30 * scale, `hsla(${hue}, 100%, 65%, 0.45)`);
  }
  if (player.dashMs > 0) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.16 * (4 - i);
      ellipse(ctx, cx - player.facing * i * 13, feet - 17 * scale, 11 * scale, 15 * scale, skin.capLight);
    }
    ctx.globalAlpha = 1;
  }
  if (player.invulnMs > 0 && Math.floor(player.invulnMs / 90) % 2 === 0) ctx.globalAlpha = 0.42;

  ctx.translate(cx, feet);
  ctx.scale(player.facing * scale, scale);
  ctx.rotate(pose.lean * 0.35);
  const squash = 1 - pose.crouch * 0.34;
  ctx.scale(1 + pose.crouch * 0.18, squash);
  ctx.translate(0, -pose.bob);

  const hipY = -13;
  const shoulderY = -24;
  const headY = -28.5;

  for (const [angle, knee, back] of [[pose.legB, pose.kneeB, true], [pose.legA, pose.kneeA, false]] as const) {
    const hipX = back ? -3.2 : 3.2;
    const kneeX = hipX + Math.sin(angle) * 6;
    const kneeY = hipY + Math.cos(angle) * 6;
    const ankleX = kneeX + Math.sin(angle - knee) * 6;
    const ankleY = kneeY + Math.cos(angle - knee) * 6;
    const shade = back ? skin.suitDark : skin.suit;
    limb(ctx, hipX, hipY, kneeX, kneeY, 6.2, shade);
    limb(ctx, kneeX, kneeY, ankleX, ankleY, 5.2, shade);
    ctx.save();
    ctx.translate(ankleX, ankleY);
    ctx.rotate(angle * 0.3);
    roundRect(ctx, -4.2, -1.4, 9.4, 5.2, 2.2, back ? '#5d3520' : skin.boot);
    roundRect(ctx, -4.2, 2.4, 9.4, 1.8, 0.9, '#3a2415');
    ellipse(ctx, 2.6, 0.4, 1.7, 1.2, '#ffffff30');
    ctx.restore();
  }

  const backArm = pose.armB;
  const backElbow = pose.elbowB;
  const bsx = -5.4, bsy = shoulderY + 1;
  const bex = bsx + Math.sin(backArm) * 6, bey = bsy + Math.cos(backArm) * 6;
  const bhx = bex + Math.sin(backArm + backElbow) * 5.4, bhy = bey + Math.cos(backArm + backElbow) * 5.4;
  limb(ctx, bsx, bsy, bex, bey, 4.6, skin.suitDark);
  limb(ctx, bex, bey, bhx, bhy, 4.2, skin.skinDark);
  ellipse(ctx, bhx, bhy, 2.9, 2.9, skin.skinDark);

  if (player.role === 'guardian' && coop) paintShield(ctx, bhx, bhy, player, seconds, skin.trim);

  const torsoGradient = ctx.createLinearGradient(0, shoulderY, 0, hipY + 2);
  torsoGradient.addColorStop(0, skin.suit);
  torsoGradient.addColorStop(1, skin.suitDark);
  ctx.fillStyle = torsoGradient;
  ctx.beginPath();
  ctx.moveTo(-7.4, shoulderY + 2);
  ctx.quadraticCurveTo(-8.6, hipY - 2, -6.4, hipY + 1.5);
  ctx.lineTo(6.4, hipY + 1.5);
  ctx.quadraticCurveTo(8.6, hipY - 2, 7.4, shoulderY + 2);
  ctx.quadraticCurveTo(0, shoulderY - 1.6, -7.4, shoulderY + 2);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, -7.6, shoulderY - 1.4, 15.2, 5.4, 2.4, skin.shirt);
  limb(ctx, -4.4, shoulderY + 0.4, -3.4, hipY - 3, 2.2, skin.suit);
  limb(ctx, 4.4, shoulderY + 0.4, 3.4, hipY - 3, 2.2, skin.suit);
  ellipse(ctx, -3.4, hipY - 3.4, 1.35, 1.35, skin.trim);
  ellipse(ctx, 3.4, hipY - 3.4, 1.35, 1.35, skin.trim);
  roundRect(ctx, -3.2, hipY - 6.4, 6.4, 4.6, 1.4, skin.suitDark);
  ctx.strokeStyle = '#ffffff28';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-3.2, hipY - 4.2);
  ctx.lineTo(3.2, hipY - 4.2);
  ctx.stroke();

  if (player.role === 'striker') {
    const flutter = Math.sin(seconds * 9) * 0.35;
    polygon(ctx, skin.scarf, [[-2, shoulderY - 1], [-9 - Math.abs(player.vx) * 0.02, shoulderY + 1 + flutter * 3], [-8, shoulderY + 4 + flutter * 2], [-1, shoulderY + 2]]);
  }

  const frontArm = pose.armA;
  const fsx = 5.4, fsy = shoulderY + 1;
  const fex = fsx + Math.sin(frontArm) * 6, fey = fsy + Math.cos(frontArm) * 6;
  const fhx = fex + Math.sin(frontArm + pose.elbowA) * 5.4, fhy = fey + Math.cos(frontArm + pose.elbowA) * 5.4;
  limb(ctx, fsx, fsy, fex, fey, 4.8, skin.shirt);
  limb(ctx, fex, fey, fhx, fhy, 4.3, skin.skin);
  ellipse(ctx, fhx, fhy, 3.1, 3.1, skin.skin);
  ellipse(ctx, fhx - 0.7, fhy - 0.8, 1.1, 1.1, '#ffffff70');

  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(pose.lean * 0.2);
  ellipse(ctx, -0.4, 0.6, 7.4, 7.2, skin.skinDark);
  const species = appearance.body === 'kid' ? null : BUDDY_SPECIES[appearance.body];
  const faceGradient = ctx.createRadialGradient(-2, -2.4, 1, 0, 0, 8.4);
  if (appearance.body === 'penguin') {
    faceGradient.addColorStop(0, '#ffffff');
    faceGradient.addColorStop(1, '#e8eef2');
  } else if (species) {
    faceGradient.addColorStop(0, species.muzzle);
    faceGradient.addColorStop(1, species.fur);
  } else {
    faceGradient.addColorStop(0, '#fff0dc');
    faceGradient.addColorStop(1, skin.skin);
  }
  ellipse(ctx, 0, 0, 7.2, 7, faceGradient);
  if (appearance.body === 'bear') {
    ellipse(ctx, -5.6, -5.4, 2.8, 2.8, species!.furDark);
    ellipse(ctx, 5.6, -5.4, 2.8, 2.8, species!.furDark);
    ellipse(ctx, -5.6, -5.4, 1.4, 1.4, species!.muzzle);
    ellipse(ctx, 5.6, -5.4, 1.4, 1.4, species!.muzzle);
    ellipse(ctx, 0.6, 2.4, 3.4, 2.5, species!.muzzle);
    ellipse(ctx, 0.6, 1.5, 1.3, 1.0, '#4a2c1c');
  }
  if (appearance.body === 'fox') {
    polygon(ctx, species!.furDark, [[-7, -3], [-5.4, -9.6], [-2.2, -4.4]]);
    polygon(ctx, species!.furDark, [[7, -3], [5.4, -9.6], [2.2, -4.4]]);
    polygon(ctx, species!.muzzle, [[-5.8, -4], [-5.2, -7.6], [-3.4, -4.6]]);
    polygon(ctx, species!.muzzle, [[5.8, -4], [5.2, -7.6], [3.4, -4.6]]);
    ellipse(ctx, 0.6, 2.4, 3.4, 2.5, species!.muzzle);
    polygon(ctx, '#4a2c1c', [[-0.4, 1.2], [1.8, 1.2], [0.7, 2.5]]);
  }
  if (appearance.body === 'penguin') {
    ellipse(ctx, 0, -4.6, 7.2, 3.6, species!.fur);
    polygon(ctx, '#f2a13c', [[-1.6, 1.2], [1.8, 1.2], [0.1, 3.6]]);
  }
  if (!species) {
    ellipse(ctx, -6.4, 1.2, 1.9, 2.4, skin.skin);
    ellipse(ctx, 6.4, 1.2, 1.9, 2.4, skin.skin);
    polygon(ctx, skin.hair, [[-6.6, -1.6], [-5.2, -4.6], [-3.4, -1.8], [-1.6, -4.8], [0.2, -1.9], [2, -4.6], [3.6, -1.7], [5.4, -4.2], [6.6, -1.4], [6.6, -3.4], [-6.6, -3.4]]);
  }
  ellipse(ctx, -3.4, 2.6, 2.1, 1.3, '#ff9d8a55');
  ellipse(ctx, 3.6, 2.6, 2.1, 1.3, '#ff9d8a55');

  if (pose.eye === 'cross') {
    ctx.strokeStyle = '#4a2c1c';
    ctx.lineWidth = 1.1;
    for (const ex of [-2.5, 2.9]) {
      ctx.beginPath();
      ctx.moveTo(ex - 1.4, -1.6); ctx.lineTo(ex + 1.4, 1.0);
      ctx.moveTo(ex + 1.4, -1.6); ctx.lineTo(ex - 1.4, 1.0);
      ctx.stroke();
    }
  } else if (pose.eye === 'shut') {
    ctx.strokeStyle = '#4a2c1c';
    ctx.lineWidth = 1.1;
    for (const ex of [-2.5, 2.9]) {
      ctx.beginPath();
      ctx.arc(ex, -0.2, 1.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else if (pose.eye === 'happy') {
    ctx.strokeStyle = '#4a2c1c';
    ctx.lineWidth = 1.2;
    for (const ex of [-2.5, 2.9]) {
      ctx.beginPath();
      ctx.arc(ex, 0.6, 1.6, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    }
  } else {
    for (const [ex, size] of [[-2.5, 1], [2.9, 1.08]] as const) {
      ellipse(ctx, ex, -0.4, 1.85 * size, 2.25 * size, '#fffaf2');
      ellipse(ctx, ex + 0.35, -0.25, 1.15 * size, 1.5 * size, '#3b2418');
      ellipse(ctx, ex + 0.6, -0.85, 0.45, 0.55, '#ffffff');
    }
    ctx.strokeStyle = '#5a3320';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(-4.2, -3.2); ctx.lineTo(-1.2, -3.7);
    ctx.moveTo(1.4, -3.7); ctx.lineTo(4.4, -3.1);
    ctx.stroke();
  }
  if (!species) ellipse(ctx, 0.6, 1.4, 0.85, 0.7, skin.skinDark);
  ctx.strokeStyle = '#8a4a34';
  ctx.lineWidth = 0.95;
  ctx.beginPath();
  if (pose.mouth === 'open') { ctx.arc(0.8, 2.6, 1.9, 0.1 * Math.PI, 0.9 * Math.PI); }
  else if (pose.mouth === 'grit') { ctx.moveTo(-1.2, 3.2); ctx.lineTo(2.8, 3.2); }
  else if (pose.mouth === 'flat') { ctx.moveTo(-0.6, 3.1); ctx.lineTo(2.2, 3.1); }
  else { ctx.arc(0.8, 2.2, 1.7, 0.15 * Math.PI, 0.85 * Math.PI); }
  ctx.stroke();
  if (pose.mouth === 'open') ellipse(ctx, 0.8, 3.4, 1.2, 0.8, '#c4553f');

  const capGradient = ctx.createLinearGradient(0, -8, 0, -1);
  capGradient.addColorStop(0, skin.capLight);
  capGradient.addColorStop(1, skin.cap);
  ctx.fillStyle = capGradient;
  ctx.beginPath();
  ctx.ellipse(0, -3.2, 7.6, 5.4, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, -7.8, -3.6, 15.6, 2.2, 1.1, skin.capDark);
  ctx.fillStyle = skin.cap;
  ctx.beginPath();
  ctx.ellipse(5.6, -2.6, 5.2, 1.9, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ellipse(ctx, 5.6, -3.1, 4.4, 1.1, skin.capLight);
  star(ctx, -0.4, -5.6, 2.5, 1.1, 5, skin.trim);
  ellipse(ctx, -0.4, -5.6, 0.9, 0.9, '#fff8dc');
  ctx.strokeStyle = '#3f8f4f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-1.2, -8.2);
  ctx.quadraticCurveTo(-2.4, -11.4, -0.6, -12.6);
  ctx.stroke();
  ellipse(ctx, 1.1, -12.4, 2.6, 1.5, '#5cb85c');
  ellipse(ctx, 0.6, -12.8, 1.4, 0.8, '#8ede8a');
  ctx.restore();

  ctx.restore();

  if (player.guardMs > 0) paintGuardDome(ctx, cx, feet - player.h / 2, player, seconds);
  if (coop) {
    ctx.save();
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = appearance.name;
    const width = ctx.measureText(label).width + 12;
    const tagY = player.y - (player.index === 0 ? 22 : 40);
    roundRect(ctx, cx - width / 2, tagY, width, 15, 7, player.index === 0 ? '#e8503ae6' : '#3fbf8fe6');
    ctx.fillStyle = '#fff8ec';
    ctx.fillText(label, cx, tagY + 11);
    ctx.restore();
  }
}

function paintShield(ctx: Context, x: number, y: number, player: Player, seconds: number, trim: string) {
  ctx.save();
  ctx.translate(x - 1.5, y);
  ctx.rotate(-0.25);
  const flash = player.shieldFlashMs > 0;
  ellipse(ctx, 0, 0, 6.4, 7.6, flash ? '#fff3c4' : '#c9d6e2');
  ellipse(ctx, 0, 0, 5.2, 6.4, flash ? '#ffe07a' : '#8fa6b8');
  ellipse(ctx, 0, 0, 3.6, 4.6, flash ? '#fff6d8' : '#e8f1f7');
  polygon(ctx, flash ? '#e8503a' : '#3fbf8f', [[0, -3], [2.2, 0], [0, 3.4], [-2.2, 0]]);
  ellipse(ctx, -1.6, -2.6, 1.2, 1.8, '#ffffff90');
  if (flash) {
    ctx.strokeStyle = '#fff0a8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 8.6 + Math.sin(seconds * 30) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function paintGuardDome(ctx: Context, x: number, y: number, player: Player, seconds: number) {
  const life = player.guardMs / ROLE.guardMs;
  const radius = ROLE.guardRadius * (0.86 + 0.14 * Math.sin(seconds * 5));
  ctx.save();
  ctx.globalAlpha = 0.28 + life * 0.3;
  const gradient = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius);
  gradient.addColorStop(0, '#7fe6bb18');
  gradient.addColorStop(0.72, '#3fbf8f44');
  gradient.addColorStop(1, '#ffe08a88');
  ellipse(ctx, x, y, radius, radius, gradient);
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = '#a9f2d4';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([10, 7]);
  ctx.lineDashOffset = -seconds * 40;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 6; i++) {
    const angle = seconds * 1.6 + (i / 6) * Math.PI * 2;
    star(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 4, 1.7, 4, '#fff2b8', angle);
  }
  ctx.restore();
}

function paintBubble(ctx: Context, x: number, y: number, seconds: number, skin: typeof BUDDY_PALETTES[number]) {
  const wobble = Math.sin(seconds * 4) * 2;
  ctx.save();
  glow(ctx, x, y, 34, `${skin.cap}44`);
  const gradient = ctx.createRadialGradient(x - 8, y - 10, 3, x, y, 26);
  gradient.addColorStop(0, '#ffffffcc');
  gradient.addColorStop(0.55, '#cfefff55');
  gradient.addColorStop(1, `${skin.capLight}66`);
  ellipse(ctx, x, y + wobble, 25, 26, gradient);
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y + wobble, 25, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ellipse(ctx, x - 9, y - 11 + wobble, 5.5, 3.6, '#ffffffbb');
  ctx.save();
  ctx.translate(x, y + 8 + wobble);
  ctx.scale(0.62, 0.62);
  ellipse(ctx, 0, 0, 10, 11, skin.suit);
  ellipse(ctx, 0, -12, 8, 8, skin.skin);
  ellipse(ctx, -2.6, -13, 1.5, 1.8, '#3b2418');
  ellipse(ctx, 2.6, -13, 1.5, 1.8, '#3b2418');
  ctx.strokeStyle = '#8a4a34';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -8.4, 2.2, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = skin.cap;
  ctx.beginPath();
  ctx.ellipse(0, -16, 8.4, 5, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6de';
  ctx.fillText('碰我复活', x, y + 38 + wobble);
  ctx.restore();
}

export function paintEnemy(ctx: Context, enemy: Enemy, seconds: number, theme: string) {
  const cx = enemy.x + enemy.w / 2;
  const bottom = enemy.y + enemy.h;
  const squashed = enemy.state === 'squash';
  const dying = enemy.state === 'dead';
  ctx.save();
  if (dying) {
    ctx.globalAlpha = Math.max(0, enemy.timerMs / 700);
    ctx.translate(cx, bottom - enemy.h / 2);
    ctx.rotate((1 - enemy.timerMs / 700) * 3);
    ctx.translate(-cx, -(bottom - enemy.h / 2));
  }
  if (!dying) ellipse(ctx, cx, bottom + 2, enemy.w * 0.44, 3, '#00000028');
  if (enemy.stunMs > 0) {
    for (let i = 0; i < 3; i++) {
      const angle = seconds * 6 + (i / 3) * Math.PI * 2;
      star(ctx, cx + Math.cos(angle) * 15, enemy.y - 8 + Math.sin(angle) * 5, 3.4, 1.4, 5, '#ffe07a', angle);
    }
  }
  if (enemy.hurtMs > 0 && Math.floor(enemy.hurtMs / 70) % 2 === 0) ctx.globalAlpha = 0.55;

  switch (enemy.kind) {
    case 'walker': paintWalker(ctx, cx, bottom, enemy, seconds, squashed, theme); break;
    case 'shell': paintShell(ctx, cx, bottom, enemy, seconds, squashed); break;
    case 'flyer': paintFlyer(ctx, cx, bottom, enemy, seconds, theme); break;
    case 'spiny': paintSpiny(ctx, cx, bottom, enemy, seconds); break;
    case 'hopper': paintHopper(ctx, cx, bottom, enemy, seconds); break;
    case 'plant': paintPlant(ctx, cx, enemy.baseY, enemy, seconds); break;
    case 'chaser': paintChaser(ctx, cx, bottom, enemy, seconds); break;
    case 'boss': paintBoss(ctx, cx, bottom, enemy, seconds); break;
  }
  ctx.restore();
}

function paintWalker(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number, squashed: boolean, theme: string) {
  const cap = theme === 'snow' ? '#8fb8d8' : theme === 'candy' ? '#e07ab0' : theme === 'night' ? '#7a5aa8' : '#a9673c';
  const capLight = theme === 'snow' ? '#c3ddf0' : theme === 'candy' ? '#ffb3d9' : theme === 'night' ? '#a986d6' : '#d18f57';
  if (squashed) {
    ellipse(ctx, cx, bottom - 4, 17, 5, cap);
    ellipse(ctx, cx, bottom - 5, 12, 3, capLight);
    return;
  }
  const step = Math.sin(seconds * 7 + enemy.phase);
  ctx.save();
  ctx.translate(cx, bottom);
  ellipse(ctx, -7 + step * 2, -2, 5.4, 3.2, '#4a2c1a');
  ellipse(ctx, 7 - step * 2, -2, 5.4, 3.2, '#4a2c1a');
  const body = ctx.createLinearGradient(0, -28, 0, -4);
  body.addColorStop(0, capLight);
  body.addColorStop(1, cap);
  ellipse(ctx, 0, -14, 15, 13, body);
  ellipse(ctx, 0, -9, 10.5, 7.5, '#f0d3a8');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(0, -18, 15.4, 10, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, -5, -22, 4.4, 2.6, '#ffffff35');
  roundRect(ctx, -1.4, -30, 2.8, 5, 1.4, '#6b4a2a');
  for (const ex of [-5.2, 5.2]) {
    ellipse(ctx, ex, -14, 3.6, 4.2, '#fffaf0');
    ellipse(ctx, ex + enemy.dir * 0.9, -13.4, 1.9, 2.4, '#2b1a10');
    ellipse(ctx, ex + enemy.dir * 1.3, -14.4, 0.7, 0.8, '#ffffff');
  }
  ctx.strokeStyle = '#3a2415';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-8.6, -19.4); ctx.lineTo(-2.6, -17.2);
  ctx.moveTo(8.6, -19.4); ctx.lineTo(2.6, -17.2);
  ctx.stroke();
  ctx.strokeStyle = '#7a3a24';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, -7.6, 3.4, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  polygon(ctx, '#fffaf0', [[-2.6, -8.4], [-1.2, -6.2], [-0.2, -8.4]]);
  polygon(ctx, '#fffaf0', [[2.6, -8.4], [1.2, -6.2], [0.2, -8.4]]);
  ctx.restore();
}

function paintShell(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number, squashed: boolean) {
  const shellOnly = enemy.state === 'shell' || enemy.state === 'slide';
  const spin = enemy.state === 'slide' ? seconds * 16 : seconds * 1.2;
  ctx.save();
  ctx.translate(cx, bottom);
  if (squashed) { ellipse(ctx, 0, -4, 16, 5, '#3f9e5c'); ctx.restore(); return; }
  if (!shellOnly) {
    const step = Math.sin(seconds * 7 + enemy.phase);
    ellipse(ctx, -7 + step * 2, -2, 5, 3, '#e8b64a');
    ellipse(ctx, 7 - step * 2, -2, 5, 3, '#e8b64a');
    ctx.save();
    ctx.translate(enemy.dir * 11, -22);
    ellipse(ctx, 0, 0, 7.2, 7, '#f2d98a');
    ellipse(ctx, enemy.dir * 2.4, -1, 2.2, 2.6, '#fffaf0');
    ellipse(ctx, enemy.dir * 3, -0.8, 1.2, 1.5, '#2b1a10');
    ellipse(ctx, enemy.dir * 5.4, 2.4, 2.6, 1.6, '#e8a24a');
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, shellOnly ? -11 : -16);
  ctx.rotate(shellOnly ? spin : 0);
  ellipse(ctx, 0, 0, 15, shellOnly ? 11 : 12.5, '#f6e6b8');
  const shell = ctx.createRadialGradient(-4, -5, 2, 0, 0, 15);
  shell.addColorStop(0, '#7fe0a0');
  shell.addColorStop(1, '#2f8f52');
  ellipse(ctx, 0, -0.8, 13, shellOnly ? 9.4 : 10.8, shell);
  ctx.strokeStyle = '#1f6b3c';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 3.4 - 0.8);
    ctx.lineTo(Math.cos(angle) * 11.4, Math.sin(angle) * 8.4 - 0.8);
    ctx.stroke();
  }
  ellipse(ctx, 0, -0.8, 4.4, 3.6, '#a9f0c4');
  ellipse(ctx, -4.6, -5, 3.4, 2, '#ffffff45');
  ctx.restore();
  if (enemy.state === 'slide') {
    ctx.strokeStyle = '#ffffff70';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-enemy.dir * (16 + i * 8), -8 - i * 3);
      ctx.lineTo(-enemy.dir * (26 + i * 8), -8 - i * 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintFlyer(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number, theme: string) {
  const body = theme === 'sea' ? '#8fd8f0' : theme === 'night' ? '#c9a6ff' : theme === 'cave' ? '#b08a6a' : '#ffd257';
  const stripe = theme === 'sea' ? '#3f8fb8' : theme === 'night' ? '#6b4a9c' : theme === 'cave' ? '#5a4030' : '#3a2a18';
  const flap = Math.sin(seconds * 22 + enemy.phase);
  ctx.save();
  ctx.translate(cx, bottom - 13);
  ctx.globalAlpha = 0.62;
  ellipse(ctx, -6, -8 + flap * 2, 9, 4.4 + flap * 1.6, '#e8f6ff');
  ellipse(ctx, 6, -8 - flap * 2, 9, 4.4 - flap * 1.6, '#e8f6ff');
  ctx.globalAlpha = 1;
  ellipse(ctx, 0, 0, 13, 10.5, body);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 10.5, 0, 0, Math.PI * 2);
  ctx.clip();
  for (const sx of [-6, 1, 8]) roundRect(ctx, sx, -12, 3.6, 24, 1.6, stripe);
  ctx.restore();
  ellipse(ctx, -4, -4, 4.4, 2.6, '#ffffff50');
  for (const ex of [-4.4, 4.4]) {
    ellipse(ctx, ex, -1, 3.2, 3.6, '#fffaf0');
    ellipse(ctx, ex + enemy.dir * 0.8, -0.6, 1.7, 2.1, '#2b1a10');
    ellipse(ctx, ex + enemy.dir * 1.2, -1.6, 0.6, 0.7, '#ffffff');
  }
  ctx.strokeStyle = '#7a3a24';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 4, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 3, -9);
    ctx.quadraticCurveTo(side * 6, -15, side * 8.5, -14);
    ctx.stroke();
    ellipse(ctx, side * 8.5, -14, 1.6, 1.6, stripe);
  }
  polygon(ctx, stripe, [[-13, 2], [-19, 4], [-13, 6]]);
  ctx.restore();
}

function paintSpiny(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number) {
  const step = Math.sin(seconds * 8 + enemy.phase);
  ctx.save();
  ctx.translate(cx, bottom);
  ellipse(ctx, -6 + step * 2, -2, 4.6, 2.8, '#5a2a3a');
  ellipse(ctx, 6 - step * 2, -2, 4.6, 2.8, '#5a2a3a');
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + (i / 8) * Math.PI;
    const bx = Math.cos(angle) * 12;
    const by = -12 + Math.sin(angle) * 10;
    polygon(ctx, '#f2e4c8', [[bx, by], [bx + Math.cos(angle) * 8, by + Math.sin(angle) * 8], [bx - Math.sin(angle) * 3.4, by + Math.cos(angle) * 3.4]]);
  }
  const shell = ctx.createRadialGradient(-4, -18, 2, 0, -12, 15);
  shell.addColorStop(0, '#ff8f9c');
  shell.addColorStop(1, '#c23a52');
  ellipse(ctx, 0, -12, 13, 11, shell);
  ellipse(ctx, -4, -17, 4.4, 2.6, '#ffffff45');
  ellipse(ctx, 0, -6, 9, 5, '#f6d9a8');
  for (const ex of [-4, 4]) {
    ellipse(ctx, ex, -8, 2.8, 3.2, '#fffaf0');
    ellipse(ctx, ex + enemy.dir * 0.7, -7.6, 1.5, 1.9, '#2b1a10');
  }
  ctx.strokeStyle = '#3a2415';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7, -12.6); ctx.lineTo(-2, -10.6);
  ctx.moveTo(7, -12.6); ctx.lineTo(2, -10.6);
  ctx.stroke();
  ctx.restore();
}

function paintHopper(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number) {
  const air = !enemy.onGround;
  const compress = air ? 0 : Math.max(0, 1 - enemy.hopMs / 400) * 0.3;
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(1 + compress * 0.4, 1 - compress);
  limb(ctx, -6, -8, -9, air ? -2 : -1, 4.4, '#2f8f52');
  limb(ctx, 6, -8, 9, air ? -2 : -1, 4.4, '#2f8f52');
  ellipse(ctx, -9, -1, 4.6, 2.6, '#e8b64a');
  ellipse(ctx, 9, -1, 4.6, 2.6, '#e8b64a');
  const body = ctx.createRadialGradient(-4, -20, 2, 0, -14, 16);
  body.addColorStop(0, '#a9f0a0');
  body.addColorStop(1, '#3f9e5c');
  ellipse(ctx, 0, -14, 14, 12.5, body);
  ellipse(ctx, 0, -8, 9, 6, '#e8f7c8');
  for (const ex of [-6, 6]) {
    ellipse(ctx, ex, -24, 5.2, 5.4, '#7fd48a');
    ellipse(ctx, ex, -24.4, 3.8, 4, '#fffaf0');
    ellipse(ctx, ex + enemy.dir * 1, -24, 2, 2.4, '#2b1a10');
    ellipse(ctx, ex + enemy.dir * 1.4, -25, 0.7, 0.8, '#ffffff');
  }
  ctx.strokeStyle = '#2f6b3c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -12, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ellipse(ctx, -8, -16, 2.4, 1.6, '#ff9d8a66');
  ellipse(ctx, 8, -16, 2.4, 1.6, '#ff9d8a66');
  ctx.restore();
}

function paintPlant(ctx: Context, cx: number, baseY: number, enemy: Enemy, seconds: number) {
  if (enemy.h <= 2) return;
  const height = enemy.h;
  const chomp = Math.abs(Math.sin(seconds * 5 + enemy.phase));
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 30, baseY - 60, 60, 60);
  ctx.clip();
  ctx.strokeStyle = '#3f9e5c';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx, baseY + 4);
  ctx.quadraticCurveTo(cx + Math.sin(seconds * 2) * 3, baseY - height * 0.5, cx, baseY - height + 12);
  ctx.stroke();
  ellipse(ctx, cx - 9, baseY - height * 0.45, 7, 3.4, '#5cb85c');
  ellipse(ctx, cx + 9, baseY - height * 0.62, 7, 3.4, '#5cb85c');
  const headY = baseY - height + 8;
  const head = ctx.createRadialGradient(cx - 4, headY - 5, 2, cx, headY, 15);
  head.addColorStop(0, '#ff8f7a');
  head.addColorStop(1, '#d13a2e');
  ellipse(ctx, cx, headY, 14, 12, head);
  for (const [sx, sy, r] of [[-6, -5, 3], [5, -6, 2.4], [0, 3, 2.2]] as const) ellipse(ctx, cx + sx, headY + sy, r, r * 0.8, '#fff3e0');
  const open = 3 + chomp * 5;
  ctx.fillStyle = '#7a1a18';
  ctx.beginPath();
  ctx.ellipse(cx, headY + 5, 10, open, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -2; i <= 2; i++) {
    polygon(ctx, '#fffaf0', [[cx + i * 4 - 1.6, headY + 5 - open], [cx + i * 4 + 1.6, headY + 5 - open], [cx + i * 4, headY + 5 - open + 3.4]]);
    polygon(ctx, '#fffaf0', [[cx + i * 4 - 1.6, headY + 5 + open], [cx + i * 4 + 1.6, headY + 5 + open], [cx + i * 4, headY + 5 + open - 3.4]]);
  }
  for (const ex of [-6, 6]) {
    ellipse(ctx, cx + ex, headY - 6, 2.6, 3, '#fffaf0');
    ellipse(ctx, cx + ex, headY - 5.6, 1.4, 1.8, '#2b1a10');
  }
  ctx.restore();
}

function paintChaser(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number) {
  const run = Math.sin(seconds * 14 + enemy.phase);
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(enemy.dir, 1);
  ctx.strokeStyle = '#ff6b8a55';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-14 - i * 7, -20 + i * 4);
    ctx.lineTo(-24 - i * 7, -20 + i * 4);
    ctx.stroke();
  }
  limb(ctx, -3, -12, -6 + run * 5, -2, 5, '#3a2450');
  limb(ctx, 3, -12, 6 - run * 5, -2, 5, '#4a2f66');
  ellipse(ctx, -6 + run * 5, -1, 4.6, 2.6, '#241634');
  ellipse(ctx, 6 - run * 5, -1, 4.6, 2.6, '#241634');
  const body = ctx.createLinearGradient(0, -28, 0, -10);
  body.addColorStop(0, '#7a4f9c');
  body.addColorStop(1, '#3a2450');
  ellipse(ctx, 1, -17, 12.5, 12, body);
  polygon(ctx, '#ff6b8a', [[-2, -24], [-14, -20 + run * 2], [-12, -16], [-1, -20]]);
  ellipse(ctx, 4, -25, 8.4, 8, '#4a2f66');
  ellipse(ctx, 6, -25, 6.4, 6.2, '#241634');
  for (const ex of [3.4, 8]) {
    ellipse(ctx, ex, -25.6, 2.2, 2.6, '#ffdf6b');
    ellipse(ctx, ex + 0.5, -25.6, 1.1, 1.5, '#ff3b5c');
  }
  ctx.strokeStyle = '#ff6b8a';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(2, -21); ctx.lineTo(9, -21.6);
  ctx.stroke();
  polygon(ctx, '#f2e4c8', [[3, -21], [4.4, -18.6], [5.6, -21]]);
  polygon(ctx, '#f2e4c8', [[6.4, -21], [7.6, -18.6], [8.8, -21]]);
  ctx.restore();
}

function paintBoss(ctx: Context, cx: number, bottom: number, enemy: Enemy, seconds: number) {
  const dizzy = enemy.state === 'dizzy';
  const wobble = dizzy ? Math.sin(seconds * 9) * 0.09 : Math.sin(seconds * 2.4) * 0.02;
  const hurt = enemy.hp;
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.rotate(wobble);
  const step = dizzy ? 0 : Math.sin(seconds * 5);
  ellipse(ctx, -24 + step * 4, -6, 17, 8, '#5a3a22');
  ellipse(ctx, 24 - step * 4, -6, 17, 8, '#5a3a22');
  ellipse(ctx, -24 + step * 4, -8, 13, 5, '#8a5a34');
  ellipse(ctx, 24 - step * 4, -8, 13, 5, '#8a5a34');
  const body = ctx.createLinearGradient(0, -60, 0, -10);
  body.addColorStop(0, '#f0d3a8');
  body.addColorStop(1, '#c99a63');
  ellipse(ctx, 0, -34, 34, 30, body);
  ellipse(ctx, 0, -26, 24, 18, '#fbe8c8');
  for (const side of [-1, 1]) {
    const swing = dizzy ? 0.5 : Math.sin(seconds * 5 + (side > 0 ? Math.PI : 0)) * 0.4;
    limb(ctx, side * 28, -46, side * (40 + swing * 6), -28 + swing * 8, 13, '#c99a63');
    ellipse(ctx, side * (40 + swing * 6), -28 + swing * 8, 10, 9, '#a9713f');
    ellipse(ctx, side * (40 + swing * 6) - 2, -31 + swing * 8, 4, 3, '#ffffff30');
  }
  const cap = ctx.createLinearGradient(0, -84, 0, -44);
  cap.addColorStop(0, hurt <= 1 ? '#ff7a6b' : '#e8503a');
  cap.addColorStop(1, hurt <= 1 ? '#b32e22' : '#8f2418');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(0, -52, 46, 32, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, -46, -54, 92, 8, 4, '#7a1a12');
  for (const [sx, sy, r] of [[-26, -62, 9], [-6, -72, 11], [18, -64, 8], [34, -56, 6], [-38, -55, 6]] as const) {
    ellipse(ctx, sx, sy, r, r * 0.78, '#fff3e0');
    ellipse(ctx, sx - r * 0.25, sy - r * 0.25, r * 0.45, r * 0.32, '#ffffff');
  }
  polygon(ctx, '#ffd166', [[-18, -80], [-12, -92], [-4, -82], [4, -94], [12, -82], [20, -92], [24, -78], [-18, -78]]);
  roundRect(ctx, -19, -80, 44, 5, 2, '#e8a24a');
  for (const gx of [-10, 2, 14]) ellipse(ctx, gx, -86, 2.4, 2.4, gx === 2 ? '#ff5c7a' : '#7fe6bb');
  for (const ex of [-13, 13]) {
    ellipse(ctx, ex, -38, 8.4, dizzy ? 4 : 9.4, '#fffaf0');
    if (dizzy) {
      ctx.strokeStyle = '#3a2415';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(ex, -36, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ellipse(ctx, ex + (enemy.dir * 2), -37, 4.4, 5.4, '#2b1a10');
      ellipse(ctx, ex + (enemy.dir * 3), -39.5, 1.6, 1.8, '#ffffff');
    }
  }
  ctx.strokeStyle = '#3a2415';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-24, -50); ctx.lineTo(-6, -44);
  ctx.moveTo(24, -50); ctx.lineTo(6, -44);
  ctx.stroke();
  ctx.fillStyle = '#7a1a18';
  ctx.beginPath();
  ctx.ellipse(0, -20, 15, dizzy ? 6 : 10, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -2; i <= 2; i++) {
    polygon(ctx, '#fffaf0', [[i * 6 - 2.4, -28], [i * 6 + 2.4, -28], [i * 6, -22]]);
  }
  if (hurt < 3) {
    ctx.strokeStyle = '#7a1a1288';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, -66); ctx.lineTo(-22, -58); ctx.lineTo(-28, -52);
    ctx.stroke();
  }
  if (hurt < 2) {
    ctx.beginPath();
    ctx.moveTo(26, -70); ctx.lineTo(18, -60); ctx.lineTo(26, -54);
    ctx.stroke();
  }
  if (dizzy) {
    for (let i = 0; i < 4; i++) {
      const angle = seconds * 5 + (i / 4) * Math.PI * 2;
      star(ctx, Math.cos(angle) * 30, -96 + Math.sin(angle) * 8, 5.4, 2.2, 5, '#ffe07a', angle);
    }
  }
  ctx.restore();
  const width = 92;
  roundRect(ctx, cx - width / 2, bottom - enemy.h - 26, width, 9, 4, '#00000066');
  roundRect(ctx, cx - width / 2 + 1.5, bottom - enemy.h - 24.5, (width - 3) * (enemy.hp / 3), 6, 3, enemy.hp > 1 ? '#ff8f5c' : '#ff4d5e');
}

export function paintPickup(ctx: Context, pickup: Pickup, seconds: number) {
  const cx = pickup.x + pickup.w / 2;
  const float = pickup.float ? Math.sin(seconds * 2.6 + pickup.animMs / 300) * 3 : 0;
  const cy = pickup.y + pickup.h / 2 + float;
  ctx.save();
  switch (pickup.kind) {
    case 'coin': {
      const spin = Math.abs(Math.cos(seconds * 3.4 + pickup.animMs / 260));
      glow(ctx, cx, cy, 15, '#ffd16640');
      ellipse(ctx, cx, cy, 9.5 * spin + 1.6, 11, '#c98a2a');
      ellipse(ctx, cx, cy, 8 * spin + 1.2, 9.4, '#ffd166');
      ellipse(ctx, cx - 1.4 * spin, cy - 2, 3.4 * spin, 4, '#fff3c4');
      if (spin > 0.45) star(ctx, cx, cy, 4.6 * spin, 2 * spin, 5, '#c98a2a');
      break;
    }
    case 'heart': {
      glow(ctx, cx, cy, 18, '#ff5c7a44');
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(cx, cy + 9);
      ctx.bezierCurveTo(cx - 15, cy - 2, cx - 8, cy - 12, cx, cy - 4);
      ctx.bezierCurveTo(cx + 8, cy - 12, cx + 15, cy - 2, cx, cy + 9);
      ctx.fill();
      ellipse(ctx, cx - 4.4, cy - 4, 2.6, 1.9, '#ffffff99');
      break;
    }
    case 'star': {
      const hue = (seconds * 200) % 360;
      glow(ctx, cx, cy, 24, `hsla(${hue}, 100%, 65%, 0.5)`);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(seconds * 2) * 0.25);
      star(ctx, 0, 0, 14, 6, 5, '#ffe07a');
      star(ctx, 0, 0, 11, 4.6, 5, `hsl(${hue}, 95%, 68%)`);
      for (const ex of [-3.4, 3.4]) {
        ellipse(ctx, ex, -1, 1.7, 2.2, '#3a2415');
        ellipse(ctx, ex + 0.5, -1.7, 0.6, 0.7, '#ffffff');
      }
      ctx.strokeStyle = '#3a2415';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 2.4, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'mushroom': {
      ellipse(ctx, cx, cy + 7, 8, 6, '#f6e6c8');
      for (const ex of [-3, 3]) ellipse(ctx, cx + ex, cy + 7, 1.5, 1.9, '#3a2415');
      const cap = ctx.createLinearGradient(cx, cy - 12, cx, cy + 2);
      cap.addColorStop(0, '#ff7a6b');
      cap.addColorStop(1, '#d13a2e');
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 13, 11, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      roundRect(ctx, cx - 13, cy - 0.5, 26, 3.4, 1.6, '#b32e22');
      for (const [sx, sy, r] of [[-6, -5, 3.4], [5, -6, 3], [0, -1, 2.4]] as const) ellipse(ctx, cx + sx, cy + sy, r, r * 0.8, '#fff3e0');
      break;
    }
    case 'flower': {
      ctx.strokeStyle = '#3f9e5c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 12);
      ctx.lineTo(cx, cy + 2);
      ctx.stroke();
      ellipse(ctx, cx - 6, cy + 8, 5, 2.6, '#5cb85c');
      ellipse(ctx, cx + 6, cy + 10, 5, 2.6, '#5cb85c');
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + seconds * 0.8;
        ellipse(ctx, cx + Math.cos(angle) * 7.5, cy - 2 + Math.sin(angle) * 7.5, 5, 5, i % 2 ? '#ff9d3a' : '#ffd166');
      }
      ellipse(ctx, cx, cy - 2, 6, 6, '#fff3e0');
      for (const ex of [-2.4, 2.4]) ellipse(ctx, cx + ex, cy - 2.6, 1.4, 1.8, '#3a2415');
      ctx.strokeStyle = '#3a2415';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy + 0.6, 2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }
    case 'candy': {
      glow(ctx, cx, cy, 20, '#7fe6bb44');
      const hue = (seconds * 120) % 360;
      polygon(ctx, `hsl(${hue}, 80%, 72%)`, [[cx - 14, cy - 6], [cx - 8, cy], [cx - 14, cy + 6]]);
      polygon(ctx, `hsl(${(hue + 60) % 360}, 80%, 72%)`, [[cx + 14, cy - 6], [cx + 8, cy], [cx + 14, cy + 6]]);
      ellipse(ctx, cx, cy, 9, 8, `hsl(${(hue + 180) % 360}, 85%, 66%)`);
      ellipse(ctx, cx - 3, cy - 3, 3.4, 2.4, '#ffffffaa');
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.4, 0.4, 2.4);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export function paintBody(ctx: Context, body: Body, seconds: number, theme: string) {
  const wood = theme === 'cave' || theme === 'castle' ? ['#6b5a4a', '#4a3c30'] : theme === 'candy' ? ['#ffb3d9', '#d1709f'] : ['#c99a63', '#8a5a34'];
  ctx.save();
  if (body.kind === 'spring') {
    const compress = body.squashMs > 0 ? body.squashMs / 280 : 0;
    const height = body.h * (1 - compress * 0.55);
    const top = body.y + body.h - height;
    ctx.strokeStyle = '#c9d6e2';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = top + 5 + (i / 4) * (height - 8);
      ctx.moveTo(body.x + 3, y);
      ctx.lineTo(body.x + body.w - 3, y + 2);
    }
    ctx.stroke();
    roundRect(ctx, body.x - 2, top - 4, body.w + 4, 7, 3, '#e8503a');
    roundRect(ctx, body.x - 2, top - 4, body.w + 4, 3, 1.5, '#ff8a63');
    roundRect(ctx, body.x + 1, body.y + body.h - 4, body.w - 2, 5, 2, '#7a4326');
    ctx.restore();
    return;
  }
  if (body.kind === 'phase') {
    const alpha = body.solid ? 1 : 0.24;
    ctx.globalAlpha = alpha;
    if (body.solid) glow(ctx, body.x + body.w / 2, body.y + body.h / 2, body.w * 0.7, '#c9a6ff33');
    roundRect(ctx, body.x, body.y, body.w, body.h, 7, body.solid ? '#8f6fd0' : '#5a4a7a');
    roundRect(ctx, body.x + 2, body.y + 2, body.w - 4, body.h * 0.45, 5, body.solid ? '#c9a6ff' : '#7a6a9a');
    ctx.globalAlpha = body.solid ? 0.9 : 0.5;
    ctx.strokeStyle = '#e8dcff';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -seconds * 22;
    ctx.beginPath();
    ctx.roundRect(body.x + 1, body.y + 1, body.w - 2, body.h - 2, 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  if (body.kind === 'fragile') {
    const shake = body.timerMs > 0 && !body.broken ? Math.sin(seconds * 40) * 1.6 : 0;
    ctx.globalAlpha = body.broken ? 0.5 : 1;
    ctx.translate(shake, 0);
    roundRect(ctx, body.x, body.y, body.w, body.h, 4, '#c2b09a');
    roundRect(ctx, body.x + 2, body.y + 2, body.w - 4, body.h - 8, 3, '#e0d2bc');
    ctx.strokeStyle = '#8a7a64';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(body.x + 8, body.y + 3);
    ctx.lineTo(body.x + 14, body.y + 14);
    ctx.lineTo(body.x + 9, body.y + 22);
    ctx.lineTo(body.x + 16, body.y + body.h - 3);
    ctx.moveTo(body.x + body.w - 10, body.y + 4);
    ctx.lineTo(body.x + body.w - 16, body.y + 16);
    ctx.lineTo(body.x + body.w - 8, body.y + body.h - 4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  glow(ctx, body.x + body.w / 2, body.y + body.h, body.w * 0.5, '#ffd16622');
  roundRect(ctx, body.x, body.y, body.w, body.h, 6, wood[1]);
  roundRect(ctx, body.x + 2, body.y + 2, body.w - 4, body.h - 6, 4, wood[0]);
  ctx.strokeStyle = '#ffffff30';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(body.x + 6, body.y + 5);
  ctx.lineTo(body.x + body.w - 6, body.y + 5);
  ctx.stroke();
  for (const bx of [body.x + 7, body.x + body.w - 7]) {
    ellipse(ctx, bx, body.y + body.h / 2, 2.6, 2.6, '#ffd166');
    ellipse(ctx, bx - 0.7, body.y + body.h / 2 - 0.7, 1, 1, '#fff3c4');
  }
  ctx.restore();
}

export function paintShot(ctx: Context, shot: Shot, seconds: number) {
  const hue = 20 + Math.sin(seconds * 20) * 14;
  glow(ctx, shot.x, shot.y, 18, `hsla(${hue}, 100%, 60%, 0.55)`);
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(shot.animMs / 90);
  ellipse(ctx, 0, 0, 8, 8, `hsl(${hue}, 100%, 58%)`);
  ellipse(ctx, 0, 0, 5, 5, '#ffe07a');
  ellipse(ctx, -1.4, -1.4, 2, 2, '#fff8dc');
  ctx.restore();
}

export function paintCheckpoint(ctx: Context, x: number, y: number, active: boolean, seconds: number) {
  ctx.save();
  roundRect(ctx, x - 3, y - 74, 6, 74, 3, active ? '#c9d6e2' : '#7a8a94');
  ellipse(ctx, x, y - 76, 5, 5, active ? '#ffd166' : '#9aa8b2');
  if (active) glow(ctx, x, y - 60, 34, '#7fe6bb44');
  const wave = active ? Math.sin(seconds * 5) * 4 : 0;
  ctx.fillStyle = active ? '#3fbf8f' : '#6b7a84';
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 72);
  ctx.quadraticCurveTo(x + 22 + wave, y - 66, x + 34, y - 58);
  ctx.quadraticCurveTo(x + 20 - wave, y - 52, x + 3, y - 46);
  ctx.closePath();
  ctx.fill();
  if (active) {
    star(ctx, x + 16, y - 59, 5.4, 2.2, 5, '#fff3c4');
    ellipse(ctx, x, y, 12, 4, '#7fe6bb44');
  }
  ctx.restore();
}

export function paintGoal(ctx: Context, x: number, y: number, run: QuestRun, seconds: number) {
  const won = run.status === 'won';
  ctx.save();
  glow(ctx, x, y - 140, 120, won ? '#ffd16655' : '#7fe6bb22');
  roundRect(ctx, x - 42, y - 12, 84, 12, 4, '#6b5a4a');
  roundRect(ctx, x - 38, y - 16, 76, 6, 3, '#8a7a64');
  roundRect(ctx, x - 4, y - 300, 8, 292, 4, '#c9d6e2');
  roundRect(ctx, x - 2, y - 300, 3, 292, 1.5, '#eef4f8');
  ellipse(ctx, x, y - 304, 8, 8, '#ffd166');
  ellipse(ctx, x - 2, y - 306, 3, 3, '#fff8dc');
  const slide = won ? Math.min(1, run.goal.slideMs / 900) : 0;
  const flagY = y - 286 + slide * 240;
  const wave = Math.sin(seconds * 4) * 6;
  const banner = ctx.createLinearGradient(x, flagY, x + 62, flagY + 40);
  banner.addColorStop(0, '#e8503a');
  banner.addColorStop(1, '#ffd166');
  ctx.fillStyle = banner;
  ctx.beginPath();
  ctx.moveTo(x + 4, flagY);
  ctx.quadraticCurveTo(x + 36 + wave, flagY + 8, x + 62, flagY + 18);
  ctx.quadraticCurveTo(x + 34 - wave, flagY + 30, x + 4, flagY + 40);
  ctx.closePath();
  ctx.fill();
  star(ctx, x + 28, flagY + 19, 9, 3.8, 5, '#fff8dc');
  ctx.restore();
}

export function paintGate(ctx: Context, x: number, y: number, open: boolean, seconds: number) {
  ctx.save();
  ctx.globalAlpha = open ? 0.2 : 1;
  const gradient = ctx.createLinearGradient(x, y, x + TILE, y);
  gradient.addColorStop(0, '#5a4a6a');
  gradient.addColorStop(0.5, '#8f6fd0');
  gradient.addColorStop(1, '#5a4a6a');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = open ? '#c9a6ff44' : '#e8dcff';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = seconds * 18;
  ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.setLineDash([]);
  if (!open) star(ctx, x + TILE / 2, y + TILE / 2, 8, 3.4, 5, '#ffd166');
  ctx.restore();
}

export function paintLink(ctx: Context, run: QuestRun, seconds: number) {
  if (!run.coop || run.players.length < 2) return;
  const [a, b] = run.players;
  if (a.bubbleMs > 0 || b.bubbleMs > 0 || a.linkMs <= 0) return;
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  ctx.save();
  ctx.globalAlpha = 0.5;
  const gradient = ctx.createLinearGradient(ax, ay, bx, by);
  gradient.addColorStop(0, '#e8503a');
  gradient.addColorStop(0.5, '#ffd166');
  gradient.addColorStop(1, '#3fbf8f');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2.6;
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -seconds * 34;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 22, bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 3; i++) {
    const t = ((seconds * 0.6 + i / 3) % 1);
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t - Math.sin(t * Math.PI) * 22;
    star(ctx, px, py, 4.4, 1.8, 5, '#fff3c4', seconds * 3);
  }
  ctx.restore();
}