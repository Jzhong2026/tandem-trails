import { useState } from 'react';
import { TRUCKS } from '../shared/trucks.js';
import type { TruckId } from '../shared/trucks.js';
import { StudyPicker } from './study-picker.js';
import { TruckGarage } from './truck-garage.js';
import { isWorkshopMode } from '../shared/workshop.js';
import { TOURNAMENTS } from '../shared/learning.js';
import { FUEL_MAX } from '../shared/race.js';
import { RACE_TRACKS } from '../shared/race-tracks.js';
import { RACE_SEATS } from '../shared/race-protocol.js';
import type { RaceRoomView, RaceSeat } from '../shared/race-protocol.js';
import type { RaceGame } from './use-race-room.js';
import { CAR_COLORS, CAR_NAMES } from './race-render.js';

interface Props {
  room: RaceRoomView;
  seat: RaceSeat;
  game: RaceGame;
  onExit: () => void;
}

export function RaceLobby({ room, seat, game, onExit }: Props) {
  const me = room.players[seat];
  const isHost = room.hostSeat === seat;
  const [name, setName] = useState(me?.name ?? '');
  const [copy, setCopy] = useState<'idle' | 'done' | 'manual'>('idle');
  const present = room.players.filter((player): player is NonNullable<typeof player> => player !== null);
  const allReady = present.length > 0 && present.every(player => player.ready);
  const address = new URL(window.location.pathname, window.location.origin);
  address.searchParams.set('race', room.code);
  const disabled = game.connection !== 'online' || game.busy;

  const commitName = () => {
    if (me && name.trim() && name !== me.name) game.profile({ name });
  };

  return <div className="race-lobby">
    <div className="race-lobby-grid">
      <div className="race-panel">
        <h2>邀请选手 <span className="race-chip live">{present.length}/4 已就位</span></h2>
        <div className="race-invite-top"><span>房间码</span><strong>{room.code}</strong></div>
        <div className="race-invite-row">
          <input className="race-input" aria-label="邀请链接" value={address.href} readOnly
            onFocus={event => event.currentTarget.select()} />
          <button className="rbtn cyan" disabled={disabled} onClick={async () => {
            try { await navigator.clipboard.writeText(address.href); setCopy('done'); }
            catch { setCopy('manual'); }
          }}>{copy === 'done' ? '已复制' : '复制邀请'}</button>
        </div>
        <p className="race-assist">{copy === 'manual' ? '可选中链接手动复制，或直接分享房间码。'
          : '把链接或房间码发给同学，各自打开就能加入，最多 4 人。'}</p>

        {room.mode === 'race' && me && <>
          <TruckGarage truck={me.truck} colour={me.color}/>
          <div className="truck-picker" aria-label="选择我的重卡">{(Object.keys(TRUCKS) as TruckId[]).map(id =>
            <button key={id} className="rbtn ghost small" aria-pressed={me.truck===id} disabled={disabled}
              onClick={()=>game.profile({truck:id})}>{TRUCKS[id].name}</button>)}</div>
        </>}
        <div className="race-seats" style={{ marginTop: 14 }}>
          {RACE_SEATS.map(index => {
            const player = room.players[index];
            if (!player) return <div key={index} className="race-seat empty">等待选手 {index + 1}…</div>;
            const own = index === seat;
            const color = CAR_COLORS[player.color];
            return <div key={index} className={`race-seat${own ? ' own' : ''}`} style={{ '--pc': color } as React.CSSProperties}>
              <div className="race-seat-head">
                <span className="race-dot" style={{ background: color }} />
                <strong>{player.name}{own ? '（你）' : ''}</strong>
                <span className={`race-ptag ${player.online ? (player.ready ? 'finished' : 'racing') : 'offline'}`}>
                  {player.online ? (player.ready ? '已准备' : '未准备') : '掉线'}
                </span>
              </div>
              {room.mode === 'race' && <small>{TRUCKS[player.truck].name}</small>}
              {own ? <>
                <div className="race-seat-name">
                  <input className="race-input" value={name} maxLength={8} aria-label="你的名字"
                    onChange={event => setName(event.target.value)} onBlur={commitName}
                    onKeyDown={event => { if (event.key === 'Enter') { commitName(); event.currentTarget.blur(); } }} />
                </div>
                <div className="race-swatches">
                  {CAR_COLORS.map((swatch, colorIndex) => {
                    const taken = present.some(other => other.seat !== seat && other.color === colorIndex);
                    return <button key={colorIndex} className="race-swatch" style={{ background: swatch }}
                      aria-label={`${CAR_NAMES[colorIndex]}色`} aria-pressed={player.color === colorIndex}
                      disabled={disabled || (taken && player.color !== colorIndex)}
                      onClick={() => game.profile({ color: colorIndex })} />;
                  })}
                </div>
              </> : <p className="race-assist" style={{ margin: 0 }}>{CAR_NAMES[player.color]}色赛车</p>}
            </div>;
          })}
        </div>
      </div>

      <div className="race-panel">
        <StudyPicker course={room.course} disabled={disabled || !isHost} change={course=>game.config({course})}/>
        {room.mode !== 'race' ? <div className={`learning-console ${room.mode}`}>
          <span>{TOURNAMENTS[room.mode].subject} · {isWorkshopMode(room.mode)?'四站合力赛':'六关挑战'}</span>
          <h2>{TOURNAMENTS[room.mode].name}</h2>
          <p>{TOURNAMENTS[room.mode].rule}</p><p>{isWorkshopMode(room.mode)?'全桌共用棋盘。每站成功，参与操作的选手各得一星，完成检验的选手再得一星。':'每人完成相同的六关。答对得一分，同分并列，可以给队友分享线索。'}</p>
        </div> : <><h2>赛道与规则 {isHost && <span className="race-chip amber">房主设置</span>}</h2>
        <div className="race-tracks">
          {RACE_TRACKS.map(track => <button key={track.id} className="race-track"
            aria-pressed={room.trackId === track.id} disabled={disabled || !isHost}
            onClick={() => game.config({ trackId: track.id })}>
            <span className={`race-track-swatch ${track.theme}`} />
            <span className="race-track-copy"><strong>{track.name}</strong><span>{track.subtitle}</span></span>
          </button>)}
        </div>
        <div className="race-config-row">
          <span className="race-config-label">出发油量</span>
          <div className="race-stepper">
            <button disabled={disabled || !isHost || room.startFuel <= 1} aria-label="减少出发油量"
              onClick={() => game.config({ startFuel: room.startFuel - 1 })}>−</button>
            <strong>{room.startFuel}</strong>
            <button disabled={disabled || !isHost || room.startFuel >= FUEL_MAX} aria-label="增加出发油量"
              onClick={() => game.config({ startFuel: room.startFuel + 1 })}>＋</button>
          </div>
          <span className="race-assist" style={{ margin: 0 }}>满格 {FUEL_MAX} · 默认 6 格</span>
        </div>
        <ul className="race-rules" style={{ marginTop: 14 }}>
          <li><span className="ico" style={{ color: 'var(--r-green)' }}>＋</span><span>进服务区答 <b>4 道题</b>（语文、数学、英语轮换），答对一题 <b>+1 格油</b>。</span></li>
          <li><span className="ico" style={{ color: 'var(--r-amber)' }}>－</span><span>每经过一个服务区消耗 <b>3 格油</b>，撞障碍一次漏 <b>1 格油</b>。</span></li>
          <li><span className="ico" style={{ color: 'var(--r-red)' }}>✕</span><span>油箱降到 <b>0</b> 立即淘汰；坚持到终点就是赢家。</span></li>
          <li><span className="ico" style={{ color: 'var(--r-cyan)' }}>↑</span><span>用 <b>← →</b> 或左右滑动变道，穿过算式答案所在的门可补 1 格油。</span></li>
          <li><span className="ico" style={{ color: 'var(--r-magenta)' }}>✎</span><span>赛后要把<b>答错的题</b>复习一遍，全桌复习完才能开下一局。</span></li>
        </ul></>}
      </div>
    </div>

    <div className="race-lobby-actions">
      <button className={`rbtn ${me?.ready ? 'ghost' : 'green'} big`} disabled={disabled || !me}
        onClick={() => game.ready(!me?.ready, room.lobbyRevision)}>
        {me?.ready ? '取消准备' : '我准备好了'}
      </button>
      {isHost && <button className="rbtn primary big" disabled={disabled || !allReady} onClick={() => game.start()}>
        {allReady ? '开始比赛 🏁' : '等所有人准备'}
      </button>}
      <span className="spacer" />
      <button className="rbtn ghost" disabled={disabled} onClick={onExit}>退出房间</button>
    </div>
    {!isHost && <p className="race-assist">房主会在所有人准备后开始比赛。可以先选好名字和代表色。</p>}
  </div>;
}