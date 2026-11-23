import { createSub, SUB, tentacleOpen } from '../shared/sub.js';
import type { SubView } from '../shared/sub.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { Seat } from '../shared/protocol.js';
import { CHAPTER_OUTFIT, paintBuddy, paletteOf } from './buddy.js';
import { PanoramaCanvas } from './panorama-canvas.js';
import type { BuddyLooks } from '../shared/buddy.js';
import { interpolateSub } from './panorama-motion.js';
import { animationSeconds, halo, polygon } from './scenery.js';

type Context = CanvasRenderingContext2D;
const preview = createSub();

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function waterBackdrop(ctx: Context) {
  const { width, height, surface, seabed } = SUB;
  const sky = ctx.createLinearGradient(0, 0, 0, surface);
  sky.addColorStop(0, '#d8f2f4');
  sky.addColorStop(1, '#a8dde6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, surface);
  halo(ctx, 780, 18, 60, '#fff6d888');
  const water = ctx.createLinearGradient(0, surface, 0, height);
  water.addColorStop(0, '#2e8ba0');
  water.addColorStop(.55, '#1d5f78');
  water.addColorStop(1, '#123a52');
  ctx.fillStyle = water;
  ctx.fillRect(0, surface, width, height - surface);
  for (let i = 0; i < 5; i++) {
    const x = i * 210 + 52;
    const shaft = ctx.createLinearGradient(x, surface, x + 120, seabed);
    shaft.addColorStop(0, '#bfeef52e');
    shaft.addColorStop(1, '#bfeef500');
    polygon(ctx, shaft, [[x, surface], [x + 26, surface], [x + 150, seabed], [x + 60, seabed]]);
  }
  for (let i = 0; i < 60; i++) {
    ellipse(ctx, (i * 173) % width, surface + 14 + (i * 67) % (seabed - surface - 24), 1 + i % 2, 1 + i % 2, '#bfeef526');
  }
  for (const [fx, fy] of [[150, 110], [470, 86], [830, 120], [250, 306], [560, 300]] as const) {
    ellipse(ctx, fx, fy, 7, 3.4, '#16485e99');
    polygon(ctx, '#16485e99', [[fx - 7, fy], [fx - 12, fy - 3.4], [fx - 12, fy + 3.4]]);
  }
  ctx.strokeStyle = '#e8fbff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 6) {
    const y = surface + Math.sin(x / 34) * 2.4;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function seabed(ctx: Context) {
  const { width, height, seabed } = SUB;
  const sand = ctx.createLinearGradient(0, seabed, 0, height);
  sand.addColorStop(0, '#d8c08a');
  sand.addColorStop(1, '#a98f5c');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 8) ctx.lineTo(x, seabed + Math.sin(x / 52) * 3);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 46; i++) {
    ellipse(ctx, (i * 137) % width, seabed + 10 + (i * 53) % 38, 3 + i % 4, 2, i % 2 ? '#b39862' : '#c4ab77');
  }
  for (let i = 0; i < 12; i++) {
    const x = 40 + i * 84;
    const y = seabed + 4 + Math.sin(x / 52) * 3;
    for (let blade = -1; blade <= 1; blade++) {
      polygon(ctx, i % 2 ? '#2f7d6a' : '#3c9a7f',
        [[x + blade * 4 - 2, y], [x + blade * 6, y - 14 - (i + blade + 1) % 3 * 4], [x + blade * 4 + 2, y]]);
    }
  }
  ellipse(ctx, 130, seabed + 16, 7, 3, '#e88a6a');
  ellipse(ctx, 870, seabed + 20, 6, 2.6, '#f2a984');
}

function coralFan(ctx: Context, x: number, y: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const [dx, dy] of [[-9, -14], [0, -19], [9, -13]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * .5, y + dy * .6, x + dx, y + dy);
    ctx.stroke();
    ellipse(ctx, x + dx, y + dy, 3.4, 3.4, '#ffd9b0');
  }
}

