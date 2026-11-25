import { FileSearch, Link2, UserRound } from 'lucide-react';
import type { EvidenceView } from '../../shared/types.js';

interface EvidenceBoardProps {
  evidence: EvidenceView[];
  total: number;
}

export function EvidenceBoard({ evidence, total }: EvidenceBoardProps) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-5 shadow-paper sm:p-6" aria-labelledby="evidence-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-clue">SHARED EVIDENCE</p>
          <h2 id="evidence-title" className="mt-1 font-display text-2xl font-bold">共享证据板</h2>
        </div>
        <span className="rounded-full bg-canvas px-3 py-1.5 font-mono text-sm text-brand">{evidence.length}/{total}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {evidence.length === 0 ? '证据板为空' : `最新证据：${evidence.at(-1)?.title}。共有 ${evidence.length} 条证据。`}
      </p>
      {evidence.length === 0 ? (
        <div className="mt-5 grid min-h-52 place-items-center rounded-2xl border border-dashed border-line bg-canvas/70 p-6 text-center">
          <div>
            <FileSearch className="mx-auto text-muted" size={34} strokeWidth={1.5} />
            <p className="mt-3 font-semibold">证据板还是空的</p>
            <p className="mt-1 text-sm leading-6 text-muted">翻开各自的线索，再把它放到这里。<br />信息拼齐，推理才会开始。</p>
          </div>
        </div>
      ) : (
        <div className="relative mt-5 space-y-3" aria-live="polite">
          <div className="red-string left-5 right-5 top-5 hidden" aria-hidden="true" />
          {evidence.map((item) => (
            <article key={item.id} className="relative flex gap-3 rounded-2xl border border-line bg-canvas/65 p-4">
              <span className="clue-pin mt-2 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-bold">{item.title}</h3>
                  <span className="flex items-center gap-1 text-[11px] text-muted"><UserRound size={11} /> {item.sharedBy === 'investigator' ? '调查员' : '分析员'}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">{item.text}</p>
              </div>
            </article>
          ))}
          {evidence.length === total && (
            <p className="flex items-center justify-center gap-2 pt-1 text-sm font-semibold text-brand"><Link2 size={15} /> 线索已齐，可以开始推理</p>
          )}
        </div>
      )}
    </section>
  );
}
