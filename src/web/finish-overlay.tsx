import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isEggLevel, isMineLevel, isSubLevel } from '../shared/game-levels.js';
import type { GameLevel } from '../shared/game-levels.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { ChapterStory } from '../shared/story.js';
import type { Looks } from './panorama-canvas.js';
import { paintFinish } from './finish-art.js';

const durationMs = 2100;

function FinishIllustration({ level, looks }: { level: GameLevel; looks: Looks }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const target = canvas.current!;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now();
    let frame = 0;
    function draw(now: number) {
      const time = motion.matches ? 1 : Math.min(1, (now - start) / durationMs);
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, target.width, target.height);
      ctx!.setTransform(3, 0, 0, 3, target.width / 2, target.height / 2);
      paintFinish(ctx!, level, time, looks);
      if (time < 1) frame = requestAnimationFrame(draw);
    }
    function settle() {
      if (motion.matches) {
        cancelAnimationFrame(frame);
        draw(performance.now());
      }
    }
    draw(start);
    motion.addEventListener('change', settle);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', settle);
    };
  }, [level, looks]);
  return <canvas className="finish-art" width={780} height={480} ref={canvas} aria-hidden="true" />;
}

export function FinishOverlay({ level, title, summary, children, looks = DEFAULT_APPEARANCE, story = null }: {
  level: GameLevel; title: string; summary: string; children: ReactNode; looks?: Looks; story?: ChapterStory | null;
}) {
  const theme = isEggLevel(level) ? 'egg' : isMineLevel(level) ? 'mine' : isSubLevel(level) ? 'sub' : 'river';
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), 450);
    return () => clearTimeout(timer);
  }, []);
  return <div className={`finish-scene finish-${theme}`}>
    <FinishIllustration level={level} looks={looks} />
    <div className="finish-result">
      <h2>{title}</h2>
      <p>{summary}</p>
      {story && <p className="finish-story">{story.outro}</p>}
      {story && <p className="assist finish-hook">{story.nextHook}</p>}
      <fieldset className="finish-actions-guard" disabled={!armed}>
        <div className="finish-actions">{children}</div>
      </fieldset>
    </div>
  </div>;
}