function reef(ctx: Context, r: { x: number; y: number; rx: number; ry: number }) {
  const hanging = r.y - r.ry <= SUB.surface;
  const rock = ctx.createLinearGradient(r.x - r.rx, r.y - r.ry, r.x + r.rx, r.y + r.ry);
  rock.addColorStop(0, '#4a6f7c');
  rock.addColorStop(1, '#2c4a56');
  ellipse(ctx, r.x, r.y, r.rx, r.ry, rock);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 + .4;
    ellipse(ctx, r.x + Math.cos(angle) * r.rx * .88, r.y + Math.sin(angle) * r.ry * .88,
      8 + i % 3 * 3, 7 + i % 4 * 2, '#3a5c68');
  }
  for (let i = 0; i < 6; i++) {
    ellipse(ctx, r.x - r.rx * .5 + (i * 37) % (r.rx * 1.2), r.y - r.ry * .55 + (i * 61) % (r.ry * 1.1),
      2.4, 1.8, '#6f95a188');
  }
  if (hanging) {
    ctx.strokeStyle = '#3c9a7f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const baseX = r.x + i * 13;
      const baseY = r.y + r.ry - 10;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(baseX + i * 6 + 5, baseY + 14, baseX + i * 4, baseY + 27);
      ctx.stroke();
      ellipse(ctx, baseX + i * 4, baseY + 27, 3.4, 5, '#4cb592');
    }
  } else {
    coralFan(ctx, r.x - r.rx * .4, r.y - r.ry + 8, '#e88a6a');
    coralFan(ctx, r.x + r.rx * .38, r.y - r.ry + 12, '#f2a984');
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, r.x - 14 + i * 9, r.y - r.ry + 16 + (i % 2) * 5, 3, 3, '#ffb27a');
    }
  }
}

function buoy(ctx: Context, x: number, y: number) {
  ctx.strokeStyle = '#e8fbff2a';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x, SUB.seabed);
  ctx.stroke();
  ctx.setLineDash([]);
  halo(ctx, x, y, 24, '#f5bd8038');
  ellipse(ctx, x, y, 10, 10, '#f5bd80');
  ellipse(ctx, x, y, 5.4, 5.4, '#1d5f78');
  ellipse(ctx, x - 3, y - 4, 2, 1.4, '#ffe1a1');
}

function station(ctx: Context) {
  const { x, y } = SUB.dock;
  halo(ctx, x, y, 74, '#ffb27a3d');
  ellipse(ctx, x, y + 44, 54, 12, '#c9ae74');
  ctx.fillStyle = '#e88a6a';
  ctx.beginPath();
  ctx.moveTo(x - 46, y + 44);
  ctx.quadraticCurveTo(x - 50, y - 32, x, y - 38);
  ctx.quadraticCurveTo(x + 50, y - 32, x + 46, y + 44);
  ctx.lineTo(x + 28, y + 44);
  ctx.quadraticCurveTo(x + 30, y - 16, x, y - 20);
  ctx.quadraticCurveTo(x - 30, y - 16, x - 28, y + 44);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f2a984';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 38, y + 40);
  ctx.quadraticCurveTo(x - 42, y - 24, x, y - 30);
  ctx.quadraticCurveTo(x + 42, y - 24, x + 38, y + 40);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + i * Math.PI / 8;
    ellipse(ctx, x + Math.cos(angle) * 38, y - 4 + Math.sin(angle) * 30, 2.6, 2.6, '#ffd9b0');
  }
  halo(ctx, x, y + 10, 30, '#ffe1a155');
}

function paintLayout(ctx: Context) {
  waterBackdrop(ctx);
  seabed(ctx);
  for (const b of SUB.buoys) buoy(ctx, b.x, b.y);
  for (const r of SUB.reefs) reef(ctx, r);
  station(ctx);
}

