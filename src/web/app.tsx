import { useState } from 'react';
import {
  EGG_LEVEL_TITLE, EGG_SUMMARY, EGG_TITLE, EGG2_LEVEL_TITLE, EGG2_SUMMARY, GAME_LEVELS,
  isEggLevel, isMineLevel, isSubLevel, MINE_LEVEL_TITLE, MINE_SUMMARY, MINE_TITLE, MINE2_LEVEL_TITLE, MINE2_SUMMARY,
  SUB_LEVEL_TITLE, SUB_SUMMARY, SUB_TITLE,
} from '../shared/game-levels.js';
import type { GameLevel } from '../shared/game-levels.js';
import { createEgg, isEggView } from '../shared/egg.js';
import { createMine, isMineView } from '../shared/mine.js';
import { createSub, isSubView } from '../shared/sub.js';
import { normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, validRoomCode } from '../shared/protocol.js';
import type { FogClues, RoomView, Seat } from '../shared/protocol.js';
import { nextRiverLevel, RIVER_COURSES } from '../shared/river-levels.js';
import type { Channel, Flag } from '../shared/river-levels.js';
import type { RiverView } from '../shared/river.js';
import { EggCanvas } from './egg-canvas.js';
import { BuddySeats } from './buddy-picker.js';
import { MissionCard, StoryBubble } from './story-bubble.js';
import { storyFor } from '../shared/story.js';
import { looksOf } from './buddy.js';
import { EggStage } from './egg-stage.js';
import { FinishOverlay } from './finish-overlay.js';
import { MineCanvas } from './mine-canvas.js';
import { MineStage } from './mine-stage.js';
import { PaddleButton } from './paddle-button.js';
import { PauseOverlay } from './pause-overlay.js';
import { QuestGame } from './quest-game.js';
import { QuestPreview } from './quest-preview.js';
import { RiverCanvas } from './river-canvas.js';
import { SubCanvas } from './sub-canvas.js';
import { SubStage } from './sub-stage.js';
import { useRoom } from './use-room.js';

type Game = ReturnType<typeof useRoom>;
const seatName = { left: '左桨', right: '右桨' } as const;
const flagName: Record<Flag, string> = { triangle: '▲ 三角旗', circle: '● 圆旗' };
const channelName: Record<Channel, string> = { upper: '↑ 靠上岸的水路', lower: '↓ 靠下岸的水路' };

function courseInfo(level: GameLevel) {
  if (level === 'mine') return { title: MINE_TITLE, summary: MINE_SUMMARY, chapter: MINE_LEVEL_TITLE };
  if (level === 'mine2') return { title: MINE_TITLE, summary: MINE2_SUMMARY, chapter: MINE2_LEVEL_TITLE };
  if (level === 'egg') return { title: EGG_TITLE, summary: EGG_SUMMARY, chapter: EGG_LEVEL_TITLE };
  if (level === 'egg2') return { title: EGG_TITLE, summary: EGG2_SUMMARY, chapter: EGG2_LEVEL_TITLE };
  if (level === 'sub') return { title: SUB_TITLE, summary: SUB_SUMMARY, chapter: SUB_LEVEL_TITLE };
  return { ...RIVER_COURSES[level], chapter: '双桨救援队' };
}

