import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createQuest, IDLE_INPUT, QUEST_STEP, questProgress, questStars, ROLE, stepQuest, teamHearts,
} from '../shared/quest.js';
import type { QuestInput, QuestRun } from '../shared/quest.js';
import { QUEST_LEVELS, VIEW_HEIGHT, VIEW_WIDTH } from '../shared/quest-levels.js';
import { isWorldFinale, worldStoryOf } from '../shared/quest-story.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { BuddyLooks } from '../shared/buddy.js';
import type { QuestAudio } from './quest-audio.js';
import { StarIcon } from './quest-map.js';
import type { QuestRecord } from './quest-map.js';
import { buildTerrain, paintFrame, ParticleField } from './quest-render.js';

interface Hud {
  hearts: number[];
  bubbles: boolean[];
  coins: number;
  score: number;
  seconds: number;
  progress: number;
  dashReady: boolean;
  dashActive: boolean;
  guardReady: boolean;
  guardActive: boolean;
  guardRatio: number;
  dashRatio: number;
  fire: boolean[];
  big: boolean[];
  star: boolean[];
  bossHp: number;
}

const EMPTY_HUD: Hud = {
  hearts: [], bubbles: [], coins: 0, score: 0, seconds: 0, progress: 0,
  dashReady: true, dashActive: false, guardReady: true, guardActive: false,
  guardRatio: 1, dashRatio: 1, fire: [], big: [], star: [], bossHp: -1,
};

interface Props {
  levelIndex: number;
  coop: boolean;
  assist: boolean;
  audio: QuestAudio;
  runKey: number;
  record?: QuestRecord;
  looks?: BuddyLooks;
  onComplete: (index: number, stars: number, record: QuestRecord) => void;
  onExit: () => void;
  onNext: () => void;
  onRetry: () => void;
}

type Phase = 'playing' | 'paused' | 'won' | 'dead';

const SOLO_KEYS: Record<string, keyof QuestInput> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyK: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  ShiftLeft: 'run', ShiftRight: 'run', KeyJ: 'run',
  KeyF: 'fire', KeyX: 'fire', KeyL: 'fire',
};
const P1_KEYS: Record<string, keyof QuestInput> = {
  KeyA: 'left', KeyD: 'right', KeyW: 'jump', Space: 'jump', KeyS: 'down', KeyG: 'run', KeyF: 'fire',
};
const P2_KEYS: Record<string, keyof QuestInput> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down',
  Period: 'run', Slash: 'run', Comma: 'fire', KeyM: 'fire',
};
const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Comma', 'Period', 'Slash']);

