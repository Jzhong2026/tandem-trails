import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { RallyVehicle } from '../shared/knowledge-rally.js';

export interface RallyVehicleRig {
  group: THREE.Group;
  paint: THREE.MeshPhysicalMaterial;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  headlights: THREE.SpotLight[];
  brakeMaterial: THREE.MeshStandardMaterial;
  exhaustPoints: THREE.Vector3[];
}

type Vec3 = readonly [number, number, number];
type WheelStyle = 'rally' | 'sport' | 'truck';
type TruckStyle = 'scania' | 'volvo' | 'man';

interface LoftSection {
  z: number;
  bottom: number;
  top: number;
  bottomWidth: number;
  shoulderWidth: number;
  topWidth: number;
}

interface VehicleMaterials {
  paint: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  tread: THREE.MeshStandardMaterial;
  alloy: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  tintedGlass: THREE.MeshPhysicalMaterial;
  headlight: THREE.MeshStandardMaterial;
  brake: THREE.MeshStandardMaterial;
  amber: THREE.MeshStandardMaterial;
}

function loftGeometry(sections: LoftSection[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const ringSize = 6;

  for (const section of sections) {
    const shoulderY = section.bottom + (section.top - section.bottom) * 0.28;
    const ring: Vec3[] = [
      [-section.bottomWidth / 2, section.bottom, section.z],
      [section.bottomWidth / 2, section.bottom, section.z],
      [section.shoulderWidth / 2, shoulderY, section.z],
      [section.topWidth / 2, section.top, section.z],
      [-section.topWidth / 2, section.top, section.z],
      [-section.shoulderWidth / 2, shoulderY, section.z],
    ];
    for (const point of ring) positions.push(...point);
  }

  for (let section = 0; section < sections.length - 1; section++) {
    for (let edge = 0; edge < ringSize; edge++) {
      const next = (edge + 1) % ringSize;
      const a = section * ringSize + edge;
      const b = section * ringSize + next;
      const c = (section + 1) * ringSize + next;
      const d = (section + 1) * ringSize + edge;
      indices.push(a, b, c, a, c, d);
    }
  }

  const frontCenter = positions.length / 3;
  positions.push(0, sections[0].bottom + (sections[0].top - sections[0].bottom) / 2, sections[0].z);
  const rearCenter = positions.length / 3;
  const last = sections[sections.length - 1];
  positions.push(0, last.bottom + (last.top - last.bottom) / 2, last.z);
  for (let edge = 0; edge < ringSize; edge++) {
    const next = (edge + 1) % ringSize;
    indices.push(frontCenter, next, edge);
    const offset = (sections.length - 1) * ringSize;
    indices.push(rearCenter, offset + edge, offset + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function quadGeometry(points: readonly [Vec3, Vec3, Vec3, Vec3]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

class VehicleBuilder {
  readonly group = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  readonly frontWheels: THREE.Group[] = [];
  readonly headlights: THREE.SpotLight[] = [];
  readonly exhaustPoints: THREE.Vector3[] = [];
  readonly brakeMaterial: THREE.MeshStandardMaterial;
  readonly materials: VehicleMaterials;

  constructor(private readonly vehicle: RallyVehicle) {
    this.group.name = `rally-vehicle-${vehicle.id}`;
    const truck = vehicle.kind === 'truck';
    const paint = new THREE.MeshPhysicalMaterial({
      color: vehicle.color,
      metalness: truck ? 0.32 : vehicle.kind === 'sport' ? 0.55 : 0.38,
      roughness: truck ? 0.3 : vehicle.kind === 'sport' ? 0.2 : 0.26,
      clearcoat: 1,
      clearcoatRoughness: truck ? 0.16 : 0.08,
      envMapIntensity: 1.25,
    });
    const accent = new THREE.MeshPhysicalMaterial({
      color: vehicle.accent,
      metalness: 0.28,
      roughness: 0.3,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    const dark = new THREE.MeshStandardMaterial({ color: '#14191f', metalness: 0.25, roughness: 0.68 });
    const carbon = new THREE.MeshStandardMaterial({ color: '#20262c', metalness: 0.5, roughness: 0.38 });
    const tire = new THREE.MeshStandardMaterial({ color: '#171a1e', roughness: 0.96 });
    const tread = new THREE.MeshStandardMaterial({ color: '#24282c', roughness: 0.92 });
    const alloy = new THREE.MeshStandardMaterial({ color: '#aeb7bf', metalness: 0.92, roughness: 0.3 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#e2e8ec', metalness: 1, roughness: 0.18 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#a8d5e5', metalness: 0.05, roughness: 0.08, transmission: 0.2,
      transparent: true, opacity: 0.5, ior: 1.45, thickness: 0.04,
      clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
    });
    const tintedGlass = new THREE.MeshPhysicalMaterial({
      color: '#172d3b', metalness: 0.12, roughness: 0.12, transmission: 0.08,
      transparent: true, opacity: 0.82, ior: 1.5, thickness: 0.05,
      clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
    });
    const headlight = new THREE.MeshStandardMaterial({
      color: '#e8f2f7', emissive: '#fff1cf', emissiveIntensity: 0.85, roughness: 0.2,
    });
    const brake = new THREE.MeshStandardMaterial({
      color: '#7d1018', emissive: '#ff241c', emissiveIntensity: 1.35, roughness: 0.32,
    });
    const amber = new THREE.MeshStandardMaterial({
      color: '#a45b12', emissive: '#ff9d32', emissiveIntensity: 1.1, roughness: 0.35,
    });
    this.brakeMaterial = brake;
    this.materials = {
      paint, accent, dark, carbon, tire, tread, alloy, chrome,
      glass, tintedGlass, headlight, brake, amber,
    };
  }

  part(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  box(w: number, h: number, d: number, material: THREE.Material, position: Vec3, rotation: Vec3 = [0, 0, 0]) {
    return this.part(new THREE.BoxGeometry(w, h, d), material, ...position, ...rotation);
  }

  roundedBox(w: number, h: number, d: number, radius: number, material: THREE.Material, position: Vec3) {
    return this.part(new RoundedBoxGeometry(w, h, d, 3, radius), material, ...position);
  }

  panel(points: readonly [Vec3, Vec3, Vec3, Vec3], material: THREE.Material) {
    return this.part(quadGeometry(points), material, 0, 0, 0);
  }

  beam(start: Vec3, end: Vec3, thickness: number, material: THREE.Material, depth = thickness) {
    const from = new THREE.Vector3(...start);
    const direction = new THREE.Vector3(...end).sub(from);
    const mesh = this.part(new THREE.BoxGeometry(thickness, direction.length(), depth), material, 0, 0, 0);
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  label(text: string, width: number, height: number, position: Vec3, rotation: Vec3, color = '#f4f7f9') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let fontSize = 84;
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    const textWidth = ctx.measureText(text).width;
    if (textWidth > 476) {
      fontSize = Math.floor(fontSize * 476 / textWidth);
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({
      map: texture, transparent: true, alphaTest: 0.04, depthWrite: false,
      metalness: 0.25, roughness: 0.42, side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    material.userData.textures = [texture];
    this.part(new THREE.PlaneGeometry(width, height), material, ...position, ...rotation);
  }

  wheel(x: number, z: number, radius: number, width: number, steer: boolean, style: WheelStyle, dual = false) {
    const steering = new THREE.Group();
    steering.position.set(x, radius, z);
    const spin = new THREE.Group();
    steering.add(spin);
    this.group.add(steering);
    this.wheels.push(spin);
    if (steer) this.frontWheels.push(steering);

    const side = Math.sign(x);
    const offsets = dual ? [-width * 0.24, width * 0.24] : [0];
    const tireWidth = dual ? width * 0.48 : width;
    const rimRatio = style === 'sport' ? 0.68 : style === 'truck' ? 0.57 : 0.61;
    const spokes = style === 'sport' ? 10 : style === 'truck' ? 8 : 6;
    const treadCount = style === 'truck' ? 22 : 18;
    const treadRadius = radius * (1 - 0.0275);

    for (const offset of offsets) {
      const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, tireWidth, 28), this.materials.tire);
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.position.x = offset;
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;
      spin.add(tireMesh);

      for (let index = 0; index < treadCount; index++) {
        const angle = index / treadCount * Math.PI * 2;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(tireWidth * 0.9, radius * 0.055, radius * 0.17),
          this.materials.tread,
        );
        block.position.set(offset, Math.cos(angle) * treadRadius, Math.sin(angle) * treadRadius);
        block.rotation.x = angle;
        block.castShadow = true;
        spin.add(block);
      }

      const face = side * (offset + Math.sign(offset || side) * (tireWidth / 2 + 0.008));
      const sidewall = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, radius * 0.17, 7, 24), this.materials.tire);
      sidewall.rotation.y = Math.PI / 2;
      sidewall.position.x = face;
      sidewall.castShadow = true;
      spin.add(sidewall);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * rimRatio, radius * rimRatio, 0.035, 24), this.materials.alloy);
      rim.rotation.z = Math.PI / 2;
      rim.position.x = face + side * 0.012;
      rim.castShadow = true;
      spin.add(rim);

      const rimRing = new THREE.Mesh(new THREE.TorusGeometry(radius * rimRatio, radius * 0.035, 7, 24), this.materials.chrome);
      rimRing.rotation.y = Math.PI / 2;
      rimRing.position.x = face + side * 0.034;
      spin.add(rimRing);

      for (let index = 0; index < spokes; index++) {
        const angle = index / spokes * Math.PI * 2;
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, radius * rimRatio * 0.82, radius * (style === 'sport' ? 0.045 : 0.075)),
          this.materials.chrome,
        );
        spoke.position.set(
          face + side * 0.038,
          Math.cos(angle) * radius * rimRatio * 0.43,
          Math.sin(angle) * radius * rimRatio * 0.43,
        );
        spoke.rotation.x = angle;
        spoke.castShadow = true;
        spin.add(spoke);
      }

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 0.07, 16), this.materials.dark);
      hub.rotation.z = Math.PI / 2;
      hub.position.x = face + side * 0.055;
      hub.castShadow = true;
      spin.add(hub);
    }
  }

  headlight(x: number, y: number, z: number, width: number, height: number) {
    this.roundedBox(width + 0.035, height + 0.035, 0.075, 0.018, this.materials.dark, [x, y, z + 0.025]);
    this.box(width, height, 0.035, this.materials.headlight, [x, y, z - 0.025]);
    const spot = new THREE.SpotLight('#fff0cd', 0, 45, 0.34, 0.58, 1.4);
    spot.name = 'rally-headlight';
    spot.position.set(x, y, z - 0.08);
    spot.target.position.set(x * 1.08, 0.05, z - 28);
    spot.castShadow = false;
    this.group.add(spot, spot.target);
    this.headlights.push(spot);
  }

  taillight(x: number, y: number, z: number, width: number, height: number) {
    this.roundedBox(width + 0.025, height + 0.025, 0.055, 0.015, this.materials.dark, [x, y, z - 0.01]);
    this.box(width, height, 0.035, this.materials.brake, [x, y, z + 0.025]);
  }

  result(): RallyVehicleRig {
    return {
      group: this.group,
      paint: this.materials.paint,
      wheels: this.wheels,
      frontWheels: this.frontWheels,
      headlights: this.headlights,
      brakeMaterial: this.brakeMaterial,
      exhaustPoints: this.exhaustPoints,
    };
  }
}

