import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRUCKS } from '../shared/trucks.js';
import type { TruckId } from '../shared/trucks.js';
import { drawGrille, fifthWheel, highRoof } from './scania-body.js';
import { CAR_COLORS, CAR_DARK } from './race-render.js';

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export interface TruckRig {
  plateTex: THREE.CanvasTexture;
  group: THREE.Group;
  paint: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  amber: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  marker: THREE.MeshStandardMaterial;
  spins: THREE.Group[];
  steers: THREE.Group[];
  beams: THREE.SpotLight[];
}

export function buildTruck(id: TruckId, night: boolean): TruckRig {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color: CAR_COLORS[0],
    metalness: 0.3,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const trim = new THREE.MeshStandardMaterial({ color: CAR_DARK[0], metalness: 0.6, roughness: 0.45 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: 1, roughness: 0.22 });
  const alu = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.9, roughness: 0.38 });
  const black = new THREE.MeshStandardMaterial({
    color: '#14171c',
    metalness: 0.15,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const tire = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.95 });
  const glazing = canvasTexture(256, 128, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 45, 128);
    sky.addColorStop(0, '#91aeb9');
    sky.addColorStop(0.42, '#466978');
    sky.addColorStop(0.48, '#2a404c');
    sky.addColorStop(1, '#172c37');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#e2f5fc19';
    for (const x of [35, 51, 190]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10, 0);
      ctx.lineTo(x - 49, 128);
      ctx.lineTo(x - 59, 128);
      ctx.fill();
    }
  });
  const glass = new THREE.MeshPhysicalMaterial({
    map: glazing,
    metalness: 0.28,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const tail = new THREE.MeshStandardMaterial({
    color: '#5a0f12',
    emissive: new THREE.Color('#ff2a2a'),
    emissiveIntensity: 1.1,
    roughness: 0.4,
  });
  const amber = new THREE.MeshStandardMaterial({
    color: '#6b4a12',
    emissive: new THREE.Color('#ffa028'),
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });
  const head = new THREE.MeshStandardMaterial({
    color: '#cfd8e0',
    emissive: new THREE.Color('#fff2cc'),
    emissiveIntensity: night ? 3.2 : 0.25,
    roughness: 0.25,
  });
  const marker = new THREE.MeshStandardMaterial({
    color: '#6b4a12',
    emissive: new THREE.Color('#ffb347'),
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });

  const part = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);

  /* 底盘 */
  for (const side of [-1, 1]) part(box(0.12, 0.26, 5.7), black, side * 0.45, 0.56, -0.1);
  part(box(1.9, 0.16, 0.5), black, 0, 0.5, -2.6);
  for (const cz of [-1.15, -2.2]) part(box(1.0, 0.12, 0.1), black, 0, 0.5, cz);

  /* 驾驶室：高顶平头造型 */
  part(rbox(2.5, 2.05, 2.3, 0.1), paint, 0, 2.0, 1.75);
  if (id === 'scania') part(highRoof(), paint, 0, 0, 0);
  else if (id === 'sitrak') {
    part(rbox(2.44, 0.76, 2.28, 0.16), paint, 0, 3.36, 1.7);
    part(rbox(2.03, 0.21, 1.76, 0.1), paint, 0, 3.79, 1.48);
    part(rbox(1.32, 0.15, 0.06, 0.04), black, 0, 3.38, 2.85);
    for (const side of [-1, 1]) {
      part(rbox(0.31, 0.1, 0.07, 0.03), head, side * 0.84, 3.44, 2.84);
      part(rbox(0.14, 0.29, 0.06, 0.03), head, side * 1.09, 1.13, 3.09, 0, 0, -side * 0.29);
    }
  } else if (id === 'volvo') {
    part(rbox(2.42, 0.82, 2.22, 0.22), paint, 0, 3.4, 1.65);
    part(rbox(2.25, 0.28, 1.66, 0.12), paint, 0, 3.85, 1.43);
  } else {
    part(rbox(2.48, 0.65, 2.3, 0.09), paint, 0, 3.31, 1.73);
    part(rbox(2.28, 0.25, 2.08, 0.1), trim, 0, 3.69, 1.65);
  }
  part(box(2.44, 0.14, 0.5), trim, 0, 3.06, 2.72, -0.12);
  part(rbox(2.32, 0.91, 0.09, 0.04), black, 0, 2.56, 2.94, -0.1);
  part(rbox(2.22, 0.82, 0.07, 0.035), glass, 0, 2.56, 2.99, -0.1);
  for (const side of [-1, 1]) {
    part(box(0.78, 0.022, 0.026), black, side * 0.51, 2.22, 3.074, 0, 0, side * 0.065);
    part(box(0.06, 0.74, 1.4), glass, side * 1.26, 2.42, 1.95);
    part(box(0.02, 0.18, 2.2), trim, side * 1.255, 1.02, 1.75);
    part(box(0.02, 1.6, 0.03), black, side * 1.26, 1.85, 1.02);
    part(box(0.05, 0.07, 0.3), chrome, side * 1.27, 1.72, 1.25);
    part(box(0.34, 0.1, 0.9), black, side * 1.16, 0.52, 1.5);
    part(box(0.3, 0.08, 0.7), black, side * 1.16, 0.82, 1.45);
  }

  /* 前脸：格栅 / 大灯 / 保险杠 */
  const grille = canvasTexture(768, 480, (ctx) => drawGrille(ctx, id));
  const grilleMat = new THREE.MeshStandardMaterial({ map: grille, roughness: 0.46, metalness: 0.15 });
  part(new THREE.PlaneGeometry(id === 'man' ? 2.04 : 1.88, 1.34), grilleMat, 0, 1.4, 3.085);
  for (const y of [1.03, 1.3, 1.57]) part(rbox(1.68, 0.027, 0.07, 0.01), alu, 0, y, 3.09);
  for (const side of [-1, 1]) {
    part(rbox(0.37, 0.45, 0.18, 0.06), black, side * 1.057, 1.08, 2.97);
    part(
      rbox(0.29, 0.075, 0.06, 0.026),
      head,
      side * 1.07,
      1.2,
      3.075,
      0,
      0,
      side * (id === 'volvo' ? 0.4 : 0.1),
    );
    part(rbox(0.21, 0.1, 0.07, 0.025), glass, side * 1.07, 1.03, 3.074);
    part(box(0.042, 0.19, 0.055), head, side * 1.2, 1.12, 3.08);
    part(box(0.05, 0.08, 0.06), amber, side * 1.21, 0.96, 3.075);
  }
  part(rbox(2.52, 0.52, 0.42, 0.08), trim, 0, 0.62, 2.95);
  for (const side of [-1, 1]) part(box(0.16, 0.12, 0.06), head, side * 0.85, 0.5, 3.16);

  /* 后视镜 */
  for (const side of [-1, 1]) {
    part(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 6), black, side * 1.44, 2.86, 2.5, 0, 0, side * 1.25);
    part(rbox(0.14, 0.62, 0.34, 0.05), paint, side * 1.66, 2.72, 2.42);
    part(box(0.02, 0.52, 0.26), glass, side * 1.66, 2.72, 2.24);
  }

  /* 车尾：后窗 / 标识 / 排气 / 油箱 */
  part(box(1.58, 0.7, 0.04), black, 0, 2.5, 0.56);
  part(box(1.5, 0.62, 0.06), glass, 0, 2.5, 0.529);
  for (const side of [-1, 1]) part(box(0.03, 1.5, 0.02), black, side * 0.62, 1.7, 0.57);
  part(box(2.3, 0.06, 0.06), trim, 0, 3.66, 0.5);
  part(new THREE.CylinderGeometry(0.085, 0.085, 2.5, 12), chrome, -1.32, 2.15, 0.42);
  part(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 12), alu, -1.32, 1.55, 0.42);
  part(new THREE.CylinderGeometry(0.1, 0.085, 0.2, 12), black, -1.32, 3.45, 0.42);
  part(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 16), alu, 1.22, 0.72, -0.7, Math.PI / 2);
  for (const dz of [-0.4, 0.4]) part(box(0.06, 0.72, 0.08), black, 1.22, 0.72, -0.7 + dz);
  part(box(0.5, 0.6, 1.2), black, -1.2, 0.72, -0.8);

  // The turntable throat, air lines and cab extenders are prominent from the chase camera.
  const graphite = new THREE.MeshStandardMaterial({ color: '#434a50', metalness: 0.58, roughness: 0.5 });
  part(rbox(1.32, 0.14, 0.93, 0.06), alu, 0, 0.88, -1.55);
  part(fifthWheel(), graphite, 0, 1.02, -1.67);
  part(rbox(1.47, 0.1, 0.85, 0.04), alu, 0, 1.02, -0.27);
  for (let x = -0.58; x <= 0.6; x += 0.14) part(box(0.035, 0.02, 0.65), graphite, x, 1.08, -0.27);
  for (const side of [-1, 1]) {
    // Rear extensions guide air past the sleeper. The lower edges taper inwards.
    part(rbox(0.11, 2.5, 0.58, 0.05), paint, side * 1.18, 2.3, 0.35, side * 0.01, side * 0.13);
    part(rbox(0.065, 1.42, 0.13, 0.028), trim, side * 1.18, 1.82, 0.055);
    part(rbox(0.24, 0.1, 0.33, 0.04), black, side * 1.6, 2.35, 2.43);
    part(rbox(0.2, 0.17, 0.07, 0.025), glass, side * 1.63, 2.43, 2.235);
    for (const z of [-0.35, 0.22]) part(rbox(0.7, 0.64, 0.07, 0.03), graphite, side * 0.9, 0.69, z);
  }
  for (const [i, colour] of ['#bd4437', '#dbad35', '#273740'].entries()) {
    const points: THREE.Vector3[] = [];
    for (let k = 0; k <= 64; k++) {
      const t = k / 64,
        angle = t * Math.PI * 16;
      points.push(
        new THREE.Vector3(
          -0.45 + i * 0.3 + 0.066 * Math.cos(angle),
          1.64 - 0.45 * Math.sin(Math.PI * t) + 0.066 * Math.sin(angle),
          0.48 - 0.93 * t,
        ),
      );
    }
    part(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.023, 5, false),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.65 }),
      0,
      0,
      0,
    );
  }
  for (let i = -2; i <= 2; i++) part(rbox(0.045, 0.58, 0.045, 0.018), trim, i * 0.31, 1.51, 0.57);
  /* 车轮：前转向 + 后双胎 */
  const spins: THREE.Group[] = [];
  const steers: THREE.Group[] = [];
  const wheelFace = canvasTexture(256, 256, (ctx) => {
    const rim = ctx.createRadialGradient(114, 110, 10, 128, 128, 120);
    rim.addColorStop(0, '#d9e3e6');
    rim.addColorStop(0.42, '#9ba9ab');
    rim.addColorStop(0.7, '#657279');
    rim.addColorStop(0.78, '#ccd4d5');
    rim.addColorStop(0.89, '#7b8789');
    rim.addColorStop(1, '#e0e5e5');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 10; i++) {
      const angle = (i * 2 * Math.PI) / 10;
      ctx.save();
      ctx.translate(128, 128);
      ctx.rotate(angle);
      ctx.fillStyle = '#384348';
      ctx.beginPath();
      ctx.ellipse(0, -82, 12, 17, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#eaf1ee';
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const x = 7 * Math.cos((j * Math.PI) / 3),
          y = -48 + 7 * Math.sin((j * Math.PI) / 3);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
  const polishedRim = new THREE.MeshStandardMaterial({ map: wheelFace, metalness: 0.43, roughness: 0.35 });
  const wheel = (x: number, z: number, width: number, dual: boolean, steer: boolean) => {
    const steerGroup = new THREE.Group();
    steerGroup.position.set(x, 0.52, z);
    const spin = new THREE.Group();
    steerGroup.add(spin);
    const offsets = dual ? [-0.17, 0.17] : [0];
    for (const off of offsets) {
      const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, width, 22), tire);
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.position.x = off;
      tireMesh.castShadow = true;
      spin.add(tireMesh);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, width + 0.03, 16), chrome);
      rim.rotation.z = Math.PI / 2;
      rim.position.x = off + (dual ? Math.sign(off) * 0.02 : 0);
      spin.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, width + 0.08, 10), alu);
      hub.rotation.z = Math.PI / 2;
      hub.position.x = off + (dual ? Math.sign(off) * 0.04 : 0);
      spin.add(hub);
      if (!dual || Math.sign(off) === Math.sign(x)) {
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.303, 40), polishedRim);
        face.rotation.y = (Math.sign(x) * Math.PI) / 2;
        face.position.x = off + Math.sign(x) * (width / 2 + (dual ? 0.043 : 0.023));
        spin.add(face);
      }
    }
    group.add(steerGroup);
    spins.push(spin);
    if (steer) steers.push(steerGroup);
  };
  wheel(-1.02, 2.15, 0.32, false, true);
  wheel(1.02, 2.15, 0.32, false, true);
  wheel(-1.08, -1.75, 0.3, true, false);
  wheel(1.08, -1.75, 0.3, true, false);

  /* 后轮挡泥板 / 尾灯 / 牌照 / 挡泥帘 */
  part(box(1.7, 0.55, 1.0), black, 0, 0.78, -2.2);
  part(box(2.44, 0.34, 0.12), black, 0, 0.86, -2.99);
  for (const side of [-1, 1]) {
    part(
      new THREE.CylinderGeometry(0.68, 0.68, 0.82, 18, 1, true, 0, Math.PI),
      black,
      side * 1.08,
      0.52,
      -1.75,
      0,
      0,
      Math.PI / 2,
    );
    part(box(0.52, 0.24, 0.08), tail, side * 0.95, 0.86, -3.06);
    part(box(0.12, 0.2, 0.03), amber, side * 1.24, 0.86, -3.06);
    part(box(0.1, 0.16, 0.03), head, side * 0.72, 0.86, -3.06);
  }
  part(box(2.44, 0.16, 0.1), alu, 0, 0.5, -2.98);
  for (const side of [-1, 1]) part(box(0.08, 0.4, 0.08), black, side * 0.9, 0.62, -2.94);
  part(box(2.2, 0.12, 0.06), black, 0, 0.3, -2.92);

  const plateTex = canvasTexture(128, 32, (ctx) => {
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(0, 0, 128, 32);
    ctx.strokeStyle = '#1a1d24';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 124, 28);
    ctx.fillStyle = '#1a1d24';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', 64, 17);
  });
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.14),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }),
  );
  plate.position.set(0, 0.86, -3.07);
  plate.rotation.y = Math.PI;
  group.add(plate);

  const flapTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(0, 6, 128, 6);
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(TRUCKS[id].brand, 64, 78);
  });
  for (const side of [-1, 1]) {
    const flap = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.52),
      new THREE.MeshStandardMaterial({ map: flapTex, roughness: 0.9, side: THREE.DoubleSide }),
    );
    flap.position.set(side * 1.08, 0.42, -2.42);
    flap.rotation.y = Math.PI;
    flap.rotation.x = 0.08;
    group.add(flap);
  }

  const badge = (text: string) =>
    canvasTexture(256, 64, (ctx) => {
      ctx.clearRect(0, 0, 256, 64);
      const g = ctx.createLinearGradient(0, 8, 0, 56);
      g.addColorStop(0, '#f2f5f8');
      g.addColorStop(0.5, '#aeb6bf');
      g.addColorStop(1, '#e8ecf0');
      ctx.fillStyle = g;
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 34);
    });
  const badgeMat = (tex: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.7, roughness: 0.35 });
  const rearBadge = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.3), badgeMat(badge(TRUCKS[id].brand)));
  rearBadge.position.set(0, 1.95, 0.56);
  rearBadge.rotation.y = Math.PI;
  group.add(rearBadge);
  if (id === 'volvo')
    part(new THREE.PlaneGeometry(1.75, 0.25), badgeMat(badge('GLOBETROTTER')), 0, 3.26, 2.78);
  const modelTex = badge(TRUCKS[id].badge);
  for (const side of [-1, 1]) {
    const model = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.26), badgeMat(modelTex));
    model.position.set(side * 1.26, 1.55, 1.9);
    model.rotation.y = (side * Math.PI) / 2;
    group.add(model);
  }

  /* 顶部标记灯 / 气喇叭 / 天线 */
  for (const side of [-1, 1])
    part(rbox(0.26, 0.07, 0.09, 0.025), marker, side * 0.87, 3.52, id === 'man' ? 2.88 : 2.7);
  for (const side of [-1, 1]) {
    part(box(0.09, 0.05, 0.07), tail, side * 0.9, 3.62, 0.52);
    part(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 8), chrome, side * 0.5, 3.78, 2.1, Math.PI / 2);
  }
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), black, 0.9, 3.9, 0.7);

  /* 夜间的 headlights 光锥 */
  const beams: THREE.SpotLight[] = [];
  if (night) {
    for (const side of [-1, 1]) {
      const spot = new THREE.SpotLight('#ffe9c0', 320, 70, 0.44, 0.6, 1.6);
      spot.position.set(side * 0.95, 1.05, 2.9);
      spot.target.position.set(side * 1.4, 0, 26);
      group.add(spot, spot.target);
      beams.push(spot);
    }
  }

  // Batch static pieces by finish. Steering and wheel-spin groups keep their pivots.
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const meshes = batches.get(child.material) ?? [];
    meshes.push(child);
    batches.set(child.material, meshes);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      if (!geometry.getAttribute('uv'))
        geometry.setAttribute(
          'uv',
          new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2),
        );
      return geometry;
    });
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const mesh of meshes) {
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    group.add(new THREE.Mesh(merged, material));
  }
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });
  return { group, plateTex, paint, trim, tail, amber, head, marker, spins, steers, beams };
}
