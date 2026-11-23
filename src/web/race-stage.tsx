import { useEffect, useMemo, useRef, useState } from 'react';
import { FUEL_MAX, STATION_COST } from '../shared/race.js';
import type { PlayerStatus } from '../shared/race.js';
import { trackById } from '../shared/race-tracks.js';
import type { RaceRoomView, RaceSeat } from '../shared/race-protocol.js';
import type { RaceGame } from './use-race-room.js';
import type { RaceAudio } from './race-audio.js';
import {
  buildObstacles, buildScenery, CAR_SCREEN_X, CAR_W, laneCenter, RaceParticles, paintRaceFrame,
  VIEW_HEIGHT, VIEW_WIDTH, CAR_COLORS,
} from './race-render.js';
import { PlayerCard } from './race-hud.js';

interface Props {
  room: RaceRoomView;
  seat: RaceSeat;
  game: RaceGame;
  audio: RaceAudio;
  onExit: () => void;
}

interface Display {
  x: number; laneY: number; hitFlash: number; shake: number; exhaustClock: number; smokeClock: number;
}

interface Prev {
  hits: number; fuel: number; status: PlayerStatus; quizPhase: string | null; countdown: number | null;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export function RaceStage({ room, seat, game, audio, onExit }: Props) {
  const track = trackById(room.trackId);
  const obstacles = useMemo(() => buildObstacles(track), [track]);
  const scenery = useMemo(() => buildScenery(track), [track]);
  const me = room.players[seat];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef(room);
  const snapshotAt = useRef(performance.now());
  const display = useRef<Display>({ x: 0, laneY: 1, hitFlash: 0, shake: 0, exhaustClock: 0, smokeClock: 0 });
  const prev = useRef<Prev>({ hits: 0, fuel: room.startFuel, status: 'racing', quizPhase: null, countdown: null });
  const particles = useRef(new RaceParticles());
  const [spectating, setSpectating] = useState(false);
  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const [touch, setTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    roomRef.current = room;
    snapshotAt.current = performance.now();
  }, [room]);

  useEffect(() => {
    if (room.phase === 'finished' || room.phase === 'lobby') setSpectating(false);
  }, [room.phase]);

