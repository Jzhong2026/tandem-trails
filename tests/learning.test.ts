import assert from 'node:assert/strict';
import test from 'node:test';
import { questionsFor, studyShelf } from '../src/server/curriculum.js';
import { LearningMatch } from '../src/server/learning-match.js';
import { makeChallenges, gradeChallenge, LEARNING_GAMES } from '../src/shared/learning.js';
import type { LearningMode } from '../src/shared/learning.js';
import { SUBJECT_NAMES } from '../src/shared/study.js';
import type { RaceSubject } from '../src/shared/race-questions.js';

const modes = Object.keys(LEARNING_GAMES) as LearningMode[];
for (let grade = 2; grade <= 9; grade++)
  for (const term of [1, 2]) {
    test(`Shanghai course ${grade}/${term} supplies the shelf, race and all three contests`, () => {
      const course = { grade, term };
      const bank = questionsFor(course);
      for (const subject of Object.keys(SUBJECT_NAMES) as RaceSubject[]) {
        const shelf = studyShelf(course, subject);
        assert.ok(shelf.lessons.length && shelf.topics.length && shelf.edition && shelf.cards.length);
        assert.ok(shelf.lessons.every((l) => l.url.startsWith('https://basic.sh.smartedu.cn/')));
        assert.equal(shelf.exercises, bank.filter((q) => q.subject === subject).length);
      }
      for (const q of bank) {
        assert.ok(q.options[q.answer] && q.explain.trim());
        assert.equal(new Set(q.options).size, q.options.length);
      }
      for (const mode of modes) {
        const rounds = makeChallenges(mode, bank, () => 0.43);
        assert.equal(rounds.length, 6);
        assert.equal(new Set(rounds.map((q) => q.prompt)).size, 6);
        for (const q of rounds) {
          assert.ok(q.solution.every((i) => i >= 0 && i < q.options.length));
          assert.ok(gradeChallenge(q, q.solution));
          assert.ok(q.explanation && q.hint);
          if (mode === 'parcel') assert.equal(q.options.length, 8);
        }
      }
    });
  }

test('shared clues, independent progress, duplicate answers and retirement', () => {
  const bank = questionsFor({ grade: 2, term: 2 });
  const match = new LearningMatch('lantern', bank, [
    { seat: 0, name: '小林' },
    { seat: 2, name: '小唐' },
  ]);
  assert.equal(match.view(0)?.prompt, match.view(2)?.prompt);
  assert.equal(match.act(0, { type: 'hint', round: 0 }), true);
  assert.equal(match.view(2)?.helper, '小林');
  for (let round = 0; round < 6; round++) {
    const view = match.view(2)!;
    const question = bank.find((q) => q.prompt === view.prompt)!;
    const index = view.options.indexOf(question.options[question.answer]);
    const move = { type: 'submit' as const, round, picks: [index] };
    assert.equal(match.act(2, move), true);
    assert.equal(match.act(2, move), false);
    assert.equal(match.view(2)?.verdict?.correct, true);
    assert.equal(match.act(2, { type: 'next', round }), true);
    assert.equal(match.act(2, move), false);
  }
  assert.equal(match.finished, false);
  assert.equal(match.view(2)?.scores[0].score, 6);
  match.retire(0);
  assert.equal(match.finished, true);
});