function wheelArches(builder: VehicleBuilder, x: number, z: number, radius: number, painted: boolean) {
  const outer = builder.part(
    new THREE.TorusGeometry(radius * 1.09, radius * 0.075, 7, 28, Math.PI),
    painted ? builder.materials.paint : builder.materials.dark,
    x, radius, z, 0, Math.PI / 2, 0,
  );
  outer.name = 'wheel-arch';
}

function addCarWheels(builder: VehicleBuilder, vehicle: RallyVehicle, style: WheelStyle) {
  const { bodyLength: length, bodyWidth: width, wheelRadius: radius } = vehicle;
  const axle = length * 0.31;
  const track = width - 0.24;
  for (const side of [-1, 1]) {
    builder.wheel(side * track / 2, -axle, radius, style === 'sport' ? 0.29 : 0.26, true, style);
    builder.wheel(side * track / 2, axle, radius, style === 'sport' ? 0.32 : 0.28, false, style);
    wheelArches(builder, side * (width / 2 + 0.005), -axle, radius, true);
    wheelArches(builder, side * (width / 2 + 0.005), axle, radius, true);
  }
}

function buildComet(builder: VehicleBuilder, vehicle: RallyVehicle) {
  const { bodyLength: length, bodyWidth: width, bodyHeight: height, wheelRadius: radius } = vehicle;
  const materials = builder.materials;
  const front = -length / 2;
  const rear = length / 2;
  const belt = height * 0.59;

  builder.part(loftGeometry([
    { z: front, bottom: radius * 0.55, top: height * 0.34, bottomWidth: width * 0.87, shoulderWidth: width * 0.91, topWidth: width * 0.8 },
    { z: -length * 0.43, bottom: radius * 0.55, top: height * 0.49, bottomWidth: width * 0.96, shoulderWidth: width * 0.98, topWidth: width * 0.88 },
    { z: -length * 0.22, bottom: radius * 0.55, top: belt, bottomWidth: width, shoulderWidth: width, topWidth: width * 0.93 },
    { z: length * 0.18, bottom: radius * 0.55, top: belt + 0.02, bottomWidth: width, shoulderWidth: width, topWidth: width * 0.94 },
    { z: length * 0.38, bottom: radius * 0.58, top: height * 0.54, bottomWidth: width * 0.97, shoulderWidth: width * 0.97, topWidth: width * 0.89 },
    { z: rear, bottom: radius * 0.62, top: height * 0.44, bottomWidth: width * 0.88, shoulderWidth: width * 0.9, topWidth: width * 0.82 },
  ]), materials.paint, 0, 0, 0);

  const hood = builder.roundedBox(width * 0.86, 0.055, length * 0.29, 0.025, materials.paint, [0, belt - 0.035, -length * 0.32]);
  hood.rotation.x = -0.09;
  for (const side of [-1, 1]) {
    const vent = builder.roundedBox(width * 0.2, 0.022, length * 0.075, 0.012, materials.carbon, [side * width * 0.23, belt + 0.005, -length * 0.245]);
    vent.rotation.x = -0.09;
    for (let index = -1; index <= 1; index++) {
      builder.box(width * 0.16, 0.012, 0.018, materials.alloy, [side * width * 0.23, belt + 0.02, -length * 0.245 + index * 0.055], [-0.09, 0, 0]);
    }
  }

  const roofFront = -length * 0.02;
  const roofRear = length * 0.2;
  builder.panel([
    [-width * 0.42, belt + 0.01, -length * 0.22],
    [width * 0.42, belt + 0.01, -length * 0.22],
    [width * 0.34, height - 0.055, roofFront],
    [-width * 0.34, height - 0.055, roofFront],
  ], materials.glass);
  for (const side of [-1, 1]) {
    builder.panel([
      [side * width * 0.425, belt + 0.015, -length * 0.215],
      [side * width * 0.345, height - 0.06, roofFront + 0.01],
      [side * width * 0.35, height - 0.06, roofRear],
      [side * width * 0.43, belt + 0.02, length * 0.27],
    ], materials.tintedGlass);
    builder.beam([side * width * 0.43, belt, -length * 0.22], [side * width * 0.35, height - 0.025, roofFront], 0.055, materials.paint);
    builder.beam([side * width * 0.35, height - 0.025, roofRear], [side * width * 0.43, belt, length * 0.28], 0.07, materials.paint);
    builder.beam([side * width * 0.43, belt, length * 0.08], [side * width * 0.35, height - 0.025, length * 0.1], 0.06, materials.dark);
    builder.box(0.025, 0.035, 0.17, materials.chrome, [side * (width / 2 + 0.012), belt - 0.11, length * 0.04]);
    builder.box(0.055, 0.09, length * 0.58, materials.accent, [side * (width / 2 + 0.005), radius * 0.82, length * 0.015]);
    builder.beam([side * (width / 2 + 0.012), radius * 0.62, -length * 0.18], [side * (width / 2 + 0.012), belt - 0.03, -length * 0.18], 0.012, materials.dark);
    builder.beam([side * (width / 2 + 0.012), radius * 0.62, length * 0.19], [side * (width / 2 + 0.012), belt - 0.03, length * 0.19], 0.012, materials.dark);
  }
  builder.panel([
    [-width * 0.35, height - 0.055, roofRear],
    [width * 0.35, height - 0.055, roofRear],
    [width * 0.42, belt + 0.025, length * 0.29],
    [-width * 0.42, belt + 0.025, length * 0.29],
  ], materials.tintedGlass);
  builder.roundedBox(width * 0.72, 0.07, length * 0.235, 0.03, materials.accent, [0, height - 0.03, length * 0.09]);

  for (const side of [-1, 1]) {
    builder.beam([side * width * 0.46, belt - 0.03, -length * 0.18], [side * (width / 2 + 0.1), belt + 0.07, -length * 0.17], 0.035, materials.dark);
    builder.roundedBox(0.17, 0.11, 0.23, 0.04, materials.paint, [side * (width / 2 + 0.12), belt + 0.1, -length * 0.17]);
    builder.box(0.02, 0.075, 0.16, materials.tintedGlass, [side * (width / 2 + 0.12), belt + 0.1, -length * 0.17 + 0.12]);
  }

  for (const x of [-0.3, -0.1, 0.1, 0.3]) {
    builder.roundedBox(0.16, 0.1, 0.18, 0.025, materials.dark, [x * width, height + 0.055, roofFront - 0.025]);
    builder.box(0.13, 0.06, 0.025, materials.headlight, [x * width, height + 0.055, roofFront - 0.12]);
  }

  builder.box(width * 0.98, 0.075, 0.27, materials.carbon, [0, radius * 0.58, front - 0.08]);
  builder.box(width * 0.52, 0.17, 0.045, materials.carbon, [0, radius * 1.18, front - 0.015]);
  for (const side of [-1, 1]) {
    builder.box(width * 0.2, 0.14, 0.04, materials.carbon, [side * width * 0.34, radius * 1.15, front - 0.012]);
    builder.headlight(side * width * 0.31, radius * 1.72, front - 0.035, width * 0.22, 0.1);
    builder.box(width * 0.17, 0.025, 0.025, materials.headlight, [side * width * 0.31, radius * 1.9, front - 0.06]);
    builder.box(0.16, 0.035, 0.2, materials.accent, [side * width * 0.47, radius * 0.95, front - 0.1], [0, side * 0.22, 0]);
  }

  for (const side of [-1, 1]) {
    builder.beam([side * width * 0.29, height * 0.55, length * 0.36], [side * width * 0.29, height + 0.08, length * 0.39], 0.045, materials.carbon);
  }
  builder.box(width * 0.94, 0.075, 0.31, materials.accent, [0, height + 0.1, length * 0.39], [-0.08, 0, 0]);
  for (const side of [-1, 1]) {
    builder.box(0.045, 0.19, 0.35, materials.carbon, [side * width * 0.47, height + 0.11, length * 0.39], [-0.08, 0, 0]);
    builder.taillight(side * width * 0.32, radius * 1.78, rear + 0.015, width * 0.19, 0.12);
    const tip = builder.part(new THREE.CylinderGeometry(0.045, 0.052, 0.16, 12), materials.chrome, side * width * 0.27, radius * 0.72, rear + 0.08, Math.PI / 2, 0, 0);
    tip.name = 'exhaust-tip';
    builder.exhaustPoints.push(new THREE.Vector3(side * width * 0.27, radius * 0.72, rear + 0.18));
  }
  builder.box(width * 0.92, 0.18, 0.15, materials.carbon, [0, radius * 0.92, rear + 0.04]);
  builder.label('COMET R4', 0.48, 0.1, [0, radius * 1.25, rear + 0.125], [0, Math.PI, 0], '#e9edf0');
  addCarWheels(builder, vehicle, 'rally');
}

