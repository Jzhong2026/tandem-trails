import { DEFAULT_COURSE } from './study.js';
import type { StudyCourse } from './study.js';

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
export interface NumberGate {
  x: number;
  prompt: string;
  values: number[];
  answerLane: number;
}

// One untimed pit stop follows each moving number challenge. Gate positions and
// lane labels are shared by the renderer and the authoritative race simulation.
export function numberGates(track: RaceTrackDef, course:StudyCourse = DEFAULT_COURSE): NumberGate[] {
  return track.stations.map((station, index) => {
    const start = track.stations[index - 1] ?? 0;
    const a = 3 + (track.seed + index) % 6;
    const b = 2 + (track.seed + 2 * index) % 5;
    const tasks = [
      { prompt: `${a} + ${b}`, result: a + b },
      { prompt: `${a} × ${b}`, result: a * b },
      { prompt: `${a * b} ÷ ${b}`, result: a },
      { prompt: `${10 + a} − ${b}`, result: 10 + a - b },
    ];
    if (course.grade === 2 && course.term === 1) tasks[2] = {prompt:`${a} × 2`,result:a*2};
    if (course.grade === 2 && course.term === 2) tasks[0] = {prompt:`${a*100} + ${b*10}`,result:a*100+b*10};
    if (course.grade >= 3) {
      const tens = a*10;
      tasks[0] = {prompt:`${tens} + ${b*2}`,result:tens+b*2};
      tasks[1] = {prompt:`${a+10} × ${b}`,result:(a+10)*b};
      tasks[2] = {prompt:`${a*b*10} ÷ ${b}`,result:a*10};
      tasks[3] = {prompt:`(${a} + ${b}) × 2`,result:(a+b)*2};
    }
    if (course.grade >= 5) {
      tasks[0] = {prompt:`${a}.5 × 2`,result:a*2+1};
      tasks[1] = {prompt:`${b} ÷ 0.5`,result:b*2};
    }
    if (course.grade === 6) tasks[2] = course.term===1
      ? {prompt:`(−${a}) × (−${b})`,result:a*b} : {prompt:`${a*20} × 25%`,result:a*5};
    const task = tasks[index % tasks.length];
    const answerLane = (track.seed + index) % 3;
    const values = [task.result + 2, task.result - 1, task.result + 1];
    values[answerLane] = task.result;
    return { x: Math.round(start + track.speed * 5.8), prompt: task.prompt, values, answerLane };
  });
}
