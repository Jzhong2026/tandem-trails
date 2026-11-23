import type { RaceAudio } from './race-audio.js';
import { useEffect, useRef, useState } from 'react';
import { LEARNING_GAMES } from '../shared/learning.js';
import type { LearningMode, LearningScore, LearningView } from '../shared/learning.js';
import type { RaceGame } from './use-race-room.js';
import { drawModel, models } from './diorama.js';
import './learning.css';

const scenes = {
  lantern: ['#202547', '#85425e', '#ffbb75'],
  orbit: ['#0d1839', '#283782', '#80dbee'],
  parcel: ['#397fa0', '#80c8ce', '#ffdeac'],
};
function Course({ mode, view, seat }: { mode: LearningMode; view: LearningView; seat: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(view);
  useEffect(() => {
    latest.current = view;
  }, [view]);
  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    let frame = 0,
      last = -100;
    const progress = new Map<number, number>();
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(devicePixelRatio, 2);
      el.width = Math.max(1, entry.contentRect.width * dpr);
      el.height = Math.max(1, entry.contentRect.height * dpr);
    });
    observer.observe(el);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const paint = (time: number) => {
      frame = requestAnimationFrame(paint);
      if (document.hidden || time - last < 33) return;
      last = time;
      const t = reduced.matches ? 0 : time / 1000;
      const h = 200,
        w = (el.width / el.height) * h;
      ctx.setTransform(el.height / h, 0, 0, el.height / h, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      scenes[mode].forEach((colour, i) => sky.addColorStop(i / 2, colour));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 48; i++) {
        const x = (i * 131.3) % w,
          y = (i * 47.6) % 145;
        const radius = mode === 'parcel' ? 3 + (i % 9) : 0.65 + (i % 3) * 0.5;
        ctx.fillStyle = mode === 'parcel' ? '#fff6dc51' : '#fff3caac';
        ctx.beginPath();
        ctx.ellipse(x, y, radius * (mode === 'parcel' ? 2 : 1), radius, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = mode === 'orbit' ? '#b4adfd' : '#fff0bb';
      ctx.beginPath();
      ctx.arc(w * 0.78, 42, 24, 0, 2 * Math.PI);
      ctx.fill();
      if (mode === 'orbit') {
        ctx.strokeStyle = '#f4c5ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(w * 0.78, 42, 36, 8, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        for (let i = 0; i < 6; i++) {
          const x = ((i + 0.25) * w) / 5;
          if (mode === 'parcel')
            drawModel(ctx, models.island, x, 100 + Math.sin(i) * 18, 0.6 + (i % 2) * 0.2, 0.4 + i);
          else {
            ctx.fillStyle = '#452f4fd9';
            ctx.fillRect(x - 11, 109 - (i % 2) * 17, 22, 85);
            for (let j = 0; j < 3; j++) {
              const y = 110 - (i % 2) * 17 - j * 12;
              ctx.beginPath();
              ctx.moveTo(x - 21 + j * 4, y);
              ctx.lineTo(x, y - 14);
              ctx.lineTo(x + 21 - j * 4, y);
              ctx.fill();
            }
          }
        }
      }
      const current = latest.current;
      const scores = [...current.scores].sort((a, b) => a.seat - b.seat);
      scores.forEach((p, i) => {
        const y = 163 - i * (70 / Math.max(1, scores.length - 1));
        const end = w - 40,
          start = 38;
        const target = start + (p.completed / current.total) * (end - start);
        const old = progress.get(p.seat) ?? target;
        const x = old + (target - old) * (reduced.matches ? 1 : 0.13);
        progress.set(p.seat, x);
        ctx.strokeStyle = p.seat === seat ? '#fff2b8b0' : '#ffffff50';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(start, y);
        ctx.lineTo(end, y);
        ctx.stroke();
        ctx.setLineDash([]);
        const dy = Math.sin(t * 1.5 + i) * 2;
        drawModel(
          ctx,
          models[mode],
          x,
          y + dy,
          p.seat === seat ? 1 : 0.8,
          0.32 + Math.sin(t * 0.6 + i) * 0.13,
        );
        ctx.fillStyle = '#182742';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        const label = p.seat === seat ? '我' : p.name;
        const tw = ctx.measureText(label).width + 12;
        ctx.beginPath();
        ctx.roundRect(x - tw / 2, y + 14, tw, 17, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y + 27);
      });
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mode, seat]);
  return <canvas ref={canvas} className="learning-course" aria-label="全桌选手的实时赛程" role="img" />;
}

function Board({ scores, final }: { scores: LearningScore[]; final: boolean }) {
  const high = Math.max(-1, ...scores.filter((p) => !p.retired).map((p) => p.score));
  return (
    <div className="learning-scores">
      {scores.map((p) => (
        <span key={p.seat}>
          {final && !p.retired && p.score === high ? '★ ' : ''}
          {p.name} <b>{p.score} 分</b>
          {p.retired ? ' · 退赛' : p.done ? ' · 完成' : ''}
        </span>
      ))}
    </div>
  );
}

