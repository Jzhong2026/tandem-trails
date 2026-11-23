import { useEffect, useRef } from 'react';
import { trackById } from '../shared/race-tracks.js';
import {
  buildObstacles,
  buildScenery,
  CAM_BACK,
  createCamera,
  RaceParticles,
  paintRaceFrame2D,
} from './race-render.js';
import { RaceScene } from './race-scene.js';
export default function RacePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const glCanvas = glCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const track = trackById('campus');
    const obstacles = buildObstacles(track);
    const scenery = buildScenery(track);
    const particles = new RaceParticles();
    let scene: RaceScene | null = null;
    if (glCanvas) {
      try {
        scene = new RaceScene(glCanvas, track, obstacles, scenery);
      } catch {
        scene = null;
        glCanvas.style.display = 'none';
      }
    }
    let scale = 1;
    let frame = 0;
    let last = 0;
    let x = 0;
    let exhaust = 0;
    const camera = createCamera(800, 600);
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      canvas.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = dpr;
      Object.assign(camera, createCamera(entry.contentRect.width, entry.contentRect.height));
      scene?.setSize(entry.contentRect.width, entry.contentRect.height, dpr);
    });
    observer.observe(canvas);
    const draw = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
      last = time;
      x += track.speed * dt;
      if (x > track.length) x = 0;
      const laneY = Math.floor(((Math.sin(x / 420) + 1) / 2) * 2.999);
      if (scene) {
        scene.render({
          showcase: true,
          track,
          cameraX: x - CAM_BACK,
          laneY,
          color: 0,
          status: 'racing',
          hitFlash: 0,
          shake: 0,
          stationActive: null,
          time: time / 1000,
          dt,
        });
      } else {
        exhaust += dt;
        if (exhaust > 0.05) {
          exhaust = 0;
          particles.exhaust(
            camera.width / 2 + (laneY - 1) * camera.truckLanePx - 36 * (camera.truckW / 100),
            camera.truckGroundY - 6,
            true,
          );
        }
        particles.update(dt);
        ctx!.setTransform(scale, 0, 0, scale, 0, 0);
        paintRaceFrame2D(ctx!, {
          track,
          obstacles,
          scenery,
          camera,
          cameraX: x - CAM_BACK,
          laneY,
          color: 0,
          status: 'racing',
          hitFlash: 0,
          boost: true,
          stationActive: null,
          time: time / 1000,
          particles,
          fuel: 7,
          fuelMax: 10,
        });
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      particles.clear();
      scene?.dispose();
    };
  }, []);
  return (
    <div className="race-preview-stage">
      <canvas className="race-gl" ref={glCanvasRef} aria-hidden="true" />
      <canvas className="race-canvas" ref={canvasRef} role="img" aria-label="知识赛车预览动画" />
    </div>
  );
}