function buildApex(builder: VehicleBuilder, vehicle: RallyVehicle) {
  const { bodyLength: length, bodyWidth: width, bodyHeight: height, wheelRadius: radius } = vehicle;
  const materials = builder.materials;
  const front = -length / 2;
  const rear = length / 2;

  builder.part(loftGeometry([
    { z: front, bottom: radius * 0.55, top: radius * 1.18, bottomWidth: width * 0.9, shoulderWidth: width * 0.96, topWidth: width * 0.78 },
    { z: -length * 0.34, bottom: radius * 0.52, top: radius * 1.72, bottomWidth: width * 0.98, shoulderWidth: width, topWidth: width * 0.86 },
    { z: -length * 0.12, bottom: radius * 0.52, top: height * 0.58, bottomWidth: width, shoulderWidth: width, topWidth: width * 0.9 },
    { z: length * 0.2, bottom: radius * 0.55, top: height * 0.6, bottomWidth: width, shoulderWidth: width * 1.01, topWidth: width * 0.92 },
    { z: length * 0.39, bottom: radius * 0.58, top: radius * 1.65, bottomWidth: width * 0.98, shoulderWidth: width, topWidth: width * 0.88 },
    { z: rear, bottom: radius * 0.62, top: radius * 1.35, bottomWidth: width * 0.9, shoulderWidth: width * 0.94, topWidth: width * 0.8 },
  ]), materials.paint, 0, 0, 0);

  builder.part(loftGeometry([
    { z: front + 0.04, bottom: radius * 1.15, top: radius * 1.3, bottomWidth: width * 0.8, shoulderWidth: width * 0.7, topWidth: width * 0.48 },
    { z: -length * 0.34, bottom: radius * 1.67, top: radius * 1.79, bottomWidth: width * 0.86, shoulderWidth: width * 0.68, topWidth: width * 0.48 },
    { z: -length * 0.13, bottom: height * 0.57, top: height * 0.64, bottomWidth: width * 0.9, shoulderWidth: width * 0.68, topWidth: width * 0.5 },
  ]), materials.paint, 0, 0, 0);

  builder.part(loftGeometry([
    { z: -length * 0.23, bottom: height * 0.55, top: height * 0.6, bottomWidth: width * 0.86, shoulderWidth: width * 0.8, topWidth: width * 0.64 },
    { z: -length * 0.12, bottom: height * 0.57, top: height * 0.76, bottomWidth: width * 0.88, shoulderWidth: width * 0.78, topWidth: width * 0.68 },
    { z: -length * 0.01, bottom: height * 0.59, top: height, bottomWidth: width * 0.88, shoulderWidth: width * 0.76, topWidth: width * 0.65 },
    { z: length * 0.12, bottom: height * 0.59, top: height - 0.015, bottomWidth: width * 0.88, shoulderWidth: width * 0.77, topWidth: width * 0.65 },
    { z: length * 0.25, bottom: height * 0.59, top: height * 0.76, bottomWidth: width * 0.88, shoulderWidth: width * 0.8, topWidth: width * 0.7 },
    { z: length * 0.34, bottom: height * 0.58, top: height * 0.61, bottomWidth: width * 0.86, shoulderWidth: width * 0.82, topWidth: width * 0.72 },
  ]), materials.tintedGlass, 0, 0, 0);

  builder.panel([
    [-width * 0.36, height * 0.61, -length * 0.225],
    [width * 0.36, height * 0.61, -length * 0.225],
    [width * 0.325, height - 0.025, -length * 0.01],
    [-width * 0.325, height - 0.025, -length * 0.01],
  ], materials.glass);
  builder.part(loftGeometry([
    { z: -length * 0.01, bottom: height - 0.06, top: height - 0.005, bottomWidth: width * 0.65, shoulderWidth: width * 0.67, topWidth: width * 0.62 },
    { z: length * 0.055, bottom: height - 0.055, top: height + 0.012, bottomWidth: width * 0.65, shoulderWidth: width * 0.67, topWidth: width * 0.62 },
    { z: length * 0.12, bottom: height - 0.06, top: height - 0.015, bottomWidth: width * 0.65, shoulderWidth: width * 0.67, topWidth: width * 0.62 },
  ]), materials.paint, 0, 0, 0);
  builder.box(width * 0.08, 0.018, length * 0.27, materials.accent, [0, height * 0.645 + 0.012, -length * 0.25], [-0.11, 0, 0]);

  for (const side of [-1, 1]) {
    const x = side * width * 0.2;
    const vent = builder.roundedBox(width * 0.16, 0.025, length * 0.085, 0.012, materials.carbon, [x, height * 0.65, -length * 0.19]);
    vent.rotation.x = -0.1;
    for (let index = -1; index <= 1; index++) {
      builder.box(width * 0.13, 0.012, 0.018, materials.alloy, [x, height * 0.655, -length * 0.19 + index * 0.055], [-0.1, 0, 0]);
    }
    builder.box(0.11, 0.13, length * 0.56, materials.carbon, [side * (width / 2 + 0.005), radius * 0.82, length * 0.015]);
    builder.box(0.12, 0.028, length * 0.54, materials.accent, [side * (width / 2 + 0.012), radius * 0.7, length * 0.015]);
    builder.panel([
      [side * (width / 2 + 0.015), radius * 1.15, length * 0.16],
      [side * (width / 2 + 0.015), radius * 1.75, length * 0.22],
      [side * (width / 2 + 0.015), radius * 1.45, length * 0.36],
      [side * (width / 2 + 0.015), radius * 0.95, length * 0.33],
    ], materials.carbon);
    builder.beam([side * width * 0.42, height * 0.57, -length * 0.18], [side * (width / 2 + 0.1), height * 0.62, -length * 0.16], 0.032, materials.dark);
    builder.roundedBox(0.19, 0.09, 0.22, 0.035, materials.paint, [side * (width / 2 + 0.12), height * 0.64, -length * 0.16]);
    builder.headlight(side * width * 0.3, radius * 1.45, front - 0.02, width * 0.27, 0.065);
    builder.box(width * 0.22, 0.018, 0.022, materials.headlight, [side * width * 0.3, radius * 1.62, front - 0.055]);
    builder.taillight(side * width * 0.34, radius * 1.5, rear + 0.02, width * 0.25, 0.075);
    builder.beam([side * width * 0.31, radius * 1.45, length * 0.35], [side * width * 0.31, height + 0.11, length * 0.37], 0.05, materials.carbon);
    builder.box(0.04, 0.24, 0.43, materials.carbon, [side * width * 0.49, height + 0.12, length * 0.37]);
    const tip = builder.part(new THREE.CylinderGeometry(0.052, 0.058, 0.18, 14), materials.chrome, side * width * 0.23, radius * 0.72, rear + 0.09, Math.PI / 2, 0, 0);
    tip.name = 'exhaust-tip';
    builder.exhaustPoints.push(new THREE.Vector3(side * width * 0.23, radius * 0.72, rear + 0.2));
  }

  builder.box(width * 1.02, 0.065, 0.4, materials.carbon, [0, radius * 0.52, front - 0.1]);
  builder.box(width * 0.62, 0.15, 0.04, materials.carbon, [0, radius * 1.03, front - 0.015]);
  builder.box(width * 0.96, 0.07, 0.4, materials.accent, [0, height + 0.13, length * 0.37], [-0.06, 0, 0]);
  builder.box(width * 0.84, 0.15, 0.16, materials.carbon, [0, radius * 0.78, rear + 0.055]);
  for (const x of [-0.28, -0.14, 0, 0.14, 0.28]) {
    builder.box(0.025, 0.13, 0.32, materials.carbon, [x * width, radius * 0.67, rear + 0.11], [-0.15, 0, 0]);
  }
  builder.label('APEX', 0.4, 0.095, [0, radius * 1.08, rear + 0.145], [0, Math.PI, 0], '#e7f7ff');
  addCarWheels(builder, vehicle, 'sport');
}

