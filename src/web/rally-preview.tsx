import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RallyVehicle } from '../shared/knowledge-rally.js';
import { buildRallyVehicle } from './rally-vehicle.js';

export function RallyVehiclePreview({ vehicle }: { vehicle: RallyVehicle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = environment;
    scene.environmentIntensity = 0.65;
    scene.add(new THREE.HemisphereLight('#cce7ff', '#27311f', 1.8));
    const key = new THREE.DirectionalLight('#fff1d6', 4);
    key.position.set(-5, 9, -6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 35 });
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key);
    const rim = new THREE.DirectionalLight('#70cfff', 2.2);
    rim.position.set(7, 4, 5);
    scene.add(rim);

    const rig = buildRallyVehicle(vehicle);
    rig.group.traverse(object => {
      if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    scene.add(rig.group);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(vehicle.kind === 'truck' ? 6.2 : 4.1, vehicle.kind === 'truck' ? 6.5 : 4.3, 0.18, 64),
      new THREE.MeshStandardMaterial({ color: '#17222c', metalness: 0.35, roughness: 0.6 }),
    );
    platform.position.y = -0.12;
    platform.receiveShadow = true;
    scene.add(platform);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(vehicle.kind === 'truck' ? 6.15 : 4.05, 0.025, 8, 80),
      new THREE.MeshBasicMaterial({ color: '#65c9e8', transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.015;
    scene.add(ring);

    const resize = () => {
      const width = canvas.clientWidth || 500;
      const height = canvas.clientHeight || 210;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let frame = 0;
    let disposed = false;
    const started = performance.now();
    const draw = () => {
      if (disposed) return;
      const t = (performance.now() - started) / 1000;
      rig.group.rotation.y = -0.35 + Math.sin(t * 0.35) * 0.16;
      const distance = vehicle.kind === 'truck' ? 15.5 : 10.8;
      camera.position.set(Math.sin(-0.72) * distance, vehicle.kind === 'truck' ? 5.3 : 3.2, Math.cos(-0.72) * distance);
      camera.lookAt(0, vehicle.kind === 'truck' ? 2.1 : 0.75, 0);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      const textures = new Set<THREE.Texture>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      });
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      environment.dispose();
      renderer.dispose();
    };
  }, [vehicle]);

  return <canvas ref={canvasRef} aria-label={`${vehicle.name} 三维车辆预览`} />;
}
