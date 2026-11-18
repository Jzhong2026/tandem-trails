import { RIVER_ORDER } from './river-levels.js';

export const GAME_TICK_MS = 1000 / 30;
export const GAME_LEVELS = [...RIVER_ORDER, 'mine', 'egg'] as const;
export type GameLevel = typeof GAME_LEVELS[number];

export const MINE_TITLE = '萤火虫矿洞';
export const MINE_LEVEL_TITLE = '断桥接力';
export const MINE_SUMMARY = '下层放桥，上层开升降梯，带着萤火虫一起出洞。';
export const EGG_TITLE = '摇摇晃晃送龙蛋';
export const EGG_LEVEL_TITLE = '双坡运蛋';
export const EGG_SUMMARY = '一起走，轮流抬高较低的一端，把龙蛋送回巢。';

export function usesMovementControls(level: unknown): level is 'mine' | 'egg' {
  return level === 'mine' || level === 'egg';
}

export function isGameLevel(input: unknown): input is GameLevel {
  return GAME_LEVELS.some(level => level === input);
}
