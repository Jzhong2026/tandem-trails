import assert from 'node:assert/strict';
import test from 'node:test';
import { RaceRoom } from '../src/server/race-room.js';
import { RACE_QUESTIONS } from '../src/shared/race-questions.js';
import type { RaceSeat } from '../src/shared/race-protocol.js';

function room(code = 'ABC234') {
  return new RaceRoom(code, 0);
}

function joinPlayers(count: number) {
  const instance = room();
  for (let i = 0; i < count; i++) instance.admit(i as RaceSeat, `sock${i}`, 0);
  return instance;
}

function readyAll(instance: RaceRoom) {
  const revision = instance.view(0, 0).lobbyRevision;
  for (const seat of instance.presentSeats()) instance.ready(seat, true, revision, 0);
}

function answerCorrectly(instance: RaceRoom, seat: RaceSeat) {
  const quiz = instance.view(seat, 0).quiz!;
  const bank = RACE_QUESTIONS.find(question => question.prompt === quiz.prompt);
  assert.ok(bank, `unknown prompt ${quiz.prompt}`);
  const correctText = bank.options[bank.answer];
  const index = quiz.options.indexOf(correctText);
  assert.ok(index >= 0, 'correct option present');
  instance.answer(seat, index, 0);
}

function answerWrongly(instance: RaceRoom, seat: RaceSeat) {
  const quiz = instance.view(seat, 0).quiz!;
  const bank = RACE_QUESTIONS.find(question => question.prompt === quiz.prompt);
  assert.ok(bank, `unknown prompt ${quiz.prompt}`);
  const correctText = bank.options[bank.answer];
  const index = quiz.options.indexOf(correctText);
  assert.ok(index >= 0, 'correct option present');
  instance.answer(seat, (index + 1) % 4, 0);
}

function playToCompletion(instance: RaceRoom, seat: RaceSeat, wrongFirst = false) {
  let guard = 0;
  let missNext = wrongFirst;
  while (instance.phase === 'playing' && guard++ < 60000) {
    const quiz = instance.view(seat, 0).quiz;
    if (quiz) {
      if (quiz.phase === 'question') {
        if (missNext) {
          answerWrongly(instance, seat);
          missNext = false;
        } else {
          answerCorrectly(instance, seat);
        }
      } else instance.advance(seat, 0);
      continue;
    }
    instance.tick(0);
  }
  assert.equal(instance.phase, 'finished', 'race should finish');
}

test('admit assigns host and free seats, full at four', () => {
  const instance = room();
  assert.equal(instance.firstFreeSeat(), 0);
  instance.admit(0, 'a', 0);
  assert.equal(instance.hostSeat, 0);
  assert.equal(instance.firstFreeSeat(), 1);
  instance.admit(1, 'b', 0);
  instance.admit(2, 'c', 0);
  instance.admit(3, 'd', 0);
  assert.equal(instance.firstFreeSeat(), undefined);
  assert.equal(instance.presentSeats().length, 4);
});

test('profile sanitizes name and keeps colors unique', () => {
  const instance = joinPlayers(2);
  instance.setProfile(0, { name: '  闪电小子  ', color: 2 }, 0);
  assert.equal(instance.view(0, 0).players[0]!.name, '闪电小子');
  assert.equal(instance.view(0, 0).players[0]!.color, 2);
  instance.setProfile(1, { color: 2 }, 0);
  assert.notEqual(instance.view(0, 0).players[1]!.color, 2, 'color already taken');
  instance.setProfile(0, { name: 'x'.repeat(40) }, 0);
  assert.ok(instance.view(0, 0).players[0]!.name.length <= 8);
});

test('start requires every present player ready', () => {
  const instance = joinPlayers(2);
  const revision = instance.view(0, 0).lobbyRevision;
  instance.ready(0, true, revision, 0);
  assert.equal(instance.canStart(), false);
  assert.equal(instance.start(0), false);
  instance.ready(1, true, revision, 0);
  assert.equal(instance.canStart(), true);
  assert.equal(instance.start(0), true);
  assert.equal(instance.phase, 'playing');
  assert.equal(instance.view(0, 0).players.filter(Boolean).length, 2);
});

test('ready rejects a stale lobby revision', () => {
  const instance = joinPlayers(1);
  assert.equal(instance.ready(0, true, 999, 0), false);
});

test('config changes reset ready and bump revision', () => {
  const instance = joinPlayers(1);
  readyAll(instance);
  const before = instance.view(0, 0).lobbyRevision;
  instance.setConfig({ trackId: 'canyon', startFuel: 9 }, 0);
  const view = instance.view(0, 0);
  assert.equal(view.trackId, 'canyon');
  assert.equal(view.startFuel, 9);
  assert.ok(view.lobbyRevision > before);
  assert.equal(view.players[0]!.ready, false);
});

