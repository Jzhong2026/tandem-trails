import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Obstacle, PlayerStatus } from '../shared/race.js';
import type { RaceTrackDef } from '../shared/race-tracks.js';
import { CAM_BACK, CAR_COLORS, CAR_DARK, PALETTES } from './race-render.js';
import type { SceneryItem, ThemePalette } from './race-render.js';

/* 真实 3D 赛道：纵向 1 世界单位 = 0.1m（车速 148u/s ≈ 53km/h），
 * 横向 1 世界单位 = 0.0175m（车道 3.5m、路半宽 5.25m，符合真实道路）。 */
const ZU = 0.1;
const XU = 0.0175;
const LANE_M = 200 * XU;
const ROAD_HALF_M = 300 * XU;

export interface SceneFrame {
  track: RaceTrackDef;
  cameraX: number;
  laneY: number;
  color: number;
  status: PlayerStatus;
  hitFlash: number;
  shake: number;
  stationActive: number | null;
  time: number;
  dt: number;
}

export interface SceneAnchors {
  groundX: number; groundY: number;
  roofX: number; roofY: number;
  exhaustX: number; exhaustY: number;
  hitX: number; hitY: number;
  pxPerM: number;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
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

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 合批桶：把整条赛道的同类静物合并成单个网格，控制 draw call。 */
class Bucket {
  private geos: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation,
    x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geos.push(g);
  }
  build(material: THREE.Material, shadow = true): THREE.Mesh | null {
    if (this.geos.length === 0) return null;
    const merged = mergeGeometries(this.geos, false);
    for (const g of this.geos) g.dispose();
    this.geos = [];
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function ridgeGeometry(width: number, segs: number, hMin: number, hMax: number, seed: number) {
  const r = rand(seed);
  const controls: number[] = [];
  const count = Math.ceil(segs / 8) + 2;
  for (let i = 0; i < count; i++) controls.push(hMin * 0.2 + (hMax - hMin) * (0.25 + r() * 0.75));
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const x = (i / segs - 0.5) * width;
    const f = i / 8;
    const i0 = Math.floor(f);
    const t = f - i0;
    const smooth = t * t * (3 - 2 * t);
    const peak = controls[i0] * (1 - smooth) + controls[i0 + 1] * smooth;
    positions.push(x, 0, 0, x, peak, 0);
    if (i < segs) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface TruckRig {
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

export class RaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private mountains = new THREE.Group();
  private clouds = new THREE.Group();
  private cloudDrift: { sprite: THREE.Sprite; speed: number }[] = [];
  private lampGlows: { sprite: THREE.Sprite; pool: THREE.Mesh; z: number }[] = [];
  private lampHeadMat: THREE.MeshStandardMaterial;
  private stationRigs: { screen: THREE.MeshStandardMaterial; beam: THREE.Sprite; fascia: THREE.MeshStandardMaterial }[] = [];
  private truck: TruckRig;
  private track: RaceTrackDef;
  private palette: ThemePalette;
  private width = 800;
  private height = 600;
  private camX = 0;
  private prevLaneY = 1;
  private latVel = 0;
  private speed = 0;
  private wheelSpin = 0;
  private truckX = 0;
  private truckZ = 0;
  private envTex: THREE.Texture;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, track: RaceTrackDef, obstacles: Obstacle[], scenery: SceneryItem[]) {
    this.track = track;
    this.palette = PALETTES[track.theme];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = track.theme === 'night' ? 0.95 : 1.0;

    this.camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.4, 1200);
    this.scene.fog = new THREE.Fog(this.palette.fog, 120, 430);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = track.theme === 'night' ? 0.1 : track.theme === 'sunset' ? 0.25 : 0.3;

    const night = this.palette.night;
    this.sun = new THREE.DirectionalLight(
      night ? '#a8c0e8' : track.theme === 'sunset' ? '#ff9a4d' : '#fff1d6',
      night ? 0.5 : track.theme === 'sunset' ? 2.0 : 2.2,
    );
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(
      night ? '#2a3a55' : track.theme === 'sunset' ? '#8a7aa8' : '#cfe4ff',
      night ? '#0b0e13' : track.theme === 'sunset' ? '#57493a' : '#77876a',
      night ? 0.35 : track.theme === 'sunset' ? 0.4 : 0.5,
    );
    this.scene.add(this.hemi);

    this.skyMat = this.buildSky();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), this.skyMat);
    this.scene.add(this.sky);
    this.buildMountains();
    this.buildClouds();
    this.buildGround();
    this.buildRoad();
    this.buildGuardrail();
    this.lampHeadMat = new THREE.MeshStandardMaterial({
      color: '#9aa2ad', emissive: new THREE.Color(this.palette.lampGlow),
      emissiveIntensity: night ? 2.4 : track.theme === 'sunset' ? 0.6 : 0.05, roughness: 0.4,
    });
    this.buildScenery(scenery);
    this.buildObstacles(obstacles);
    this.buildStations();
    this.buildFinish();
    this.truck = this.buildTruck();
    this.scene.add(this.truck.group);
  }

  /* ---------- 天空 / 远景 ---------- */

  private buildSky() {
    const p = this.palette;
    const sunDir = this.track.theme === 'sunset' ? new THREE.Vector3(-0.42, 0.16, 0.89)
      : this.track.theme === 'night' ? new THREE.Vector3(0.28, 0.18, 0.94)
        : new THREE.Vector3(0.33, 0.16, 0.93);
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(p.skyTop) },
        bottom: { value: new THREE.Color(p.skyBottom) },
        sunDir: { value: sunDir.normalize() },
        sunCol: { value: new THREE.Color(p.sun) },
        night: { value: p.night ? 1 : 0 },
        disc: { value: p.night ? 0.99975 : 0.9994 },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol;
        uniform float night; uniform float disc; uniform float time;
        varying vec3 vDir;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(bottom, top, pow(h, 0.55));
          float s = clamp(dot(d, sunDir), 0.0, 1.0);
          float disk = smoothstep(disc, disc + 0.00035, s);
          float glow = pow(s, 90.0) * 0.5 + pow(s, 12.0) * 0.16;
          col += sunCol * (disk * 1.5 + glow);
          if (night > 0.5) {
            vec3 g = floor(d * 230.0);
            float st = step(0.9976, hash(g));
            float tw = 0.55 + 0.45 * sin(time * 2.0 + hash(g + 1.7) * 40.0);
            col += vec3(0.9, 0.95, 1.0) * st * tw * smoothstep(0.02, 0.22, d.y);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }

  private buildMountains() {
    const p = this.palette;
    const layers: { dist: number; color: string; hMin: number; hMax: number; seed: number }[] = [
      { dist: 440, color: p.hillFar, hMin: 42, hMax: 96, seed: 0x1234 },
      { dist: 390, color: p.hillNear, hMin: 22, hMax: 52, seed: 0x9876 },
      { dist: 350, color: p.treeLine, hMin: 5, hMax: 11, seed: 0x51a7 },
    ];
    for (const layer of layers) {
      const haze = layer.dist > 420 ? 0.42 : layer.dist > 370 ? 0.26 : 0.12;
      const color = new THREE.Color(layer.color).lerp(new THREE.Color(p.fog), haze);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false });
      const geo = ridgeGeometry(1600, 120, layer.hMin, layer.hMax, layer.seed);
      for (const [x, z, ry] of [[0, layer.dist, 0], [-layer.dist, 0, Math.PI / 2], [layer.dist, 0, Math.PI / 2]] as const) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, -0.5, z);
        mesh.rotation.y = ry;
        this.mountains.add(mesh);
      }
    }
    this.scene.add(this.mountains);
  }

  private buildClouds() {
    const tex = canvasTexture(128, 128, ctx => {
      const blob = (x: number, y: number, r: number) => {
        const g = ctx.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.65, 'rgba(255,255,255,0.32)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      blob(64, 74, 44); blob(40, 80, 30); blob(90, 80, 32); blob(64, 52, 30);
    });
    const r = rand(0x5bf03);
    const tint = new THREE.Color(this.palette.cloud.slice(0, 7));
    const opacity = parseInt(this.palette.cloud.slice(7, 9) || 'cc', 16) / 255;
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, opacity, depthWrite: false, fog: false });
      const sprite = new THREE.Sprite(mat);
      const scale = 40 + r() * 70;
      sprite.scale.set(scale, scale * 0.42, 1);
      sprite.position.set((r() - 0.5) * 640, 75 + r() * 90, -60 + r() * 520);
      this.clouds.add(sprite);
      this.cloudDrift.push({ sprite, speed: 0.6 + r() * 1.2 });
    }
    this.scene.add(this.clouds);
  }

  /* ---------- 地面 / 路面 ---------- */

  private buildGround() {
    const len = this.track.length * ZU + 900;
    const tex = canvasTexture(256, 256, ctx => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);
      const r = rand(0x77aa);
      for (let i = 0; i < 2400; i++) {
        const v = 200 + Math.floor(r() * 55);
        ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
        ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, 0, 256, 128);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(110, len / 8);
    const mat = new THREE.MeshPhongMaterial({ color: this.palette.fieldNear, map: tex, shininess: 2, specular: new THREE.Color('#0a0a0a') });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, len), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.04, len / 2 - 450);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildRoad() {
    const p = this.palette;
    const len = this.track.length * ZU + 160;
    const tex = canvasTexture(512, 512, ctx => {
      const mx = 512 / 11.6;
      const my = 512 / 12;
      ctx.fillStyle = p.road;
      ctx.fillRect(0, 0, 512, 512);
      const r = rand(0x4a0ad);
      for (let i = 0; i < 3200; i++) {
        const light = r() < 0.5;
        ctx.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
        ctx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (const lane of [-3.5, 0, 3.5]) {
        for (const off of [-0.95, 0.95]) {
          ctx.fillRect((5.8 + lane + off - 0.28) * mx, 0, 0.56 * mx, 512);
        }
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(r() * 400, r() * 460, 40 + r() * 90, 24 + r() * 60);
      }
      ctx.fillStyle = p.edge;
      for (const side of [-1, 1]) ctx.fillRect((5.8 + side * 5.05 - 0.08) * mx, 0, 0.16 * mx, 512);
      ctx.fillStyle = p.dash;
      for (const side of [-1, 1]) {
        for (const start of [0, 6]) ctx.fillRect((5.8 + side * 1.75 - 0.06) * mx, start * my, 0.12 * mx, 3 * my);
      }
      for (const [x0, x1] of [[0, 0.55], [11.05, 11.6]]) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 === 0 ? p.rumbleA : p.rumbleB;
          ctx.fillRect(x0 * mx, i * 3 * my, (x1 - x0) * mx, 3 * my);
        }
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, len / 12);
    const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 8, specular: new THREE.Color('#15181c') });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(11.6, len), mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, len / 2 - 80);
    road.receiveShadow = true;
    this.scene.add(road);
  }

  private buildGuardrail() {
    const len = this.track.length * ZU + 160;
    const metal = new THREE.MeshStandardMaterial({ color: this.palette.guard, metalness: 0.85, roughness: 0.42 });
    const postMat = new THREE.MeshStandardMaterial({ color: this.palette.guardPost, metalness: 0.7, roughness: 0.55 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, len), metal);
      rail.position.set(side * (ROAD_HALF_M + 0.62), 0.72, len / 2 - 80);
      rail.castShadow = true;
      this.scene.add(rail);
    }
    const count = Math.ceil(len / 4) * 2;
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.9, 0.12), postMat, count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let z = -80; z < len - 80; z += 4) {
      for (const side of [-1, 1]) {
        m.setPosition(side * (ROAD_HALF_M + 0.66), 0.45, z);
        posts.setMatrixAt(i++, m);
      }
    }
    posts.count = i;
    posts.castShadow = true;
    this.scene.add(posts);
  }

  /* ----------  roadside ---------- */

  private buildScenery(scenery: SceneryItem[]) {
    const p = this.palette;
    const veg = new Bucket();
    const rockB = new Bucket();
    const buildings = new Bucket();
    const lamps = new Bucket();
    const heads = new Bucket();
    const signs = new Bucket();
    const vegMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 2, specular: new THREE.Color('#0a0a0a') });
    const rockMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 2, specular: new THREE.Color('#0a0a0a'), flatShading: true });
    const lampMat = new THREE.MeshPhongMaterial({ color: p.guardPost, shininess: 40, specular: new THREE.Color('#555a60') });

    const facade = canvasTexture(256, 256, ctx => {
      ctx.fillStyle = p.building;
      ctx.fillRect(0, 0, 256, 256);
      const r = rand(0xbeef);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          const lit = p.night ? r() < 0.55 : true;
          ctx.fillStyle = lit ? p.window : '#141a26';
          ctx.fillRect(24 + col * 56, 22 + row * 44, 34, 26);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(24 + col * 56, 44 + row * 44, 34, 4);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 236, 256, 20);
    });
    const buildMat = new THREE.MeshPhongMaterial({ map: facade, vertexColors: true, shininess: 4, specular: new THREE.Color('#0a0a0a') });
    const roofMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 2, specular: new THREE.Color('#0a0a0a') });
    const roofs = new Bucket();

    const glowTex = canvasTexture(128, 128, ctx => {
      const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,233,168,0.9)');
      g.addColorStop(0.4, 'rgba(255,233,168,0.28)');
      g.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });

    const r = rand(this.track.seed ^ 0x5177);
    for (const item of scenery) {
      const x = item.side * item.lateral * XU;
      const z = item.z * ZU;
      const s = item.size;
      const tone = item.tone;
      if (item.kind === 'tree') {
        const green = new THREE.Color(p.tree).lerp(new THREE.Color(p.treeDark), tone * 0.8);
        veg.add(new THREE.CylinderGeometry(0.13 * s, 0.2 * s, 1.1 * s, 7), p.trunk, x, 0.55 * s, z);
        veg.add(new THREE.SphereGeometry(1.6 * s, 8, 6), green, x, 2.1 * s, z, 0, 0, 0, 1, 0.92, 1);
        veg.add(new THREE.SphereGeometry(1.05 * s, 7, 5), green, x - 1.15 * s, 1.7 * s, z + 0.3 * s);
        veg.add(new THREE.SphereGeometry(1.1 * s, 7, 5), green, x + 1.1 * s, 1.8 * s, z - 0.2 * s);
        veg.add(new THREE.SphereGeometry(0.9 * s, 7, 5), green, x + 0.2 * s, 2.9 * s, z + 0.4 * s);
      } else if (item.kind === 'pine') {
        const green = new THREE.Color(p.treeDark).lerp(new THREE.Color(p.tree), tone * 0.6);
        veg.add(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.4 * s, 6), p.trunk, x, 0.7 * s, z);
        veg.add(new THREE.ConeGeometry(1.5 * s, 2.3 * s, 8), green, x, 2.0 * s, z);
        veg.add(new THREE.ConeGeometry(1.15 * s, 2.0 * s, 8), green, x, 3.0 * s, z);
        veg.add(new THREE.ConeGeometry(0.8 * s, 1.7 * s, 8), green, x, 3.9 * s, z);
      } else if (item.kind === 'bush') {
        const green = new THREE.Color(p.bush).lerp(new THREE.Color(p.treeDark), tone * 0.7);
        veg.add(new THREE.SphereGeometry(0.62 * s, 7, 5), green, x - 0.5 * s, 0.5 * s, z);
        veg.add(new THREE.SphereGeometry(0.74 * s, 7, 5), green, x + 0.45 * s, 0.62 * s, z + 0.2 * s);
        veg.add(new THREE.SphereGeometry(0.55 * s, 7, 5), green, x, 0.95 * s, z - 0.15 * s);
      } else if (item.kind === 'rock') {
        const gray = new THREE.Color(p.rock).lerp(new THREE.Color('#ffffff'), tone * 0.18);
        rockB.add(new THREE.DodecahedronGeometry(0.62 * s, 0), gray, x, 0.3 * s, z, r() * 0.4, r() * 3, r() * 0.3, 1.3, 0.8, 1);
      } else if (item.kind === 'building') {
        const bx = x * 1.55;
        const w = (6 + tone * 6) * s;
        const h = (4.5 + tone * 5) * s;
        const tint = new THREE.Color('#ffffff').lerp(new THREE.Color(p.buildingRoof), tone * 0.35);
        buildings.add(new THREE.BoxGeometry(w, h, 8 * s), tint, bx, h / 2, z);
        roofs.add(new THREE.BoxGeometry(w + 0.5, 0.35, 8 * s + 0.5), p.buildingRoof, bx, h + 0.17, z);
      } else if (item.kind === 'lamp') {
        const armDir = -item.side;
        lamps.add(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 7.4 * s, 8), '#ffffff', x, 3.7 * s, z);
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(x, 7.3 * s, z),
          new THREE.Vector3(x + armDir * 0.9 * s, 7.95 * s, z),
          new THREE.Vector3(x + armDir * 1.75 * s, 7.6 * s, z),
        );
        lamps.add(new THREE.TubeGeometry(curve, 8, 0.06 * s, 6), '#ffffff', 0, 0, 0);
        heads.add(new THREE.BoxGeometry(0.6 * s, 0.14 * s, 0.26 * s), '#ffffff', x + armDir * 1.85 * s, 7.52 * s, z);
        const hx = x + armDir * 1.85 * s;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: '#ffe9a8', transparent: true, opacity: 0.85, depthWrite: false,
        }));
        sprite.scale.set(7, 7, 1);
        sprite.position.set(hx, 7.5 * s, z);
        sprite.visible = false;
        this.scene.add(sprite);
        const pool = new THREE.Mesh(
          new THREE.PlaneGeometry(9, 5),
          new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(hx - armDir * 1.2, 0.03, z);
        pool.visible = false;
        this.scene.add(pool);
        this.lampGlows.push({ sprite, pool, z });
      } else if (item.kind === 'sign') {
        signs.add(new THREE.CylinderGeometry(0.05, 0.06, 2.6 * s, 6), '#ffffff', x, 1.3 * s, z);
        const tex = canvasTexture(256, 128, ctx => {
          ctx.fillStyle = '#2f6f4a';
          ctx.fillRect(0, 0, 256, 128);
          ctx.strokeStyle = '#f4f1e8';
          ctx.lineWidth = 8;
          ctx.strokeRect(8, 8, 240, 112);
          ctx.fillStyle = '#f4f1e8';
          ctx.font = '900 52px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('前方施工', 128, 68);
        });
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4 * s, 1.2 * s),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }),
        );
        panel.position.set(x, 2.9 * s, z);
        panel.rotation.y = item.side > 0 ? -Math.PI / 2 : Math.PI / 2;
        panel.castShadow = true;
        this.scene.add(panel);
      }
    }

    for (const mesh of [veg.build(vegMat), rockB.build(rockMat), buildings.build(buildMat),
      roofs.build(roofMat), lamps.build(lampMat), heads.build(this.lampHeadMat, false), signs.build(lampMat)]) {
      if (mesh) this.scene.add(mesh);
    }
  }

  /* ---------- 障碍 / 服务区 / 终点 ---------- */

  private buildObstacles(obstacles: Obstacle[]) {
    const cones = new Bucket();
    const barrels = new Bucket();
    const rocks = new Bucket();
    const r = rand(this.track.seed ^ 0x0b57);
    for (const ob of obstacles) {
      const x = (ob.lane - 1) * LANE_M;
      const z = ob.x * ZU;
      if (ob.kind === 'cone') {
        for (const off of [-0.95, 0, 0.95]) {
          const s = off === 0 ? 1 : 0.88;
          const cz = z + (r() - 0.5) * 0.5;
          cones.add(new THREE.BoxGeometry(0.52 * s, 0.05, 0.52 * s), '#b8431a', x + off, 0.025, cz);
          cones.add(new THREE.ConeGeometry(0.24 * s, 0.72 * s, 14), '#e8611f', x + off, 0.38 * s, cz);
          cones.add(new THREE.CylinderGeometry(0.13 * s, 0.17 * s, 0.14 * s, 14), '#f6f2e6', x + off, 0.42 * s, cz);
        }
      } else if (ob.kind === 'barrel') {
        for (const off of [-0.42, 0.42]) {
          const bz = z + off * 0.6;
          barrels.add(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 16), '#b8332f', x + off, 0.475, bz);
          barrels.add(new THREE.CylinderGeometry(0.33, 0.33, 0.13, 16), '#f6f2e6', x + off, 0.62, bz);
          barrels.add(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 16), '#f6f2e6', x + off, 0.3, bz);
          barrels.add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), '#d9571f', x + off, 0.96, bz);
        }
      } else {
        const gray = new THREE.Color(this.palette.rock).lerp(new THREE.Color('#ffffff'), r() * 0.15);
        rocks.add(new THREE.DodecahedronGeometry(0.9, 0), gray, x, 0.42, z, r() * 0.3, r() * 3, r() * 0.2, 1.35, 0.85, 1.1);
      }
    }
    const coneMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 6, specular: new THREE.Color('#111111') });
    const barrelMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 20, specular: new THREE.Color('#222222') });
    const rockMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 2, specular: new THREE.Color('#0a0a0a'), flatShading: true });
    for (const mesh of [cones.build(coneMat), barrels.build(barrelMat), rocks.build(rockMat)]) {
      if (mesh) this.scene.add(mesh);
    }
  }

  private buildStations() {
    const padMat = new THREE.MeshPhongMaterial({ color: '#3a3f47', shininess: 4, specular: new THREE.Color('#0a0a0a') });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 0.6, roughness: 0.4 });
    const postMat = new THREE.MeshStandardMaterial({ color: '#b8bec7', metalness: 0.7, roughness: 0.45 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.5 });
    this.track.stations.forEach((stationZ, index) => {
      const z = stationZ * ZU;
      const cx = ROAD_HALF_M + 6.5;
      const group = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(12, 18), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.02, z);
      pad.receiveShadow = true;
      group.add(pad);
      const canopy = new THREE.Mesh(new RoundedBoxGeometry(11, 0.55, 8, 2, 0.12), canopyMat);
      canopy.position.set(cx, 5.3, z);
      canopy.castShadow = true;
      group.add(canopy);
      const fasciaMat = new THREE.MeshStandardMaterial({
        color: '#2f6f4a', emissive: new THREE.Color('#4ade80'), emissiveIntensity: 0, roughness: 0.5,
      });
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 8), fasciaMat);
      fascia.position.set(cx - 5.5, 5.3, z);
      group.add(fascia);
      const signTex = canvasTexture(256, 128, ctx => {
        ctx.fillStyle = '#2f6f4a';
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#f4f1e8';
        ctx.font = '900 54px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`服务区 ${index + 1}`, 128, 66);
      });
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 1.5),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, side: THREE.DoubleSide }),
      );
      sign.position.set(cx - 5.6, 6.6, z);
      sign.rotation.y = -Math.PI / 2;
      group.add(sign);
      for (const dx of [-4.6, 4.6]) {
        for (const dz of [-3.2, 3.2]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 5.1, 10), postMat);
          post.position.set(cx + dx, 2.55, z + dz);
          post.castShadow = true;
          group.add(post);
        }
      }
      const screenMat = new THREE.MeshStandardMaterial({
        color: '#1a1d24', emissive: new THREE.Color('#4ade80'), emissiveIntensity: 0.25, roughness: 0.35,
      });
      for (const dz of [-2.2, 2.2]) {
        const pump = new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.6, 0.55, 2, 0.06), pumpMat);
        pump.position.set(cx - 1.5, 0.8, z + dz);
        pump.castShadow = true;
        group.add(pump);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.36), screenMat);
        screen.position.set(cx - 1.92, 1.15, z + dz);
        group.add(screen);
        const hose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: '#1a1d24', roughness: 0.8 }));
        hose.position.set(cx - 1.5, 1.0, z + dz + 0.32);
        group.add(hose);
      }
      const beam = new THREE.Sprite(new THREE.SpriteMaterial({
        map: canvasTexture(128, 128, ctx => {
          const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
          g.addColorStop(0, 'rgba(74,222,128,0.75)');
          g.addColorStop(1, 'rgba(74,222,128,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 128, 128);
        }),
        transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      beam.scale.set(16, 10, 1);
      beam.position.set(cx - 2, 3.2, z);
      group.add(beam);
      this.stationRigs.push({ screen: screenMat, beam, fascia: fasciaMat });
      this.scene.add(group);
    });
  }

  private buildFinish() {
    const z = this.track.length * ZU;
    const steel = new THREE.MeshStandardMaterial({ color: '#8b939d', metalness: 0.8, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 6.4, 10), steel);
      post.position.set(side * (ROAD_HALF_M + 1.2), 3.2, z);
      post.castShadow = true;
      this.scene.add(post);
    }
    const bannerTex = canvasTexture(512, 128, ctx => {
      ctx.fillStyle = '#1a1d24';
      ctx.fillRect(0, 0, 512, 128);
      for (let i = 0; i < 32; i++) {
        for (const row of [0, 1]) {
          ctx.fillStyle = (i + row) % 2 === 0 ? '#f4f1e8' : '#1a1d24';
          ctx.fillRect(i * 16, row === 0 ? 0 : 108, 16, 20);
        }
      }
      ctx.fillStyle = '#ffc233';
      ctx.font = '900 58px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('终点 FINISH', 256, 64);
    });
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_HALF_M * 2 + 3.4, 1.5, 0.24),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6 }),
    );
    banner.position.set(0, 5.9, z);
    banner.castShadow = true;
    this.scene.add(banner);
    const lineTex = canvasTexture(128, 32, ctx => {
      for (let i = 0; i < 16; i++) {
        for (let row = 0; row < 4; row++) {
          ctx.fillStyle = (i + row) % 2 === 0 ? '#f4f1e8' : '#15181d';
          ctx.fillRect(i * 8, row * 8, 8, 8);
        }
      }
    });
    lineTex.wrapS = THREE.RepeatWrapping;
    lineTex.repeat.set(6, 1);
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_M * 2, 1.2),
      new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.9 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, z);
    this.scene.add(line);
  }

  /* ---------- Scania 牵引车 ---------- */

  private buildTruck(): TruckRig {
    const group = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({
      color: CAR_COLORS[0], metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12,
    });
    const trim = new THREE.MeshStandardMaterial({ color: CAR_DARK[0], metalness: 0.6, roughness: 0.45 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: 1, roughness: 0.22 });
    const alu = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.9, roughness: 0.38 });
    const black = new THREE.MeshStandardMaterial({ color: '#14171c', metalness: 0.15, roughness: 0.85, side: THREE.DoubleSide });
    const tire = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.95 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#0e1a24', metalness: 1, roughness: 0.06, envMapIntensity: 1.5 });
    const tail = new THREE.MeshStandardMaterial({ color: '#5a0f12', emissive: new THREE.Color('#ff2a2a'), emissiveIntensity: 1.1, roughness: 0.4 });
    const amber = new THREE.MeshStandardMaterial({ color: '#6b4a12', emissive: new THREE.Color('#ffa028'), emissiveIntensity: 1.2, roughness: 0.4 });
    const head = new THREE.MeshStandardMaterial({ color: '#cfd8e0', emissive: new THREE.Color('#fff2cc'), emissiveIntensity: this.palette.night ? 3.2 : 0.25, roughness: 0.25 });
    const marker = new THREE.MeshStandardMaterial({ color: '#6b4a12', emissive: new THREE.Color('#ffb347'), emissiveIntensity: 1.4, roughness: 0.4 });

    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
      rx = 0, ry = 0, rz = 0) => {
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
    part(rbox(2.42, 0.74, 2.1, 0.22), paint, 0, 3.34, 1.55);
    part(box(2.44, 0.14, 0.5), trim, 0, 3.06, 2.72, -0.12);
    part(box(2.24, 1.0, 0.06), glass, 0, 2.5, 2.88, -0.16);
    for (const side of [-1, 1]) {
      part(box(0.05, 0.03, 0.62), black, side * 0.5, 2.16, 2.94, -0.16, 0, side * 0.35);
      part(box(0.06, 0.74, 1.4), glass, side * 1.26, 2.42, 1.95);
      part(box(0.02, 0.18, 2.2), trim, side * 1.255, 1.02, 1.75);
      part(box(0.02, 1.6, 0.03), black, side * 1.26, 1.85, 1.02);
      part(box(0.05, 0.07, 0.3), chrome, side * 1.27, 1.72, 1.25);
      part(box(0.34, 0.1, 0.9), black, side * 1.16, 0.52, 1.5);
      part(box(0.3, 0.08, 0.7), black, side * 1.16, 0.82, 1.45);
    }

    /* 前脸：格栅 / 大灯 / 保险杠 */
    for (const y of [1.32, 1.52, 1.72]) part(box(1.9, 0.13, 0.07), black, 0, y, 2.92);
    part(box(2.1, 0.1, 0.06), chrome, 0, 1.86, 2.93);
    for (const side of [-1, 1]) {
      part(box(0.36, 0.44, 0.1), head, side * 1.02, 1.06, 2.92);
      part(box(0.12, 0.44, 0.1), amber, side * 1.24, 1.06, 2.92);
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
    part(box(1.5, 0.62, 0.06), glass, 0, 2.5, 0.58);
    for (const side of [-1, 1]) part(box(0.03, 1.5, 0.02), black, side * 0.62, 1.7, 0.57);
    part(box(2.3, 0.06, 0.06), trim, 0, 3.66, 0.5);
    part(new THREE.CylinderGeometry(0.085, 0.085, 2.5, 12), chrome, -1.32, 2.15, 0.42);
    part(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 12), alu, -1.32, 1.55, 0.42);
    part(new THREE.CylinderGeometry(0.1, 0.085, 0.2, 12), black, -1.32, 3.45, 0.42);
    part(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 16), alu, 1.22, 0.72, -0.7, Math.PI / 2);
    for (const dz of [-0.4, 0.4]) part(box(0.06, 0.72, 0.08), black, 1.22, 0.72, -0.7 + dz);
    part(box(0.5, 0.6, 1.2), black, -1.2, 0.72, -0.8);

    /* 车轮：前转向 + 后双胎 */
    const spins: THREE.Group[] = [];
    const steers: THREE.Group[] = [];
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
        for (let i = 0; i < 6; i++) {
          const spoke = new THREE.Mesh(box(width + 0.05, 0.09, 0.4), alu);
          spoke.position.x = off + (dual ? Math.sign(off) * 0.03 : 0);
          spoke.rotation.x = (i / 6) * Math.PI;
          spin.add(spoke);
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
      part(new THREE.CylinderGeometry(0.68, 0.68, 0.82, 18, 1, true, 0, Math.PI), black, side * 1.08, 0.52, -1.75, 0, 0, Math.PI / 2);
      part(box(0.52, 0.24, 0.08), tail, side * 0.95, 0.86, -3.06);
      part(box(0.12, 0.2, 0.03), amber, side * 1.24, 0.86, -3.06);
      part(box(0.1, 0.16, 0.03), head, side * 0.72, 0.86, -3.06);
    }
    part(box(2.44, 0.16, 0.1), alu, 0, 0.5, -2.98);
    for (const side of [-1, 1]) part(box(0.08, 0.4, 0.08), black, side * 0.9, 0.62, -2.94);
    part(box(2.2, 0.12, 0.06), black, 0, 0.3, -2.92);

    const plateTex = canvasTexture(128, 32, ctx => {
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
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }));
    plate.position.set(0, 0.86, -3.07);
    plate.rotation.y = Math.PI;
    group.add(plate);
    this.plateTex = plateTex;

    const flapTex = canvasTexture(128, 128, ctx => {
      ctx.fillStyle = '#101216';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillRect(0, 6, 128, 6);
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCANIA', 64, 78);
    });
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.52), new THREE.MeshStandardMaterial({ map: flapTex, roughness: 0.9, side: THREE.DoubleSide }));
      flap.position.set(side * 1.08, 0.42, -2.42);
      flap.rotation.y = Math.PI;
      flap.rotation.x = 0.08;
      group.add(flap);
    }

    const badge = (text: string) => canvasTexture(256, 64, ctx => {
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
    const badgeMat = (tex: THREE.Texture) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.7, roughness: 0.35 });
    const rearBadge = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.3), badgeMat(badge('SCANIA')));
    rearBadge.position.set(0, 1.95, 0.56);
    rearBadge.rotation.y = Math.PI;
    group.add(rearBadge);
    const frontBadge = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.24), badgeMat(badge('SCANIA')));
    frontBadge.position.set(0, 2.06, 2.96);
    group.add(frontBadge);
    const modelTex = badge('S 500 V8');
    for (const side of [-1, 1]) {
      const model = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.26), badgeMat(modelTex));
      model.position.set(side * 1.26, 1.55, 1.9);
      model.rotation.y = side * Math.PI / 2;
      group.add(model);
    }

    /* 顶部标记灯 / 气喇叭 / 天线 */
    for (let i = -2; i <= 2; i++) part(box(0.1, 0.05, 0.07), marker, i * 0.42, 3.72, 2.5);
    for (const side of [-1, 1]) {
      part(box(0.09, 0.05, 0.07), tail, side * 0.9, 3.62, 0.52);
      part(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 8), chrome, side * 0.5, 3.78, 2.1, Math.PI / 2);
    }
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), black, 0.9, 3.9, 0.7);

    /* 夜间的 headlights 光锥 */
    const beams: THREE.SpotLight[] = [];
    if (this.palette.night) {
      for (const side of [-1, 1]) {
        const spot = new THREE.SpotLight('#ffe9c0', 320, 70, 0.44, 0.6, 1.6);
        spot.position.set(side * 0.95, 1.05, 2.9);
        spot.target.position.set(side * 1.4, 0, 26);
        group.add(spot, spot.target);
        beams.push(spot);
      }
    }

    group.traverse(obj => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
    return { group, paint, trim, tail, amber, head, marker, spins, steers, beams };
  }

  private plateTex: THREE.Texture | null = null;

  setPlayerNumber(n: number) {
    if (!this.plateTex) return;
    const canvas = this.plateTex.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(4, 4, 120, 24);
    ctx.fillStyle = '#1a1d24';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 64, 17);
    this.plateTex.needsUpdate = true;
  }

  /* ---------- 每帧 ---------- */

  setSize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(dpr, 1.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(frame: SceneFrame) {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0.001, frame.dt));
    const t = frame.time;
    const truckZ = (frame.cameraX + CAM_BACK) * ZU;
    const truckX = (frame.laneY - 1) * LANE_M;
    this.truckX = truckX;
    this.truckZ = truckZ;

    const targetVel = THREE.MathUtils.clamp((frame.laneY - this.prevLaneY) / dt * LANE_M, -9, 9);
    this.prevLaneY = frame.laneY;
    this.latVel += (targetVel - this.latVel) * Math.min(1, dt * 7);
    const targetSpeed = frame.status === 'racing' ? this.track.speed * ZU : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4);
    this.wheelSpin += (this.speed / 0.52) * dt;

    const rig = this.truck;
    rig.group.position.set(truckX, Math.sin(t * 8.3) * 0.012 * (0.3 + this.speed / 20), truckZ);
    rig.group.rotation.z = THREE.MathUtils.clamp(this.latVel * 0.018, -0.07, 0.07);
    rig.group.rotation.x = Math.sin(t * 6.1) * 0.003;
    for (const spin of rig.spins) spin.rotation.x = -this.wheelSpin;
    for (const steer of rig.steers) steer.rotation.y = THREE.MathUtils.clamp(this.latVel * 0.055, -0.38, 0.38);

    const gone = frame.status === 'eliminated';
    const bodyColor = gone ? '#6b7280' : CAR_COLORS[frame.color] ?? CAR_COLORS[0];
    const trimColor = gone ? '#4a505a' : CAR_DARK[frame.color] ?? CAR_DARK[0];
    if (rig.paint.color.getHexString() !== new THREE.Color(bodyColor).getHexString()) {
      rig.paint.color.set(bodyColor);
      rig.trim.color.set(trimColor);
    }
    rig.paint.roughness = gone ? 0.8 : 0.34;
    rig.paint.clearcoat = gone ? 0.15 : 1;
    rig.paint.emissive.set('#ff2020');
    rig.paint.emissiveIntensity = frame.hitFlash * 0.5;
    rig.marker.emissiveIntensity = gone ? 0 : 1.4;
    rig.tail.emissiveIntensity = gone ? 0.25 : frame.status === 'racing' ? 1.1 : 2.8;
    rig.head.emissiveIntensity = this.palette.night ? (gone ? 0.4 : 3.2) : 0.25;
    for (const beam of rig.beams) beam.visible = !gone;

    /* 摄像机：车后追焦，变道时滞后露出侧身 */
    this.camX += (truckX * 0.5 + 2.3 - this.camX) * Math.min(1, dt * 3.2);
    const shakeX = (Math.random() - 0.5) * frame.shake * 0.22;
    const shakeY = (Math.random() - 0.5) * frame.shake * 0.18;
    this.camera.position.set(this.camX + shakeX, 4.2 + Math.sin(t * 1.7) * 0.05 + shakeY, truckZ - 11.5);
    this.camera.lookAt(truckX * 0.85 + 0.5 + shakeX * 0.5, -2.25, truckZ + 10);

    const off = this.track.theme === 'sunset' ? [-20, 12, 18] : this.track.theme === 'night' ? [14, 22, -10] : [18, 26, 12];
    this.sun.position.set(truckX + off[0], off[1], truckZ + off[2]);
    this.sun.target.position.set(truckX, 0, truckZ + 4);
    this.sky.position.set(this.camX, 0, truckZ - 11.5);
    this.mountains.position.z = truckZ - 11.5;
    this.clouds.position.z = (truckZ - 11.5) * 0.9;
    for (const cloud of this.cloudDrift) {
      cloud.sprite.position.x += cloud.speed * dt;
      if (cloud.sprite.position.x > 340) cloud.sprite.position.x = -340;
    }
    this.skyMat.uniforms.time.value = t;

    const camZ = truckZ - 11.5;
    for (const glow of this.lampGlows) {
      const on = this.palette.night && Math.abs(glow.z - camZ) < 150;
      glow.sprite.visible = on;
      glow.pool.visible = on;
    }
    this.stationRigs.forEach((rig2, index) => {
      const active = frame.stationActive === index;
      rig2.screen.emissiveIntensity = active ? 1.6 : 0.25;
      rig2.fascia.emissiveIntensity = active ? 0.7 : 0;
      rig2.beam.material.opacity = active ? 0.5 : 0;
    });

    this.renderer.render(this.scene, this.camera);
  }

  anchors(): SceneAnchors {
    const project = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(this.camera);
      return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height };
    };
    const ground = project(this.truckX, 0, this.truckZ - 2.5);
    const oneUp = project(this.truckX, 1, this.truckZ - 2.5);
    const roof = project(this.truckX, 3.9, this.truckZ + 1.2);
    const exhaust = project(this.truckX - 1.32, 3.5, this.truckZ + 0.42);
    const hit = project(this.truckX, 1.5, this.truckZ - 3);
    return {
      groundX: ground.x, groundY: ground.y,
      roofX: roof.x, roofY: roof.y,
      exhaustX: exhaust.x, exhaustY: exhaust.y,
      hitX: hit.x, hitY: hit.y,
      pxPerM: Math.abs(oneUp.y - ground.y),
    };
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          for (const value of Object.values(mat)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          mat.dispose();
        }
      }
    });
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}