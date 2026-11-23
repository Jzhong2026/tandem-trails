export type RaceTheme = 'day' | 'sunset' | 'night';

export interface RaceTrackDef {
  id: string;
  name: string;
  subtitle: string;
  theme: RaceTheme;
  length: number;
  speed: number;
  stations: number[];
  gap: [number, number];
  doubleChance: number;
  seed: number;
}

export const RACE_TRACKS: RaceTrackDef[] = [
  {
    id: 'campus', name: '阳光校园线', subtitle: '车速慢 · 障碍稀 · 适合第一次玩',
    theme: 'day', length: 10000, speed: 130, stations: [2500, 5000, 7500],
    gap: [340, 520], doubleChance: 0.08, seed: 20260901,
  },
  {
    id: 'suburb', name: '黄昏郊野线', subtitle: '车速中等 · 偶尔双车道障碍',
    theme: 'sunset', length: 10800, speed: 150, stations: [2700, 5400, 8100],
    gap: [300, 460], doubleChance: 0.16, seed: 20260902,
  },
  {
    id: 'canyon', name: '星空峡谷线', subtitle: '车速快 · 障碍密 · 高手挑战',
    theme: 'night', length: 11600, speed: 170, stations: [2900, 5800, 8700],
    gap: [260, 420], doubleChance: 0.26, seed: 20260903,
  },
];

export function trackById(id: string): RaceTrackDef {
  return RACE_TRACKS.find(track => track.id === id) ?? RACE_TRACKS[0];
}