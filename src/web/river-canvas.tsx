import { useEffect, useRef } from 'react';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import { initialRiverView } from '../shared/river.js';
import type { Paddles, RiverView } from '../shared/river.js';
import { RIVER_SIZE } from '../shared/river-levels.js';
import type { Channel, Flag, RiverLevel } from '../shared/river-levels.js';
import type { BuddyLooks } from '../shared/buddy.js';
import { paintActors, paintFogClues, paintRiver } from './river-art.js';

const idlePaddles: Paddles = [false, false];

interface Props {
  level: RiverLevel;
  run?: RiverView;
  paddles?: Paddles;
  channel?: Channel | null;
  flag?: Flag | null;
  looks?: BuddyLooks;
}

export function RiverCanvas({ level, run, paddles = idlePaddles, channel = null, flag = null, looks = DEFAULT_APPEARANCE }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ run: run ?? initialRiverView(level), paddles, flag, channel, looks });
  useEffect(() => {
    latest.current = { run: run ?? initialRiverView(level), paddles, flag, channel, looks };
  }, [level, run, paddles, flag, channel, looks]);

  useEffect(() => {
    const target = canvas.current!;
    const ctx = target.getContext('2d');
    const scenery = document.createElement('canvas');
    scenery.width = RIVER_SIZE.width;
    scenery.height = RIVER_SIZE.height;
    const sceneContext = scenery.getContext('2d');
    if (!ctx || !sceneContext) return;
    paintRiver(sceneContext, level);

    let scale = 1;
    let frame = 0;
    let previous: typeof latest.current | undefined;
    let displayed = { ...latest.current.run };
    let resized = true;

    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      target.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = target.height / RIVER_SIZE.height;
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
        const maxCamera = Math.max(0, RIVER_SIZE.width - viewWidth);
        const camera = Math.min(maxCamera, Math.max(0, displayed.x - viewWidth * 0.32));
        ctx!.setTransform(scale, 0, 0, scale, -camera * scale, 0);
        ctx!.drawImage(scenery, 0, 0);
        if (level === 'fog') paintFogClues(ctx!, next.channel, next.run.rescued ? null : next.flag);
        paintActors(ctx!, displayed, next.paddles, next.looks);
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
  }, [level]);

  return <canvas className="river-canvas" aria-hidden="true" ref={canvas} />;
}