function truckGrille(builder: VehicleBuilder, style: TruckStyle, width: number, front: number) {
  const { dark, chrome, alloy } = builder.materials;
  const grilleWidth = style === 'man' ? width * 0.65 : width * 0.6;
  const z = front - 0.115;
  builder.roundedBox(grilleWidth, 0.5, 0.08, 0.035, dark, [0, 1.18, z]);
  if (style === 'scania') {
    for (let index = 0; index < 5; index++) {
      builder.box(grilleWidth * 0.88, 0.035, 0.035, chrome, [0, 0.99 + index * 0.095, z - 0.05]);
    }
    builder.box(0.09, 0.34, 0.04, alloy, [0, 1.18, z - 0.075]);
  } else if (style === 'volvo') {
    builder.beam([-grilleWidth * 0.41, 0.99, z - 0.055], [grilleWidth * 0.41, 1.37, z - 0.055], 0.055, chrome, 0.035);
    builder.beam([-grilleWidth * 0.32, 1.0, z - 0.06], [grilleWidth * 0.5, 1.37, z - 0.06], 0.032, alloy, 0.03);
  } else {
    for (let index = 0; index < 3; index++) {
      builder.box(grilleWidth * 0.86, 0.055, 0.04, chrome, [0, 1.04 + index * 0.14, z - 0.05]);
    }
    builder.box(0.075, 0.42, 0.045, alloy, [0, 1.18, z - 0.07]);
    for (const side of [-1, 1]) {
      builder.beam([side * grilleWidth * 0.44, 0.94, z - 0.045], [side * grilleWidth * 0.5, 1.43, z - 0.045], 0.035, alloy, 0.035);
    }
  }
}

