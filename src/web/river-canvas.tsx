import { useEffect, useRef } from 'react';
import { createRiverRun, RIVER } from '../shared/river.js';
import type { Paddles, RiverView } from '../shared/river.js';
import { paintActors, paintRiver } from './river-art.js';

const startView = createRiverRun();
const idlePaddles: Paddles = [false, false];

export function RiverCanvas({ run = startView, paddles = idlePaddles }: { run?: RiverView; paddles?: Paddles }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ run, paddles });
  useEffect(() => { latest.current = { run, paddles }; }, [run, paddles]);

  useEffect(() => {
    const target = canvas.current!;
    const ctx = target.getContext('2d');
    const scenery = document.createElement('canvas');
    scenery.width = RIVER.width;
    scenery.height = RIVER.height;
    const sceneContext = scenery.getContext('2d');
    if (!ctx || !sceneContext) return;
    paintRiver(sceneContext);

    let scale = 1;
    let frame = 0;
    let previous: { run: RiverView; paddles: Paddles } | undefined;
    let displayed = { ...latest.current.run };
    let resized = true;

    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      target.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = target.height / RIVER.height;
      resized = true;
    });
    observer.observe(target);
    let lastTime = 0;

    function draw(time: number) {
      const next = latest.current;
      const delta = lastTime ? Math.min(40, time - lastTime) : 16;
      lastTime = time;
      const distance = Math.hypot(next.run.x - displayed.x, next.run.y - displayed.y);
      const turn = next.run.heading - displayed.heading;
      if (next !== previous || resized || distance > 0.15 || Math.abs(turn) > 0.002) {
        if (next.run.collisions !== displayed.collisions || distance > 100 || next.run.finished) {
          displayed = { ...next.run };
        } else {
          const blend = Math.min(1, delta / 55);
          displayed = {
            ...next.run,
            x: displayed.x + (next.run.x - displayed.x) * blend,
            y: displayed.y + (next.run.y - displayed.y) * blend,
            heading: displayed.heading + turn * blend,
          };
        }
        const viewWidth = target.width / scale;
        const maxCamera = Math.max(0, RIVER.width - viewWidth);
        const camera = Math.min(maxCamera, Math.max(0, displayed.x - viewWidth * 0.32));
        ctx!.setTransform(scale, 0, 0, scale, -camera * scale, 0);
        ctx!.drawImage(scenery, 0, 0);
        paintActors(ctx!, displayed, next.paddles);
        previous = next;
        resized = false;
      }
      frame = window.requestAnimationFrame(draw);
    }
    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas className="river-canvas" aria-hidden="true" ref={canvas} />;
}
