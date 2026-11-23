import { useEffect, useRef, useState } from 'react';
import { normalizeRoomCode, validRoomCode } from '../shared/protocol.js';
import { trackById } from '../shared/race-tracks.js';
import { useRaceRoom } from './use-race-room.js';
import { RaceAudio } from './race-audio.js';
import { RaceLobby } from './race-lobby.js';
import { RaceStage } from './race-stage.js';
import {
  buildObstacles, buildScenery, CAM_BACK, createCamera, RaceParticles, paintRaceFrame2D,
  paintRaceOverlay, PALETTES, CAR_COLORS,
} from './race-render.js';
import { RaceScene } from './race-scene.js';
import './race.css';

interface Props {
  onExit: () => void;
  initialAction?: 'create' | 'join';
}

export function RaceGame({ onExit, initialAction }: Props) {
  const game = useRaceRoom();
  const audioRef = useRef<RaceAudio | null>(null);
  if (!audioRef.current) audioRef.current = new RaceAudio();
  const audio = audioRef.current;
  const [muted, setMuted] = useState(false);
  const [code, setCode] = useState(() => normalizeRoomCode(
    new URLSearchParams(window.location.search).get('race') ?? '',
  ).slice(0, 6));
  const autoDone = useRef(false);

  useEffect(() => () => audio.dispose(), [audio]);

  useEffect(() => {
    if (autoDone.current || game.connection !== 'online' || game.room) return;
    const urlCode = normalizeRoomCode(new URLSearchParams(window.location.search).get('race') ?? '');
    if (validRoomCode(urlCode)) {
      autoDone.current = true;
      void game.join(urlCode);
    } else if (initialAction === 'create') {
      autoDone.current = true;
      void game.create();
    }
  }, [game.connection, game.room, game, initialAction]);

  const toggleMute = () => {
    audio.unlock();
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
  };

  const exit = () => {
    audio.stopMusic();
    audio.stopEngine();
    if (game.room) void game.leave();
    onExit();
  };

  const online = game.connection === 'online';
  const me = game.seat !== null ? game.room?.players[game.seat] : null;

  return <div className="race">
    <div className="race-shell">
      <div className="race-top">
        <span className="race-logo"><span className="race-flag" aria-hidden="true" />知识<b>赛车</b></span>
        {game.room && <span className="race-chip live">{game.room.phase === 'lobby' ? '大厅 · 准备中'
          : game.room.phase === 'playing' ? '比赛进行中' : '比赛结束'}</span>}
        <span className="race-top-spacer" />
        <button className="rbtn ghost small icon" onClick={toggleMute}
          aria-pressed={muted} aria-label={muted ? '打开声音' : '关闭全部声音'} title={muted ? '打开声音' : '关闭全部声音'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="rbtn ghost small" onClick={exit}>返回首页</button>
      </div>

      {game.connection === 'offline' && <div className="race-notice" role="alert">
        <span>暂时连不上游戏服务。请检查网络和游戏地址。</span>
        <button className="rbtn ghost small" onClick={game.retry}>重新连接</button>
      </div>}
      {game.error && <div className="race-notice" role="alert"><span>{game.error}</span></div>}

      {game.room && game.seat !== null
        ? game.room.phase === 'lobby'
          ? <RaceLobby room={game.room} seat={game.seat} game={game} onExit={exit} />
          : <RaceStage room={game.room} seat={game.seat} game={game} audio={audio} onExit={exit} />
        : <div className="race-lobby">
          <div className="race-panel" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <h2>开始一场比赛</h2>
            <p className="race-assist" style={{ marginTop: 0 }}>一个人练手，或叫上最多 3 位同学各自设备联机。答对二年级上学期的语文数学题加油，看谁先冲到终点！</p>
            <button className="rbtn primary big" style={{ width: '100%', marginTop: 14 }}
              disabled={!online || game.busy} onClick={() => { audio.unlock(); void game.create(); }}>
              创建比赛（可单人）
            </button>
            <form style={{ marginTop: 18 }} onSubmit={event => {
              event.preventDefault();
              if (validRoomCode(code)) { audio.unlock(); void game.join(code); }
            }}>
              <label className="race-config-label" htmlFor="race-code">或用房间码加入</label>
              <div className="race-invite-row" style={{ marginTop: 8 }}>
                <input id="race-code" className="race-input" value={code} placeholder="6 位字母或数字"
                  autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6}
                  onChange={event => setCode(normalizeRoomCode(event.target.value))} />
                <button type="submit" className="rbtn cyan" disabled={!online || game.busy || !validRoomCode(code)}>加入</button>
              </div>
            </form>
            {!me && !online && <p className="race-assist">正在连接游戏服务…</p>}
          </div>
        </div>}
    </div>
  </div>;
}

