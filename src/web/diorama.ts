// Small faceted models share the existing canvas and its world transform. Each
// ring is a cross-section in XZ. Faces are lit and sorted in camera space.
type Ring = readonly [height: number, radius: number];
export interface Solid {
  rings: readonly Ring[];
  sides: number;
  size: readonly [number, number, number];
  at: readonly [number, number, number];
  colour: number;
}
const globe: Ring[] = [
  [-1, 0.04],
  [-0.8, 0.59],
  [-0.38, 0.92],
  [0, 1],
  [0.38, 0.92],
  [0.8, 0.59],
  [1, 0.04],
];
const barrel: Ring[] = [
  [-1, 0.8],
  [-0.8, 1],
  [0.8, 1],
  [1, 0.8],
];
const slab: Ring[] = [
  [-1, 1],
  [1, 1],
];
const gem: Ring[] = [
  [-1, 0.04],
  [-0.5, 0.85],
  [0.45, 1],
  [1, 0.04],
];
const cone: Ring[] = [
  [-1, 1],
  [1, 0.04],
];

function solid(
  rings: readonly Ring[],
  sides: number,
  size: Solid['size'],
  at: Solid['at'],
  colour: number,
): Solid {
  return { rings, sides, size, at, colour };
}
export const models = {
  pine: [
    solid(barrel, 5, [3, 8, 3], [0, -4, 0], 0x8c7158),
    solid(cone, 7, [12, 13, 12], [0, 9, 0], 0x456d66),
    solid(cone, 7, [9, 11, 9], [0, 21, 0], 0x81a57c),
  ],
  summit: [
    solid(cone, 7, [43, 24, 28], [0, 0, 0], 0x897c98),
    solid(cone, 7, [16, 9, 10], [0, 15, 0], 0xffddcb),
  ],
  cavern: [
    solid(gem, 7, [25, 39, 21], [0, 0, 0], 0x375064),
    solid(gem, 5, [12, 25, 10], [17, -9, 5], 0x3e586a),
  ],
  coral: [
    solid(gem, 6, [23, 8, 15], [0, -4, 0], 0x557c86),
    solid(barrel, 7, [5, 12, 5], [-4, 8, 0], 0xb5758b),
    solid(cone, 6, [5, 10, 4], [7, 5, 3], 0xdc9b85),
    solid(cone, 6, [4, 7, 4], [-12, 4, 3], 0xc78387),
  ],
  submarine: [
    solid(globe, 18, [29, 14, 13], [0, 0, 0], 0xffb56b),
    solid(barrel, 8, [4, 6, 4], [-2, 15, 0], 0xdd9e63),
  ],
  lantern: [
    solid(globe, 10, [13, 14, 13], [0, 1, 0], 0xfb6844),
    solid(barrel, 8, [8, 2, 8], [0, 15, 0], 0xffc56c),
    solid(barrel, 8, [8, 2, 8], [0, -13, 0], 0xf9bb56),
    solid(cone, 6, [2, 4, 2], [0, -19, 0], 0xffb74d),
  ],
  orbit: [
    solid(globe, 10, [20, 7, 9], [0, 2, 0], 0xaadcf4),
    solid(globe, 10, [9, 6, 6], [2, 8, 0], 0x36c7d6),
    solid(gem, 4, [12, 2, 18], [-3, 1, 0], 0x6785ed),
    solid(gem, 5, [8, 4, 4], [-20, 2, 0], 0xffb84f),
  ],
  parcel: [
    solid(globe, 12, [23, 12, 12], [0, 9, 0], 0xffb35d),
    solid(barrel, 4, [7, 4, 6], [0, -10, 0], 0x8f503c),
    solid(slab, 4, [1, 5, 1], [-4, -4, 0], 0xc89661),
    solid(slab, 4, [1, 5, 1], [4, -4, 0], 0xc89661),
    solid(gem, 4, [6, 7, 3], [-19, 10, 0], 0xe17b62),
  ],
  crystal: [solid(gem, 6, [7, 18, 7], [0, 0, 0], 0x82e7da), solid(gem, 5, [5, 10, 5], [8, -6, 3], 0xafa9ff)],
  egg: [solid(globe, 12, [13, 17, 13], [0, 0, 0], 0xffdb9f), solid(gem, 6, [3, 4, 2], [4, -2, 12], 0xc188ac)],
  buoy: [solid(cone, 8, [6, 9, 6], [0, 0, 0], 0xff9c67), solid(barrel, 8, [4, 2, 4], [0, 1, 0], 0xffebc7)],
  beacon: [solid(gem, 6, [6, 9, 6], [0, 0, 0], 0x98ede9), solid(barrel, 8, [7, 2, 7], [0, -9, 0], 0x4799a1)],
  island: [
    solid(gem, 7, [28, 12, 18], [0, 0, 0], 0xa77b94),
    solid(barrel, 7, [26, 2, 17], [0, 5, 0], 0x95d491),
    solid(cone, 7, [6, 12, 6], [-7, 17, -2], 0x3ca580),
    solid(cone, 7, [5, 9, 5], [7, 14, 2], 0x67b887),
  ],
} satisfies Record<string, Solid[]>;

