import { TRUCKS } from '../shared/trucks.js';
import { FUEL_MAX } from '../shared/race.js';
import type { PlayerStatus } from '../shared/race.js';
import type { RacePlayerView } from '../shared/race-protocol.js';
import { CAR_COLORS } from './race-render.js';

export function fuelColor(fuel: number): string {
  if (fuel > 6) return '#4ade80';
  if (fuel > 3) return '#ffc233';
  return '#ff4d4d';
}

export const STATUS_LABEL: Record<PlayerStatus, { text: string; cls: string }> = {
  racing: { text: '比赛中', cls: 'racing' },
  quiz: { text: '答题中', cls: 'quiz' },
  finished: { text: '已冲线', cls: 'finished' },
  eliminated: { text: '已淘汰', cls: 'eliminated' },
};

export function FuelGauge({ fuel }: { fuel: number }) {
  const color = fuelColor(fuel);
  return <div className="race-fuel" style={{ '--fc': color } as React.CSSProperties}
    role="meter" aria-label="油量" aria-valuenow={fuel} aria-valuemin={0} aria-valuemax={FUEL_MAX}>
    {Array.from({ length: FUEL_MAX }, (_, i) => <i key={i} className={i < fuel ? 'on' : ''} />)}
  </div>;
}

export function RoadBar({ progress, color, stations }: { progress: number; color: string; stations: number[] }) {
  return <div className="race-roadbar" style={{ '--pc': color } as React.CSSProperties}
    role="progressbar" aria-label="赛程进度" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
    <i style={{ width: `${Math.max(1.5, progress * 100)}%` }} />
    {stations.map((station, index) => <span key={index} className="tick" style={{ left: `${station * 100}%` }} />)}
    <span className="flag" />
  </div>;
}

export function PlayerCard({ player, own, stations, length }: {
  player: RacePlayerView; own: boolean; stations: number[]; length: number;
}) {
  const color = CAR_COLORS[player.color] ?? CAR_COLORS[0];
  const status = player.online ? STATUS_LABEL[player.status] : { text: '掉线', cls: 'offline' };
  return <div className={`race-pcard${own ? ' own' : ''}${player.status === 'eliminated' ? ' out' : ''}`}
    style={{ '--pc': color } as React.CSSProperties}>
    <div className="race-pcard-head">
      <span className="race-dot" />
      <span className="race-pname">{player.name}{own ? '（你）' : ''}</span>
      <span className={`race-ptag ${status.cls}`}>{status.text}</span>
    </div>
    <RoadBar progress={player.progress} color={color} stations={stations.map(s => s / length)} />
    <div className="race-pmeta">
      <FuelGauge fuel={player.fuel} />
      <span className="race-fuelnum" style={{ '--fc': fuelColor(player.fuel) } as React.CSSProperties}>{player.fuel}/{FUEL_MAX}</span>
    </div>
    <div className="race-pmeta">
      <span className="race-pstat">{TRUCKS[player.truck].name}</span>
      <span className="race-pstat">答对 {player.correctTotal}</span>
      <span className="race-pstat">碰撞 {player.hits}</span>
      <span className="race-pstat">服务区 {player.stationsCleared}/{stations.length}</span>
    </div>
  </div>;
}