export function RaceHome({ onPlay }: { onPlay: (action: 'create' | 'join') => void }) {
  return <div className="race"><section className="race-home">
    <div className="race-home-copy">
      <h1>知识<br /><em>赛车</em></h1>
      <p className="lede">开着 Scania 重卡在纵向赛道上飞驰，每进一个服务区答 4 道题，答对加油、撞障碍漏油，油尽淘汰。赛后要把答错的题复习一遍才能开下一局。单人练手，或最多 4 人各自设备联机，顶部实时看到彼此的进度和油箱。</p>
      <div className="race-home-actions">
        <button className="rbtn primary" onClick={() => onPlay('create')}>单人 / 创建比赛</button>
        <button className="rbtn cyan" onClick={() => onPlay('join')}>加入比赛</button>
      </div>
      <div className="race-home-facts">
        <span className="race-chip">最多 4 人联机</span>
        <span className="race-chip">3 条主题赛道</span>
        <span className="race-chip">95 道课本题</span>
        <span className="race-chip">赛后错题必复习</span>
        <span className="race-chip">键盘 / 触屏都能玩</span>
      </div>
    </div>
    <figure className="race-home-preview">
      <RacePreview />
      <figcaption><strong>阳光校园线</strong><span>答对加油 · 油尽淘汰 · 先到终点获胜</span></figcaption>
    </figure>
  </section></div>;
}

function RacePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const glCanvas = glCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const track = trackById('campus');
    const obstacles = buildObstacles(track);
    const scenery = buildScenery(track);
    const particles = new RaceParticles();
    let scene: RaceScene | null = null;
    if (glCanvas) {
      try {
        scene = new RaceScene(glCanvas, track, obstacles, scenery);
      } catch {
        scene = null;
        glCanvas.style.display = 'none';
      }
    }
    let scale = 1;
    let frame = 0;
    let last = 0;
    let x = 0;
    let exhaust = 0;
    const camera = createCamera(800, 600);
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      canvas.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
      scale = dpr;
      Object.assign(camera, createCamera(entry.contentRect.width, entry.contentRect.height));
      scene?.setSize(entry.contentRect.width, entry.contentRect.height, dpr);
    });
    observer.observe(canvas);
    const draw = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
      last = time;
      x += track.speed * dt;
      if (x > track.length) x = 0;
      const laneY = Math.floor((Math.sin(x / 420) + 1) / 2 * 2.999);
      let anchor = null as ReturnType<RaceScene['anchors']> | null;
      if (scene) {
        scene.render({
          track, cameraX: x - CAM_BACK, laneY, color: 0, status: 'racing',
          hitFlash: 0, shake: 0, stationActive: null, time: time / 1000, dt,
        });
        anchor = scene.anchors();
      }
      exhaust += dt;
      if (exhaust > 0.05) {
        exhaust = 0;
        particles.exhaust(
          anchor ? anchor.exhaustX : camera.width / 2 + (laneY - 1) * camera.truckLanePx - 36 * (camera.truckW / 100),
          anchor ? anchor.exhaustY : camera.truckGroundY - 6, true);
      }
      particles.update(dt);
      ctx!.setTransform(scale, 0, 0, scale, 0, 0);
      if (scene && anchor) {
        ctx!.clearRect(0, 0, camera.width, camera.height);
        paintRaceOverlay(ctx!, {
          width: camera.width, height: camera.height, palette: PALETTES[track.theme], particles,
          gauge: {
            x: anchor.roofX, groundY: anchor.groundY, scale: anchor.pxPerM / 40,
            fuel: 7, fuelMax: 10, roofY: anchor.roofY,
          },
          boost: true, shake: 0, hitFlash: 0,
        });
      } else {
        paintRaceFrame2D(ctx!, {
          track, obstacles, scenery, camera, cameraX: x - CAM_BACK, laneY, color: 0, status: 'racing',
          hitFlash: 0, boost: true, stationActive: null, time: time / 1000, particles,
          fuel: 7, fuelMax: 10,
        });
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      particles.clear();
      scene?.dispose();
    };
  }, []);
  return <div className="race-preview-stage">
    <canvas className="race-gl" ref={glCanvasRef} aria-hidden="true" />
    <canvas className="race-canvas" ref={canvasRef} role="img" aria-label="知识赛车预览动画" />
  </div>;
}