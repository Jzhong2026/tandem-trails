import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkshopMatch } from '../src/server/workshop-match.js';
import { traceLight, workshopPuzzle, WORKSHOP_ROUNDS } from '../src/shared/workshop.js';
import type { WorkshopMode, WorkshopAction, Mirror } from '../src/shared/workshop.js';
import { courseSubjects, studyShelf } from '../src/server/curriculum.js';

test('every mirror layout starts unfinished and its construction gives a working route', () => {
  for (const grade of [2, 4, 7, 9])
    for (const term of [1, 2])
      for (let round = 0; round < 4; round++)
        for (let variant = 0; variant < 24; variant++) {
          const puzzle = workshopPuzzle('optics', { grade, term }, round, variant);
          if (puzzle.board.kind !== 'optics') throw Error();
          assert.equal(traceLight(puzzle.board).lit, false);
          puzzle.answer.forEach(
            (slash, i) => puzzle.board.kind === 'optics' && (puzzle.board.mirrors[i].slash = Boolean(slash)),
          );
          assert.equal(traceLight(puzzle.board).lit, true);
        }
});
for (const mode of ['optics', 'atlas', 'chronicle'] as WorkshopMode[]) {
  test(`${mode} supports cooperative scoring, retries, stale moves and four completed boards`, () => {
    const course = { grade: 8, term: 2 },
      seed = 17;
    const match = new WorkshopMatch(
      mode,
      course,
      [
        { seat: 0, name: '左' },
        { seat: 1, name: '右' },
      ],
      seed,
    );
    const act = (seat: number, type: WorkshopAction['type'], index?: number) => {
      const { round, revision } = match.view();
      return match.act(seat, { round, revision, type, index });
    };
    for (let round = 0; round < WORKSHOP_ROUNDS; round++) {
      const puzzle = workshopPuzzle(mode, course, round, seed);
      const initial = match.view();
      assert.equal(initial.round, round);
      assert.ok(!Object.hasOwn(initial, 'answer'));
      assert.equal(act(0, 'hint'), true);
      assert.equal(match.act(1, { round, revision: initial.revision, type: 'select', index: 0 }), false);
      assert.equal(act(1, 'select', -1), false);
      if (initial.board.kind === 'optics') {
        assert.equal(act(0, 'test'), true);
        for (const [i, v] of puzzle.answer.entries()) {
          const mirror: Mirror = initial.board.mirrors[i];
          if (mirror.slash !== Boolean(v)) assert.equal(act(0, 'select', mirror.cell), true);
        }
      } else if (initial.board.kind === 'atlas') {
        const bad = (puzzle.answer[0] + 1) % initial.board.size ** 2;
        assert.equal(act(0, 'select', bad), true);
        assert.equal(act(0, 'test'), true);
        assert.equal(match.view().solved, false);
        assert.equal(act(0, 'select', puzzle.answer[0]), true);
      } else {
        assert.equal(act(0, 'select', puzzle.answer[1]), true);
        assert.equal(act(0, 'undo'), true);
        for (const i of puzzle.answer) assert.equal(act(0, 'select', i), true);
      }
      assert.equal(act(1, 'test'), true);
      assert.ok(match.view().solved);
      assert.ok(match.view().message);
      assert.equal(act(1, 'test'), false);
      assert.equal(act(1, 'next'), true);
    }
    assert.equal(match.finished, true);
    assert.deepEqual(
      match.view().players.map((p) => p.points),
      [4, 8],
    );
  });
}
test('published junior subject shelves include local study and cross-term listings', () => {
  for (let grade = 6; grade <= 9; grade++)
    for (const term of [1, 2]) {
      const course = { grade, term };
      for (const subject of courseSubjects(course)) {
        const shelf = studyShelf(course, subject);
        assert.ok(shelf.edition && shelf.lessons.length && shelf.cards.length, `${grade}/${term}/${subject}`);
        assert.ok(shelf.exercises > 0);
      }
    }
  assert.ok(courseSubjects({ grade: 7, term: 2 }).includes('人工智能基础'));
  assert.ok(courseSubjects({ grade: 9, term: 1 }).includes('化学'));
  assert.ok(!courseSubjects({ grade: 2, term: 1 }).includes('化学'));
});

test('retirement removes only that player and ends an empty workshop', () => {
  const match = new WorkshopMatch(
    'atlas',
    { grade: 3, term: 1 },
    [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    2,
  );
  assert.ok(match.retire(1));
  assert.equal(match.retire(1), false);
  assert.equal(match.act(1, { round: 0, revision: match.view().revision, type: 'hint' }), false);
  assert.equal(match.finished, false);
  assert.ok(match.retire(0));
  assert.ok(match.finished);
});

test('exhibits can be reordered without losing a teammate’s concurrent move', () => {
  const match = new WorkshopMatch(
    'chronicle',
    { grade: 2, term: 2 },
    [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    1,
  );
  for (const i of [2, 0, 3])
    match.act(0, { round: 0, revision: match.view().revision, type: 'select', index: i });
  const revision = match.view().revision;
  assert.ok(match.act(1, { type: 'move', index: 0, destination: 2, round: 0, revision }));
  assert.deepEqual(match.view().selection, [0, 3, 2]);
  assert.equal(match.act(0, { type: 'move', index: 2, destination: 0, round: 0, revision }), false);
});
