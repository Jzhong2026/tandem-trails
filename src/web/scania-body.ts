import type { TruckId } from '../shared/trucks.js';
import * as THREE from 'three';

// Eight-sided cross sections preserve the flat windscreen and the chamfered
// corner pillars of a cab-over sleeper. Dimensions here are in metres.
export function highRoof() {
  const rings = [
    [3.0, 1.22, 0.57, 2.83, 0.13],
    [3.13, 1.24, 0.52, 2.82, 0.15],
    [3.57, 1.21, 0.5, 2.69, 0.23],
    [3.84, 1.15, 0.53, 2.47, 0.28],
    [3.94, 1.05, 0.61, 2.35, 0.26],
  ];
  const points = rings.map(([y, w, rear, front, c]) => [
    [-w + c, y, rear],
    [w - c, y, rear],
    [w, y, rear + c],
    [w, y, front - c],
    [w - c, y, front],
    [-w + c, y, front],
    [-w, y, front - c],
    [-w, y, rear + c],
  ]);
  const vertices: number[] = [];
  for (let row = 1; row < points.length; row++) {
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      vertices.push(
        ...points[row - 1][i],
        ...points[row][i],
        ...points[row][j],
        ...points[row - 1][i],
        ...points[row][j],
        ...points[row - 1][j],
      );
    }
  }
  const top = points[points.length - 1];
  for (let i = 1; i < 7; i++) vertices.push(...top[0], ...top[i + 1], ...top[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  return g;
}

export function fifthWheel() {
  const shoe = new THREE.Shape();
  shoe.moveTo(-0.17, -0.16);
  shoe.lineTo(-0.38, -0.63);
  shoe.bezierCurveTo(-0.85, -0.55, -0.91, 0.18, -0.59, 0.47);
  shoe.bezierCurveTo(-0.32, 0.73, 0.32, 0.73, 0.59, 0.47);
  shoe.bezierCurveTo(0.91, 0.18, 0.85, -0.55, 0.38, -0.63);
  shoe.lineTo(0.17, -0.16);
  shoe.quadraticCurveTo(0, 0.16, -0.17, -0.16);
  const g = new THREE.ExtrudeGeometry(shoe, {
    depth: 0.09,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI);
  return g;
}

export function drawGrille(ctx: CanvasRenderingContext2D, id: TruckId) {
  ctx.fillStyle = '#202831';
  ctx.fillRect(0, 0, 768, 480);
  const ridge = ctx.createLinearGradient(0, 0, 768, 0);
  ridge.addColorStop(0, '#4e5b65');
  ridge.addColorStop(0.44, '#909da5');
  ridge.addColorStop(1, '#404954');
  for (let row = 0; row < 4; row++) {
    const y = 92 + row * 93,
      edge = 24 + row * 15;
    ctx.fillStyle = '#0f171c';
    ctx.beginPath();
    ctx.moveTo(edge, y);
    ctx.lineTo(768 - edge, y);
    ctx.lineTo(738 - edge, y + 58);
    ctx.lineTo(edge + 30, y + 58);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#35414a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = edge; x < 768 - edge; x += 15) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 22, y + 58);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = ridge;
    ctx.beginPath();
    ctx.moveTo(edge + 20, y + 60);
    ctx.lineTo(748 - edge, y + 60);
    ctx.lineTo(735 - edge, y + 68);
    ctx.lineTo(edge + 33, y + 68);
    ctx.closePath();
    ctx.fill();
  }
  if (id === 'volvo') {
    ctx.strokeStyle = '#cfd9d9';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(34, 427);
    ctx.lineTo(730, 45);
    ctx.stroke();
    ctx.fillStyle = '#28485a';
    ctx.beginPath();
    ctx.arc(384, 232, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 23px Arial';
    ctx.fillText('VOLVO', 384, 241);
    return;
  }
  if (id === 'sitrak') {
    ctx.fillStyle = '#242f37';
    ctx.fillRect(0, 0, 768, 103);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7e9e7';
    ctx.font = 'bold 64px Arial';
    ctx.fillText('S I T R A K', 384, 78);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#bbc1bb';
    for (const y of [156, 263, 370]) {
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(241, y + 14);
      ctx.lineTo(527, y + 14);
      ctx.lineTo(740, y);
      ctx.stroke();
    }
    ctx.font = 'bold 27px Arial';
    ctx.fillText('C7H', 666, 448);
    return;
  }
  ctx.font = '900 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#091019';
  ctx.fillText(id === 'man' ? 'M A N' : 'S C A N I A', 386, 54);
  ctx.fillStyle = '#f0f4f6';
  ctx.fillText(id === 'man' ? 'M A N' : 'S C A N I A', 384, 49);
  ctx.fillStyle = '#d0d9db';
  ctx.font = 'bold 27px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(id === 'man' ? 'TGX' : '770 S', 660, 446);
}