export function App() {
  const game = useRoom();
  const [quest, setQuest] = useState<'solo' | 'coop' | null>(null);
  const [code, setCode] = useState(() => normalizeRoomCode(
    new URLSearchParams(window.location.search).get('room') ?? '',
  ).slice(0, ROOM_CODE_LENGTH));
  const online = game.connection === 'online';
  const invalidLetters = [...new Set([...code].filter(letter => !ROOM_CODE_ALPHABET.includes(letter)))];
  const codeHint = !code || validRoomCode(code) ? ''
    : invalidLetters.length > 0
      ? `房间码不含 ${invalidLetters.map(letter => letter === ' ' ? '空格' : letter).join('、')}，请核对后重新输入。`
      : '房间码需要 6 位，请补全后再加入。';

  return <div className="shell">
    <header className="site-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /></span>Tandem Trails</div>
      <span className={`network ${game.connection}`} role="status">
        {online ? '已连接' : game.connection === 'connecting' ? '正在连接' : '连接中断'}
      </span>
    </header>
    <main>
      {game.connection === 'offline' && <div className="notice" role="alert">
        <span>暂时连不上游戏服务。请检查网络和游戏地址。</span>
        <button className="text-button" onClick={game.retry}>重新连接</button>
      </div>}
      {game.error && <p className="notice" role="alert">{game.error}</p>}
      {quest && !game.room
        ? <QuestGame initialMode={quest} onExit={() => setQuest(null)} />
        : game.room && game.seat
        ? !game.room.run
          ? <RoomLobby room={game.room} seat={game.seat} game={game} />
          : isMineView(game.room.run)
            ? <MineStage run={game.room.run} phase={game.room.phase} seat={game.seat} game={game} />
            : isEggView(game.room.run)
              ? <EggStage run={game.room.run} phase={game.room.phase} seat={game.seat} game={game} />
              : isSubView(game.room.run)
                ? <SubStage run={game.room.run} phase={game.room.phase} seat={game.seat} game={game} />
                : <RiverStage run={game.room.run} room={game.room} seat={game.seat} game={game} />
        : <>
          <div className="quest">
            <section className="quest-hero-home">
              <div className="quest-hero-copy">
                <h1>星芽<br /><em>大冒险</em></h1>
                <p className="lede">12 个手绘主题关卡：跑、跳、踩扁栗栗、顶问号砖、踩弹簧飞上天。可以一个人闯关，也可以两个人分工——前锋冲刺开路，后卫举盾断后。</p>
                <div className="quest-hero-actions">
                  <button className="qbtn primary" onClick={() => setQuest('solo')}>单人闯关</button>
                  <button className="qbtn mint" onClick={() => setQuest('coop')}>双人同乐</button>
                </div>
                <div className="quest-hero-facts">
                  <span className="quest-chip">12 关 · 4 个世界</span>
                  <span className="quest-chip">难度轻松 · 掉坑不扣心</span>
                  <span className="quest-chip">双人更容易通关</span>
                  <span className="quest-chip">键盘 / 触屏都能玩</span>
                </div>
              </div>
              <QuestPreview coop={false} />
            </section>
            <div className="quest-divider">双人联机 · 双桨救援队</div>
          </div>
          <section className="home">
            <div className="home-copy">
              <h1>亲子协作<br />大冒险</h1>
              <p className="home-description">和家人各掌一支桨。一起练船、绕浮木，再循着线索到雾里救小鸭。</p>
              <button className="primary create-button" disabled={!online || game.busy} onClick={game.create}>创建房间</button>
              <form className="join-form" onSubmit={event => {
                event.preventDefault();
                if (validRoomCode(code)) void game.join(code);
              }}>
                <label htmlFor="room-code">房间码</label>
                <div className="join-row">
                  <input id="room-code" name="room-code" value={code} placeholder="6 位字母或数字"
                    autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    aria-invalid={codeHint !== ''} aria-describedby={codeHint ? 'room-code-hint' : undefined}
                    maxLength={ROOM_CODE_LENGTH} onChange={event => setCode(normalizeRoomCode(event.target.value))} />
                  <button type="submit" className="secondary" disabled={!online || game.busy || !validRoomCode(code)}>加入房间</button>
                </div>
                {codeHint && <p className="assist" id="room-code-hint">{codeHint}</p>}
              </form>
            </div>
            <CourseCard level="bend" />
          </section>
        </>}
    </main>
  </div>;
}

