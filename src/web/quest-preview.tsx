import { useEffect, useRef } from 'react';
import { createQuest, IDLE_INPUT, QUEST_STEP, stepQuest, tileAt } from '../shared/quest.js';
import type { QuestInput, QuestRun } from '../shared/quest.js';
import { QUEST_LEVELS, TILE, VIEW_HEIGHT, VIEW_WIDTH } from '../shared/quest-levels.js';
import { buildTerrain, paintPreview, ParticleField } from './quest-render.js';

const SHOWCASE = [0, 3, 10, 7];
const SOLID = new Set(['#', '=', 'B', '?', '!', '+', 'u', '[', ']', '(', ')', '{', '}', '>', '<', 'D']);

function demoInput(run: QuestRun, tick: number): QuestInput[] {
  const player = run.players[0];
  const input: QuestInput = { ...IDLE_INPUT, right: true, run: true };
  const feetRow = Math.floor((player.y + player.h + 4) / TILE);
  const headRow = Math.floor((player.y + 6) / TILE);
  const front = Math.floor((player.x + player.w + 2) / TILE);
  if (run.level.water) {
    if (tick % 26 === 0 || player.y > 6 * TILE) input.jump = true;
    return [input];
  }
  let wall = false;
  for (let col = front; col <= front + 2; col++) {
    for (let row = headRow; row < feetRow; row++) if (SOLID.has(tileAt(run, col, row))) wall = true;
  }
  let gap = true;
  for (let col = front; col <= front + 2; col++) {
    for (let row = feetRow; row <= feetRow + 3; row++) {
      const char = tileAt(run, col, row);
      if (SOLID.has(char) || char === '-') gap = false;
    }
  }
  const enemy = run.enemies.some(entry => entry.state !== 'dead' && entry.state !== 'squash'
    && entry.x - (player.x + player.w) > -8 && entry.x - (player.x + player.w) < 90);
  if (player.onGround && (wall || gap || enemy)) input.jump = true;
  if (!player.onGround && player.vy < 0) input.jump = true;
  return [input];
}

export function QuestPreview({ coop }: { coop: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let slot = 0;
    let run = createQuest(SHOWCASE[slot], { coop, assist: true });
    let terrain = buildTerrain(run);
    const particles = new ParticleField();
    let scale = 1;
    let frame = 0;
    let last = 0;
    let accumulator = 0;
    let tick = 0;
    let held = 0;

    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      canvas.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = canvas.height / VIEW_HEIGHT;
      run.viewWidth = Math.min(VIEW_WIDTH, canvas.width / scale);
    });
    observer.observe(canvas);

    const draw = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : QUEST_STEP;
      last = time;
      accumulator += dt;
      let steps = 0;
      while (accumulator >= QUEST_STEP && steps < 4) {
        stepQuest(run, demoInput(run, tick));
        accumulator -= QUEST_STEP;
        tick++;
        steps++;
      }
      for (const event of run.events) particles.fromEvent(event, run);
      run.events.length = 0;
      particles.update(dt);
      held += dt;
      if (held > 11 || run.status !== 'playing' || run.players[0].x > 62 * TILE) {
        held = 0;
        slot = (slot + 1) % SHOWCASE.length;
        run = createQuest(SHOWCASE[slot], { coop, assist: true });
        terrain = buildTerrain(run);
        particles.clear();
        if (labelRef.current) labelRef.current.textContent = QUEST_LEVELS[SHOWCASE[slot]].name;
      }
      ctx!.setTransform(scale, 0, 0, scale, 0, 0);
      paintPreview(ctx!, run, terrain, time / 1000);
      frame = window.requestAnimationFrame(draw);
    };
    if (labelRef.current) labelRef.current.textContent = QUEST_LEVELS[SHOWCASE[0]].name;
    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      particles.clear();
    };
  }, [coop]);

  return <figure className="quest-preview">
    <canvas className="quest-canvas" ref={canvasRef} role="img" aria-label="星芽大冒险关卡预览动画" />
    <figcaption>
      <strong>实机预览 · <span ref={labelRef}>绿野第一步</span></strong>
      <span>12 个主题关卡 · 单人 / 双人</span>
    </figcaption>
  </figure>;
}