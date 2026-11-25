import { useState } from 'react';
import { Check, Clipboard, DoorOpen, Link2, LoaderCircle, Play, Search, UserRound, Users } from 'lucide-react';
import type { CaseMeta, RoomView } from '../../shared/types.js';

interface LobbyProps {
  view: RoomView;
  seat: 0 | 1;
  caseMeta?: CaseMeta;
  connected: boolean;
  busy: boolean;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ view, seat, caseMeta, connected, busy, onReady, onStart, onLeave }: LobbyProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const isHost = seat === view.hostSeat;
  const current = view.players[seat];
  const allReady = view.players.filter((player) => player !== null).length === 2 && view.players.every((player) => player?.ready);
  const invite = `${window.location.origin}/?room=${view.code}`;

  return (
    <main className="board-texture min-h-screen px-5 py-8 text-paper sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-paper text-brand"><Search size={21} /></span>
            <div><strong className="font-display text-xl">知识侦探社</strong><span className="block text-xs text-paper/65">双人合作调查</span></div>
          </div>
          <button className="flex items-center gap-2 rounded-full border border-paper/20 px-4 py-2 text-sm text-paper/80 hover:bg-paper/10" onClick={onLeave} disabled={busy}><DoorOpen size={16} /> 离开房间</button>
        </header>

        <section className="mx-auto mt-12 max-w-3xl rounded-[2rem] border border-paper/15 bg-paper p-6 text-ink shadow-lift sm:p-9">
          <p className="text-sm font-semibold tracking-[0.18em] text-clue">CASE {view.caseId}</p>
          <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">等待搭档</h1>
          <p className="mt-3 text-muted">{caseMeta?.brief}</p>

          <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center rounded-2xl border border-line bg-canvas p-5">
            <div>
              <span className="text-xs font-semibold tracking-widest text-muted">ROOM CODE</span>
              <strong data-testid="room-code" className="mt-1 block font-mono text-3xl tracking-[0.32em] text-brand">{view.code}</strong>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-brand hover:bg-brand-soft"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invite);
                  setCopyState('copied');
                } catch {
                  const field = document.createElement('textarea');
                  field.value = invite;
                  field.style.position = 'fixed';
                  field.style.opacity = '0';
                  document.body.appendChild(field);
                  field.select();
                  const copied = document.execCommand('copy');
                  field.remove();
                  setCopyState(copied ? 'copied' : 'manual');
                }
              }}
            >
              {copyState === 'copied' ? <Check size={16} /> : <Clipboard size={16} />} {copyState === 'copied' ? '已复制邀请' : '复制邀请链接'}
            </button>
          </div>
          <input className="mt-3 h-10 w-full rounded-lg border border-line bg-paper px-3 text-xs text-muted" value={invite} readOnly aria-label="邀请链接" onFocus={(event) => event.currentTarget.select()} />
          {copyState === 'manual' && <p className="mt-2 text-xs text-clue">浏览器不允许自动复制，请选中上方邀请链接手动复制。</p>}

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {view.players.map((player, index) => (
              <div key={index} className={`rounded-2xl border p-5 ${player ? 'border-brand/30 bg-brand-soft/50' : 'border-dashed border-line bg-canvas'}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-12 w-12 place-items-center rounded-full ${player ? 'bg-brand text-brand-foreground' : 'bg-line text-muted'}`}>
                    {index === 0 ? <UserRound size={22} /> : <Users size={22} />}
                  </span>
                  <div>
                    <strong className="block">{player?.name ?? '等待搭档加入'}</strong>
                    <span className="text-sm text-muted">{player ? (player.role === 'investigator' ? '调查员 · 现场与证人' : '分析员 · 地图与档案') : '分享房间码或邀请链接'}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                  <i className={`h-2 w-2 rounded-full ${player?.connected ? 'bg-brand' : 'bg-clue'}`} />
                  {player ? (player.ready ? '已准备好' : player.connected ? '正在准备' : '连接中断') : '空席位'}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {current && (
              <button
                className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50 ${current.ready ? 'border border-line bg-paper text-ink' : 'bg-brand text-brand-foreground'}`}
                disabled={!connected || busy}
                onClick={() => onReady(!current.ready)}
              >
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : current.ready ? <Check size={18} /> : <Link2 size={18} />}
                {current.ready ? '取消准备' : '我准备好了'}
              </button>
            )}
            {isHost && (
              <button className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-clue font-semibold text-clue-foreground disabled:opacity-40" disabled={!connected || busy || !allReady} onClick={onStart}>
                <Play size={18} fill="currentColor" /> 开始调查
              </button>
            )}
          </div>
          {!allReady && <p className="mt-4 text-center text-sm text-muted">两位侦探都准备好后，房主才能开始调查。</p>}
        </section>
      </div>
    </main>
  );
}
