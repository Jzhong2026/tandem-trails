import { useEffect, useRef } from 'react';
import type { Seat } from '../shared/protocol.js';

type Context = CanvasRenderingContext2D;

export function PanoramaCanvas<T>({ run, seat, world, focusX, paintLayout, paintRun, theme }: {
  run: T;
  seat: Seat;
  world: { width: number; height: number };
  focusX: (run: T, seat: Seat) => number;
  paintLayout: (ctx: Context) => void;
  paintRun: (ctx: Context, run: T, seat: Seat) => void;
  theme: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(run);
  useEffect(() => { latest.current = run; }, [run]);

  useEffect(() => {
    const target = canvas.current!;
    const ctx = target.getContext('2d');
    const scenery = document.createElement('canvas');
    scenery.width = world.width;
    scenery.height = world.height;
    const backdrop = scenery.getContext('2d');
    if (!ctx || !backdrop) return;
    paintLayout(backdrop);

    let drawn: T | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      target.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      drawn = undefined;
    });
    observer.observe(target);
    let frame = 0;
    function update() {
      const state = latest.current;
      if (drawn !== state) {
        const scale = target.height / world.height;
        const viewWidth = target.width / scale;
        const offset = Math.max(0, Math.min(world.width - viewWidth, focusX(state, seat) - viewWidth * .38));
        ctx!.setTransform(scale, 0, 0, scale, -offset * scale, 0);
        ctx!.drawImage(scenery, 0, 0);
        paintRun(ctx!, state, seat);
        drawn = state;
      }
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [seat, world, focusX, paintLayout, paintRun]);

  return <canvas ref={canvas} className={`river-canvas ${theme}`} aria-hidden="true" />;
}