// Place model instances in world space. Distance to the camera controls screen
// position, scale, fog and parallax, independently of the collision plane.
export function drawLandscape(
  ctx: CanvasRenderingContext2D,
  model: Solid[],
  width: number,
  baseline: number,
  travel = 0,
  size = 1,
) {
  const focal = 320;
  ctx.save();
  for (const depth of [520, 330, 220]) {
    const projection = focal / depth;
    const spacing = 67;
    const cameraX = travel * 0.18;
    const first = Math.floor((cameraX - width / (2 * projection)) / spacing) - 1;
    const last = Math.ceil((cameraX + width / (2 * projection)) / spacing) + 1;
    ctx.globalAlpha = depth === 520 ? 0.34 : depth === 330 ? 0.53 : 0.8;
    for (let i = first; i <= last; i++) {
      const wave = Math.sin(i * 13.1 + depth);
      const x = width / 2 + (i * spacing + 14 * wave - cameraX) * projection;
      const y = baseline + (12 + 6 * wave) * projection;
      drawModel(ctx, model, x, y, (0.87 + 0.13 * wave) * projection * size, i * 0.78);
    }
  }
  ctx.restore();
}

const sprites = new WeakMap<Solid[], Map<number, HTMLCanvasElement>>();
const angles = 96;
const halfSize = 50;

export function drawModel(
  ctx: CanvasRenderingContext2D,
  model: Solid[],
  x: number,
  y: number,
  scale: number,
  yaw: number,
) {
  const turn = Math.round((yaw * angles) / (2 * Math.PI));
  const key = ((turn % angles) + angles) % angles;
  let views = sprites.get(model);
  if (!views) {
    views = new Map();
    sprites.set(model, views);
  }
  let sprite = views.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = halfSize * 4;
    const surface = sprite.getContext('2d')!;
    rasterize(surface, model, halfSize * 2, halfSize * 2, 2, (key * 2 * Math.PI) / angles, 0.22);
    views.set(key, sprite);
  }
  const radius = halfSize * scale;
  ctx.drawImage(sprite, x - radius, y - radius, 2 * radius, 2 * radius);
}

function rasterize(
  ctx: CanvasRenderingContext2D,
  model: Solid[],
  x: number,
  y: number,
  scale: number,
  yaw: number,
  pitch: number,
) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const faces: { points: number[][]; depth: number; colour: number; light: number }[] = [];
  for (const part of model) {
    const rings = part.rings.map(([height, radius]) =>
      Array.from({ length: part.sides }, (_, i) => {
        const a = (2 * Math.PI * i) / part.sides;
        const px = Math.cos(a) * radius * part.size[0] + part.at[0];
        const py = height * part.size[1] + part.at[1];
        const pz = Math.sin(a) * radius * part.size[2] + part.at[2];
        const z = pz * cy - px * sy;
        return [px * cy + pz * sy, py * cp - z * sp, z * cp + py * sp];
      }),
    );
    function add(points: number[][]) {
      const [a, b, c] = points;
      const u = b.map((v, i) => v - a[i]),
        v = c.map((n, i) => n - a[i]);
      const nx = u[1] * v[2] - u[2] * v[1],
        ny = u[2] * v[0] - u[0] * v[2],
        nz = u[0] * v[1] - u[1] * v[0];
      if (nz <= 0) return;
      const diffuse = (-0.4 * nx + 0.72 * ny + 0.55 * nz) / (Math.hypot(nx, ny, nz) || 1);
      faces.push({
        points,
        depth: points.reduce((s, p) => s + p[2], 0) / points.length,
        light: 0.65 + Math.max(0, diffuse) * 0.45,
        colour: part.colour,
      });
    }
    for (let r = 1; r < rings.length; r++) {
      for (let i = 0; i < part.sides; i++) {
        const j = (i + 1) % part.sides;
        add([rings[r - 1][i], rings[r][i], rings[r][j], rings[r - 1][j]]);
      }
    }
    add([...rings[rings.length - 1]].reverse());
    add(rings[0]);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, -scale);
  for (const face of faces.sort((a, b) => a.depth - b.depth)) {
    const { colour, light } = face;
    ctx.fillStyle = `rgb(${(colour >> 16) * light} ${((colour >> 8) & 255) * light} ${(colour & 255) * light})`;
    ctx.beginPath();
    for (const [i, p] of face.points.entries()) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
