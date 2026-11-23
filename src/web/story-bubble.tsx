import { currentBeat, levelProgress, storyFor } from '../shared/story.js';
import type { GameLevel } from '../shared/game-levels.js';
import type { RoomView } from '../shared/protocol.js';

export function StoryBubble({ level, run }: { level: GameLevel; run: RoomView['run'] }) {
  const beat = currentBeat(storyFor(level), levelProgress(level, run));
  return <p className="story-bubble" aria-live="polite"><strong>{beat.npc}</strong>{beat.text}</p>;
}

function artwork(level: GameLevel) {
  if (level.startsWith('mine')) return 'mine';
  if (level.startsWith('egg')) return 'egg';
  return level === 'sub' ? 'sub' : 'river';
}

export function ChapterIntro({level}:{level:GameLevel}) {
  const story=storyFor(level);
  return <div key={level} aria-hidden="true" className="chapter-intro">
    <img src={'/art/'+artwork(level)+'.webp'} alt=""/>
    <div><small>{story.requester} 的委托</small><strong>{story.mission}</strong></div>
  </div>;
}

export function MissionCard({ level }: { level: GameLevel }) {
  const story = storyFor(level);
  return <div className="mission-card">
    <img className="mission-still" src={'/art/'+artwork(level)+'.webp'} alt="" />
    <span className="chapter">{story.requester} 的委托</span>
    <p className="mission-line">{story.mission}</p>
    <p className="assist">为什么需要两个人：{story.whyTwo}。</p>
  </div>;
}