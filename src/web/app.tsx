import { useState } from 'react';
import { normalizeRoomCode, ROOM_CODE_LENGTH, SEATS, validRoomCode } from '../shared/protocol.js';
import type { RoomView, Seat } from '../shared/protocol.js';
import { RIVER } from '../shared/river.js';
import { PaddleButton } from './paddle-button.js';
import { RiverCanvas } from './river-canvas.js';
import { useRoom } from './use-room.js';

type Game = ReturnType<typeof useRoom>;
const seatName = { left: '左桨', right: '右桨' } as const;

export function App() {
  const game = useRoom();
  const [code, setCode] = useState(() => normalizeRoomCode(
    new URLSearchParams(window.location.search).get('room') ?? '',
  ).slice(0, ROOM_CODE_LENGTH));
  const online = game.connection === 'online';

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
      {game.room && game.seat
        ? game.room.phase === 'lobby'
          ? <RoomLobby room={game.room} seat={game.seat} game={game} />
          : <RiverStage room={game.room} seat={game.seat} game={game} />
        : <section className="home">
          <div className="home-copy">
            <h1>亲子协作<br />大冒险</h1>
            <p className="home-description">和家人各掌一支桨。绕过浮木，把小鸭平安送回岸边。</p>
            <button className="primary create-button" disabled={!online || game.busy} onClick={game.create}>创建房间</button>
            <form className="join-form" onSubmit={event => {
              event.preventDefault();
              if (validRoomCode(code)) void game.join(code);
            }}>
              <label htmlFor="room-code">房间码</label>
              <div className="join-row">
                <input id="room-code" name="room-code" value={code} placeholder="6 位字母或数字"
                  autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  maxLength={ROOM_CODE_LENGTH} onChange={event => setCode(normalizeRoomCode(event.target.value))} />
                <button type="submit" className="secondary" disabled={!online || game.busy || !validRoomCode(code)}>加入房间</button>
              </div>
            </form>
          </div>
          <RiverCard />
        </section>}
    </main>
  </div>;
}

function RiverCard() {
  return <figure className="river-card">
    <RiverCanvas />
    <figcaption>
      <div><span className="chapter">双桨救援队</span><strong>浮木弯道</strong></div>
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
      <ul className="seats">
        {SEATS.map(key => {
          const player = room.players[key];
          return <li key={key} className={key}>
            <span>{seatName[key]}{key === seat && <small>你</small>}</span>
            <span>{!player ? '等待加入' : !player.online ? '暂时掉线' : player.ready ? '已准备' : '未准备'}</span>
          </li>;
        })}
      </ul>
      <div className="room-actions">
        <button className="primary" disabled={disabled} onClick={() => game.ready(!ready)}>
          {ready ? '取消准备' : '我准备好了'}
        </button>
        <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
      </div>
    </div>
    <RiverCard />
  </section>;
}

function RiverStage({ room, seat, game }: { room: RoomView; seat: Seat; game: Game }) {
  const run = room.run!;
  const other = seat === 'left' ? 'right' : 'left';
  const disabled = game.connection !== 'online' || game.busy;
  const progress = room.phase === 'finished' ? 100 : Math.min(99, Math.round(
    (run.x - RIVER.start.x) / (RIVER.dock.x - RIVER.start.x) * 100,
  ));

  return <section className="stage">
    <div className="stage-title">
      <div><span className="chapter">双桨救援队</span><h1>浮木弯道</h1></div>
      <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
    </div>
    <div className="stage-hud">
      <span aria-live="polite">{run.rescued ? '小鸭已上船，划向码头' : '绕过浮木，靠近小鸭'}</span>
      <progress aria-label="河道进度" max={100} value={progress} />
    </div>
    <div className="stage-scene">
      <RiverCanvas run={run} paddles={room.paddles} />
      {room.phase === 'paused' && <div className="stage-overlay" role="status">
        <strong>队友掉线，等对方回来继续。</strong>
        <span>房间会保留 90 秒。</span>
      </div>}
      {room.phase === 'finished' && <div className="stage-overlay finish">
        <h2>小鸭到家了！</h2>
        <p>用时 {Math.floor(run.elapsedMs / 1000)} 秒 · 碰撞 {run.collisions} 次</p>
        <button className="primary" disabled={disabled} onClick={game.replay}>再玩一次</button>
      </div>}
    </div>
    {room.phase !== 'finished' && <div className="control-deck">
      <div>
        <p className="control-instruction">一人划，船转向。两人一起划，船才前进。</p>
        <div className="control-state">
          {run.recoveryMs > 0 ? '划到了浮木，已回到最近的安全点。'
            : `队友的${seatName[other]} · ${room.paddles[seat === 'left' ? 1 : 0] ? '划桨中' : '已松开'}`}
        </div>
      </div>
      <div className="paddle-control">
        <PaddleButton seat={seat} enabled={!disabled && room.phase === 'playing'} onPaddle={game.paddle} />
        <span className="keyboard-guide">键盘也可按住 <kbd>空格</kbd></span>
      </div>
    </div>}
  </section>;
}
