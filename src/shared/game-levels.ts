import { nextRiverLevel, RIVER_ORDER } from './river-levels.js';
import type { RiverLevel } from './river-levels.js';
import type { Seat } from './protocol.js';

export const GAME_TICK_MS = 1000 / 30;
export const MINE_ORDER = ['mine', 'mine2'] as const;
export const EGG_ORDER = ['egg', 'egg2'] as const;
export const SUB_ORDER = ['sub'] as const;
export type MineLevel = typeof MINE_ORDER[number];
export type EggLevel = typeof EGG_ORDER[number];
export type SubLevel = typeof SUB_ORDER[number];
export const GAME_LEVELS = [...RIVER_ORDER, ...MINE_ORDER, ...EGG_ORDER, ...SUB_ORDER] as const;
export type GameLevel = typeof GAME_LEVELS[number];

export const MINE_TITLE = '萤火虫矿洞';
export const MINE_LEVEL_TITLE = '断桥接力';
export const MINE_SUMMARY = '下层放桥，上层开升降梯，带着萤火虫一起出洞。';
export const MINE2_LEVEL_TITLE = '双桥接力';
export const MINE2_SUMMARY = '轮流为队友放桥，各收一只萤火虫，一起出洞。';
export const EGG_TITLE = '摇摇晃晃送龙蛋';
export const EGG_LEVEL_TITLE = '双坡运蛋';
export const EGG_SUMMARY = '一起走，轮流抬高较低的一端，把龙蛋送回巢。';
export const EGG2_LEVEL_TITLE = '风口栈道';
export const EGG2_SUMMARY = '坡道抬低端，风口两人一起扶稳，顶风把龙蛋送回巢。';
export const SUB_TITLE = '泡泡潜艇';
export const SUB_LEVEL_TITLE = '珊瑚浅滩';
export const SUB_SUMMARY = '左驾驶员管上下，右驾驶员管前后，收集气泡、接小海马，一起开到珊瑚站。';

export function isMineLevel(level: unknown): level is MineLevel {
  return MINE_ORDER.some(entry => entry === level);
}

export function isEggLevel(level: unknown): level is EggLevel {
  return EGG_ORDER.some(entry => entry === level);
}

export function isSubLevel(level: unknown): level is SubLevel {
  return SUB_ORDER.some(entry => entry === level);
}

export function usesMovementControls(level: unknown): level is MineLevel | EggLevel | SubLevel {
  return isMineLevel(level) || isEggLevel(level) || isSubLevel(level);
}

export function seatRoleName(level: GameLevel, seat: Seat): string {
  if (isMineLevel(level)) return seat === 'left' ? '下层' : '上层';
  if (isEggLevel(level)) return seat === 'left' ? '左端' : '右端';
  if (isSubLevel(level)) return seat === 'left' ? '升降驾驶员' : '前进驾驶员';
  return seat === 'left' ? '左桨' : '右桨';
}

export function isGameLevel(input: unknown): input is GameLevel {
  return GAME_LEVELS.some(level => level === input);
}

export function nextGameLevel(level: GameLevel): GameLevel | undefined {
  if (isMineLevel(level)) return MINE_ORDER[MINE_ORDER.indexOf(level) + 1];
  if (isEggLevel(level)) return EGG_ORDER[EGG_ORDER.indexOf(level) + 1];
  if (isSubLevel(level)) return SUB_ORDER[SUB_ORDER.indexOf(level) + 1];
  return nextRiverLevel(level as RiverLevel);
}