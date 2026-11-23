import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { traceLight, WORKSHOP_GAMES, WORKSHOP_ROUNDS } from '../shared/workshop.js';
import type { Board, WorkshopAction, WorkshopMode, WorkshopView } from '../shared/workshop.js';
import type { RaceGame } from './use-race-room.js';
import type { RaceAudio } from './race-audio.js';
import { drawModel, models } from './diorama.js';
import './workshop.css';

type GridBoard = Extract<Board, { size: number }>;
function BoardPainting({ board, selected }: { board: GridBoard; selected: number | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const width = canvas.clientWidth;
      if (!width) return;
      const ratio = Math.min(devicePixelRatio, 2);
      canvas.width = canvas.height = Math.round(width * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const step = width / board.size;
      ctx.scale(ratio, ratio);
      if (board.kind === 'atlas') {
        for (let i = 0; i < board.size ** 2; i++) {
          const x = ((i % board.size) + 0.5) * step,
            y = (Math.floor(i / board.size) + 0.48) * step;
          if (i === board.landmark || Math.abs(Math.sin(i * 12.9898 + board.size) * 43758.5453) % 1 < 0.27) {
            drawModel(ctx, models.chartIsland, x, y, step / 73, (i % 5) * 0.34);
            if (i === board.landmark) drawModel(ctx, models.lighthouse, x, y - step * 0.12, step / 58, 0.45);
          } else {
            ctx.strokeStyle = '#baf4dc44';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - step * 0.16, y);
            ctx.quadraticCurveTo(x, y + 5, x + step * 0.16, y);
            ctx.stroke();
          }
          if (i === selected) {
            ctx.strokeStyle = '#fff296';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, step * 0.28, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else {
        const beam = traceLight(board);
        ctx.beginPath();
        beam.path.forEach((p, i) => {
          const x = (p.x + 0.5) * step,
            y = (p.y + 0.5) * step;
          if (!i) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = beam.lit ? '#ffe070' : '#36f3ed';
        ctx.strokeStyle = ctx.shadowColor;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#f0ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (const relay of board.relays) {
          const cx = ((relay % board.size) + 0.5) * step,
            cy = (Math.floor(relay / board.size) + 0.5) * step;
          ctx.beginPath();
          ctx.arc(cx, cy, step * 0.22, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffd86e';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        const x = ((board.target % board.size) + 0.5) * step,
          y = (Math.floor(board.target / board.size) + 0.5) * step;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, step * 0.44);
        glow.addColorStop(0, beam.lit ? '#fffcb3dc' : '#f9c95a75');
        glow.addColorStop(1, '#ffad4200');
        ctx.fillStyle = glow;
        ctx.fillRect(x - step * 0.46, y - step * 0.46, step * 0.92, step * 0.92);
        drawModel(ctx, models.sunCrystal, x, y, step / 46, 0.48);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [board, selected]);
  return <canvas ref={ref} className="workshop-paint" aria-hidden="true" />;
}

function Grid({
  board,
  view,
  choose,
  disabled,
}: {
  board: GridBoard;
  view: WorkshopView;
  choose: (i: number) => void;
  disabled: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const n = board.size;
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n };
    if (!(e.key in deltas) || !(e.target instanceof HTMLButtonElement)) return;
    e.preventDefault();
    const i = Number(e.target.dataset.cell),
      d = deltas[e.key];
    const cells = grid.current?.querySelectorAll<HTMLButtonElement>('button[data-cell]');
    let j = i + d;
    while (cells && j >= 0 && j < n * n && (Math.abs(d) !== 1 || Math.floor(j / n) === Math.floor(i / n))) {
      if (!cells[j].disabled) {
        cells[j].focus();
        break;
      }
      j += d;
    }
  };
  return (
    <div className="workshop-map-wrap">
      <div
        ref={grid}
        className={`workshop-map ${board.kind}-map`}
        style={{ '--cells': n } as CSSProperties}
        onKeyDown={key}
      >
        <BoardPainting board={board} selected={view.selection[0]} />
        {Array.from({ length: n * n }, (_, i) => {
          const col = i % n,
            row = Math.floor(i / n);
          const mirror = board.kind === 'optics' ? board.mirrors.find((m) => m.cell === i) : null;
          const label =
            board.kind === 'atlas'
              ? `第 ${col + board.axisMin} 列，第 ${n - 1 - row + board.axisMin} 行`
              : mirror
                ? `旋转第 ${col + 1} 列第 ${row + 1} 行镜片`
                : i === board.target
                  ? '接收水晶'
                  : '光路';
          return (
            <button
              key={i}
              type="button"
              data-cell={i}
              data-relay={(board.kind === 'optics' && board.relays.includes(i)) || undefined}
              aria-label={label}
              className={`map-cell${mirror ? ' has-mirror' : ''}${view.selection[0] === i ? ' marked' : ''}`}
              disabled={disabled || (board.kind === 'optics' && !mirror)}
              onClick={() => choose(i)}
            >
              {board.kind === 'atlas' && (
                <>
                  {col === 0 && <small className="map-y">{n - 1 - row + board.axisMin}</small>}
                  {row === n - 1 && <small className="map-x">{col + board.axisMin}</small>}
                  {i === board.landmark && <span className="map-pin">灯塔</span>}
                </>
              )}
              {mirror && <i className={mirror.slash ? 'mirror-up' : 'mirror-down'} />}
              {board.kind === 'optics' && col === 0 && row === board.startRow && (
                <span className="beam-source">▶</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkshopStage({
  mode,
  view,
  seat,
  game,
  audio,
}: {
  mode: WorkshopMode;
  view: WorkshopView;
  seat: number;
  game: RaceGame;
  audio: RaceAudio;
}) {
  const [opening, setOpening] = useState(view.round === 0 && !view.finished && view.revision === 0);
  useEffect(() => {
    const id = setTimeout(() => setOpening(false), 1800);
    return () => clearTimeout(id);
  }, []);
  const prevSolved = useRef(view.solved);
  useEffect(() => {
    if (view.solved && !prevSolved.current) audio.play('correct');
    prevSolved.current = view.solved;
  }, [view.solved, audio]);
  const locked = game.connection !== 'online' || view.solved || view.finished;
  const act = (type: WorkshopAction['type'], index?: number, destination?: number) => {
    if (game.connection !== 'online') return;
    audio.unlock();
    game.workshopAct({ round: view.round, revision: view.revision, type, index, destination });
  };
  const board = view.board;
  const valid =
    board.kind === 'optics' ||
    (board.kind === 'atlas' ? view.selection.length === 1 : view.selection.length === board.cards.length);
  const rankings = [...view.players].sort((a, b) => b.points - a.points || a.seat - b.seat);
  return (
    <section className={`workshop-stage ${mode}`}>
      {opening && (
        <div className="workshop-opening">
          <span>上海探索社</span>
          <strong>{WORKSHOP_GAMES[mode].name}</strong>
          <button className="rbtn ghost small" onClick={() => setOpening(false)}>
            跳过片头
          </button>
        </div>
      )}
      <div className="workshop-mast">
        <div>
          <small>{WORKSHOP_GAMES[mode].subject} · 合力赛</small>
          <h1>{view.finished ? '探索完成' : view.title}</h1>
        </div>
        <b>
          {view.round + 1} / {WORKSHOP_ROUNDS}
        </b>
      </div>
      <div className="workshop-scores" aria-label="全桌贡献星">
        {rankings.map((p) => (
          <span key={p.seat}>
            {p.name}
            {p.seat === seat ? '（我）' : ''} <b>★ {p.points}</b>
            {p.retired ? ' · 退赛' : game.room?.players[p.seat]?.online ? '' : ' · 重连中'}
          </span>
        ))}
      </div>
      {view.finished ? (
        <div className="workshop-end">
          <h2>四站展览闭幕</h2>
          <p>每站参与解题得一星，完成正确检验再得一星。</p>
          <button
            className="rbtn primary"
            disabled={game.connection !== 'online' || game.busy}
            onClick={() => game.replay()}
          >
            再来一局
          </button>
        </div>
      ) : (
        <div className="workshop-layout">
          <div className="workshop-board">
            {board.kind === 'chronicle' ? (
              <div className="museum">
                <ol className="museum-case" aria-label="当前时间线">
                  {Array.from({ length: board.cards.length }, (_, i) => (
                    <li
                      key={i}
                      draggable={!locked && view.selection[i] !== undefined}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                      onDragOver={(e) => {
                        if (!locked && view.selection[i] !== undefined) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const source = e.dataTransfer.getData('text/plain');
                        if (/^\d+$/.test(source)) act('move', Number(source), i);
                      }}
                    >
                      <span>{i + 1}</span>
                      <strong>
                        {view.selection[i] === undefined ? '待布展' : board.cards[view.selection[i]]}
                      </strong>
                      {view.selection[i] !== undefined && !locked && (
                        <div className="museum-reorder">
                          <button
                            aria-label={`第 ${i + 1} 件上移`}
                            disabled={i === 0}
                            onClick={() => act('move', i, i - 1)}
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`第 ${i + 1} 件下移`}
                            disabled={i + 1 >= view.selection.length}
                            onClick={() => act('move', i, i + 1)}
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                <div className="museum-tray">
                  {board.cards.map((c, i) => (
                    <button
                      key={c}
                      disabled={locked || view.selection.includes(i)}
                      className="exhibit"
                      onClick={() => act('select', i)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Grid board={board} view={view} choose={(i) => act('select', i)} disabled={locked} />
            )}
          </div>
          <div className="workshop-log">
            <h2>{mode === 'atlas' ? '探险日志' : mode === 'optics' ? '工坊任务' : '策展委托'}</h2>
            <p>{view.prompt}</p>
            {mode === 'atlas' && <small>上北下南 · 左西右东</small>}
            {mode === 'optics' && <small>点镜片转向 · 金色水晶为终点</small>}
            {view.hint ? (
              <p className="workshop-hint">{view.hint}</p>
            ) : (
              !view.solved && (
                <button className="rbtn ghost small" disabled={locked} onClick={() => act('hint')}>
                  给全桌开线索
                </button>
              )
            )}
            {view.message && (
              <div className={`workshop-message${view.solved ? ' solved' : ''}`} role="status">
                {view.solved && <strong>✦ 破解成功</strong>}
                <p>{view.message}</p>
              </div>
            )}
            {view.solved ? (
              <button
                className="rbtn primary"
                disabled={game.connection !== 'online'}
                onClick={() => act('next')}
              >
                {view.round === WORKSHOP_ROUNDS - 1 ? '完成探索' : '进入下一站'}
              </button>
            ) : (
              <>
                <button className="rbtn primary" disabled={locked || !valid} onClick={() => act('test')}>
                  {mode === 'optics' ? '检验光路' : mode === 'atlas' ? '挖掘宝箱' : '检验时间线'}
                </button>
                {mode === 'chronicle' && (
                  <div className="workshop-tools">
                    <button
                      className="rbtn ghost small"
                      disabled={locked || !view.selection.length}
                      onClick={() => act('undo')}
                    >
                      撤回一件
                    </button>
                    <button
                      className="rbtn ghost small"
                      disabled={locked || !view.selection.length}
                      onClick={() => act('clear')}
                    >
                      重新布展
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
