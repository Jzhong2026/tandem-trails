import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RallyObstacle, RallyRun } from '../shared/knowledge-rally.js';
import { buildRallyVehicle } from './rally-vehicle.js';
import type { RallyVehicleRig } from './rally-vehicle.js';

const LANE_WIDTH = 3.5;
const ROAD_WIDTH = 11.4;

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseTexture(base: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const random = seeded(seed);
  for (let i = 0; i < 9000; i++) {
    const shade = random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.02 + random() * 0.07})`;
    const size = 0.5 + random() * 1.6;
    ctx.fillRect(random() * 256, random() * 256, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function labelTexture(text: string, accent: string, sub = ''): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#111a25';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.strokeRect(8, 8, 1008, 240);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8f4e8';
  ctx.font = '900 104px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(text, 512, sub ? 102 : 130);
  if (sub) {
    ctx.fillStyle = accent;
    ctx.font = '700 34px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(sub, 512, 192);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,246,196,0.95)');
  gradient.addColorStop(0.2, 'rgba(255,222,132,0.55)');
  gradient.addColorStop(1, 'rgba(255,210,110,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export class RallyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  private vehicle: RallyVehicleRig;
  private run: RallyRun;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private environment: THREE.Texture;
  private wheelSpin = 0;
  private lastLane = 1;
  private bodyRoll = 0;
  private dust: THREE.Points;
  private dustPositions: Float32Array;
  private dustLife: Float32Array;
  private time = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, run: RallyRun) {
    this.run = run;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = run.level.theme === 'night' ? 0.88 : 1.05;
    this.scene.background = new THREE.Color(run.level.sky);
    this.scene.fog = new THREE.Fog(run.level.fog, run.level.biome === 'night' ? 80 : 120, run.level.biome === 'night' ? 330 : 460);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = run.level.theme === 'night' ? 0.18 : 0.42;

    this.hemi = new THREE.HemisphereLight(run.level.sky, run.level.ground, run.level.theme === 'night' ? 0.55 : 1.35);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(run.level.sun, run.level.theme === 'night' ? 0.65 : 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 28, bottom: -18, near: 1, far: 110 });
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);

    this.buildSky();
    this.buildGroundAndRoad();
    this.buildZones();
    this.buildRoadFurniture();
    this.buildScenery();
    this.buildMountains();
    this.buildGates();
    this.buildObstacles(run.obstacles);
    if (run.level.biome === 'night') this.buildNightDetails();

    this.vehicle = buildRallyVehicle(run.vehicle);
    this.vehicle.group.traverse(object => {
      if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    this.scene.add(this.vehicle.group);

    const dustGeometry = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(90 * 3);
    this.dustLife = new Float32Array(90);
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
      color: run.level.biome === 'snow' ? '#f4fbff' : '#c7b28d', size: 0.38, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.setSize(canvas.clientWidth || 960, canvas.clientHeight || 540);
  }

  private buildSky() {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(this.run.level.sky) },
        bottomColor: { value: new THREE.Color(this.run.level.fog) },
      },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){ float h=normalize(vWorld).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),0.55),0.0)),1.0); }',
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), material);
    sky.position.z = -this.run.level.length / 2;
    this.scene.add(sky);
    if (this.run.level.theme !== 'night') {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: this.run.level.sun, transparent: true, opacity: 0.72, depthWrite: false }));
      sun.position.set(-170, 135, -this.run.level.length * 0.72);
      sun.scale.set(85, 85, 1);
      this.scene.add(sun);
    }
  }

  private buildGroundAndRoad() {
    const { level } = this.run;
    const length = level.length + 700;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, length),
      new THREE.MeshStandardMaterial({ color: level.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, -length / 2 + 250);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadTexture = noiseTexture(level.road, level.seed);
    roadTexture.repeat.set(2, length / 18);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, length),
      new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.93, metalness: 0.02 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -length / 2 + 250);
    road.receiveShadow = true;
    this.scene.add(road);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, length),
        new THREE.MeshStandardMaterial({ color: level.biome === 'snow' ? '#b7c1c5' : '#77756d', roughness: 1 }),
      );
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(side * (ROAD_WIDTH / 2 + 0.7), -0.015, -length / 2 + 250);
      shoulder.receiveShadow = true;
      this.scene.add(shoulder);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.025, length),
        new THREE.MeshStandardMaterial({ color: '#f3efe1', roughness: 0.8 }),
      );
      edge.position.set(side * (ROAD_WIDTH / 2 - 0.25), 0.025, -length / 2 + 250);
      this.scene.add(edge);
    }
  }

  private buildZones() {
    const colors = { sand: '#d7a45d', ice: '#9de7ff', boost: '#ffd95a' };
    for (const zone of this.run.level.zones) {
      const length = zone.to - zone.from;
      const material = new THREE.MeshStandardMaterial({
        color: colors[zone.kind],
        transparent: true,
        opacity: zone.kind === 'ice' ? 0.42 : 0.34,
        roughness: zone.kind === 'ice' ? 0.18 : 0.9,
        emissive: zone.kind === 'boost' ? colors[zone.kind] : '#000000',
        emissiveIntensity: zone.kind === 'boost' ? 0.35 : 0,
        depthWrite: false,
      });
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, length), material);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.045, -(zone.from + zone.to) / 2);
      this.scene.add(strip);
      if (zone.kind === 'boost') {
        for (let distance = zone.from + 12; distance < zone.to; distance += 22) {
          const chevron = new THREE.Mesh(
            new THREE.BoxGeometry(ROAD_WIDTH * 0.62, 0.035, 1.4),
            new THREE.MeshBasicMaterial({ color: colors.boost, transparent: true, opacity: 0.75 }),
          );
          chevron.position.set(0, 0.075, -distance);
          this.scene.add(chevron);
        }
      }
    }
  }

  private buildRoadFurniture() {
    const { level } = this.run;
    const length = level.length + 600;
    const random = seeded(level.seed + 91);
    const dashCount = Math.floor(length / 12);
    const dashes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.15, 0.025, 5),
      new THREE.MeshStandardMaterial({ color: '#eee9d8', roughness: 0.8 }),
      dashCount * 2,
    );
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (let i = 0; i < dashCount; i++) {
      for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
        matrix.makeTranslation(x, 0.025, 240 - i * 12);
        dashes.setMatrixAt(index++, matrix);
      }
    }
    dashes.receiveShadow = true;
    this.scene.add(dashes);

    const curbCount = Math.floor(length / 6);
    const curbs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.42, 0.12, 5.8),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }),
      curbCount * 2,
    );
    const red = new THREE.Color('#c84438');
    const white = new THREE.Color('#f1eee4');
    index = 0;
    for (let i = 0; i < curbCount; i++) {
      for (const side of [-1, 1]) {
        matrix.makeTranslation(side * (ROAD_WIDTH / 2 + 0.12), 0.03, 240 - i * 6);
        curbs.setMatrixAt(index, matrix);
        curbs.setColorAt(index++, i % 2 === 0 ? red : white);
      }
    }
    this.scene.add(curbs);

    const railMaterial = new THREE.MeshStandardMaterial({ color: '#9ba5aa', metalness: 0.72, roughness: 0.42 });
    const postCount = Math.floor(length / 12);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), railMaterial, postCount * 2);
    index = 0;
    for (let i = 0; i < postCount; i++) {
      for (const side of [-1, 1]) {
        matrix.makeTranslation(side * 6.65, 0.45, 240 - i * 12);
        posts.setMatrixAt(index++, matrix);
      }
    }
    posts.castShadow = true;
    this.scene.add(posts);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.25, length), railMaterial);
      rail.position.set(side * 6.65, 0.78, -length / 2 + 250);
      rail.castShadow = true;
      this.scene.add(rail);
    }

    if (level.biome !== 'night') {
      const cloudTexture = glowTexture();
      for (let i = 0; i < 26; i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, color: '#ffffff', transparent: true, opacity: 0.13 + random() * 0.13, depthWrite: false }));
        sprite.position.set((random() - 0.5) * 500, 55 + random() * 90, 100 - random() * (level.length + 500));
        sprite.scale.set(70 + random() * 90, 24 + random() * 28, 1);
        this.scene.add(sprite);
      }
    }
  }

  private buildScenery() {
    const { level } = this.run;
    const random = seeded(level.seed + 17);
    const count = level.biome === 'desert' ? 170 : 300;
    const tree = level.biome !== 'desert';
    const trunk = tree ? new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: '#5a4430', roughness: 1 }),
      count,
    ) : null;
    const crown = tree ? new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.1, 6.8, 7),
      new THREE.MeshStandardMaterial({ color: level.biome === 'snow' ? '#496454' : '#244f3b', roughness: 1 }),
      count,
    ) : null;
    const rocks = !tree ? new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: level.biome === 'snow' ? '#9ba8ad' : '#9b6847', roughness: 1 }),
      count,
    ) : null;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const side = random() < 0.5 ? -1 : 1;
      const distance = random() * (level.length + 500);
      const offset = 10 + Math.pow(random(), 1.5) * 105;
      const size = 0.65 + random() * 1.65;
      position.set(side * offset, 0, 240 - distance);
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI, 0));
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale);
      if (trunk && crown) {
        trunk.setMatrixAt(i, matrix);
        position.y = 1.6 * size;
        matrix.compose(position, quaternion, scale);
        crown.setMatrixAt(i, matrix);
      } else if (rocks) {
        position.y = 0.7 * size;
        scale.set(size * 1.8, size * 0.85, size * 1.3);
        matrix.compose(position, quaternion, scale);
        rocks.setMatrixAt(i, matrix);
      }
    }
    if (trunk) { trunk.castShadow = true; this.scene.add(trunk); }
    if (crown) { crown.castShadow = true; this.scene.add(crown); }
    if (rocks) { rocks.castShadow = true; rocks.receiveShadow = true; this.scene.add(rocks); }

    if (level.biome === 'snow') {
      const snowCaps = new THREE.InstancedMesh(
        new THREE.ConeGeometry(1.4, 2.3, 7),
        new THREE.MeshStandardMaterial({ color: '#edf5f5', roughness: 0.92 }),
        count,
      );
      for (let i = 0; i < count; i++) {
        crown!.getMatrixAt(i, matrix);
        const p = new THREE.Vector3().setFromMatrixPosition(matrix);
        const s = new THREE.Vector3().setFromMatrixScale(matrix);
        p.y += 2.2 * s.y;
        matrix.compose(p, quaternion, s);
        snowCaps.setMatrixAt(i, matrix);
      }
      snowCaps.castShadow = true;
      this.scene.add(snowCaps);
    }
  }

  private buildMountains() {
    const { level } = this.run;
    const random = seeded(level.seed + 303);
    const material = new THREE.MeshStandardMaterial({ color: level.biome === 'desert' ? '#805844' : '#667c83', roughness: 1 });
    const snowMaterial = new THREE.MeshStandardMaterial({ color: '#e4edef', roughness: 1 });
    for (let i = 0; i < 42; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const radius = 28 + random() * 55;
      const height = 35 + random() * 85;
      const segments = 9 + Math.floor(random() * 4);
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), material);
      mountain.position.set(side * (85 + random() * 170), height / 2 - 4, 150 - random() * (level.length + 600));
      mountain.rotation.y = random() * Math.PI;
      mountain.castShadow = true;
      this.scene.add(mountain);
      if (level.biome === 'snow') {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.36, height * 0.3, segments), snowMaterial);
        cap.position.copy(mountain.position);
        cap.position.y += height * 0.35;
        cap.rotation.y = mountain.rotation.y;
        this.scene.add(cap);
      }
    }
  }

  private buildGates() {
    this.run.level.checkpoints.forEach((distance, index) => this.buildGate(distance, `知识补给站 ${index + 1}`, '答对问题 · 积攒能量', this.run.level.accent));
    this.buildGate(this.run.level.length, '终点', 'FINISH', this.run.level.accent, true);
  }

  private buildGate(distance: number, title: string, subtitle: string, accent: string, finish = false) {
    const group = new THREE.Group();
    group.position.z = -distance;
    const metal = new THREE.MeshStandardMaterial({ color: '#26313a', metalness: 0.55, roughness: 0.45 });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, finish ? 7 : 5.8, 0.55), metal);
      pillar.position.set(side * 6.2, finish ? 3.5 : 2.9, 0);
      pillar.castShadow = true;
      group.add(pillar);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), metal);
      foot.position.set(side * 6.2, 0.18, 0);
      group.add(foot);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(12.9, finish ? 1.8 : 1.55, 0.28),
      new THREE.MeshStandardMaterial({ map: labelTexture(title, accent, subtitle), roughness: 0.65 }),
    );
    banner.position.y = finish ? 6.3 : 5.1;
    banner.castShadow = true;
    group.add(banner);
    if (finish) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(11.2, 1.5),
        new THREE.MeshStandardMaterial({ map: labelTexture('FINISH', accent), roughness: 0.8 }),
      );
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.035;
      group.add(line);
    }
    this.scene.add(group);
  }

  private buildObstacles(obstacles: RallyObstacle[]) {
    const coneMaterial = new THREE.MeshStandardMaterial({ color: '#ef6a32', roughness: 0.7 });
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: '#f2eee4', roughness: 0.75 });
    const barrierMaterial = new THREE.MeshStandardMaterial({ color: '#e5e8e5', roughness: 0.75 });
    const redMaterial = new THREE.MeshStandardMaterial({ color: '#c53d32', roughness: 0.75 });
    const crateMaterial = new THREE.MeshStandardMaterial({ color: '#9b6a3e', roughness: 0.95 });
    for (const obstacle of obstacles) {
      const group = new THREE.Group();
      group.position.set((obstacle.lane - 1) * LANE_WIDTH, 0, -obstacle.distance);
      if (obstacle.kind === 'cone') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8), coneMaterial);
        base.position.y = 0.05;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.05, 12), coneMaterial);
        cone.position.y = 0.58;
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.18, 12), whiteMaterial);
        stripe.position.y = 0.62;
        group.add(base, cone, stripe);
      } else if (obstacle.kind === 'barrier') {
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.65, 0.28), barrierMaterial);
        board.position.y = 0.85;
        for (let i = 0; i < 5; i++) {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.66, 0.3), redMaterial);
          stripe.position.set(-1 + i * 0.5, 0.85, 0);
          stripe.rotation.z = -0.32;
          group.add(stripe);
        }
        for (const x of [-0.9, 0.9]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), barrierMaterial);
          leg.position.set(x, 0.55, 0);
          group.add(leg);
        }
        group.add(board);
      } else {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), crateMaterial);
        crate.position.y = 0.68;
        crate.rotation.y = 0.18;
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.13, 1.4), whiteMaterial);
        band.position.y = 0.68;
        band.rotation.y = 0.18;
        group.add(crate, band);
      }
      group.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      this.scene.add(group);
    }
  }

  private buildNightDetails() {
    const random = seeded(this.run.level.seed + 777);
    const positions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      positions[i * 3] = (random() - 0.5) * 650;
      positions[i * 3 + 1] = 70 + random() * 260;
      positions[i * 3 + 2] = 150 - random() * (this.run.level.length + 500);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#dbe8ff', size: 0.7, transparent: true, opacity: 0.85 })));

    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#3d4851', metalness: 0.65, roughness: 0.5 });
    const bulbMaterial = new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffe4a3', emissiveIntensity: 3 });
    const glow = glowTexture();
    for (let distance = 60; distance < this.run.level.length + 200; distance += 55) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.Group();
        lamp.position.set(side * 7.2, 0, -distance);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 8, 8), poleMaterial);
        pole.position.y = 4;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMaterial);
        arm.position.set(-side * 0.7, 7.9, 0);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bulbMaterial);
        bulb.position.set(-side * 1.35, 7.75, 0);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0.5, depthWrite: false }));
        sprite.position.copy(bulb.position);
        sprite.scale.set(4.5, 4.5, 1);
        lamp.add(pole, arm, bulb, sprite);
        this.scene.add(lamp);
      }
    }
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(run: RallyRun, dt: number) {
    if (this.disposed) return;
    this.run = run;
    this.time += dt;
    const carX = (run.laneVisual - 1) * LANE_WIDTH;
    const carZ = -run.distance;
    const isTruck = run.vehicle.kind === 'truck';
    this.vehicle.group.position.set(carX, 0.02, carZ);
    const laneVelocity = run.laneVisual - this.lastLane;
    this.bodyRoll += ((-laneVelocity * 2.4) - this.bodyRoll) * Math.min(1, dt * 8);
    this.vehicle.group.rotation.set(run.boostMs > 0 ? -0.012 : 0, -laneVelocity * 1.8, this.bodyRoll);
    this.lastLane = run.laneVisual;
    this.vehicle.group.visible = !(run.invulnMs > 0 && Math.floor(this.time * 14) % 2 === 0);

    this.wheelSpin += run.speed * dt / run.vehicle.wheelRadius;
    for (const wheel of this.vehicle.wheels) wheel.rotation.x = -this.wheelSpin;
    for (const wheel of this.vehicle.frontWheels) wheel.rotation.y = (run.lane - run.laneVisual) * -0.32;
    this.vehicle.brakeMaterial.emissiveIntensity = run.phase === 'quiz' ? 2.2 : 0.55;
    for (const light of this.vehicle.headlights) light.intensity = run.level.theme === 'night' ? 75 : 8;

    const cameraHeight = isTruck ? 5.3 : 3.65;
    const cameraBack = isTruck ? 11.5 : 8.1;
    const shake = run.invulnMs > 0 ? Math.sin(this.time * 65) * 0.055 : 0;
    this.camera.position.set(carX * 0.48 + shake, cameraHeight + Math.sin(this.time * 8) * Math.min(run.speed / 1000, 0.025), carZ + cameraBack);
    this.camera.lookAt(carX * 0.68, isTruck ? 1.9 : 1.05, carZ - (isTruck ? 18 : 13));
    this.camera.fov += ((run.boostMs > 0 ? 70 : 62) - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    this.sun.position.set(carX - 35, 55, carZ + 25);
    this.sun.target.position.set(carX, 0, carZ - 20);
    this.sun.target.updateMatrixWorld();
    this.updateDust(run, carX, carZ, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateDust(run: RallyRun, carX: number, carZ: number, dt: number) {
    for (let i = 0; i < this.dustLife.length; i++) {
      if (this.dustLife[i] <= 0) continue;
      this.dustLife[i] -= dt;
      this.dustPositions[i * 3 + 1] += dt * 0.7;
      this.dustPositions[i * 3 + 2] += dt * 3;
      if (this.dustLife[i] <= 0) this.dustPositions[i * 3 + 1] = -50;
    }
    if (run.phase === 'driving' && run.speed > 5 && Math.random() < dt * (run.boostMs > 0 ? 55 : 20)) {
      const index = this.dustLife.findIndex(life => life <= 0);
      if (index >= 0) {
        this.dustLife[index] = 0.6 + Math.random() * 0.5;
        this.dustPositions[index * 3] = carX + (Math.random() < 0.5 ? -0.8 : 0.8);
        this.dustPositions[index * 3 + 1] = 0.2;
        this.dustPositions[index * 3 + 2] = carZ + run.vehicle.bodyLength * 0.42;
      }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
        if ('geometry' in object && object.geometry) object.geometry.dispose();
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    this.environment.dispose();
    this.renderer.dispose();
  }
}