function CourseCard({ level }: { level: GameLevel }) {
  const course = courseInfo(level);
  return <figure className="river-card">
    {isMineLevel(level) ? <MineCanvas seat="left" run={createMine(level)} />
      : isEggLevel(level) ? <EggCanvas seat="left" run={createEgg(level)} />
        : isSubLevel(level) ? <SubCanvas seat="left" run={createSub(level)} />
          : <RiverCanvas level={level} />}
    <figcaption>
      <div><span className="chapter">{course.chapter}</span><strong>{course.title}</strong></div>
      <span className="player-count">2 人合作</span>
    </figcaption>
  </figure>;
}

function RoomLobby({ room, seat, game }: { room: RoomView; seat: Seat; game: Game }) {
  const [copy, setCopy] = useState<'idle' | 'done' | 'manual'>('idle');
  const ready = room.players[seat]?.ready ?? false;
  const address = new URL(window.location.pathname, window.location.origin);
  address.searchParams.set('room', room.code);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname);
  const disabled = game.connection !== 'online' || game.busy;
  const course = courseInfo(room.level);

  return <section className="room-layout">
    <div className="room-panel">
      <h1>等待搭档</h1>
      <div className="invite">
        <div className="invite-top"><span>房间码</span><strong>{room.code}</strong></div>
        <div className="invite-row">
          <input aria-label="邀请链接" value={address.href} readOnly onFocus={event => event.currentTarget.select()} />
          <button className="secondary" onClick={async () => {
            try {
              await navigator.clipboard.writeText(address.href);
              setCopy('done');
            } catch {
              setCopy('manual');
            }
          }}>{copy === 'done' ? '已复制' : '复制邀请'}</button>
        </div>
        {copy !== 'idle' && <p className="assist" role="status">{copy === 'manual'
          ? '可选中链接手动复制，或直接分享房间码。' : '邀请链接已复制。'}</p>}
        {loopback && <p className="assist">另一台设备请打开终端里显示的 LAN 地址，再输入房间码。</p>}
      </div>
      <div className="course-picker">
        {seat === 'left' ? <label>
          <span>关卡</span>
          <select value={room.level} disabled={disabled}
            onChange={event => void game.selectLevel(event.currentTarget.value as GameLevel)}>
            {GAME_LEVELS.map(level => <option key={level} value={level}>
              {courseInfo(level).title}{room.completed.includes(level) ? ' · 已通关' : ''}
            </option>)}
          </select>
        </label> : <p>本轮关卡 <strong>{course.title}</strong></p>}
        <p className="assist">{course.summary}</p>
      </div>
      <MissionCard level={room.level} />
      <BuddySeats room={room} seat={seat} game={game} />
      <div className="room-actions">
        <button className="primary" disabled={disabled} onClick={() => game.ready(!ready, room.lobbyRevision)}>
          {ready ? '取消准备' : '我准备好了'}
        </button>
        <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
      </div>
    </div>
    <CourseCard level={room.level} />
  </section>;
}

