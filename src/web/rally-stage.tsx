import { useCallback, useEffect, useRef, useState } from 'react';
import type { RallyChallenge, RallyRun, RallyZoneKind } from '../shared/knowledge-rally.js';
import {
  activeRallyZone, advanceRallyQuiz, answerRally, calculateRallyStars, retryRallyQuestion, steerRally, stepRally,
} from '../shared/knowledge-rally.js';
import type { RaceEventKind } from '../shared/race.js';
import { RaceAudio } from './race-audio.js';
import { RallyScene } from './rally-scene.js';
import { paintRallyFallback } from './rally-fallback.js';
import { RallyQuizCard } from './rally-quiz.js';
import { RallyResult } from './rally-result.js';

interface Props {
  run: RallyRun;
  nextLevelId: string | null;
  canContinue: boolean;
  partsEarned: number;
  newTasks: RallyChallenge['id'][];
  onRecord: (run: RallyRun) => void;
  onRetry: () => void;
  onNext: (levelId: string) => void;
  onReview: () => void;
  onHome: () => void;
  onExit: () => void;
}

interface TaskStatus {
  id: RallyChallenge['id'];
  label: string;
  detail: string;
  done: boolean;
}

interface Snapshot {
  phase: RallyRun['phase'];
  countdownMs: number;
  distance: number;
  speed: number;
  energy: number;
  integrity: number;
  combo: number;
  boostMs: number;
  quiz: RallyRun['quiz'];
  hazardLanes: number[];
  hazardDistance: number;
  zone: RallyZoneKind | null;
  upcomingZone: RallyZoneKind | null;
  zoneDistance: number;
  tasks: TaskStatus[];
}

function snapshot(run: RallyRun): Snapshot {
  const next = run.obstacles
    .filter(obstacle => !run.hitObstacles.includes(obstacle.id) && obstacle.distance >= run.distance - 5)
    .sort((a, b) => a.distance - b.distance)[0];
  const cluster = next ? run.obstacles.filter(obstacle => Math.abs(obstacle.distance - next.distance) < 7) : [];
  const zone = activeRallyZone(run);
  const upcomingZone = run.level.zones.find(item => item.from > run.distance);
  const accuracy = run.answered > 0 ? run.firstTryCorrect / run.answered : 0;
  const tasks: TaskStatus[] = run.level.challenges.map((challenge) => {
    if (challenge.id === 'accuracy') return {
      id: challenge.id,
      label: challenge.label,
      detail: `${Math.round(accuracy * 100)}% / ${Math.round(challenge.target * 100)}%`,
      done: accuracy >= challenge.target,
    };
    if (challenge.id === 'no-collision') return {
      id: challenge.id,
      label: challenge.label,
      detail: run.hitObstacles.length === 0 ? '安全' : `${run.hitObstacles.length} 次碰撞`,
      done: run.hitObstacles.length === 0,
    };
    return {
      id: challenge.id,
      label: challenge.label,
      detail: `${run.nitroUses} / ${challenge.target}`,
      done: run.nitroUses >= challenge.target,
    };
  });
  return {
    phase: run.phase, countdownMs: run.countdownMs, distance: run.distance, speed: run.speed,
    energy: run.energy, integrity: run.integrity, combo: run.combo, boostMs: run.boostMs,
    quiz: run.quiz ? { ...run.quiz, questions: [...run.quiz.questions] } : null,
    hazardLanes: [...new Set(cluster.map(obstacle => obstacle.lane))],
    hazardDistance: next ? Math.max(0, next.distance - run.distance) : 999,
    zone: zone?.kind ?? null,
    upcomingZone: upcomingZone?.kind ?? null,
    zoneDistance: zone ? 0 : upcomingZone ? Math.max(0, upcomingZone.from - run.distance) : 999,
    tasks,
  };
}