function Heart({ filled }: { filled: boolean }) {
  return <svg className={`quest-heart${filled ? '' : ' empty'}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-8.4-5.1-8.4-11A4.8 4.8 0 0 1 12 7.2 4.8 4.8 0 0 1 20.4 10c0 5.9-8.4 11-8.4 11z"
      fill={filled ? '#ff4d6d' : '#6b4a8a'} stroke="#2a1a3a" strokeWidth="1.4" />
    {filled && <ellipse cx="9" cy="10.5" rx="2" ry="1.4" fill="#ffffff88" />}
  </svg>;
}

export function QuestStage({ levelIndex, coop, assist, audio, runKey, record, looks = DEFAULT_APPEARANCE, onComplete, onExit, onNext, onRetry }: Props) {
  const level = QUEST_LEVELS[levelIndex];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<QuestRun | null>(null);
  const inputsRef = useRef<QuestInput[]>([{ ...IDLE_INPUT }, { ...IDLE_INPUT }]);
  const phaseRef = useRef<Phase>('playing');
  const [phase, setPhase] = useState<Phase>('playing');
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [result, setResult] = useState<{ stars: number; coins: number; seconds: number; score: number; hearts: number } | null>(null);
  const [touch, setTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const completedRef = useRef(false);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setTouch(query.matches || window.innerWidth < 760);
    update();
    window.addEventListener('resize', update);
    query.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      query.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const run = createQuest(levelIndex, { coop, assist, looks });
    runRef.current = run;
    completedRef.current = false;
    inputsRef.current = [{ ...IDLE_INPUT }, { ...IDLE_INPUT }];
    phaseRef.current = 'playing';
    setPhase('playing');
    setResult(null);
    const terrain = buildTerrain(run);
    const particles = new ParticleField();
    audio.startMusic(level.theme);

    let scale = 1;
    let frame = 0;
    let last = 0;
    let accumulator = 0;
    let hudClock = 0;

    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      const height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      scale = height / VIEW_HEIGHT;
      run.viewWidth = Math.min(VIEW_WIDTH, width / scale);
    });
    observer.observe(canvas);

    const draw = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : QUEST_STEP;
      last = time;
      if (phaseRef.current === 'playing') {
        accumulator += dt;
        let steps = 0;
        while (accumulator >= QUEST_STEP && steps < 6) {
          stepQuest(run, inputsRef.current);
          accumulator -= QUEST_STEP;
          steps++;
        }
        for (const event of run.events) {
          audio.play(event.kind);
          particles.fromEvent(event, run);
        }
        run.events.length = 0;
        particles.update(dt);
        if (run.status === 'won' && !completedRef.current) {
          completedRef.current = true;
          const stars = questStars(run);
          const snapshot = { stars, coins: run.coins, seconds: run.elapsedMs / 1000, score: run.score, hearts: teamHearts(run) };
          setResult(snapshot);
          setPhaseBoth('won');
          audio.stopMusic();
          onComplete(levelIndex, stars, { stars, coins: run.coins, timeMs: run.elapsedMs, score: run.score });
        } else if (run.status === 'dead' && phaseRef.current === 'playing') {
          setPhaseBoth('dead');
          audio.stopMusic();
        }
      }
      ctx!.setTransform(scale, 0, 0, scale, 0, 0);
      paintFrame(ctx!, run, terrain, particles, time / 1000);

      hudClock += dt;
      if (hudClock > 0.09) {
        hudClock = 0;
        const striker = run.players[0];
        const guardian = run.players[1];
        const boss = run.enemies.find(enemy => enemy.kind === 'boss');
        setHud({
          hearts: run.players.map(player => player.hearts),
          bubbles: run.players.map(player => player.bubbleMs > 0),
          coins: run.coins,
          score: run.score,
          seconds: run.elapsedMs / 1000,
          progress: questProgress(run),
          dashReady: striker.dashCooldownMs <= 0,
          dashActive: striker.dashMs > 0,
          dashRatio: 1 - striker.dashCooldownMs / ROLE.dashCooldownMs,
          guardReady: Boolean(guardian && guardian.guardCooldownMs <= 0),
          guardActive: Boolean(guardian && guardian.guardMs > 0),
          guardRatio: guardian ? 1 - guardian.guardCooldownMs / ROLE.guardCooldownMs : 1,
          fire: run.players.map(player => player.fire),
          big: run.players.map(player => player.big),
          star: run.players.map(player => player.starMs > 0),
          bossHp: boss && boss.state !== 'dead' ? boss.hp : -1,
        });
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      audio.stopMusic();
      particles.clear();
      runRef.current = null;
    };
  }, [levelIndex, coop, assist, runKey, audio, onComplete, setPhaseBoth, level.theme, looks]);

  useEffect(() => {
    const apply = (code: string, pressed: boolean) => {
      if (coop) {
        const first = P1_KEYS[code];
        if (first) inputsRef.current[0][first] = pressed;
        const second = P2_KEYS[code];
        if (second) inputsRef.current[1][second] = pressed;
        return Boolean(first || second);
      }
      const key = SOLO_KEYS[code];
      if (key) inputsRef.current[0][key] = pressed;
      return Boolean(key);
    };
    const down = (event: KeyboardEvent) => {
      if (event.repeat) { if (BLOCKED.has(event.code)) event.preventDefault(); return; }
      audio.unlock();
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        if (phaseRef.current === 'playing') { setPhaseBoth('paused'); audio.stopMusic(); }
        else if (phaseRef.current === 'paused') { setPhaseBoth('playing'); audio.startMusic(level.theme); }
        return;
      }
      if (event.code === 'KeyR' && phaseRef.current !== 'won') { event.preventDefault(); onRetry(); return; }
      if (apply(event.code, true) && BLOCKED.has(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (apply(event.code, false) && BLOCKED.has(event.code)) event.preventDefault();
    };
    const blur = () => { inputsRef.current = [{ ...IDLE_INPUT }, { ...IDLE_INPUT }]; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [coop, audio, level.theme, onRetry, setPhaseBoth]);

  const resume = () => { audio.unlock(); setPhaseBoth('playing'); audio.startMusic(level.theme); };
  const pause = () => { setPhaseBoth('paused'); audio.stopMusic(); };

  const pad = (player: number, key: keyof QuestInput) => {
    const id = `${player}:${key}`;
    const release = () => {
      inputsRef.current[player][key] = false;
      setPressed(current => ({ ...current, [id]: false }));
    };
    return {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        audio.unlock();
        inputsRef.current[player][key] = true;
        setPressed(current => ({ ...current, [id]: true }));
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
      'aria-pressed': Boolean(pressed[id]),
    };
  };

  const maxHearts = coop ? 3 : 5;
  const hasNext = levelIndex < QUEST_LEVELS.length - 1;

  return <section className="quest-play">
    <p className="story-bubble quest-story">{level.story}</p>
    <div className="quest-hud">
      <div className="quest-hud-level">
        <span>第 {levelIndex + 1} 关 · {level.world.split(' · ')[0]}</span>
        <strong>{level.name}</strong>
      </div>
      {hud.hearts.map((hearts, index) => <div className="quest-hearts" key={index}>
        {coop && <span className={`who p${index + 1}`}>{index === 0 ? 'P1' : 'P2'}</span>}
        {hud.bubbles[index]
          ? <span className="quest-chip" style={{ borderColor: '#57c7f2', color: '#bfe8ff' }}>泡泡中</span>
          : Array.from({ length: maxHearts }, (_, i) => <Heart key={i} filled={i < hearts} />)}
      </div>)}
      <div className="quest-stat coins"><i aria-hidden="true">◉</i>{hud.coins}<span className="quest-chip">/ {level.coinTotal}</span></div>
      <div className="quest-stat score"><i aria-hidden="true">★</i>{hud.score.toLocaleString('en-US')}</div>
      <div className="quest-stat time"><i aria-hidden="true">◷</i>{hud.seconds.toFixed(1)}s</div>
      <div className="quest-progress" role="progressbar" aria-label="关卡进度" aria-valuenow={Math.round(hud.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${Math.max(2, hud.progress * 100)}%` }} />
      </div>
      <button className="qbtn ghost small icon" onClick={phase === 'paused' ? resume : pause}
        aria-label={phase === 'paused' ? '继续游戏' : '暂停游戏'}>{phase === 'paused' ? '▶' : '❚❚'}</button>
      <button className="qbtn ghost small" onClick={onRetry}>重玩</button>
      <button className="qbtn ghost small" onClick={onExit}>选关</button>
    </div>

    <div className="quest-abilities">
      <div className={`quest-ability ${hud.dashActive ? 'active' : hud.dashReady ? 'ready' : ''}`}>
        <span>{coop ? 'P1 ' : ''}{hud.fire[0] ? '火球' : '冲刺击'}</span>
        <span className="meter"><i style={{ width: `${Math.round(hud.dashRatio * 100)}%` }} /></span>
        <kbd>{coop ? 'F' : 'F / X'}</kbd>
      </div>
      {coop && <div className={`quest-ability ${hud.guardActive ? 'active' : hud.guardReady ? 'ready' : ''}`}>
        <span>P2 守护罩</span>
        <span className="meter"><i style={{ width: `${Math.round(hud.guardRatio * 100)}%` }} /></span>
        <kbd>,</kbd>
      </div>}
      {hud.star.some(Boolean) && <div className="quest-ability active"><span>无敌星生效中</span></div>}
      {hud.big.some(Boolean) && <div className="quest-ability ready"><span>大块头 · 可撞碎砖块</span></div>}
      {hud.bossHp >= 0 && <div className="quest-ability active"><span>菇霸 {hud.bossHp} / 3</span></div>}
    </div>

    <div className="quest-scene">
      <canvas className="quest-canvas" ref={canvasRef} aria-label={`${level.name} 游戏画面`} role="img" />
      {phase === 'paused' && <div className="quest-overlay">
        <h2>暂停一下</h2>
        <p>{level.hint}</p>
        <div className="actions">
          <button className="qbtn primary" onClick={resume}>继续冒险</button>
          <button className="qbtn ghost" onClick={onRetry}>重玩本关</button>
          <button className="qbtn ghost" onClick={onExit}>回到选关</button>
        </div>
      </div>}
      {phase === 'dead' && <div className="quest-overlay">
        <h2>{coop ? '两个人都变泡泡了' : '心心用完了'}</h2>
        <p>{coop ? '别灰心，双人模式下敌人更慢，记得让后卫开守护罩。' : '试试开启轻松模式，心心就不会扣光啦。'}<br />{level.hint}</p>
        <div className="actions">
          <button className="qbtn primary" onClick={onRetry}>再来一次</button>
          <button className="qbtn ghost" onClick={onExit}>回到选关</button>
        </div>
      </div>}
      {phase === 'won' && result && <div className="quest-overlay">
        <h2>{levelIndex === QUEST_LEVELS.length - 1 ? '菇霸被打败啦！' : '过关！'}</h2>
        <div className="quest-stars">
          {[0, 1, 2].map(i => <span key={i} className={result.stars > i ? 'on' : 'off'}><StarIcon filled={result.stars > i} size={52} /></span>)}
        </div>
        <div className="quest-result">
          <div><span>金币</span> {result.coins} / {level.coinTotal}</div>
          <div><span>用时</span> {result.seconds.toFixed(1)}s</div>
          <div><span>得分</span> {result.score.toLocaleString('en-US')}</div>
          <div><span>剩余心</span> {result.hearts}</div>
        </div>
        <p>{result.stars === 3 ? '满星通关，太厉害了！' : '收集六成金币并留 3 颗心，就能拿到满星。'}</p>
        {isWorldFinale(level) && <p className="quest-hook">{worldStoryOf(level).hook}</p>}
        <div className="actions">
          {hasNext && <button className="qbtn primary" onClick={onNext}>下一关</button>}
          <button className={hasNext ? 'qbtn mint' : 'qbtn primary'} onClick={onRetry}>再玩一次</button>
          <button className="qbtn ghost" onClick={onExit}>回到选关</button>
        </div>
      </div>}
    </div>

    <p className="quest-hint"><b>提示：</b>{level.hint}{record ? ` 最佳记录 ${record.stars} 星 · ${record.coins} 金币 · ${(record.timeMs / 1000).toFixed(1)}s` : ''}</p>

    {touch ? <div className="quest-pads">
      <div className="quest-pad p1">
        <h4>{coop ? `P1 前锋 · ${looks.left.name}` : '移动与跳跃'}</h4>
        <div className="quest-pad-row">
          <button className="quest-touch" aria-label="向左" {...pad(0, 'left')}>◀</button>
          <button className="quest-touch" aria-label="向右" {...pad(0, 'right')}>▶</button>
          <button className="quest-touch jump" aria-label="跳跃" {...pad(0, 'jump')}>跳</button>
          <button className="quest-touch act" aria-label={coop ? '冲刺击' : '冲刺或火球'} {...pad(0, 'fire')}>{coop ? '冲' : '攻'}</button>
        </div>
      </div>
      {coop && <div className="quest-pad p2">
        <h4>P2 后卫 · {looks.right.name}</h4>
        <div className="quest-pad-row">
          <button className="quest-touch" aria-label="P2 向左" {...pad(1, 'left')}>◀</button>
          <button className="quest-touch" aria-label="P2 向右" {...pad(1, 'right')}>▶</button>
          <button className="quest-touch jump" aria-label="P2 跳跃" {...pad(1, 'jump')}>跳</button>
          <button className="quest-touch act" aria-label="守护罩" {...pad(1, 'fire')}>盾</button>
        </div>
      </div>}
    </div> : <div className="quest-deck">
      <div className="quest-keys">
        {coop ? <>
          <div><b>P1</b><kbd>A</kbd><kbd>D</kbd>移动<kbd>W</kbd>跳<kbd>G</kbd>加速<kbd>F</kbd>冲刺击</div>
          <div><b>P2</b><kbd>←</kbd><kbd>→</kbd>移动<kbd>↑</kbd>跳<kbd>.</kbd>加速<kbd>,</kbd>守护罩</div>
        </> : <>
          <div><kbd>←</kbd><kbd>→</kbd>或<kbd>A</kbd><kbd>D</kbd>移动</div>
          <div><kbd>空格</kbd>跳跃（长按跳更高）</div>
          <div><kbd>Shift</kbd>加速</div>
          <div><kbd>F</kbd>冲刺击 / 火球</div>
          <div><kbd>↓</kbd>下蹲</div>
        </>}
        <div><kbd>Esc</kbd>暂停<kbd>R</kbd>重玩</div>
      </div>
      <button className="qbtn ghost small" onClick={() => setTouch(true)}>显示触屏按键</button>
    </div>}
  </section>;
}