test('lane input moves the car during play', () => {
  const instance = joinPlayers(1);
  readyAll(instance);
  instance.start(0);
  for (let i = 0; i < 120; i++) instance.tick(0);
  assert.equal(instance.view(0, 0).players[0]!.lane, 1);
  instance.lane(0, -1, 0);
  assert.equal(instance.view(0, 0).players[0]!.lane, 0);
  instance.lane(0, -1, 0);
  assert.equal(instance.view(0, 0).players[0]!.lane, 0, 'clamped at top');
});

test('a solo race answers quizzes, refuels and reaches the finish', () => {
  const instance = joinPlayers(1);
  instance.setConfig({ startFuel: 10 }, 0);
  readyAll(instance);
  instance.start(0);
  playToCompletion(instance, 0);
  const view = instance.view(0, 0);
  const stations = view.standings!.finished[0].stationsCleared;
  assert.equal(view.players[0]!.status, 'finished');
  assert.equal(view.players[0]!.correctTotal, stations * 4);
  assert.equal(view.players[0]!.stationsCleared, stations);
  assert.ok(view.standings);
  assert.equal(view.standings!.finished.length, 1);
  assert.equal(view.standings!.eliminated.length, 0);
  assert.equal(view.quiz, null);
});

test('the wrong answers are listed for review and the next race waits for it', () => {
  const instance = joinPlayers(1);
  instance.setConfig({ startFuel: 10 }, 0);
  readyAll(instance);
  instance.start(0);
  playToCompletion(instance, 0, true);

  const view = instance.view(0, 0);
  assert.equal(view.review.length, 1, 'one wrong answer to review');
  const entry = view.review[0];
  assert.ok(entry.prompt.length > 0);
  assert.equal(entry.options.length, 4);
  assert.ok(entry.explain.length > 0);
  assert.equal(view.reviewDone, false);
  assert.equal(view.players[0]!.reviewWrong, 1);
  assert.equal(instance.canReplay(), false, 'replay is blocked until the review is done');

  assert.equal(instance.markReviewed(0, 0), true);
  assert.equal(instance.view(0, 0).reviewDone, true);
  assert.equal(instance.canReplay(), true);
  assert.equal(instance.replay(0), true);
  assert.equal(instance.phase, 'lobby');
});

test('a player without wrong answers can start the next race right away', () => {
  const instance = joinPlayers(1);
  instance.setConfig({ startFuel: 10 }, 0);
  readyAll(instance);
  instance.start(0);
  playToCompletion(instance, 0);
  assert.equal(instance.view(0, 0).review.length, 0);
  assert.equal(instance.canReplay(), true);
});

test('replay returns to the lobby keeping players', () => {
  const instance = joinPlayers(1);
  instance.setConfig({ startFuel: 10 }, 0);
  readyAll(instance);
  instance.start(0);
  playToCompletion(instance, 0);
  assert.equal(instance.replay(0), true);
  assert.equal(instance.phase, 'lobby');
  assert.equal(instance.presentSeats().length, 1);
  assert.equal(instance.view(0, 0).players[0]!.ready, false);
});

test('leaving in the lobby frees the seat and transfers host', () => {
  const instance = joinPlayers(2);
  instance.leave(0, 0);
  assert.equal(instance.presentSeats().length, 1);
  assert.equal(instance.hostSeat, 1);
  assert.equal(instance.firstFreeSeat(), 0);
});

test('leaving mid-race eliminates that player but keeps the race going', () => {
  const instance = joinPlayers(2);
  instance.setConfig({ startFuel: 10 }, 0);
  readyAll(instance);
  instance.start(0);
  for (let i = 0; i < 60; i++) instance.tick(0);
  instance.leave(0, 0);
  assert.equal(instance.phase, 'playing');
  assert.equal(instance.view(1, 0).players[0], null);
  const standings = instance.view(1, 0).standings;
  assert.equal(standings, null, 'race not over yet');
});

test('disconnect then reservation expiry eliminates the player', () => {
  const instance = new RaceRoom('XYZ234', 0, 30 * 60_000, 1000);
  instance.admit(0, 'a', 0);
  readyAll(instance);
  instance.start(0);
  for (let i = 0; i < 60; i++) instance.tick(0);
  instance.disconnect(0, 100);
  assert.equal(instance.phase, 'playing');
  instance.tick(1200);
  assert.equal(instance.view(0, 0).players[0]!.status, 'eliminated');
});

test('a room with everyone gone expires', () => {
  const instance = new RaceRoom('XYZ234', 0, 30 * 60_000, 1000);
  instance.admit(0, 'a', 0);
  instance.disconnect(0, 0);
  assert.equal(instance.expired(1500), true);
});