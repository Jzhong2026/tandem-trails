import { EGG_LAYOUTS, isEggView } from './egg.js';
import { isMineView, MINE, MINE2 } from './mine.js';
import { isSubView, SUB } from './sub.js';
import { RIVER_COURSES } from './river-levels.js';
import { isEggLevel, isMineLevel, isSubLevel } from './game-levels.js';
import type { GameLevel } from './game-levels.js';
import type { RoomView } from './protocol.js';

export interface StoryBeat { at: number; npc: string; text: string }

export interface ChapterStory {
  chapter: 'river' | 'mine' | 'egg' | 'sub';
  requester: string;
  mission: string;
  whyTwo: string;
  intro: string[];
  beats: StoryBeat[];
  outro: string;
  nextHook: string;
}

export const CHAPTER_STORY: Record<ChapterStory['chapter'], ChapterStory> = {
  river: {
    chapter: 'river',
    requester: '鸭妈妈',
    mission: '把走失的小鸭接回码头',
    whyTwo: '一支桨只会转圈，两支桨才走得直',
    intro: [
      '獭獭：救援队，鸭妈妈的小鸭在浮木后面哭。去接它回家。',
      '鸭妈妈：它只怕生人，你们要慢慢靠近。',
    ],
    beats: [
      { at: 0.25, npc: '獭獭', text: '先一个人试桨，船会转；两个人一起按，船才走。商量好谁喊口令。' },
      { at: 0.55, npc: '鸭妈妈', text: '看到浮木了吗？喊出方向，让搭档跟着划。' },
      { at: 0.85, npc: '小鸭', text: '嘎！我看到码头啦！' },
    ],
    outro: '小鸭扑进鸭妈妈翅膀里。码头灯为你们亮了一整晚。',
    nextHook: '獭獭递来下一封委托：矿洞里的萤火虫不敢出门了。',
  },
  mine: {
    chapter: 'mine',
    requester: '萤火虫长老',
    mission: '各带一只萤火虫走出矿洞',
    whyTwo: '桥和升降梯各在一层，一个人按不到两个开关',
    intro: [
      '獭獭：矿洞塌了一半，萤火虫的光被关在里面。',
      '长老：孩子怕黑，大人怕高。你们正好互补。',
    ],
    beats: [
      { at: 0.2, npc: '长老', text: '下层按住绿开关，桥才放得下。上层过桥后别忘了回报一声。' },
      { at: 0.5, npc: '獭獭', text: '升降梯要上层一直按住。下层站上去之前，先问一句「准备好了吗」。' },
      { at: 0.8, npc: '长老', text: '出口的水晶门认光：两只萤火虫都到，门才开。' },
    ],
    outro: '萤火虫把矿洞照成一条星河。长老说，这是今年最亮的一次。',
    nextHook: '委托信被风吹上山：龙妈妈的蛋还在坡那边。',
  },
  egg: {
    chapter: 'egg',
    requester: '龙妈妈',
    mission: '把龙蛋平稳抬回巢',
    whyTwo: '担架两端各一人，坡道要轮流抬低的一端',
    intro: [
      '獭獭：山上风大，龙蛋不能一个人抱。',
      '龙妈妈：它听得懂慢脚步。你们走稳，它就睡。',
    ],
    beats: [
      { at: 0.25, npc: '龙妈妈', text: '上坡了！低的那一端抬高，喊一声再走。' },
      { at: 0.55, npc: '獭獭', text: '风口要两个人一起扶稳。风向会变，看旗子报给搭档。' },
      { at: 0.85, npc: '龙蛋', text: '（蛋里传来轻轻的心跳声）' },
    ],
    outro: '蛋落进巢里，裂开一条缝，露出一只打哈欠的小龙。',
    nextHook: '海马医生的潜水电报：珊瑚站缺气泡，请潜艇支援。',
  },
  sub: {
    chapter: 'sub',
    requester: '海马医生',
    mission: '收集气泡送到珊瑚站',
    whyTwo: '一个管上下一个管前后，谁也代替不了谁',
    intro: [
      '獭獭：珊瑚站的病人等气泡做药。',
      '海马医生：礁石会动，洋流会推。你们要把对方的操作当自己的眼睛。',
    ],
    beats: [
      { at: 0.25, npc: '海马医生', text: '垂下的礁石要下潜绕。驾驶员，报深度给你的搭档。' },
      { at: 0.55, npc: '獭獭', text: '洋流带会把船推偏，顶住方向再进。' },
      { at: 0.8, npc: '海马医生', text: '触手门一开一合，看准节奏，喊「现在」再冲。' },
    ],
    outro: '气泡在珊瑚站炸成一片小烟花。病人们排队向你们鞠躬。',
    nextHook: '獭獭合上委托簿：今天的救援队，满分。',
  },
};

export function storyFor(level: GameLevel): ChapterStory {
  if (isMineLevel(level)) return CHAPTER_STORY.mine;
  if (isEggLevel(level)) return CHAPTER_STORY.egg;
  if (isSubLevel(level)) return CHAPTER_STORY.sub;
  return CHAPTER_STORY.river;
}

export function levelProgress(level: GameLevel, run: RoomView['run']): number {
  if (!run) return 0;
  if (isMineView(run)) {
    const exit = run.level === 'mine2' ? MINE2.exit : MINE.exit;
    return clamp01(Math.max(run.players.left.x, run.players.right.x) / exit);
  }
  if (isEggView(run)) return clamp01(run.x / EGG_LAYOUTS[run.level].exit);
  if (isSubView(run)) return clamp01(run.x / SUB.dock.x);
  const course = RIVER_COURSES[run.level];
  return clamp01((run.x - course.start.x) / (course.dock.x - course.start.x));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function currentBeat(story: ChapterStory, progress: number): { npc: string; text: string } {
  let beat: StoryBeat | null = null;
  for (const entry of story.beats) if (entry.at <= progress) beat = entry;
  if (beat) return { npc: beat.npc, text: beat.text };
  const line = story.intro[story.intro.length - 1];
  const split = line.indexOf('：');
  return { npc: line.slice(0, split), text: line.slice(split + 1) };
}