import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clock3,
  Link2,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { CaseMeta } from '../../shared/types.js';

interface HomeProps {
  cases: CaseMeta[];
  solvedIds: string[];
  initialRoom?: string;
  error?: string;
  connected: boolean;
  busy: boolean;
  onCreateSolo: (caseId: string) => void;
  onCreateDuo: (caseId: string) => void;
  onJoin: (code: string) => void;
}

export function Home({ cases, solvedIds, initialRoom = '', error = '', connected, busy, onCreateSolo, onCreateDuo, onJoin }: HomeProps) {
  const [selectedId, setSelectedId] = useState(cases[0]?.id ?? '');
  const [joinOpen, setJoinOpen] = useState(Boolean(initialRoom));
  const [code, setCode] = useState(initialRoom);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const joinButtonRef = useRef<HTMLButtonElement>(null);
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (joinOpen && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!joinOpen && dialog.open) {
      dialog.close();
    }
  }, [joinOpen]);

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="知识侦探社首页">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-brand-foreground shadow-paper">
            <Search size={22} strokeWidth={1.8} />
          </span>
          <span>
            <h1 className="font-display text-xl tracking-wide">知识侦探社</h1>
            <span className="block text-xs text-muted">查线索 · 讲证据 · 一起破案</span>
          </span>
        </a>
        <span className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-xs text-muted">
          <i className={`h-2 w-2 rounded-full ${connected ? 'bg-brand' : 'bg-clue'}`} />
          {connected ? '调查服务已连接' : '正在连接调查服务'}
        </span>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:pb-20">
        <div className="animate-fade-up">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-clue">
            <span className="h-px w-10 bg-clue" /> COOPERATIVE LEARNING MYSTERIES
          </p>
          <h2 className="font-display text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            每一条线索，
            <br />
            都是<span className="hand-line text-clue">思考</span>的入口。
          </h2>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted sm:text-lg">
            一个人切换身份、梳理证据，或和搭档各拿一半线索。读懂一段话、算清一段路，再把结论建立在证据上。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-brand-foreground shadow-paper transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-50"
              disabled={!connected || busy || !selected}
              onClick={() => selected && onCreateSolo(selected.id)}
            >
              <UserRound size={19} /> 开始单人探案 <ArrowUpRight size={18} />
            </button>
            <button
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-brand bg-paper px-6 py-3 font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-50"
              disabled={!connected || busy || !selected}
              onClick={() => selected && onCreateDuo(selected.id)}
            >
              <Users size={19} /> 创建双人房间
            </button>
            <button
              ref={joinButtonRef}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 font-semibold text-ink transition hover:bg-paper"
              onClick={() => setJoinOpen(true)}
            >
              <Link2 size={18} /> 加入房间
            </button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-2"><Check size={16} className="text-brand" /> 无倒计时</span>
            <span className="flex items-center gap-2"><Check size={16} className="text-brand" /> 答错不淘汰</span>
            <span className="flex items-center gap-2"><Check size={16} className="text-brand" /> 证据式反馈</span>
          </div>
        </div>

        <figure className="case-cover animate-fade-up overflow-hidden rounded-[2rem] border border-line bg-brand shadow-lift">
          <img src="/images/detective-hero.png" alt="两位小侦探在校园调查室里对照地图和线索" className="h-full max-h-[560px] w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-paper sm:p-8">
            <div>
              <span className="text-xs tracking-[0.2em] text-amber-soft">TODAY'S CASE</span>
              <strong className="mt-1 block font-display text-2xl">{selected?.title ?? '选择一份案件'}</strong>
            </div>
            <span className="rounded-full border border-paper/30 bg-paper/10 px-3 py-2 text-xs backdrop-blur">{selected?.duration}</span>
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-clue">CASE FILES</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">挑选一份案件档案</h2>
          </div>
          <p className="hidden max-w-sm text-right text-sm leading-6 text-muted sm:block">每份案件都可以单人调查，也可以创建双人房间共同破解。</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {cases.map((item, index) => {
            const solved = solvedIds.includes(item.id);
            const active = selected?.id === item.id;
            return (
              <article
                key={item.id}
                className={`group relative overflow-hidden rounded-3xl border bg-paper transition duration-300 hover:-translate-y-1 hover:shadow-lift ${active ? 'border-brand ring-2 ring-brand/15' : 'border-line'}`}
              >
                <button className="block w-full text-left" onClick={() => setSelectedId(item.id)} aria-pressed={active}>
                  <div className="case-cover h-48">
                    <img src={item.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                    <span className="absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1.5 font-mono text-xs text-ink">CASE 0{index + 1}</span>
                    {solved && <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs text-brand-foreground"><Check size={13} /> 已破解</span>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{item.subject}</span>
                      <span className="flex items-center gap-1"><Clock3 size={13} /> {item.duration}</span>
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm text-clue">{item.subtitle}</p>
                    <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-muted">{item.brief}</p>
                  </div>
                </button>
                <div className="px-5 pb-5">
                  <button
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-soft font-semibold text-brand transition hover:bg-brand hover:text-brand-foreground disabled:opacity-50"
                    disabled={!connected || busy}
                    onClick={() => onCreateSolo(item.id)}
                  >
                    调查{item.title} <ArrowUpRight size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-paper p-7 text-ink shadow-lift backdrop:bg-ink/55 backdrop:backdrop-blur-sm"
        aria-labelledby="join-title"
        onClose={() => {
          setJoinOpen(false);
          joinButtonRef.current?.focus();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) onJoin(code.trim().toUpperCase());
          }}
        >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold tracking-widest text-clue">JOIN A CASE</p>
                <h2 id="join-title" className="mt-2 font-display text-3xl font-bold">加入搭档的调查</h2>
              </div>
              <button type="button" className="rounded-full p-2 text-muted hover:bg-canvas" aria-label="关闭" onClick={() => setJoinOpen(false)}><X size={20} /></button>
            </div>
            <label className="mt-6 block text-sm font-semibold" htmlFor="room-code">房间码</label>
            <input
              ref={inputRef}
              id="room-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="例如 K7M2Q9"
              className="mt-2 h-14 w-full rounded-xl border border-line bg-canvas px-4 font-mono text-xl tracking-[0.28em] text-ink placeholder:text-muted/50"
            />
            {error && <p className="mt-3 rounded-xl bg-clue-soft px-3 py-2 text-sm text-clue" role="alert">{error}</p>}
            <button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-foreground disabled:opacity-50" disabled={!connected || busy || code.length !== 6}>
              <Link2 size={18} /> 加入调查
            </button>
          </form>
        </dialog>
    </main>
  );
}