  useEffect(() => {
    const quiz = room.quiz;
    if (quiz && quiz.phase === 'reveal' && quiz.wasCorrect !== null) {
      setMarks(current => ({ ...current, [quiz.index]: quiz.wasCorrect! }));
    }
    if (quiz && quiz.index === 0 && quiz.phase === 'question') setMarks({});
  }, [room.quiz]);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setTouch(query.matches || window.innerWidth < 760);
    update();
    window.addEventListener('resize', update);
    query.addEventListener('change', update);
    return () => { window.removeEventListener('resize', update); query.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    if (room.phase === 'playing') {
      audio.startMusic(track.theme);
      audio.startEngine();
    } else {
      audio.stopMusic();
      audio.stopEngine();
    }
    return () => { audio.stopMusic(); audio.stopEngine(); };
  }, [room.phase, track.theme, audio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let scale = 1;
    let frame = 0;
    let last = 0;

    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      canvas.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = canvas.height / VIEW_HEIGHT;
    });
    observer.observe(canvas);

    const draw = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
      last = time;
      const current = roomRef.current;
      const player = current.players[seat];
      const d = display.current;
      const p = prev.current;
      const carY = laneCenter(d.laneY);

      if (player) {
        if (player.hits > p.hits) {
          d.hitFlash = 1; d.shake = 1;
          particles.current.burst(d.x, carY, '#ff4d4d', 18);
          particles.current.burst(d.x, carY, '#ffc233', 8);
          audio.play('hit');
        }
        if (player.fuel > p.fuel) particles.current.refuel(d.x, carY - 30);
        if (player.status !== p.status) {
          if (player.status === 'quiz') audio.play('station');
          if (player.status === 'eliminated') { audio.play('eliminated'); particles.current.burst(d.x, carY, '#9aa3b5', 24, 'smoke'); }
          if (player.status === 'finished') {
            audio.play('finish');
            for (const color of CAR_COLORS) particles.current.burst(d.x, carY - 20, color, 16, 'confetti');
          }
        }
        const quiz = current.quiz;
        if (quiz?.phase === 'reveal' && p.quizPhase !== 'reveal') audio.play(quiz.wasCorrect ? 'correct' : 'wrong');
        const cdNum = current.countdownMs != null ? Math.ceil(current.countdownMs / 1000) : null;
        if (cdNum != null && cdNum >= 1 && cdNum !== p.countdown) audio.play('count');
        if (cdNum == null && p.countdown != null) audio.play('go');
        prev.current = { hits: player.hits, fuel: player.fuel, status: player.status, quizPhase: quiz?.phase ?? null, countdown: cdNum };

        if (player.status === 'racing') {
          const age = Math.min(0.12, (performance.now() - snapshotAt.current) / 1000);
          const target = player.x + track.speed * age;
          d.x += (target - d.x) * Math.min(1, dt * 14);
          d.laneY += (player.lane - d.laneY) * Math.min(1, dt * 11);
          d.exhaustClock += dt;
          if (d.exhaustClock > 0.045) {
            d.exhaustClock = 0;
            particles.current.exhaust(d.x - CAR_W / 2, carY + (Math.random() - 0.5) * 16, true);
          }
          audio.setEngineIntensity(1);
        } else {
          d.x += (player.x - d.x) * Math.min(1, dt * 10);
          d.laneY += (player.lane - d.laneY) * Math.min(1, dt * 11);
          audio.setEngineIntensity(player.status === 'quiz' ? 0.25 : 0);
          if (player.status === 'eliminated') {
            d.smokeClock += dt;
            if (d.smokeClock > 0.12) { d.smokeClock = 0; particles.current.exhaust(d.x - 10, carY - 10, false); }
          }
        }
        d.hitFlash = Math.max(0, d.hitFlash - dt * 2.2);
        d.shake = Math.max(0, d.shake - dt * 3);
      }

      particles.current.update(dt);
      const cameraX = d.x - CAR_SCREEN_X;
      ctx!.setTransform(scale, 0, 0, scale, 0, 0);
      if (d.shake > 0) ctx!.translate((Math.random() - 0.5) * d.shake * 9, (Math.random() - 0.5) * d.shake * 9);
      paintRaceFrame(ctx!, {
        track, obstacles, scenery, cameraX,
        laneY: d.laneY, color: player?.color ?? seat, status: player?.status ?? 'racing',
        hitFlash: d.hitFlash, boost: player?.status === 'racing',
        stationActive: current.quiz?.station ?? null, time: time / 1000, particles: particles.current,
      });
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); particles.current.clear(); };
  }, [track, obstacles, scenery, seat, audio]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const current = roomRef.current;
      const player = current.players[seat];
      const quiz = current.quiz;
      if (quiz && player?.status === 'quiz') {
        if (quiz.phase === 'question') {
          const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
          const numpad = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(event.code);
          const option = digit >= 0 ? digit : numpad;
          if (option >= 0) { event.preventDefault(); audio.unlock(); game.answer(option); }
        } else if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault(); audio.unlock(); game.advance();
        }
        return;
      }
      if (event.repeat) {
        if (['ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
        return;
      }
      if (event.code === 'ArrowUp' || event.code === 'KeyW') { event.preventDefault(); audio.unlock(); game.lane(-1); }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') { event.preventDefault(); audio.unlock(); game.lane(1); }
      if (event.code === 'Enter' && current.phase === 'finished') { event.preventDefault(); game.replay(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [seat, game, audio]);

  const pad = (direction: number) => {
    const id = direction < 0 ? 'up' : 'down';
    const release = () => setPressed(current => ({ ...current, [id]: false }));
    return {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        audio.unlock();
        game.lane(direction);
        setPressed(current => ({ ...current, [id]: true }));
      },
      onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
      'aria-pressed': Boolean(pressed[id]),
    };
  };

  const present = room.players.filter((player): player is NonNullable<typeof player> => player !== null);
  const stationFractions = track.stations.map(s => s / track.length);
  const quiz = room.quiz;
  const countdownNum = room.countdownMs != null ? Math.ceil(room.countdownMs / 1000) : null;
  const showGo = room.countdownMs == null && room.phase === 'playing' && room.elapsedMs < 850;
  const myStatus = me?.status ?? 'racing';
  const showResults = room.phase === 'finished' && room.standings;
  const showOut = !showResults && !spectating && myStatus === 'eliminated';
  const showDone = !showResults && !spectating && myStatus === 'finished';

  return <section className="race-play">
    <div className="race-hud">
      {present.map(player => <PlayerCard key={player.seat} player={player} own={player.seat === seat}
        stations={track.stations} length={track.length} />)}
    </div>

    <div className="race-scene">
      <canvas className="race-canvas" ref={canvasRef} role="img" aria-label={`${track.name} 赛车画面`} />

      {(countdownNum != null || showGo) && !quiz && <div className="race-overlay">
        <div className={`race-count${showGo ? ' go' : ''}`} key={showGo ? 'go' : countdownNum}>
          {showGo ? 'GO!' : countdownNum}
        </div>
        <p>准备出发！答对题目加油，撞障碍漏油，油尽就被淘汰。</p>
      </div>}

      {quiz && me && <div className="race-quiz">
        <div className="race-quiz-card">
          <div className="race-quiz-top">
            <span className="race-quiz-station">服务区 {quiz.station + 1} · 第 {quiz.index + 1}/{quiz.total} 题</span>
            <span className={`race-quiz-subject ${quiz.subject}`}>{quiz.subject === 'chinese' ? '语文' : '数学'}</span>
            <span className="race-chip">{quiz.topic}</span>
            <span className="race-quiz-dots">
              {Array.from({ length: quiz.total }, (_, i) => {
                const cls = i < quiz.index ? (marks[i] ? 'done' : 'miss') : i === quiz.index ? 'now' : '';
                return <span key={i} className={cls} />;
              })}
            </span>
          </div>
          <p className="race-quiz-prompt">{quiz.prompt}</p>
          <div className="race-quiz-options">
            {quiz.options.map((option, i) => {
              const reveal = quiz.phase === 'reveal';
              const cls = reveal ? (i === quiz.answer ? 'correct' : i === quiz.picked ? 'wrong' : '') : '';
              return <button key={i} className={`race-opt ${cls}`} disabled={reveal}
                onClick={() => { audio.unlock(); game.answer(i); }}>
                <span className="key">{OPTION_KEYS[i]}</span><span>{option}</span>
              </button>;
            })}
          </div>
          {quiz.phase === 'reveal' && <div className={`race-quiz-reveal ${quiz.wasCorrect ? 'good' : 'bad'}`}>
            <div className="race-quiz-verdict">{quiz.wasCorrect ? '答对了！油箱 +1 格' : `答错了，正确答案是 ${OPTION_KEYS[quiz.answer ?? 0]}`}</div>
            <p className="race-quiz-explain">{quiz.explain}</p>
          </div>}
          <div className="race-quiz-foot">
            <span className="race-quiz-fuel">当前油量 <b>{me.fuel}/{FUEL_MAX}</b> · 出站消耗 {STATION_COST} 格</span>
            {quiz.phase === 'reveal' && <button className="rbtn primary" onClick={() => { audio.unlock(); game.advance(); }}>
              {quiz.index + 1 < quiz.total ? '下一题 →' : '加满油，出发！'}
            </button>}
          </div>
        </div>
      </div>}

      {showOut && <div className="race-overlay">
        <h2>燃油耗尽，被淘汰了</h2>
        <p>答对 {me?.correctTotal ?? 0} 题 · 碰撞 {me?.hits ?? 0} 次 · 跑完全程的 {Math.round((me?.progress ?? 0) * 100)}%。<br />别灰心，下次多答对几道题就能跑得更远！</p>
        <div className="actions">
          <button className="rbtn primary" onClick={() => setSpectating(true)}>继续观战</button>
          <button className="rbtn ghost" onClick={onExit}>退出比赛</button>
        </div>
      </div>}

      {showDone && <div className="race-overlay">
        <h2>冲线成功！</h2>
        <p>你到达了终点，答对 {me?.correctTotal ?? 0} 题。等其他车手完赛，看看最终排名。</p>
        <div className="actions">
          <button className="rbtn primary" onClick={() => setSpectating(true)}>继续观战</button>
          <button className="rbtn ghost" onClick={onExit}>退出比赛</button>
        </div>
      </div>}

      {showResults && <div className="race-overlay">
        <h2>{room.standings!.finished.some(row => row.seat === seat) ? '比赛结束 · 你完赛了！' : '比赛结束'}</h2>
        <div className="race-results">
          {room.standings!.finished.length > 0 && <div>
            <h3>到达终点</h3>
            <div className="race-podium">
              {room.standings!.finished.map((row, index) => <div key={row.seat} className={`race-row${index === 0 ? ' gold' : ''}`}>
                <span className="race-rank">{index + 1}</span>
                <span className="race-dot" style={{ background: CAR_COLORS[row.color] }} />
                <span className="race-row-name">{row.name}{row.seat === seat ? '（你）' : ''}</span>
                <span className="race-row-stat">答对 <b>{row.correctTotal}</b> · 用时 <b>{((row.finishMs ?? 0) / 1000).toFixed(1)}s</b></span>
              </div>)}
            </div>
          </div>}
          {room.standings!.eliminated.length > 0 && <div>
            <h3>中途淘汰</h3>
            <div className="race-podium">
              {room.standings!.eliminated.map(row => <div key={row.seat} className="race-row out">
                <span className="race-rank">✕</span>
                <span className="race-dot" style={{ background: CAR_COLORS[row.color] }} />
                <span className="race-row-name">{row.name}{row.seat === seat ? '（你）' : ''}</span>
                <span className="race-row-stat">跑到 <b>{Math.round(row.progress * 100)}%</b> · 答对 <b>{row.correctTotal}</b></span>
              </div>)}
            </div>
          </div>}
        </div>
        <div className="actions">
          <button className="rbtn primary" onClick={() => { audio.unlock(); game.replay(); }}>再来一局</button>
          <button className="rbtn ghost" onClick={onExit}>退出比赛</button>
        </div>
      </div>}
    </div>

    <p className="race-hint"><b>玩法：</b>↑↓ 变道躲障碍，撞一次漏 1 格油；进服务区答 4 题，答对 +1 格，出站扣 3 格；油尽淘汰，先到终点获胜。当前赛道 {track.name}。</p>

    {touch ? <div className="race-pads">
      <button className="race-pad up" aria-label="向上变道" {...pad(-1)}>▲<small>上变道 (W / ↑)</small></button>
      <button className="race-pad down" aria-label="向下变道" {...pad(1)}>▼<small>下变道 (S / ↓)</small></button>
    </div> : <div className="race-deck">
      <div className="race-keys">
        <div><kbd>↑</kbd><kbd>W</kbd>上变道</div>
        <div><kbd>↓</kbd><kbd>S</kbd>下变道</div>
        <div>答题 <kbd>1</kbd>~<kbd>4</kbd> 选择，<kbd>回车</kbd> 继续</div>
      </div>
      <button className="rbtn ghost small" onClick={() => setTouch(true)}>显示触屏按键</button>
    </div>}
  </section>;
}