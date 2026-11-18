export const RIVER_SIZE = { width: 1000, height: 400, banks: { top: 52, bottom: 348 } } as const;
export const RIVER_ORDER = ['practice', 'bend', 'fog'] as const;
export type RiverLevel = typeof RIVER_ORDER[number];
export type Flag = 'triangle' | 'circle';
export type Channel = 'upper' | 'lower';

export interface FogLayout {
  flag: Flag;
  channel: Channel;
}

interface Point { x: number; y: number }
interface Target extends Point { radius: number }

interface RiverCourse {
  title: string;
  summary: string;
  start: Point;
  dock: Target;
  buoys: readonly Point[];
  logs: readonly (Point & { rx: number; ry: number })[];
  checkpoint?: Point;
  duck?: Target;
}

const start = { x: 105, y: 200 };

export const FOG_GATE = {
  stagingX: 345,
  startX: 375,
  endX: 510,
  halfWidth: 58,
  lanes: { upper: 122, lower: 278 },
} as const;

export const FOG_FLAGS = {
  triangle: { x: 738, y: 122, radius: 43 },
  circle: { x: 738, y: 278, radius: 43 },
} as const satisfies Record<Flag, Target>;

export const RIVER_COURSES: Record<RiverLevel, RiverCourse> = {
  practice: {
    title: '练桨池',
    summary: '轮流试桨，再一起划回码头。',
    start,
    dock: { x: 652, y: 200, radius: 72 },
    buoys: [{ x: 250, y: 200 }, { x: 425, y: 200 }],
    logs: [],
  },
  bend: {
    title: '浮木弯道',
    summary: '绕过两段浮木，把小鸭送回岸边。',
    start,
    dock: { x: 881, y: 200, radius: 47 },
    buoys: [{ x: 231, y: 263 }, { x: 410, y: 254 }, { x: 510, y: 144 }, { x: 650, y: 144 }],
    logs: [{ x: 313, y: 129, rx: 47, ry: 76 }, { x: 582, y: 276, rx: 47, ry: 77 }],
    checkpoint: { x: 449, y: 230 },
    duck: { x: 741, y: 200, radius: 45 },
  },
  fog: {
    title: '雾里找码头',
    summary: '交换救援暗号和浅滩地图，在雾里找对码头。',
    start,
    dock: { x: 881, y: 200, radius: 54 },
    buoys: [{ x: 307, y: 122 }, { x: 307, y: 278 }, { x: 572, y: 122 }, { x: 572, y: 278 }],
    logs: [],
    checkpoint: { x: 325, y: 200 },
  },
};

export function isRiverLevel(input: unknown): input is RiverLevel {
  return RIVER_ORDER.some(level => level === input);
}

export function nextRiverLevel(level: RiverLevel): RiverLevel | undefined {
  return RIVER_ORDER[RIVER_ORDER.indexOf(level) + 1];
}
