import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TRUCKS } from '../shared/trucks.js';
import type { TruckId } from '../shared/trucks.js';
import { buildTruck } from './truck-model.js';
import { CAR_COLORS, CAR_DARK } from './race-render.js';

export function TruckGarage({ truck, colour }: { truck: TruckId; colour: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const angle = useRef(0.66);
  const draw = useRef<() => void>(() => {});
  const paint = useRef<(id: number) => void>(() => {});
  const drag = useRef<number | null>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const el = canvas.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true });
    } catch {
      setFallback(true);
      return;
    }
    setFallback(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const studio = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(studio, 0.04);
    scene.environment = env.texture;
    studio.dispose();
    pmrem.dispose();
    const model = buildTruck(truck, false);
    scene.add(model.group);
    scene.add(new THREE.HemisphereLight('#fff7e4', '#7a8697', 1.7));
    const key = new THREE.DirectionalLight('#fff4db', 2.5);
    key.position.set(4, 7, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#a3dbff', 2);
    rim.position.set(-4, 4, -3);
    scene.add(rim);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4.12, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: '#485c69', roughness: 0.68 }),
    );
    base.position.y = -0.1;
    scene.add(base);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
    draw.current = () => {
      const distance = Math.max(11.3, 10.6 / camera.aspect);
      camera.position.set(Math.sin(angle.current) * distance, 3.42, Math.cos(angle.current) * distance);
      camera.lookAt(0, 1.89, 0);
      renderer.render(scene, camera);
    };
    paint.current = (id) => {
      model.paint.color.set(CAR_COLORS[id]);
      model.trim.color.set(CAR_DARK[id]);
      draw.current();
    };
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      draw.current();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      draw.current = () => {};
      paint.current = () => {};
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        }
      });
      env.dispose();
      renderer.dispose();
      // The next model reuses this canvas and its WebGL context.
    };
  }, [truck]);
  useEffect(() => paint.current(colour), [colour, truck]);
  const rotate = (delta: number) => {
    angle.current += delta;
    draw.current();
  };
  return (
    <figure className="truck-garage">
      <canvas
        ref={canvas}
        hidden={fallback}
        aria-label={TRUCKS[truck].name + ' 三维选车预览'}
        role="img"
        onPointerDown={(e) => {
          if (e.isPrimary) {
            drag.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (e.isPrimary && drag.current !== null) {
            rotate((drag.current - e.clientX) * 0.014);
            drag.current = e.clientX;
          }
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      />
      <figcaption>
        <strong>{TRUCKS[truck].name}</strong>
        {!fallback && (
          <span>
            <button aria-label="向左旋转车辆" onClick={() => rotate(-Math.PI / 4)}>
              ↶
            </button>
            <button aria-label="向右旋转车辆" onClick={() => rotate(Math.PI / 4)}>
              ↷
            </button>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
