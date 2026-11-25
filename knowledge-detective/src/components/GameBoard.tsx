import { ArrowLeftRight, DoorOpen, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { CaseMeta, RoomAction, RoomView, Role } from '../../shared/types.js';
import { ClueCard } from './ClueCard.js';
import { DeductionPanel } from './DeductionPanel.js';
import { EvidenceBoard } from './EvidenceBoard.js';
import { ResultPanel } from './ResultPanel.js';

interface GameBoardProps {
  view: RoomView;
  seat: 0 | 1;
  caseMeta?: CaseMeta;
  busy: boolean;
  canReplay: boolean;
  onAct: (action: RoomAction) => void;
  onReplay: () => void;
  onLeave: () => void;
}

const phaseName = {
  investigate: '收集线索',
  deduce: '进行推理',
  repair: '补救线索',
  accuse: '最终指认',
  solved: '案件破解',
};

export function GameBoard({ view, seat, caseMeta, busy, canReplay, onAct, onReplay, onLeave }: GameBoardProps) {
  const game = view.game;
  if (!game) return null;
  const role = game.activeRole;
  const sharedIds = new Set(game.sharedEvidence.map((item) => item.id));
  const isHost = seat === view.hostSeat;

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-brand-foreground"><Search size={19} /></span>
            <div><h1 className="font-display text-lg">{game.title}</h1><span className="block text-xs text-muted">{caseMeta?.subject} · {phaseName[game.phase]}</span></div>
          </div>
          <div className="flex items-center gap-3">
            {view.mode === 'duo' && <span className="rounded-full border border-line bg-canvas px-3 py-1.5 font-mono text-xs tracking-widest text-brand">房间 {view.code}</span>}
            <button className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted hover:bg-canvas" onClick={onLeave} disabled={busy}><DoorOpen size={16} /> 离开</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">{view.mode === 'solo' ? <UserRound size={21} /> : <Users size={21} />}</span>
            <div><strong className="block">你的身份：{role === 'investigator' ? '调查员' : '分析员'}</strong><span className="text-sm text-muted">{role === 'investigator' ? '负责现场、证人与文件线索' : '负责地图、记录与档案线索'}</span></div>
          </div>
          {view.mode === 'solo' ? (
            <div className="flex rounded-xl border border-line bg-canvas p-1">
              {(['investigator', 'analyst'] as Role[]).map((item) => (
                <button key={item} aria-pressed={role === item} className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${role === item ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-ink'}`} onClick={() => onAct({ type: 'switch-role', role: item })} disabled={busy || game.phase === 'solved'}>
                  {item === 'investigator' ? <UserRound size={16} /> : <Search size={16} />}
                  {role === item ? '当前：' : '切换到'}{item === 'investigator' ? '调查员' : '分析员'}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted"><ShieldCheck size={17} className="text-brand" /> 搭档只能看到另一组线索</div>
          )}
        </section>

        {game.phase === 'solved' ? (
          <ResultPanel game={game} canReplay={isHost && canReplay} busy={busy} onReplay={onReplay} onLeave={onLeave} />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="space-y-6">
              <section aria-labelledby="clues-title">
                <div className="mb-4 flex items-end justify-between">
                  <div><p className="text-xs font-semibold tracking-[0.18em] text-clue">PRIVATE CLUES</p><h2 id="clues-title" className="mt-1 font-display text-2xl font-bold">你的线索</h2></div>
                  <span className="flex items-center gap-1 text-xs text-muted"><ArrowLeftRight size={14} /> 分享后搭档也能看到</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {game.clues.map((clue) => (
                    <ClueCard key={clue.id} clue={clue} shared={sharedIds.has(clue.id)} disabled={busy} onReveal={() => onAct({ type: 'reveal', clueId: clue.id })} onShare={() => onAct({ type: 'share', clueId: clue.id })} />
                  ))}
                </div>
              </section>
              <DeductionPanel key={`${game.phase}:${game.stepIndex}`} game={game} disabled={busy} onAct={onAct} />
            </div>
            <EvidenceBoard evidence={game.sharedEvidence} total={4} />
          </div>
        )}
      </div>
    </main>
  );
}
