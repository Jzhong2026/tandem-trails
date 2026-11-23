import { useEffect, useRef } from 'react';
import type { BuddyLooks } from '../shared/buddy.js';
import type { Seat } from '../shared/protocol.js';

type Context = CanvasRenderingContext2D;

export function PanoramaCanvas<T>({ run, seat, world, focusX, paintLayout, paintRun, theme, frozen, interpolate, looks }: {
  run: T;
  seat: Seat;
  world: { width: number; height: number };
  focusX: (run: T, seat: Seat) => number;
  paintLayout: (ctx: Context) => void;
  paintRun: (ctx: Context, run: T, seat: Seat, looks: BuddyLooks) => void;
  theme: string;
  frozen: boolean;
  interpolate: (from: T, to: T, blend: number) => T;
  looks: BuddyLooks;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ run, frozen, looks });
  useEffect(() => { latest.current = { run, frozen, looks }; }, [run, frozen, looks]);

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
    let displayed = latest.current.run;
    let wasFrozen = latest.current.frozen;
    let lastTime: number | undefined;
    function update(time: number) {
      const next = latest.current;
      const delta = lastTime === undefined ? 16 : Math.min(40, time - lastTime);
      lastTime = time;
      if (next.frozen || wasFrozen) {
        displayed = next.run;
      } else if (displayed !== next.run) {
        displayed = interpolate(displayed, next.run, Math.min(1, delta / 55));
      }
      wasFrozen = next.frozen;
      if (drawn !== displayed) {
        const scale = target.height / world.height;
        const viewWidth = target.width / scale;
        const offset = Math.max(0, Math.min(world.width - viewWidth, focusX(displayed, seat) - viewWidth * .38));
        ctx!.setTransform(scale, 0, 0, scale, -offset * scale, 0);
        ctx!.drawImage(scenery, 0, 0);
        paintRun(ctx!, displayed, seat, next.looks);
        drawn = displayed;
      }
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [seat, world, focusX, paintLayout, paintRun, interpolate]);

  return <canvas ref={canvas} className={`river-canvas ${theme}`} aria-hidden="true" />;
}
