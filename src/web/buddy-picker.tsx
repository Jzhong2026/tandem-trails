import { useEffect, useRef, useState } from 'react';
import { BODY_DEFAULT_NAME, BUDDY_BODIES, BUDDY_NAME_MAX, BUDDY_SIZES, DEFAULT_APPEARANCE, sanitizeAppearance } from '../shared/buddy.js';
import type { Appearance, BuddyBody, BuddySize } from '../shared/buddy.js';
import type { RoomView, Seat } from '../shared/protocol.js';
import { SEATS } from '../shared/protocol.js';
import { seatRoleName } from '../shared/game-levels.js';
import { BUDDY_PALETTES, paintBuddy } from './buddy.js';
import { saveBuddyPreference } from './buddy-save.js';
import type { useRoom } from './use-room.js';

type Game = ReturnType<typeof useRoom>;

const BODY_LABEL: Record<BuddyBody, string> = {
  kid: '小芽人',
  bear: '小熊',
  fox: '小狐',
  penguin: '企鹅',
};
const SIZE_LABEL: Record<BuddySize, string> = { big: '家长 · 大', small: '孩子 · 小' };

export function BuddyPreview({ appearance, size = 96 }: { appearance: Appearance; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current!;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    target.width = size * dpr;
    target.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    paintBuddy(ctx, {
      x: size / 2, feet: size - 8, scale: (size - 24) / 41,
      appearance, outfit: 'sprout', pose: 'idle', seconds: 0.4,
    });
  }, [appearance, size]);
  return <canvas className="buddy-preview" style={{ width: size, height: size }} ref={canvas} aria-hidden="true" />;
}

export function BuddyControls({ appearance: confirmed, onChange }: { appearance: Appearance; onChange: (next: Appearance) => void }) {
  const [pending, setPending] = useState<Appearance | null>(null);
  const [editedName, setEditedName] = useState<string | null>(null);
  const appearance = pending ?? confirmed;
  const name = editedName ?? appearance.name;
  useEffect(() => {
    if (pending && pending.body === confirmed.body && pending.size === confirmed.size
      && pending.palette === confirmed.palette && pending.name === confirmed.name) setPending(null);
  }, [confirmed, pending]);
  function select(next: Appearance) {
    const clean = sanitizeAppearance(next, appearance);
    setPending(clean);
    setEditedName(null);
    onChange(clean);
  }
  function commitName(value: string) {
    if (value !== appearance.name) select({ ...appearance, name: value });
    else setEditedName(null);
  }
  return <div className="buddy-picker">
    <div className="buddy-row" role="group" aria-label="形象">
      {BUDDY_BODIES.map(body => (
        <button key={body} className="pick-btn" aria-pressed={appearance.body === body}
          onClick={() => select({
            ...appearance, body,
            name: name === BODY_DEFAULT_NAME[appearance.body] ? BODY_DEFAULT_NAME[body] : name,
          })}>
          {BODY_LABEL[body]}
        </button>
      ))}
    </div>
    <div className="buddy-row" role="group" aria-label="配色">
      {BUDDY_PALETTES.map((pal, index) => (
        <button key={index} className="pick-swatch" style={{ background: pal.cap }}
          aria-label={`配色 ${index + 1}`} aria-pressed={appearance.palette === index}
          onClick={() => select({ ...appearance, name, palette: index })} />
      ))}
    </div>
    <div className="buddy-row" role="group" aria-label="体型">
      {BUDDY_SIZES.map(size => (
        <button key={size} className="pick-btn" aria-pressed={appearance.size === size}
          onClick={() => select({ ...appearance, name, size })}>
          {SIZE_LABEL[size]}
        </button>
      ))}
    </div>
    <label className="buddy-name">
      <span>名字</span>
      <input value={name} maxLength={BUDDY_NAME_MAX} onChange={event => setEditedName(event.target.value)}
        onBlur={event => commitName(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    </label>
  </div>;
}

function BuddySeatCard({ room, seat, own, game }: { room: RoomView; seat: Seat; own: boolean; game: Game }) {
  const player = room.players[seat];
  const appearance = player?.appearance ?? DEFAULT_APPEARANCE[seat];

  function commit(next: Appearance) {
    saveBuddyPreference(seat, next);
    game.setAppearance(next);
  }

  const status = !player ? '等待加入' : !player.online ? '暂时掉线' : player.ready ? '已准备' : '未准备';
  return <li className={`buddy-card ${seat}${own ? ' own' : ''}`}>
    <div className="buddy-card-head">
      <BuddyPreview appearance={appearance} />
      <div className="buddy-card-copy">
        <strong>{appearance.name}{own && <small>你</small>}</strong>
        <span className="buddy-role">{seatRoleName(room.level, seat)} · {SIZE_LABEL[appearance.size]}</span>
        <span className={`buddy-status ${player?.ready ? 'ready' : ''}`}>{status}</span>
      </div>
    </div>
    {own && player && <BuddyControls appearance={appearance} onChange={commit} />}
  </li>;
}

export function BuddySeats({ room, seat, game }: { room: RoomView; seat: Seat; game: Game }) {
  return <ul className="buddy-seats">
    {SEATS.map(key => <BuddySeatCard key={key} room={room} seat={key} own={key === seat} game={game} />)}
  </ul>;
}