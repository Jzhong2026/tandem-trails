import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Fingerprint, Lightbulb } from 'lucide-react';
import type { GameView, RoomAction } from '../../shared/types.js';

interface DeductionPanelProps {
  game: GameView;
  disabled: boolean;
  onAct: (action: RoomAction) => void;
}

export function DeductionPanel({ game, disabled, onAct }: DeductionPanelProps) {
  const [finalOption, setFinalOption] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [game.phase, game.stepIndex]);

  if (game.phase === 'investigate') {
    return (
      <section className="rounded-3xl border border-line bg-paper p-6 shadow-paper" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-soft text-amber"><Lightbulb size={23} /></span>
          <div><p className="text-xs font-semibold tracking-widest text-clue">FIRST STEP</p><h2 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-2xl font-bold">先交换线索</h2><p className="mt-2 text-sm leading-7 text-muted">每位侦探先翻开自己的线索，再分享到证据板。所有线索齐了，推理题才会出现。</p></div>
        </div>
      </section>
    );
  }

  if (game.phase === 'deduce') {
    return (
      <section className="rounded-3xl border border-line bg-paper p-6 shadow-paper sm:p-7" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-clue">DEDUCTION {game.stepIndex + 1}/{game.totalSteps}</p>
          <Fingerprint className="text-brand" size={22} />
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-2xl font-bold leading-snug">{game.prompt}</h2>
        {game.feedback && <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-sm leading-6 text-brand" role="status">{game.feedback}</p>}
        <div className="mt-5 grid gap-3">
          {game.options?.map((option, index) => (
            <button key={option} aria-label={option} className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3 text-left font-semibold transition hover:border-brand hover:bg-brand-soft disabled:opacity-50" onClick={() => onAct({ type: 'answer', option: index })} disabled={disabled}>
              <span>{option}</span><span className="font-mono text-xs text-muted">0{index + 1}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (game.phase === 'repair') {
    return (
      <section className="rounded-3xl border border-clue/30 bg-clue-soft p-6 shadow-paper sm:p-7" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-clue text-clue-foreground"><AlertCircle size={23} /></span>
          <div><p className="text-xs font-semibold tracking-[0.18em] text-clue">CLUE RECOVERY</p><h2 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-2xl font-bold">迷雾出现了，但线索还在。</h2><p className="mt-2 text-sm leading-7 text-muted">先完成一个小任务，再回到刚才的推理。不会扣分，也不会重新开始。</p></div>
        </div>
        {game.feedback && <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-sm text-clue" role="status">{game.feedback}</p>}
        <h3 className="mt-6 font-display text-xl font-bold">{game.repair?.prompt}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {game.repair?.options.map((option, index) => (
            <button key={option} className="min-h-12 rounded-xl border border-clue/25 bg-paper px-4 py-3 text-left font-semibold text-ink transition hover:border-clue disabled:opacity-50" onClick={() => onAct({ type: 'repair', option: index })} disabled={disabled}>{option}</button>
          ))}
        </div>
      </section>
    );
  }

  if (game.phase === 'accuse') {
    const valid = finalOption !== null && evidence.length === 2;
    return (
      <section className="rounded-3xl border border-line bg-paper p-6 shadow-paper sm:p-7" aria-live="polite">
        <p className="text-xs font-semibold tracking-[0.18em] text-clue">FINAL ACCUSATION</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-2xl font-bold">{game.finalPrompt}</h2>
        {game.feedback && <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-sm leading-6 text-brand" role="status">{game.feedback}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {game.finalOptions?.map((option, index) => (
            <button key={option} aria-label={option} aria-pressed={finalOption === index} className={`min-h-14 rounded-xl border px-4 py-3 text-left font-semibold transition ${finalOption === index ? 'border-brand bg-brand text-brand-foreground' : 'border-line bg-canvas hover:border-brand'}`} onClick={() => setFinalOption(index)} disabled={disabled}>{option}</button>
          ))}
        </div>
        <div className="mt-7">
          <h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-brand" /> 选择两条支持你结论的证据</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {game.sharedEvidence.map((item) => (
              <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${evidence.includes(item.id) ? 'border-brand bg-brand-soft' : 'border-line bg-canvas'}`}>
                <input type="checkbox" checked={evidence.includes(item.id)} onChange={() => setEvidence((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} disabled={disabled || evidence.length >= 2 && !evidence.includes(item.id)} />
                <span className="font-semibold">{item.title}</span>
              </label>
            ))}
          </div>
        </div>
        <button className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-clue font-semibold text-clue-foreground disabled:opacity-40" disabled={!valid || disabled} onClick={() => finalOption !== null && onAct({ type: 'accuse', option: finalOption, evidenceIds: evidence })}>
          提交指认 <ArrowRight size={18} />
        </button>
      </section>
    );
  }

  return null;
}