function seahorse(ctx: Context, x: number, y: number, seconds: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y + Math.sin(seconds * 2.2) * 3);
  ctx.scale(scale, scale);
  halo(ctx, 0, 0, 30, '#ffc56355');
  ctx.strokeStyle = '#efac53';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, 10);
  ctx.quadraticCurveTo(-8, 20, -14, 16);
  ctx.quadraticCurveTo(-18, 12, -13, 10);
  ctx.stroke();
  polygon(ctx, '#efac53', [[-6, -4], [-13, -1], [-12, 5], [-6, 7]]);
  ellipse(ctx, 0, 2, 7, 11, '#ffc563');
  ellipse(ctx, 2, 4, 4, 8, '#ffe09a');
  ellipse(ctx, 1, -11, 6.5, 7, '#ffc563');
  ctx.fillStyle = '#efac53';
  ctx.fillRect(6, -13, 8, 3.5);
  polygon(ctx, '#efac53', [[-2, -17], [0, -21], [2, -17], [4, -20], [5, -16]]);
  ctx.strokeStyle = '#e8a24f';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-3, -2 + i * 4);
    ctx.lineTo(3, -2 + i * 4);
    ctx.stroke();
  }
  ellipse(ctx, 3.5, -12, 1.6, 2, '#362f38');
  ellipse(ctx, 4, -12.6, .5, .6, '#fffbde');
  ctx.restore();
}

function airBubble(ctx: Context, x: number, y: number, seconds: number, index: number) {
  const bob = Math.sin(seconds * 1.8 + index * 2.4) * 4;
  halo(ctx, x, y + bob, 27, '#9fe8ef66');
  ellipse(ctx, x, y + bob, 12, 12, '#bfeef54d');
  ctx.strokeStyle = '#e8fbff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y + bob, 12, 0, Math.PI * 2);
  ctx.stroke();
  ellipse(ctx, x - 4, y + bob - 4, 3, 2.2, '#ffffffcc');
}

