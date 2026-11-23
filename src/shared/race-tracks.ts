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
    id: 'campus', name: '阳光校园线', subtitle: '车速适中 · 障碍较密 · 4 个服务区',
    theme: 'day', length: 10000, speed: 148, stations: [2200, 4400, 6600, 8800],
    gap: [250, 390], doubleChance: 0.16, seed: 20260901,
  },
  {
    id: 'suburb', name: '黄昏郊野线', subtitle: '车速更快 · 常见双车道障碍',
    theme: 'sunset', length: 11200, speed: 172, stations: [2400, 4800, 7200, 9600],
    gap: [220, 340], doubleChance: 0.28, seed: 20260902,
  },
  {
    id: 'canyon', name: '星空峡谷线', subtitle: '车速最快 · 障碍最密 · 高手挑战',
    theme: 'night', length: 12400, speed: 198, stations: [2600, 5200, 7800, 10400],
    gap: [185, 300], doubleChance: 0.36, seed: 20260903,
  },
];

export function trackById(id: string): RaceTrackDef {
  return RACE_TRACKS.find(track => track.id === id) ?? RACE_TRACKS[0];
}