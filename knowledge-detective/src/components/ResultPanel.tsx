import { useEffect, useRef } from 'react';
import { Award, BookOpenCheck, RotateCcw, Sparkles } from 'lucide-react';
import type { GameView } from '../../shared/types.js';

interface ResultPanelProps {
  game: GameView;
  canReplay: boolean;
  busy: boolean;
  onReplay: () => void;
  onLeave: () => void;
}

export function ResultPanel({ game, canReplay, busy, onReplay, onLeave }: ResultPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-brand/25 bg-paper p-7 text-center shadow-lift sm:p-10" aria-live="polite">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-soft" aria-hidden="true" />
      <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-brand-soft" aria-hidden="true" />
      <div className="relative">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand text-brand-foreground"><Award size={31} /></span>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-clue">CASE CLOSED</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-2 font-display text-4xl font-black sm:text-5xl">案件破解</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">你们把分散的线索变成了一个有证据支持的结论。真正值得庆祝的，不只是答案，还有推理过程。</p>
        <div className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
          {game.masteredConcepts.map((concept) => <span key={concept} className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-2 text-sm font-semibold text-brand"><BookOpenCheck size={15} /> {concept}</span>)}
        </div>
        <div className="mx-auto mt-7 max-w-md rounded-2xl border border-line bg-canvas p-4 text-left">
          <p className="flex items-center gap-2 font-semibold"><Sparkles size={17} className="text-amber" /> 本次调查收获</p>
          <p className="mt-1 text-sm leading-6 text-muted">{game.finalExplanation}</p>
        </div>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {canReplay && <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 font-semibold text-brand-foreground disabled:opacity-50" onClick={onReplay} disabled={busy}><RotateCcw size={18} /> 再玩一次</button>}
          <button className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-paper px-6 font-semibold text-ink disabled:opacity-50" onClick={onLeave} disabled={busy}>返回首页</button>
        </div>
      </div>
    </section>
  );
}