function submarine(ctx: Context, run: SubView, seat: Seat, seconds: number, looks: BuddyLooks) {
  const { x, y } = run;
  ctx.save();
  ctx.translate(x, y + Math.sin(seconds * 1.6) * 1.5);
  const beam = ctx.createLinearGradient(26, 0, 118, 0);
  beam.addColorStop(0, '#ffe5a059');
  beam.addColorStop(1, '#ffdca300');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(24, -8);
  ctx.lineTo(118, -26);
  ctx.lineTo(118, 26);
  ctx.lineTo(24, 8);
  ctx.fill();
  ctx.fillStyle = '#c98d54';
  ctx.fillRect(-34, -2, 8, 4);
  ellipse(ctx, -36, 0, 3, 10 * Math.abs(Math.sin(seconds * 14)) + 2, '#e8b071');
  polygon(ctx, '#e09a5f', [[-24, -12], [-32, -21], [-19, -14]]);
  const hull = ctx.createLinearGradient(0, -14, 0, 14);
  hull.addColorStop(0, '#ffd9a0');
  hull.addColorStop(1, '#e09a5f');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.roundRect(-28, -14, 56, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#b9743f66';
  ctx.beginPath();
  ctx.roundRect(-28, 4, 56, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#e09a5f';
  ctx.fillRect(-3, -24, 6, 11);
  ctx.fillStyle = '#8bddd0';
  ctx.fillRect(-3, -27, 9, 4);
  for (const [px, role] of [[-9, 'left'], [9, 'right']] as const) {
    ellipse(ctx, px, -1, 7, 7, '#16323f');
    const scale = looks[role].size === 'big' ? 0.42 : 0.36;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, -1, 5.6, 0, Math.PI * 2);
    ctx.clip();
    paintBuddy(ctx, {
      x: px, feet: -1 + 28.5 * scale, scale,
      appearance: looks[role], outfit: CHAPTER_OUTFIT.sub, pose: 'bust', seconds,
    });
    ctx.restore();
    ellipse(ctx, px - 2, -3.5, 1.4, 1, '#bfeef5aa');
  }
  ellipse(ctx, 0, -33, 3.2, 3.2, paletteOf(looks[seat]).cap);
  if (run.recoveryMs > 0) {
    for (let i = 0; i < 3; i++) {
      const angle = seconds * 4 + i * 2.1;
      ellipse(ctx, Math.cos(angle) * 24, -18 + Math.sin(angle) * 8, 2.5, 2.5, '#e8fbffaa');
    }
  }
  ctx.restore();
  if (run.rescued && !run.finished) seahorse(ctx, x - 46, y - 4, seconds, .8);
}

function paintRun(ctx: Context, run: SubView, seat: Seat, looks: BuddyLooks) {
  const seconds = animationSeconds(run.elapsedMs);
  for (let i = 0; i < 6; i++) {
    const x = 90 + i * 160;
    for (let j = 0; j < 3; j++) {
      const t = (seconds * (26 + i * 5) + j * 110 + i * 47) % 300;
      const y = SUB.seabed - 6 - t;
      if (y > SUB.surface + 8) ellipse(ctx, x + Math.sin(seconds + j) * 4, y, 2 + j % 2, 2 + j % 2, '#bfeef533');
    }
  }
  halo(ctx, run.checkpoint.x, run.checkpoint.y, 30, '#f5bd8040');
  if (run.rescued) halo(ctx, SUB.dock.x, SUB.dock.y + 6, 44, '#ffe1a166');
  SUB.bubbles.forEach((bubble, index) => {
    if (!run.bubbles[index]) airBubble(ctx, bubble.x, bubble.y, seconds, index);
  });
  if (!run.rescued) seahorse(ctx, SUB.seahorse.x, SUB.seahorse.y, seconds);
  for (const current of SUB.currents) {
    ctx.save();
    ctx.strokeStyle = '#bfeef5';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const horizontal = current.pushX !== 0;
    const dir = Math.sign(horizontal ? current.pushX : current.pushY);
    const span = horizontal ? current.rx : current.ry;
    for (let i = 0; i < 5; i++) {
      const lane = (i + 0.5) / 5;
      const travel = (seconds * 55 + i * 23) % (2 * span);
      const px = horizontal ? (dir > 0 ? current.x - span + travel : current.x + span - travel) : current.x - current.rx + lane * 2 * current.rx;
      const py = horizontal ? current.y - current.ry + lane * 2 * current.ry : (dir > 0 ? current.y - span + travel : current.y + span - travel);
      ctx.globalAlpha = 0.5 * (1 - Math.abs(horizontal ? px - current.x : py - current.y) / span);
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(px - 9 * dir, py); ctx.lineTo(px, py);
        ctx.lineTo(px - 5 * dir, py - 4); ctx.moveTo(px, py); ctx.lineTo(px - 5 * dir, py + 4);
      } else {
        ctx.moveTo(px, py - 9 * dir); ctx.lineTo(px, py);
        ctx.lineTo(px - 4, py - 5 * dir); ctx.moveTo(px, py); ctx.lineTo(px + 4, py - 5 * dir);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  const reach = tentacleOpen(run.elapsedMs) ? 26 : 150;
  ctx.save();
  ctx.strokeStyle = '#e88a6a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (const offset of [-10, 0, 10]) {
      const sway = Math.sin(seconds * 3 + offset) * 6;
      const root = side < 0 ? SUB.surface : SUB.seabed;
      const tip = side < 0 ? SUB.surface + reach : SUB.seabed - reach;
      ctx.beginPath();
      ctx.moveTo(SUB.tentacle.x + offset, root);
      ctx.quadraticCurveTo(SUB.tentacle.x + offset + sway, (root + tip) / 2, SUB.tentacle.x + offset + sway * 1.6, tip);
      ctx.stroke();
    }
  }
  ctx.restore();
  submarine(ctx, run, seat, seconds, looks);
}

const focusX = (run: SubView) => run.x;

export function SubCanvas({ run = preview, seat, frozen = false, looks = DEFAULT_APPEARANCE }: {
  run?: SubView; seat: Seat; frozen?: boolean; looks?: BuddyLooks;
}) {
  return <PanoramaCanvas run={run} seat={seat} world={SUB} focusX={focusX}
    paintLayout={paintLayout} paintRun={paintRun} theme="sub-canvas" frozen={frozen}
    interpolate={interpolateSub} looks={looks} />;
}