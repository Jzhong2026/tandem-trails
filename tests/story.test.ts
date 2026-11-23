import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgg, EGG_LAYOUTS } from '../src/shared/egg.js';
import { createMine, MINE } from '../src/shared/mine.js';
import { createSub, SUB } from '../src/shared/sub.js';
import { initialRiverView } from '../src/shared/river.js';
import { RIVER_COURSES } from '../src/shared/river-levels.js';
import { CHAPTER_STORY, currentBeat, levelProgress, storyFor } from '../src/shared/story.js';
import { GAME_LEVELS } from '../src/shared/game-levels.js';

test('every level maps to its chapter story', () => {
  assert.equal(storyFor('practice').chapter, 'river');
  assert.equal(storyFor('fog').chapter, 'river');
  assert.equal(storyFor('mine2').chapter, 'mine');
  assert.equal(storyFor('egg2').chapter, 'egg');
  assert.equal(storyFor('sub').chapter, 'sub');
  for (const level of GAME_LEVELS) assert.ok(storyFor(level).mission.length > 0);
});

test('progress starts at zero and clamps to one at the goal', () => {
  assert.equal(levelProgress('practice', initialRiverView('practice')), 0);
  assert.equal(levelProgress('mine', createMine()), MINE.start / MINE.exit);
  assert.equal(levelProgress('egg', createEgg()), createEgg().x / EGG_LAYOUTS.egg.exit);
  assert.equal(levelProgress('sub', createSub()), createSub().x / SUB.dock.x);
  assert.equal(levelProgress('sub', { ...createSub(), x: SUB.dock.x + 200 }), 1);
  assert.equal(levelProgress('bend', null), 0);
  const course = RIVER_COURSES.bend;
  assert.equal(levelProgress('bend', { ...initialRiverView('bend'), x: course.dock.x }), 1);
});

test('the bubble opens with the intro and advances through beats', () => {
  const story = CHAPTER_STORY.mine;
  const opening = currentBeat(story, 0);
  assert.equal(opening.npc, '长老');
  assert.equal(opening.text, story.intro[1].split('：')[1]);
  assert.equal(currentBeat(story, 0.3).npc, '长老');
  assert.equal(currentBeat(story, 0.6).npc, '獭獭');
  assert.equal(currentBeat(story, 1).text, story.beats[2].text);
});

test('each chapter carries an outro and a hook into the next commission', () => {
  for (const story of Object.values(CHAPTER_STORY)) {
    assert.ok(story.outro.length > 0);
    assert.ok(story.nextHook.length > 0);
    assert.ok(story.beats.every(beat => beat.at > 0 && beat.at <= 1));
  }
});