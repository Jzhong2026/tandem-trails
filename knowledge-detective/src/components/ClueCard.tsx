import { useEffect, useRef } from 'react';
import { Camera, Check, FileText, Map, MessageCircle, Share2, StickyNote } from 'lucide-react';
import type { ClueKind, ClueView } from '../../shared/types.js';

interface ClueCardProps {
  clue: ClueView;
  shared: boolean;
  disabled: boolean;
  onReveal: () => void;
  onShare: () => void;
}

const kindIcon = {
  document: FileText,
  witness: MessageCircle,
  record: StickyNote,
  map: Map,
  photo: Camera,
  note: StickyNote,
};

const kindName: Record<ClueKind, string> = {
  document: '文件',
  witness: '证词',
  record: '记录',
  map: '地图',
  photo: '影像',
  note: '便签',
};

export function ClueCard({ clue, shared, disabled, onReveal, onShare }: ClueCardProps) {
  const Icon = kindIcon[clue.kind];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasShared = useRef(false);
  useEffect(() => {
    if (shared && !wasShared.current) headingRef.current?.focus();
    wasShared.current = shared;
  }, [shared]);
  return (
    <article data-clue-id={clue.id} className={`relative rounded-2xl border p-5 transition ${shared ? 'border-brand/30 bg-brand-soft/45' : 'border-line bg-paper'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-brand"><Icon size={19} /></span>
          <div><span className="text-xs font-semibold tracking-widest text-muted">{kindName[clue.kind]}</span><h3 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold">{clue.title}</h3></div>
        </div>
        {shared ? <span className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs text-brand-foreground"><Check size={12} /> 已分享</span> : <span className="clue-pin mt-2" />}
      </div>
      {clue.revealed ? (
        <>
          <p className="mt-4 min-h-20 whitespace-pre-line text-sm leading-7 text-ink">{clue.text}</p>
          {!shared && (
            <button className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-clue text-sm font-semibold text-clue-foreground transition hover:opacity-90 disabled:opacity-50" onClick={onShare} disabled={disabled}>
              <Share2 size={16} /> 分享到证据板
            </button>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-2" aria-label="线索尚未翻开">
          <div className="h-3 w-full rounded-full bg-line/70" />
          <div className="h-3 w-4/5 rounded-full bg-line/50" />
          <button className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-brand bg-paper text-sm font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-50" onClick={onReveal} disabled={disabled}>
            <FileText size={16} /> 翻开线索
          </button>
        </div>
      )}
    </article>
  );
}
