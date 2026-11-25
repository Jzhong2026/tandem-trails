import { useEffect, useRef, useState } from 'react';
import { normalizeRoomCode, validRoomCode } from '../shared/protocol.js';
import { useRaceRoom } from './use-race-room.js';
import { RaceAudio } from './race-audio.js';
import { RaceLobby } from './race-lobby.js';
import { isWorkshopMode } from '../shared/workshop.js';
import type { StudyCourse } from '../shared/study.js';
import { WorkshopStage } from './workshop-stage.js';
import { TOURNAMENTS, isTournamentMode, isLearningMode } from '../shared/learning.js';
import type { TournamentMode } from '../shared/learning.js';
import { LearningStage } from './learning-stage.js';
import { RaceStage } from './race-stage.js';
import './race.css';

interface Props {
  course:StudyCourse;
  rememberCourse:(course:StudyCourse)=>void;
  onExit: () => void;
  initialAction?: 'create' | 'join' | TournamentMode;
}

export function RaceGame({ onExit, initialAction,course,rememberCourse }: Props) {
  const game = useRaceRoom(course);
  const grade=game.room?.course.grade, term=game.room?.course.term, subject=game.room?.course.subject, host=game.seat!==null && game.room?.hostSeat===game.seat;
  useEffect(()=>{
    if(host && grade && term) rememberCourse({grade,term,subject});
  },[host,grade,term,subject,rememberCourse]);
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
    } else if (isTournamentMode(initialAction)) {
      autoDone.current = true;
      void game.createLearning(initialAction);
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
    const url = new URL(location.href);
    url.searchParams.delete('race');
    history.replaceState(null,'',url);
    onExit();
  };

  const online = game.connection === 'online';
  const mode = game.room?.mode ?? (isTournamentMode(initialAction) ? initialAction : 'race');
  const me = game.seat !== null ? game.room?.players[game.seat] : null;

  return <div className="race">
    <div className="race-shell">
      <div className="race-top">
        <span className="race-logo"><span className="race-flag" aria-hidden="true" />{mode === 'race' ? <>知识<b>赛车</b></> : TOURNAMENTS[mode].name}</span>
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
          : isWorkshopMode(mode) && game.room.workshop
          ? <WorkshopStage view={game.room.workshop} mode={mode} seat={game.seat} game={game} audio={audio}/>
          : isLearningMode(mode) && game.room.learning
          ? <LearningStage mode={mode} seat={game.seat} view={game.room.learning} game={game} muted={muted} audio={audio}/>
          : <RaceStage room={game.room} seat={game.seat} game={game} audio={audio} onExit={exit} />
        : <div className="race-lobby">
          <div className="race-panel" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <h2>开始一场比赛</h2>
            <p className="race-assist" style={{ marginTop: 0 }}>一个人练手，或叫上最多 3 位同学各自设备联机。在大厅选择上海二至九年级的语文、数学与英语，看看谁能先冲线！</p>
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
