import assert from 'node:assert/strict';
import test from 'node:test';
import { QUEST_LEVELS } from '../src/shared/quest-levels.js';
import { isWorldFinale, WORLD_STORY, worldStoryOf } from '../src/shared/quest-story.js';

test('every level carries its own story line', () => {
  assert.equal(QUEST_LEVELS.length, 12);
  const lines = QUEST_LEVELS.map(level => level.story);
  assert.ok(lines.every(line => line.length > 0));
  assert.equal(new Set(lines).size, 12);
});

test('world stories cover the four worlds and map back from any level', () => {
  const worlds = [...new Set(QUEST_LEVELS.map(level => level.world))];
  assert.deepEqual(WORLD_STORY.map(entry => entry.world), worlds);
  for (const level of QUEST_LEVELS) {
    assert.equal(worldStoryOf(level).world, level.world);
    assert.ok(worldStoryOf(level).intro.length > 0);
    assert.ok(worldStoryOf(level).hook.length > 0);
  }
});

test('only the last level of each world is a finale', () => {
  const finales = QUEST_LEVELS.filter(isWorldFinale).map(level => level.index);
  assert.deepEqual(finales, [2, 5, 8, 11]);
});