export function LearningStage({
  mode,
  view,
  seat,
  game,
  muted, audio,
}: {
  mode: LearningMode;
  view: LearningView;
  seat: number;
  game: RaceGame;
  muted: boolean;
  audio: RaceAudio;
}) {
  const [selection, setSelection] = useState({ round: view.round, picks: [] as number[] });
  const picks = selection.round === view.round ? selection.picks : [];
  const setPicks = (next: number[]) => setSelection({ round: view.round, picks: next });
  const [intro, setIntro] = useState(view.round === 0 && !view.verdict && !view.done);
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(() => setIntro(false), 2200);
    return () => clearTimeout(timer);
  }, [intro]);
  const final = game.room?.phase === 'finished';
  const disabled = game.connection !== 'online';
  const verdict = view.verdict?.correct;
  useEffect(() => {
    if (verdict !== undefined) audio.play(verdict ? 'correct' : 'wrong');
  }, [audio, view.round, verdict]);
  const speak = () => {
    if (muted || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const line = new SpeechSynthesisUtterance(view.prompt);
    line.lang = 'en-US';
    line.rate = 0.8;
    speechSynthesis.speak(line);
  };
  useEffect(() => {
    if (muted && 'speechSynthesis' in window) speechSynthesis.cancel();
    return () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, [view.round, muted]);
  const group =
    mode === 'parcel' ? (picks.length === 0 ? [0, 1, 2, 3] : [4, 5, 6, 7]) : view.options.map((_, i) => i);
  const choose = (index: number) => {
    if (disabled || view.verdict || view.done) return;
    audio.unlock();
    if (mode === 'lantern') {
      game.act({ round: view.round, type: 'submit', picks: [index] });
      return;
    }
    if (picks.includes(index)) {
      setPicks(picks.filter((i) => i !== index));
      return;
    }
    if (picks.length < 2) setPicks([...picks, index]);
  };
  useEffect(() => {
    const keydown = (event:KeyboardEvent) => {
      if (intro || disabled || view.done || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable]')) return;
      if (view.verdict) return;
      const i=Number(event.key)-1;
      if (Number.isInteger(i) && i>=0 && i<group.length && !(mode==='parcel' && picks.length===2)) {
        event.preventDefault();
        choose(group[i]);
      }
    };
    window.addEventListener('keydown',keydown);
    return ()=>window.removeEventListener('keydown',keydown);
  });
  return (
    <section className={`learning-stage ${mode}`}>
      {intro && (
        <div className="festival-intro">
          <div>
            <small>上海知识游园会</small>
            <h2>{LEARNING_GAMES[mode].name}</h2>
            <button className="rbtn ghost small" onClick={() => setIntro(false)}>
              跳过片头
            </button>
          </div>
        </div>
      )}
      <Course mode={mode} view={view} seat={seat} />
      <Board scores={view.scores} final={final} />
      <section className="learning-console">
        {view.done || final ? (
          <>
            <h2>{final ? '比赛结束' : '已完成六关'}</h2>
            <p>{final ? '每答对一关得一分，同分并列。' : '可以在上方看队友的进度。'}</p>
            {final && (
              <button className="rbtn primary" disabled={disabled || game.busy} onClick={() => game.replay()}>
                再来一局
              </button>
            )}
          </>
        ) : (
          <>
            <div className="learning-counter">
              {LEARNING_GAMES[mode].subject} · 第 {view.round + 1} / {view.total} 关
            </div>
            <h2 lang={mode === 'parcel' ? 'en' : undefined}>{view.prompt}</h2>
            {mode === 'parcel' && 'speechSynthesis' in window && (
              <button className="rbtn ghost small" disabled={muted} onClick={speak}>
                ▷ 听英文订单
              </button>
            )}
            {view.verdict ? (
              <div className={`learning-feedback${view.verdict.correct ? ' won' : ''}`} role="status">
                <strong>{view.verdict.correct ? '答对了！＋1 分' : '一起看看答案'}</strong>
                <p>{view.verdict.explanation}</p>
                <button
                  className="rbtn primary"
                  disabled={disabled}
                  onClick={() => game.act({ round: view.round, type: 'next' })}
                >
                  {view.round + 1 === view.total ? '完成比赛' : '下一关 →'}
                </button>
              </div>
            ) : (
              <>
                {mode === 'orbit' && (
                  <p>
                    挑两颗能量球　
                    <b>
                      {picks
                        .map((i) => view.options[i])
                        .concat(Array(2 - picks.length).fill('？'))
                        .join(' ＋ ')}{' '}
                      ={' '}
                      {picks.length === 2
                        ? Number((Number(view.options[picks[0]]) + Number(view.options[picks[1]])).toFixed(3))
                        : '？'}
                    </b>
                  </p>
                )}
                {mode === 'parcel' && (
                  <p>
                    {picks.length === 0
                      ? '先选指令的前半句'
                      : picks.length === 1
                        ? '再选指令的后半句'
                        : '核对你的包裹'}
                    　<b>{picks.map((i) => view.options[i]).join(' · ')}</b>
                  </p>
                )}
                {(mode !== 'parcel' || picks.length < 2) && (
                  <div className="learning-options">
                    {group.map((i) => (
                      <button
                        key={i}
                        className="learning-piece"
                        disabled={disabled}
                        aria-pressed={picks.includes(i)}
                        onClick={() => choose(i)}
                      >
                        {view.options[i]}
                      </button>
                    ))}
                  </div>
                )}
                {mode !== 'lantern' && (
                  <div className="learning-actions">
                    <button
                      className="rbtn ghost small"
                      disabled={!picks.length}
                      onClick={() => setPicks([])}
                    >
                      重新选
                    </button>
                    <button
                      className="rbtn primary"
                      disabled={disabled || picks.length !== 2}
                      onClick={() => game.act({ round: view.round, type: 'submit', picks })}
                    >
                      {mode === 'parcel' ? '发出包裹' : '注入能量'}
                    </button>
                  </div>
                )}
                {view.hint ? (
                  <p className="learning-clue" role="status">
                    {view.helper} 打开了线索 · {view.hint}
                  </p>
                ) : (
                  <button
                    className="rbtn ghost small"
                    disabled={disabled}
                    onClick={() => game.act({ round: view.round, type: 'hint' })}
                  >
                    给全桌开线索
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>
    </section>
  );
}
