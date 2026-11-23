import { QUEST_LEVELS } from './quest-levels.js';
import type { QuestLevel } from './quest-levels.js';

export interface WorldStory { world: string; intro: string; hook: string }

export const WORLD_STORY: WorldStory[] = [
  {
    world: '第一世界 · 晨光草原',
    intro: '獭獭：草原的金币被栗栗搬走了。芽芽，去把它们顶回来。',
    hook: '獭獭：草原干净了。下一封委托在云上。',
  },
  {
    world: '第二世界 · 云端奇旅',
    intro: '獭獭：云梯通向天空遗迹。风大，牵好搭档的手。',
    hook: '獭獭：天空遗迹安静了。秘境那边还在响求救铃。',
  },
  {
    world: '第三世界 · 秘境巡游',
    intro: '獭獭：糖果厂、浅海和夜林都发了求救信号。一路别松手。',
    hook: '獭獭：三处求救都回了信。只剩菇霸的城堡。',
  },
  {
    world: '第四世界 · 菇霸决战',
    intro: '獭獭：菇霸把彩虹桥锁进了城堡。最后一战，两个人一起上。',
    hook: '獭獭：彩虹桥回来了。今天的星芽队，满分。',
  },
];

export function worldStoryOf(level: QuestLevel): WorldStory {
  return WORLD_STORY.find(entry => entry.world === level.world) ?? WORLD_STORY[0];
}

export function isWorldFinale(level: QuestLevel): boolean {
  const next = QUEST_LEVELS[level.index + 1];
  return !next || next.world !== level.world;
}