function RiverStage({ run, room, seat, game }: { run: RiverView; room: RoomView; seat: Seat; game: Game }) {
  const other = seat === 'left' ? 'right' : 'left';
  const course = RIVER_COURSES[run.level];
  const next = nextRiverLevel(run.level);
  const clues = room.clues;
  const disabled = game.connection !== 'online' || game.busy;
  const progress = room.phase === 'finished' ? 100 : Math.min(99, Math.round(
    (run.x - course.start.x) / (course.dock.x - course.start.x) * 100,
  ));

  return <section className="stage">
    <div className="stage-title">
      <div><span className="chapter">双桨救援队</span><h1>{course.title}</h1></div>
      <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
    </div>
    <StoryBubble level={run.level} run={run} />
    <div className="stage-hud">
      <span aria-live="polite">{riverGoal(run, room.clues, seat)}</span>
      <progress aria-label="河道进度" max={100} value={progress} />
    </div>
    <div className="stage-scene">
      <RiverCanvas level={run.level} run={run} paddles={room.paddles} looks={looksOf(room)}
        channel={clues?.own.kind === 'channel' ? clues.own.value : clues?.channel}
        flag={clues?.own.kind === 'flag' ? clues.own.value : clues?.flag} />
      {room.phase === 'paused' && <PauseOverlay />}
      {room.phase === 'finished' && <FinishOverlay level={run.level} looks={looksOf(room)} story={storyFor(run.level)}
        title={run.level === 'practice' ? '练桨完成！' : '小鸭到家了！'}
        summary={`用时 ${Math.floor(run.elapsedMs / 1000)} 秒 · 碰撞 ${run.collisions} 次`}>
        {next && <button className="primary" disabled={disabled} onClick={() => game.next(run.level)}>下一关</button>}
        <button className={next ? 'secondary' : 'primary'} disabled={disabled} onClick={game.replay}>再玩一次</button>
      </FinishOverlay>}
    </div>
    {clues && room.phase !== 'finished' && <FogCluePanel clues={clues}
      disabled={disabled || room.phase !== 'playing'} onShare={game.shareClue} />}
    {room.phase !== 'finished' && <div className="control-deck">
      <div>
        <p className="control-instruction">一人划，船转向。两人一起划，船才前进。</p>
        <div className="control-state">
          {run.recovery === 'logs' && '划到了浮木，已回到最近的安全点。'}
          {run.recovery === 'shoal' && '碰到浅滩了。回到雾口，先对准安全水路。'}
          {!run.recovery && `队友的${seatName[other]} · ${room.paddles[seat === 'left' ? 1 : 0] ? '划桨中' : '已松开'}`}
        </div>
      </div>
      <div className="paddle-control">
        <PaddleButton seat={seat} enabled={!disabled && room.phase === 'playing'} onPaddle={game.paddle} />
        <span className="keyboard-guide">键盘也可按住 <kbd>空格</kbd></span>
      </div>
    </div>}
  </section>;
}

function riverGoal(run: RiverView, clues: FogClues | null, seat: Seat) {
  if (run.practice) {
    if (run.practice.every(Boolean)) return '两支桨都试过了，沿浮标一起划回码头';
    return run.practice[seat === 'left' ? 0 : 1] ? '等队友单独试桨' : `单独试一次你的${seatName[seat]}`;
  }
  if (run.rescued) return '小鸭已上船，划向码头';
  if (clues) {
    const { flag, channel } = clues;
    if (!flag || !channel) return '把各自看到的线索告诉队友，再穿过雾口';
    if (!run.pastFog) return `两条线索已齐，沿${channelName[channel].slice(2)}穿过雾区`;
    if (run.wrongFlag) return `这里没有小鸭，转向另一侧的${flagName[flag].slice(2)}`;
    return `找到${flagName[flag].slice(2)}，接小鸭上船`;
  }
  return '绕过浮木，靠近小鸭';
}

function FogCluePanel({ clues, disabled, onShare }: {
  clues: FogClues;
  disabled: boolean;
  onShare: () => void;
}) {
  const ownFlag = clues.own.kind === 'flag';
  const shared = ownFlag ? clues.flag !== null : clues.channel !== null;
  const otherClue = ownFlag
    ? clues.channel && channelName[clues.channel]
    : clues.flag && flagName[clues.flag];
  return <aside className="clue-panel" aria-label="雾区线索">
    <div>
      <h2>{ownFlag ? '你的救援信号' : '你的浅滩地图'}</h2>
      <strong>{clues.own.kind === 'flag' ? flagName[clues.own.value] : channelName[clues.own.value]}</strong>
    </div>
    <p aria-live="polite">{otherClue ? <>队友线索 <strong>{otherClue}</strong></> : '等队友分享另一条线索'}</p>
    <button className="secondary" disabled={disabled || shared} onClick={onShare}>
      {shared ? '已告诉队友' : '告诉队友'}
    </button>
  </aside>;
}