const AUDIO_EVENTS: Record<RallyRun['events'][number]['kind'], RaceEventKind> = {
  count: 'count', go: 'go', lane: 'lane', hit: 'hit', boost: 'go', zone: 'station', checkpoint: 'station',
  correct: 'correct', wrong: 'wrong', finish: 'finish', crash: 'eliminated',
};

const ZONE_COPY: Record<RallyZoneKind, { name: string; effect: string }> = {
  sand: { name: '沙地', effect: '车速降低' },
  ice: { name: '冰面', effect: '转向变缓' },
  boost: { name: '加速带', effect: '免费氮气' },
};

export function RallyStage({ run, nextLevelId, canContinue, partsEarned, newTasks, onRecord, onRetry, onNext, onReview, onHome, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RallyScene | null>(null);
  const audioRef = useRef<RaceAudio | null>(null);
  const pausedRef = useRef(false);
  const boostRef = useRef(false);
  const mutedRef = useRef(false);
  const recordedRef = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const [view, setView] = useState(() => snapshot(run));
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [compatible, setCompatible] = useState(false);
  const [toast, setToast] = useState('');
  const [stars, setStars] = useState(0);

  const refresh = useCallback(() => setView(snapshot(run)), [run]);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1500);
  }, []);

  const togglePause = useCallback(() => {
    if (run.phase === 'finished' || run.phase === 'crashed') return;
    pausedRef.current = !pausedRef.current;
    boostRef.current = false;
    if (pausedRef.current) audioRef.current?.setEngineIntensity(0.02);
    setPaused(pausedRef.current);
  }, [run.phase]);

  const answer = useCallback((option: number) => {
    answerRally(run, option);
    refresh();
  }, [run, refresh]);
  const retry = useCallback(() => { retryRallyQuestion(run); refresh(); }, [run, refresh]);
  const advance = useCallback(() => { advanceRallyQuiz(run); refresh(); }, [run, refresh]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!canvas || !fallback) return;
    const audio = new RaceAudio();
    audioRef.current = audio;
    audio.setMuted(mutedRef.current);
    audio.unlock();
    audio.startEngine();
    audio.startMusic(run.level.theme);
    let scene: RallyScene | null = null;
    try {
      scene = new RallyScene(canvas, run);
      sceneRef.current = scene;
    } catch {
      setCompatible(true);
    }

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      scene?.setSize(width, height);
      const ratio = Math.min(window.devicePixelRatio, 1.5);
      fallback.width = Math.round(width * ratio);
      fallback.height = Math.round(height * ratio);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let frame = 0;
    let last = performance.now();
    let lastUi = 0;
    const draw = (now: number) => {
      if (recordedRef.current) return;
      if (pausedRef.current) {
        last = now;
        frame = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!pausedRef.current && !recordedRef.current) stepRally(run, dt, boostRef.current);
      for (const event of run.events) {
        audio.play(AUDIO_EVENTS[event.kind]);
        if (event.kind === 'boost') showToast('氮气加速！');
        if (event.kind === 'zone') showToast('加速带！免费氮气');
        if (event.kind === 'hit') showToast('小心障碍！耐久 -1');
        if (event.kind === 'checkpoint') showToast('到达知识补给站');
        if (event.kind === 'go') showToast('出发！');
      }
      run.events.length = 0;
      if (scene) scene.render(run, dt);
      else paintRallyFallback(fallback, run, now / 1000);
      audio.setEngineIntensity(run.phase === 'driving' ? Math.min(1, run.speed / (run.level.speed * run.vehicle.speedFactor * 1.5)) : 0.02);
      if (now - lastUi > 80) {
        setView(snapshot(run));
        lastUi = now;
      }
      if (!recordedRef.current && (run.phase === 'finished' || run.phase === 'crashed')) {
        recordedRef.current = true;
        boostRef.current = false;
        setStars(calculateRallyStars(run));
        audio.stopEngine();
        audio.stopMusic();
        onRecord(run);
        refresh();
      }
      if (!recordedRef.current) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene?.dispose();
      sceneRef.current = null;
      audio.stopEngine();
      audio.stopMusic();
      audio.dispose();
      audioRef.current = null;
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, [run, onRecord, refresh, showToast]);

  useEffect(() => {
    audioRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (!event.repeat) togglePause();
        return;
      }
      if (pausedRef.current || run.phase === 'finished' || run.phase === 'crashed') return;
      if (run.phase === 'quiz' && run.quiz) {
        if (event.repeat) return;
        if (/^Digit[1-4]$/.test(event.code) && !run.quiz.feedback) answer(Number(event.code.slice(-1)) - 1);
        if (event.code === 'Enter' || event.code === 'Space') {
          if (run.quiz.feedback === 'correct') advance();
          else if (run.quiz.feedback === 'wrong') retry();
        }
        return;
      }
      if (event.repeat) return;
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') steerRally(run, -1);
      if (event.code === 'ArrowRight' || event.code === 'KeyD') steerRally(run, 1);
      if (event.code === 'Space') boostRef.current = true;
      refresh();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') boostRef.current = false;
    };
    const blur = () => { boostRef.current = false; };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    };
  }, [run, paused, answer, advance, retry, togglePause, refresh]);

  const progress = Math.min(100, view.distance / run.level.length * 100);
  const terminal = view.phase === 'finished' || view.phase === 'crashed';
  const countdown = Math.ceil(view.countdownMs / 1000);
  const warningKind = view.zone ?? view.upcomingZone;

  return <div className="rally-game" data-current-lane={run.lane} data-hazard-lanes={view.hazardLanes.join(',')} data-hazard-distance={Math.round(view.hazardDistance)}>
    <canvas ref={canvasRef} className="rally-game-canvas" aria-label={`${run.level.name} 三维赛车场景`} />
    <canvas ref={fallbackRef} className="rally-game-canvas rally-fallback" hidden={!compatible} aria-label="兼容模式赛车场景" />
    <div className={`rally-speed-vignette${view.boostMs > 0 ? ' on' : ''}`} />

    <div className="rally-game-hud">
      <div className="rally-hud-left">
        <button className="rally-btn small ghost" onClick={onExit} aria-label="退出比赛"><span aria-hidden="true">←</span><span>退出</span></button>
        <button className="rally-btn small ghost icon" onClick={() => setMuted(value => { mutedRef.current = !value; return !value; })} aria-label={muted ? '打开声音' : '关闭声音'}>{muted ? '×' : '♪'}</button>
        {compatible && <span className="rally-chip">兼容模式</span>}
      </div>
      <div className="rally-hud-center">
        <div className="rally-progress-label"><span>{run.level.name}</span><span>{Math.floor(view.distance)} / {run.level.length} m</span></div>
        <div className="rally-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <i style={{ width: `${progress}%` }} />
          {run.level.checkpoints.map(distance => <span key={distance} style={{ left: `${distance / run.level.length * 100}%` }} />)}
        </div>
      </div>
      <div className="rally-hud-right">
        <div className="rally-hud-metrics">
          <div className="rally-hud-metric score"><span>积分</span><b>{run.score}</b></div>
          <div className="rally-hud-metric"><span>时速</span><b>{Math.round(view.speed * 3.6)}</b></div>
          <div className="rally-hud-metric energy-wrap"><span>知识能量 {view.energy}%</span><div className="rally-energy"><i style={{ width: `${view.energy}%` }} /></div></div>
          <div className="rally-hud-metric"><span>车辆耐久</span><b className="rally-hearts">{'♥'.repeat(Math.max(0, view.integrity))}{'♡'.repeat(Math.max(0, run.vehicle.maxIntegrity - view.integrity))}</b></div>
        </div>
        <button className="rally-btn small ghost" onClick={togglePause} disabled={terminal}>暂停</button>
      </div>
    </div>

    <div className={`rally-combo${view.combo >= 2 && !terminal ? ' on' : ''}`}><b>{view.combo}×</b><span>知识连击</span></div>
    <div className="rally-task-hud" aria-label="本关挑战任务">
      <span className="rally-task-hud-title">本关任务</span>
      {view.tasks.map((task) => <div key={task.id} className={`rally-task${task.done ? ' done' : ''}`}>
        <i>{task.done ? '✓' : '○'}</i><span><b>{task.label}</b><small>{task.detail}</small></span>
      </div>)}
    </div>
    <span className="rally-sr-only" aria-live="polite">{view.zone ? `进入${ZONE_COPY[view.zone].name}，${ZONE_COPY[view.zone].effect}` : ''}</span>
    {view.phase === 'driving' && view.hazardDistance < 90 && <div className="rally-hazard">前方 {Math.round(view.hazardDistance)}m · {view.hazardLanes.map(lane => ['左侧', '中间', '右侧'][lane]).join(' / ')} 路障</div>}
    {view.phase === 'driving' && warningKind && (view.zone || view.zoneDistance < 100) && <div className={`rally-zone-warning ${view.zone ?? ''}`}>
      {view.zone ? ZONE_COPY[view.zone].name : `${Math.round(view.zoneDistance)}m 后进入${ZONE_COPY[warningKind].name}`}
      <span>{ZONE_COPY[warningKind].effect}</span>
    </div>}
    {view.phase === 'countdown' && <div className="rally-countdown"><b key={countdown}>{countdown}</b><span>准备出发</span></div>}
    {toast && !terminal && <div className="rally-toast" role="status">{toast}</div>}

    {view.phase === 'quiz' && view.quiz && !paused && <div className="rally-overlay">
      <RallyQuizCard
        question={view.quiz.questions[view.quiz.index]}
        quiz={view.quiz}
        combo={view.combo}
        continueLabel={view.quiz.index + 1 === view.quiz.questions.length ? '继续驾驶' : '下一题'}
        onAnswer={answer}
        onRetry={retry}
        onContinue={advance}
      />
    </div>}

    {!terminal && view.phase !== 'quiz' && !paused && <div className="rally-controls">
      <div className="rally-steer-pads">
        <button className="rally-control-btn" disabled={view.phase !== 'driving'} onClick={() => { steerRally(run, -1); refresh(); }} aria-label="向左变道">←<small>左变道</small></button>
        <button className="rally-control-btn" disabled={view.phase !== 'driving'} onClick={() => { steerRally(run, 1); refresh(); }} aria-label="向右变道">→<small>右变道</small></button>
      </div>
      <button
        className="rally-control-btn boost"
        disabled={view.energy < 35 || view.boostMs > 0 || view.phase !== 'driving'}
        onPointerDown={() => { boostRef.current = true; }}
        onPointerUp={() => { boostRef.current = false; }}
        onPointerCancel={() => { boostRef.current = false; }}
        onPointerLeave={() => { boostRef.current = false; }}
      >⚡<small>氮气加速</small></button>
    </div>}
    <div className="rally-key-guide"><kbd>A</kbd> <kbd>D</kbd> 变道 · <kbd>Space</kbd> 氮气 · <kbd>1–4</kbd> 答题 · <kbd>P</kbd> 暂停</div>

    {paused && !terminal && <div className="rally-overlay">
      <section className="rally-pause-card"><h2>比赛已暂停</h2><p>车辆和答题进度都在这里。准备好后继续，或者先回车库换一辆车。</p><div className="rally-pause-actions"><button className="rally-btn primary" onClick={togglePause}>继续比赛</button><button className="rally-btn ghost" onClick={onHome}>返回车库</button></div></section>
    </div>}

    {terminal && <div className="rally-overlay">
      <RallyResult
        run={run}
        stars={stars}
        nextLevelId={nextLevelId}
        canContinue={canContinue}
        partsEarned={partsEarned}
        newTasks={newTasks}
        onRetry={onRetry}
        onNext={onNext}
        onReview={onReview}
        onHome={onHome}
      />
    </div>}
  </div>;
}