function buildTruck(builder: VehicleBuilder, vehicle: RallyVehicle, style: TruckStyle) {
  const { bodyLength: length, bodyWidth: width, bodyHeight: height, wheelRadius: radius } = vehicle;
  const materials = builder.materials;
  const front = -length / 2;
  const rear = length / 2;
  const cabRear = style === 'volvo' ? length * 0.015 : style === 'scania' ? -length * 0.075 : -length * 0.06;
  const cabLength = cabRear - front;
  const cabMid = (front + cabRear) / 2;

  for (const side of [-1, 1]) {
    builder.box(0.14, 0.24, length * 0.9, materials.dark, [side * width * 0.27, 0.72, 0]);
  }
  for (const z of [-length * 0.32, -length * 0.08, length * 0.25, length * 0.37]) {
    builder.box(width * 0.64, 0.13, 0.14, materials.dark, [0, 0.7, z]);
  }

  builder.roundedBox(width * 0.97, 1.12, cabLength, 0.11, materials.paint, [0, 1.2, cabMid]);
  builder.part(loftGeometry([
    { z: front + 0.055, bottom: 1.5, top: 2.16, bottomWidth: width * 0.94, shoulderWidth: width * 0.96, topWidth: width * 0.78 },
    { z: front + 0.5, bottom: 1.48, top: height - 0.16, bottomWidth: width * 0.98, shoulderWidth: width * 0.94, topWidth: width * 0.76 },
    { z: cabRear - 0.42, bottom: 1.5, top: height - 0.1, bottomWidth: width * 0.98, shoulderWidth: width * 0.96, topWidth: width * 0.8 },
    { z: cabRear, bottom: 1.5, top: height - 0.32, bottomWidth: width * 0.95, shoulderWidth: width * 0.94, topWidth: width * 0.77 },
  ]), materials.paint, 0, 0, 0);

  builder.panel([
    [-width * 0.37, 1.83, front + 0.13],
    [width * 0.37, 1.83, front + 0.13],
    [width * 0.35, height - 0.43, front + 0.51],
    [-width * 0.35, height - 0.43, front + 0.51],
  ], materials.glass);
  builder.box(width * 0.74, 0.045, 0.16, materials.carbon, [0, 1.8, front + 0.1], [-0.12, 0, 0]);

  for (const side of [-1, 1]) {
    builder.panel([
      [side * width * 0.475, 1.82, front + 0.43],
      [side * width * 0.405, height - 0.46, front + 0.51],
      [side * width * 0.415, height - 0.46, cabRear - 0.26],
      [side * width * 0.475, 1.82, cabRear - 0.14],
    ], materials.tintedGlass);
    builder.beam([side * width * 0.477, 1.55, cabRear - 0.18], [side * width * 0.477, height - 0.43, cabRear - 0.18], 0.045, materials.dark);
    builder.box(0.028, 0.075, cabLength * 0.76, materials.accent, [side * width * 0.493, 1.48, cabMid]);
    builder.box(0.035, 0.045, 0.24, materials.chrome, [side * width * 0.497, 1.38, cabMid + 0.35]);
    builder.beam([side * width * 0.48, 2.03, front + 0.33], [side * (width / 2 + 0.23), 2.0, front + 0.27], 0.045, materials.dark);
    builder.roundedBox(0.16, 0.48, 0.25, 0.045, materials.paint, [side * (width / 2 + 0.26), 2.0, front + 0.24]);
    builder.box(0.02, 0.38, 0.18, materials.tintedGlass, [side * (width / 2 + 0.26), 2.0, front + 0.105]);
    for (let step = 0; step < 2; step++) {
      builder.box(0.34, 0.07, 0.56, materials.alloy, [side * (width / 2 + 0.02), 0.48 + step * 0.23, front + 1.15 + step * 0.08]);
    }
  }

  builder.part(loftGeometry([
    { z: front + 0.18, bottom: height - 0.58, top: height - 0.04, bottomWidth: width * 0.8, shoulderWidth: width * 0.82, topWidth: width * 0.69 },
    { z: front + 0.62, bottom: height - 0.53, top: height, bottomWidth: width * 0.84, shoulderWidth: width * 0.84, topWidth: width * 0.72 },
    { z: cabRear - 0.25, bottom: height - 0.5, top: height, bottomWidth: width * 0.85, shoulderWidth: width * 0.85, topWidth: width * 0.73 },
    { z: cabRear + 0.04, bottom: height - 0.56, top: height - 0.2, bottomWidth: width * 0.82, shoulderWidth: width * 0.82, topWidth: width * 0.7 },
  ]), materials.paint, 0, 0, 0);
  builder.box(width * 0.7, 0.025, cabLength * 0.55, materials.accent, [0, height + 0.005, cabMid + 0.12]);

  truckGrille(builder, style, width, front);
  builder.roundedBox(width * 0.98, 0.38, 0.34, 0.07, materials.paint, [0, 0.65, front - 0.06]);
  builder.box(width * 0.9, 0.13, 0.12, materials.dark, [0, 0.47, front - 0.22]);
  for (const side of [-1, 1]) {
    builder.headlight(side * width * 0.35, 0.96, front - 0.18, width * 0.15, 0.16);
    builder.box(0.1, 0.14, 0.04, materials.amber, [side * width * 0.445, 0.98, front - 0.18]);
    builder.box(0.12, 0.09, 0.035, materials.headlight, [side * width * 0.32, 0.51, front - 0.3]);
  }
  const badgeColor = style === 'scania' ? '#f3c64d' : style === 'volvo' ? '#20364b' : '#f7f2e8';
  builder.label(vehicle.make, style === 'man' ? 0.72 : 1.02, 0.2, [0, 1.66, front - 0.13], [0, Math.PI, 0], badgeColor);
  for (const side of [-1, 1]) {
    builder.label(vehicle.make, 0.88, 0.17, [side * width * 0.502, 1.72, cabMid + 0.45], [0, side * Math.PI / 2, 0], badgeColor);
  }

  for (const side of [-1, 1]) {
    const stackZ = cabRear - 0.32;
    const stackHeight = height - 1.02;
    builder.part(new THREE.CylinderGeometry(0.06, 0.065, stackHeight, 12), materials.chrome, side * width * 0.47, 0.9 + stackHeight / 2, stackZ);
    builder.part(new THREE.CylinderGeometry(0.095, 0.095, stackHeight * 0.58, 12), materials.dark, side * width * 0.47, 1.05 + stackHeight * 0.29, stackZ);
    builder.part(new THREE.CylinderGeometry(0.085, 0.07, 0.09, 12), materials.dark, side * width * 0.47, height - 0.08, stackZ);
    builder.exhaustPoints.push(new THREE.Vector3(side * width * 0.47, height - 0.02, stackZ));

    builder.part(new THREE.CylinderGeometry(0.25, 0.25, 1.25, 18), materials.alloy, side * width * 0.36, 0.73, cabRear + 0.5, Math.PI / 2, 0, 0);
    for (const offset of [-0.38, 0.38]) {
      builder.box(0.055, 0.56, 0.075, materials.dark, [side * width * 0.36, 0.73, cabRear + 0.5 + offset]);
    }
    builder.roundedBox(0.5, 0.42, 0.8, 0.06, materials.dark, [side * width * 0.29, 0.75, front + 0.75]);
  }

  const cargoStart = cabRear + 0.12;
  const cargoEnd = length * (style === 'scania' ? 0.4 : style === 'volvo' ? 0.49 : 0.47);
  const cargoLength = cargoEnd - cargoStart;
  const cargoBottom = 1.02;
  const cargoTop = height - 0.2;
  const cargoMid = (cargoStart + cargoEnd) / 2;
  const cargoPanel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(vehicle.color).multiplyScalar(style === 'volvo' ? 0.84 : 0.62),
    metalness: 0.25, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25,
  });
  builder.roundedBox(width * 0.95, cargoTop - cargoBottom, cargoLength, 0.075, materials.paint, [0, (cargoBottom + cargoTop) / 2, cargoMid]);
  for (const side of [-1, 1]) {
    builder.box(0.025, (cargoTop - cargoBottom) * 0.78, cargoLength * 0.9, cargoPanel, [side * width * 0.478, (cargoBottom + cargoTop) / 2 + 0.04, cargoMid]);
    builder.box(0.032, 0.09, cargoLength * 0.92, materials.accent, [side * width * 0.493, cargoBottom + 0.26, cargoMid]);
    for (let index = 0; index < 5; index++) {
      const z = cargoStart + cargoLength * (0.12 + index * 0.19);
      builder.box(0.025, (cargoTop - cargoBottom) * 0.72, 0.035, materials.accent, [side * width * 0.497, (cargoBottom + cargoTop) / 2 + 0.06, z]);
    }
  }

  if (cargoEnd < rear - 0.12) {
    builder.part(loftGeometry([
      { z: cargoEnd, bottom: 1.08, top: cargoTop, bottomWidth: width * 0.92, shoulderWidth: width * 0.94, topWidth: width * 0.84 },
      { z: rear - 0.28, bottom: 1.1, top: height * 0.78, bottomWidth: width * 0.91, shoulderWidth: width * 0.9, topWidth: width * 0.76 },
      { z: rear, bottom: 1.15, top: height * 0.7, bottomWidth: width * 0.87, shoulderWidth: width * 0.86, topWidth: width * 0.7 },
    ]), materials.paint, 0, 0, 0);
  }
  builder.box(width * 0.96, 0.28, 0.22, materials.dark, [0, 0.5, rear + 0.055]);
  builder.box(width * 0.84, 0.12, 0.08, materials.alloy, [0, 0.42, rear + 0.18]);
  for (const side of [-1, 1]) {
    builder.taillight(side * width * 0.36, 0.82, rear + 0.035, 0.17, 0.38);
    builder.box(0.1, 0.12, 0.035, materials.amber, [side * width * 0.44, 0.82, rear + 0.055]);
  }
  builder.label(vehicle.make, 0.86, 0.17, [0, 1.03, rear + 0.19], [0, Math.PI, 0], badgeColor);

  const frontAxle = -length * 0.32;
  const rearAxles = [length * 0.25, length * 0.37];
  const wheelX = width / 2 - 0.32;
  for (const side of [-1, 1]) {
    builder.wheel(side * wheelX, frontAxle, radius, 0.34, true, 'truck');
    wheelArches(builder, side * (width / 2 - 0.015), frontAxle, radius, false);
    for (const z of rearAxles) {
      builder.wheel(side * wheelX, z, radius, 0.5, false, 'truck', true);
      wheelArches(builder, side * (width / 2 - 0.005), z, radius, false);
      builder.box(0.06, radius * 0.85, 0.72, materials.dark, [side * (width / 2 + 0.015), radius * 0.62, z + radius * 0.85]);
    }
    builder.box(0.16, 0.12, rearAxles[1] - rearAxles[0] + 1.2, materials.dark, [side * wheelX, radius * 1.82, (rearAxles[0] + rearAxles[1]) / 2]);
  }

  const markerCount = style === 'volvo' ? 5 : 4;
  for (let index = 0; index < markerCount; index++) {
    const x = (index - (markerCount - 1) / 2) * width * 0.14;
    builder.box(0.11, 0.055, 0.08, materials.amber, [x, height + 0.02, front + 0.72]);
  }
  for (const side of [-1, 1]) {
    builder.part(new THREE.CylinderGeometry(0.055, 0.07, 0.36, 10), materials.chrome, side * width * 0.22, height + 0.14, cabMid + 0.35, Math.PI / 2, 0, 0);
    builder.box(0.07, 0.05, 0.07, materials.amber, [side * width * 0.46, height - 0.38, cabRear - 0.05]);
  }
}

export function buildRallyVehicle(vehicle: RallyVehicle): RallyVehicleRig {
  const builder = new VehicleBuilder(vehicle);
  switch (vehicle.id) {
    case 'apex-gt':
      buildApex(builder, vehicle);
      break;
    case 'scania-s500':
      buildTruck(builder, vehicle, 'scania');
      break;
    case 'volvo-fh16':
      buildTruck(builder, vehicle, 'volvo');
      break;
    case 'man-tgx':
      buildTruck(builder, vehicle, 'man');
      break;
    case 'comet-rally':
    default:
      buildComet(builder, vehicle);
      break;
  }
  return builder.result();
}
