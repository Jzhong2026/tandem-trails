import { useEffect, useMemo, useRef, useState } from 'react';
import { FUEL_MAX, STATION_COST } from '../shared/race.js';
import type { PlayerStatus } from '../shared/race.js';
import { SUBJECT_NAMES } from '../shared/study.js';
import { numberGates, trackById } from '../shared/race-tracks.js';
import type { RaceRoomView, RaceSeat } from '../shared/race-protocol.js';
import type { RaceGame } from './use-race-room.js';
import type { RaceAudio } from './race-audio.js';
import {
  buildObstacles, buildScenery, CAM_BACK, createCamera, RaceParticles, paintRaceFrame2D,
  paintRaceOverlay, PALETTES, CAR_COLORS,
} from './race-render.js';
import type { Camera } from './race-render.js';
import { RaceScene } from './race-scene.js';
import type { SceneAnchors } from './race-scene.js';
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

const OPTION_KEYS = ['1', '2', '3', '4'];

export function RaceStage({ room, seat, game, audio, onExit }: Props) {
  const track = trackById(room.trackId);
  const obstacles = useMemo(() => buildObstacles(track), [track]);
  const { grade, term } = room.course;
  const course = useMemo(()=>({grade,term}),[grade,term]);
  const gates = useMemo(() => numberGates(track,course), [track,course]);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const scenery = useMemo(() => buildScenery(track), [track]);
  const me = room.players[seat];

  const truck = me?.truck ?? 'scania';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef(room);
  const snapshotAt = useRef(performance.now());
  const cameraRef = useRef<Camera>(createCamera(800, 600));
  const display = useRef<Display>({ x: 0, laneY: 1, hitFlash: 0, shake: 0, exhaustClock: 0, smokeClock: 0 });
  const prev = useRef<Prev>({ hits: 0, fuel: room.startFuel, status: 'racing', quizPhase: null, countdown: null });
  const particles = useRef(new RaceParticles());
  const [skipIntro,setSkipIntro]=useState(false);
  const [spectating, setSpectating] = useState(false);
  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [reviewPick, setReviewPick] = useState<number | null>(null);
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
    if (room.phase !== 'finished') {
      setReviewIndex(null);
      setReviewPick(null);
    }
  }, [room.phase]);

  useEffect(() => {
    if (room.reviewDone) {
      setReviewIndex(null);
      setReviewPick(null);
    }
  }, [room.reviewDone]);

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
    const glCanvas = glCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let scene: RaceScene | null = null;
    if (glCanvas) {
      try {
        scene = new RaceScene(glCanvas, track, obstacles, scenery, truck, course);
        scene.setPlayerNumber((roomRef.current.players[seat]?.color ?? seat) + 1);
      } catch {
        scene = null;
        glCanvas.style.display = 'none';
      }
    }
    let scale = 1;
    let frame = 0;
    let last = 0;

    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      canvas.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = dpr;
      cameraRef.current = createCamera(entry.contentRect.width, entry.contentRect.height);
      scene?.setSize(entry.contentRect.width, entry.contentRect.height, dpr);
    });
    observer.observe(canvas);

    const draw = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
      last = time;
      const current = roomRef.current;
      const player = current.players[seat];
      const d = display.current;
      const p = prev.current;
      const cam = cameraRef.current;
      const status = player?.status ?? 'racing';
      const color = player?.color ?? seat;

      if (player) {
        if (status === 'racing') {
          const age = Math.min(0.12, (performance.now() - snapshotAt.current) / 1000);
          const target = player.x + track.speed * age;
          d.x += (target - d.x) * Math.min(1, dt * 14);
        } else {
          d.x += (player.x - d.x) * Math.min(1, dt * 10);
        }
        d.laneY += (player.lane - d.laneY) * Math.min(1, dt * 11);
      }

      let anchor: SceneAnchors | null = null;
      if (scene) {
        scene.render({
          track, cameraX: d.x - CAM_BACK, laneY: d.laneY, color, status,
          hitFlash: d.hitFlash, shake: d.shake, stationActive: current.quiz?.station ?? null,
          time: time / 1000, dt,
        });
        anchor = scene.anchors();
      }
      const truckScale = cam.truckW / 100;
      const truckX = anchor ? anchor.hitX : cam.width / 2 + (d.laneY - 1) * cam.truckLanePx;
      const truckY = anchor ? anchor.hitY : cam.truckGroundY - 70 * truckScale;
      const exhaustX = anchor ? anchor.exhaustX : truckX - 36 * truckScale;
      const exhaustY = anchor ? anchor.exhaustY : cam.truckGroundY - 6;
      const roofX = anchor ? anchor.roofX : truckX;
      const roofY = anchor ? anchor.roofY : cam.truckGroundY - 150 * truckScale;

      if (player) {
        if (player.hits > p.hits) {
          d.hitFlash = 1; d.shake = 1;
          particles.current.burst(truckX, truckY, '#ff4d4d', 18);
          particles.current.burst(truckX, truckY, '#ffc233', 8);
          audio.play('hit');
        }
        if (player.fuel > p.fuel) particles.current.refuel(roofX, roofY);
        if (player.status !== p.status) {
          if (player.status === 'quiz') audio.play('station');
          if (player.status === 'eliminated') {
            audio.play('eliminated');
            particles.current.burst(exhaustX, exhaustY, '#9aa3b5', 24, 'smoke');
          }
          if (player.status === 'finished') {
            audio.play('finish');
            for (const confetti of CAR_COLORS) {
              particles.current.burst(roofX, roofY, confetti, 16, 'confetti');
            }
          }
        }
        const quiz = current.quiz;
        if (quiz?.phase === 'reveal' && p.quizPhase !== 'reveal') audio.play(quiz.wasCorrect ? 'correct' : 'wrong');
        const cdNum = current.countdownMs != null ? Math.ceil(current.countdownMs / 1000) : null;
        if (cdNum != null && cdNum >= 1 && cdNum !== p.countdown) audio.play('count');
        if (cdNum == null && p.countdown != null) audio.play('go');
        prev.current = { hits: player.hits, fuel: player.fuel, status: player.status, quizPhase: quiz?.phase ?? null, countdown: cdNum };

        if (status === 'racing') {
          d.exhaustClock += dt;
          if (d.exhaustClock > 0.05) {
            d.exhaustClock = 0;
            particles.current.exhaust(exhaustX, exhaustY, true);
          }
          audio.setEngineIntensity(1);
        } else {
          audio.setEngineIntensity(status === 'quiz' ? 0.25 : 0);
          if (status === 'eliminated') {
            d.smokeClock += dt;
            if (d.smokeClock > 0.12) {
              d.smokeClock = 0;
              particles.current.exhaust(exhaustX, exhaustY - 20, false);
            }
          }
        }
        d.hitFlash = Math.max(0, d.hitFlash - dt * 2.2);
        d.shake = Math.max(0, d.shake - dt * 3);
      }

      particles.current.update(dt);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (scene && anchor) {
        ctx.clearRect(0, 0, cam.width, cam.height);
        paintRaceOverlay(ctx, {
          width: cam.width, height: cam.height, palette: PALETTES[track.theme],
          particles: particles.current,
          gauge: {
            x: anchor.roofX, groundY: anchor.groundY, scale: anchor.pxPerM / 40,
            fuel: player?.fuel ?? room.startFuel, fuelMax: FUEL_MAX, roofY: anchor.roofY,
          },
          boost: status === 'racing', shake: d.shake, hitFlash: d.hitFlash,
        });
      } else {
        if (d.shake > 0) ctx.translate((Math.random() - 0.5) * d.shake * 9, (Math.random() - 0.5) * d.shake * 9);
        paintRaceFrame2D(ctx, {
          truck, track, obstacles, scenery, camera: cam, cameraX: d.x - CAM_BACK,
          laneY: d.laneY, color, status, hitFlash: d.hitFlash, boost: status === 'racing',
          stationActive: current.quiz?.station ?? null, time: time / 1000, particles: particles.current,
          fuel: player?.fuel ?? room.startFuel, fuelMax: FUEL_MAX,
        });
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      particles.current.clear();
      scene?.dispose();
    };
  }, [track, obstacles, scenery, seat, audio, truck,course]);

  const review = room.review ?? [];
  const reviewEntry = reviewIndex != null ? review[reviewIndex] : undefined;
  const pendingReview = room.phase === 'finished' && review.length > 0 && !room.reviewDone;

  const pickReview = (option: number) => {
    if (reviewEntry && option < reviewEntry.options.length && reviewPick === null) {
      setReviewPick(option);
      audio.unlock();
      audio.play(option === reviewEntry.answer ? 'correct' : 'wrong');
    }
  };

  const finishReview = () => {
    setReviewPick(null);
    if (!reviewEntry || reviewPick !== reviewEntry.answer) return;
    if (reviewIndex != null && reviewIndex >= review.length - 1) {
      void game.reviewDone();
    } else {
      setReviewIndex((current) => (current == null ? null : current + 1));
    }
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
      const current = roomRef.current;
      const player = current.players[seat];
      if (reviewEntry) {
        if (reviewPick === null) {
          const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
          const numpad = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(event.code);
          const option = digit >= 0 ? digit : numpad;
          if (option >= 0) { event.preventDefault(); pickReview(option); }
        } else if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          finishReview();
        }
        return;
      }
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
      if (player?.status !== 'racing' || current.phase !== 'playing') return;
      if (['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(event.code)) { event.preventDefault(); audio.unlock(); game.lane(-1); }
      if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(event.code)) { event.preventDefault(); audio.unlock(); game.lane(1); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [seat, game, audio, reviewEntry, reviewPick, reviewIndex]);

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
  const quiz = room.quiz;
  const countdownNum = room.countdownMs != null ? Math.ceil(room.countdownMs / 1000) : null;
  const showGo = room.countdownMs == null && room.phase === 'playing' && room.elapsedMs < 850;
  const myStatus = me?.status ?? 'racing';
  const showResults = room.phase === 'finished' && room.standings;
  const showOut = !showResults && !spectating && myStatus === 'eliminated';
  const showDone = !showResults && !spectating && myStatus === 'finished';
  const othersPending = present.filter(player => player.seat !== seat && player.reviewWrong > 0 && !player.reviewDone);

  const gate = gates[me?.stationsCleared ?? 0];
  const distance = gate && me ? gate.x - me.x : Infinity;
  const driving = room.phase === 'playing' && myStatus === 'racing';
  return <section className="race-play">
    <div className="race-hud">
      {present.map(player => <PlayerCard key={player.seat} player={player} own={player.seat === seat}
        stations={track.stations} length={track.length} />)}
    </div>

    <div className="race-scene">
      <canvas className="race-gl" ref={glCanvasRef} aria-hidden="true" />
      <canvas className="race-canvas" ref={canvasRef}
        onPointerDown={event => {
          if (!driving || !event.isPrimary || event.button !== 0) return;
          swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { swipe.current = null; }}
        onPointerUp={event => {
          const start = swipe.current;
          swipe.current = null;
          if (!driving || start?.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
            audio.unlock();
            game.lane(Math.sign(dx));
          }
        }} role="img" aria-label={`${track.name} 赛车画面`} />

      {driving && me && gate && distance <= track.speed * 5 && distance > -track.speed * 1.8 && <div className="number-gate">
        {distance > 0 ? <>
          <small>算一算，开进答案车道</small><strong>{gate.prompt} = ?</strong>
          <div>{gate.values.map((value, lane) => <span key={lane} className={me.lane === lane ? 'selected' : ''}>{value}</span>)}</div>
        </> : <strong>{me.lastGateCorrect ? '✓ ' : ''}{gate.prompt} = {gate.values[gate.answerLane]}</strong>}
      </div>}
      {(countdownNum != null || showGo) && !quiz && !skipIntro && <div className="race-overlay grid-intro">
        <div className={`race-count${showGo ? ' go' : ''}`} key={showGo ? 'go' : countdownNum}>
          {showGo ? 'GO!' : countdownNum}
        </div>
        <p>左右变道，穿过正确的数字门加油。</p>
        <button className="rbtn ghost small" onClick={()=>setSkipIntro(true)}>跳过片头</button>
      </div>}

      {quiz && me && <div className="race-quiz">
        <div className="race-quiz-card">
          <div className="pit-banner" aria-hidden="true"/>
          <div className="race-quiz-top">
            <span className="race-quiz-station">服务区 {quiz.station + 1} · 第 {quiz.index + 1}/{quiz.total} 题</span>
            <span className={`race-quiz-subject ${quiz.subject}`}>{SUBJECT_NAMES[quiz.subject]}</span>
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
            {quiz.wasCorrect && <div className="fuel-spark" aria-hidden="true"><i/><i/><i/></div>}
            <div className="race-quiz-verdict" role="status">{quiz.wasCorrect ? (quiz.gainedFuel ? '答对了！油箱 +1 格' : '答对了！油箱已满') : `答错了，正确答案是 ${OPTION_KEYS[quiz.answer ?? 0]}`}</div>
            <p className="race-quiz-explain">{quiz.explain}</p>
          </div>}
          <div className="race-quiz-foot">
            <span className={`race-quiz-fuel${quiz.phase==='reveal' && quiz.wasCorrect?' refilled':''}`}>当前油量 <b>{me.fuel}/{FUEL_MAX}</b> · 出站消耗 {STATION_COST} 格</span>
            {quiz.phase === 'reveal' && <button className="rbtn primary" onClick={() => { audio.unlock(); game.advance(); }}>
              {quiz.index + 1 < quiz.total ? '下一题 →' : '驶出服务区 →'}
            </button>}
          </div>
        </div>
      </div>}

      {reviewEntry && <div className="race-quiz race-review">
        <div className="race-quiz-card">
          <div className="race-quiz-top">
            <span className="race-quiz-station">错题复习 · 第 {(reviewIndex ?? 0) + 1}/{review.length} 题</span>
            <span className={`race-quiz-subject ${reviewEntry.subject}`}>{SUBJECT_NAMES[reviewEntry.subject]}</span>
            <span className="race-chip">{reviewEntry.topic}</span>
            <span className="race-quiz-dots">
              {review.map((entry, i) => {
                const cls = i < (reviewIndex ?? 0) ? 'done' : i === reviewIndex ? 'now' : '';
                return <span key={entry.id} className={cls} />;
              })}
            </span>
          </div>
          <p className="race-quiz-prompt">{reviewEntry.prompt}</p>
          <div className="race-quiz-options">
            {reviewEntry.options.map((option, i) => {
              const reveal = reviewPick !== null;
              const cls = reveal ? (i === reviewEntry.answer ? 'correct' : i === reviewPick ? 'wrong' : '') : '';
              return <button key={i} className={`race-opt ${cls}`} disabled={reveal}
                onClick={() => pickReview(i)}>
                <span className="key">{OPTION_KEYS[i]}</span><span>{option}</span>
              </button>;
            })}
          </div>
          {reviewPick !== null && <div className={`race-quiz-reveal ${reviewPick === reviewEntry.answer ? 'good' : 'bad'}`}>
            <div className="race-quiz-verdict">
              {reviewPick === reviewEntry.answer ? '这次答对了！' : `再记一记，正确答案是 ${OPTION_KEYS[reviewEntry.answer]}`}
            </div>
            <p className="race-quiz-explain">{reviewEntry.explain}</p>
          </div>}
          <div className="race-quiz-foot">
            <span className="race-quiz-fuel">这局这道题你原来答错了，复习完才能开始下一局。</span>
            {reviewPick !== null && <button className="rbtn primary" onClick={finishReview}>
              {reviewPick !== reviewEntry.answer ? '再试一次' : (reviewIndex ?? 0) + 1 < review.length ? '下一题 →' : '复习完成'}
            </button>}
          </div>
        </div>
      </div>}

      {showOut && <div className="race-overlay">
        <h2>燃油耗尽，被淘汰了</h2>
        <p>答对 {me?.correctTotal ?? 0} 题 · 碰撞 {me?.hits ?? 0} 次 · 跑完全程的 {Math.round((me?.progress ?? 0) * 100)}%。<br />别灰心，赛后还能把答错的题重新学一遍！</p>
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

      {showResults && !reviewEntry && <div className="race-overlay">
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
        {pendingReview && <div className="race-review-gate">
          <p>本局有 <b>{review.length}</b> 道题没答对，先把它们复习一遍才能开下一局。</p>
          <button className="rbtn amber big" onClick={() => { setReviewIndex(0); setReviewPick(null); }}>
            开始复习错题
          </button>
        </div>}
        {!pendingReview && <div className="actions">
          <button className="rbtn primary" onClick={() => { audio.unlock(); game.replay(); }}>再来一局</button>
          <button className="rbtn ghost" onClick={onExit}>退出比赛</button>
        </div>}
        {othersPending.length > 0 && <p className="race-assist">
          等 {othersPending.map(player => player.name).join('、')} 复习完就能开始下一局。
        </p>}
      </div>}
    </div>

    <p className="race-hint"><b>玩法：</b>左右变道躲障碍，选对数字门补 1 格油，撞一次漏 1 格油；进服务区答 4 题，答对 +1 格，出站扣 3 格；油尽淘汰，先到终点获胜。赛后要把答错的题复习一遍才能再来一局。当前赛道 {track.name}。</p>

    {touch ? <div className="race-pads">
      <button disabled={!driving} className="race-pad up" aria-label="向左变道" {...pad(-1)}>◀<small>向左</small></button>
      <button disabled={!driving} className="race-pad down" aria-label="向右变道" {...pad(1)}>▶<small>向右</small></button>
    </div> : <div className="race-deck">
      <div className="race-keys">
        <div><kbd>←</kbd><kbd>A</kbd>向左</div>
        <div><kbd>→</kbd><kbd>D</kbd>向右</div>
        <div>答题 <kbd>1</kbd>~<kbd>4</kbd> 选择，<kbd>回车</kbd> 继续</div>
      </div>
      <button className="rbtn ghost small" onClick={() => setTouch(true)}>显示触屏按键</button>
    </div>}
  </section>;
}
