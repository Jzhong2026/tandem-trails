import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceQuiz, answerQuiz, COUNTDOWN_MS, createRace, FUEL_MAX, generateObstacles, IDLE_INPUT,
  LANE_COUNT, raceProgress, raceStandings, RACE_STEP, STATION_COST, stepRace,
} from '../src/shared/race.js';
import type { RaceInput, RaceRun } from '../src/shared/race.js';
import { QUESTIONS_PER_STATION, RACE_QUESTIONS } from '../src/shared/race-questions.js';
import { RACE_TRACKS } from '../src/shared/race-tracks.js';

function idle(count: number): RaceInput[] {
  return Array.from({ length: count }, () => ({ ...IDLE_INPUT }));
}

function skipCountdown(run: RaceRun) {
  const inputs = idle(run.players.length);
  for (let i = 0; i < Math.ceil(COUNTDOWN_MS / (RACE_STEP * 1000)) + 2 && run.status === 'countdown'; i++) {
    stepRace(run, inputs);
  }
  assert.equal(run.status, 'racing');
}

function stepFor(run: RaceRun, seconds: number, inputs?: RaceInput[]) {
  const frames = Math.round(seconds / RACE_STEP);
  for (let i = 0; i < frames; i++) stepRace(run, inputs ?? idle(run.players.length));
}

test('question bank is well-formed', () => {
  const ids = new Set<string>();
  for (const question of RACE_QUESTIONS) {
    assert.ok(!ids.has(question.id), `duplicate id ${question.id}`);
    ids.add(question.id);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4, `${question.id} has duplicate options`);
    assert.ok(question.answer >= 0 && question.answer <= 3);
    assert.ok(question.prompt.length > 0);
    assert.ok(question.explain.length > 0);
    assert.ok(question.subject === 'chinese' || question.subject === 'math');
  }
  assert.ok(RACE_QUESTIONS.filter(q => q.subject === 'chinese').length >= 40);
  assert.ok(RACE_QUESTIONS.filter(q => q.subject === 'math').length >= 40);
});

test('createRace supports 1 to 4 players with chosen start fuel', () => {
  for (const count of [1, 2, 3, 4]) {
    const run = createRace({ names: Array.from({ length: count }, (_, i) => `车手${i + 1}`), startFuel: 6, seed: 42 });
    assert.equal(run.players.length, count);
    assert.ok(run.players.every(p => p.fuel === 6 && p.status === 'racing'));
    assert.equal(run.status, 'countdown');
    assert.ok(run.obstacles.length > 10);
  }
  const capped = createRace({ names: ['甲', '乙', '丙', '丁', '戊'], seed: 1 });
  assert.equal(capped.players.length, 4);
});

test('obstacles never block all three lanes and keep station zones clear', () => {
  for (const track of RACE_TRACKS) {
    const obstacles = generateObstacles(track, track.seed);
    for (let i = 0; i < obstacles.length; i++) {
      const cluster = obstacles.filter(o => Math.abs(o.x - obstacles[i].x) < 40);
      assert.ok(new Set(cluster.map(o => o.lane)).size <= LANE_COUNT - 1, 'a cluster blocks every lane');
    }
    for (const station of track.stations) {
      assert.ok(obstacles.every(o => Math.abs(o.x - station) > 380), 'obstacle too close to station');
    }
    assert.ok(obstacles.every(o => o.lane >= 0 && o.lane < LANE_COUNT));
  }
});

test('countdown then racing, car moves forward', () => {
  const run = createRace({ names: [' solo '], seed: 7 });
  assert.equal(run.players[0].name, 'solo');
  skipCountdown(run);
  const before = run.players[0].x;
  stepFor(run, 1);
  assert.ok(run.players[0].x > before);
  assert.ok(run.elapsedMs > 0);
});

test('lane changes are edge-triggered and clamped', () => {
  const run = createRace({ names: ['甲'], seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  assert.equal(player.lane, 1);
  const up: RaceInput[] = [{ up: true, down: false }];
  stepRace(run, up);
  assert.equal(player.lane, 0);
  stepRace(run, up);
  assert.equal(player.lane, 0, 'holding up must not repeat');
  stepRace(run, idle(1));
  stepRace(run, up);
  assert.equal(player.lane, 0, 'already top lane');
  const down: RaceInput[] = [{ up: false, down: true }];
  stepRace(run, idle(1));
  stepRace(run, down);
  stepRace(run, idle(1));
  stepRace(run, down);
  stepRace(run, idle(1));
  stepRace(run, down);
  assert.equal(player.lane, 2);
});

test('hitting an obstacle costs one fuel, grants invulnerability, slows the car', () => {
  const run = createRace({ names: ['甲'], startFuel: 6, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  const obstacle = run.obstacles[0];
  player.x = obstacle.x - 20;
  player.lane = obstacle.lane;
  player.laneY = obstacle.lane;
  stepFor(run, 0.5);
  assert.equal(player.fuel, 5);
  assert.equal(player.hits, 1);
  assert.ok(player.invulnMs > 0 || player.slowMs > 0);
  assert.ok(player.hitObstacles.includes(0));
});

test('hitting with one fuel left eliminates the player', () => {
  const run = createRace({ names: ['甲'], startFuel: 1, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  const obstacle = run.obstacles[0];
  player.x = obstacle.x - 20;
  player.lane = obstacle.lane;
  player.laneY = obstacle.lane;
  stepFor(run, 0.5);
  assert.equal(player.status, 'eliminated');
  assert.equal(player.fuel, 0);
  assert.equal(run.status, 'finished', 'solo race ends when everyone is out');
});

test('entering a station pauses the car and deals four mixed questions', () => {
  const run = createRace({ names: ['甲', '乙'], startFuel: 6, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  player.x = run.track.stations[0] - 1;
  stepRace(run, idle(2));
  assert.equal(player.status, 'quiz');
  assert.ok(player.quiz);
  assert.equal(player.quiz.questions.length, QUESTIONS_PER_STATION);
  const subjects = player.quiz.questions.map(q => q.subject);
  assert.equal(subjects.filter(s => s === 'chinese').length, 2);
  assert.equal(subjects.filter(s => s === 'math').length, 2);
  assert.equal(run.quizOwner, 0);
  const otherBefore = run.players[1].x;
  stepFor(run, 1);
  assert.equal(run.players[1].x, otherBefore, 'pause-all freezes the other player');
});

test('correct answers add fuel up to the cap, wrong answers do not', () => {
  const run = createRace({ names: ['甲'], startFuel: 9, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  player.x = run.track.stations[0] - 1;
  stepRace(run, idle(1));
  const quiz = player.quiz!;
  answerQuiz(run, 0, quiz.questions[0].answer);
  assert.equal(player.fuel, 10);
  advanceQuiz(run, 0);
  answerQuiz(run, 0, quiz.questions[1].answer);
  assert.equal(player.fuel, FUEL_MAX, 'fuel caps at 10');
  advanceQuiz(run, 0);
  const wrong = (quiz.questions[2].answer + 1) % 4;
  answerQuiz(run, 0, wrong);
  assert.equal(player.fuel, 10);
  assert.equal(player.wrongTotal, 1);
});

test('leaving a station costs three fuel; enough correct answers survive', () => {
  const run = createRace({ names: ['甲'], startFuel: 6, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  player.x = run.track.stations[0] - 1;
  stepRace(run, idle(1));
  const quiz = player.quiz!;
  for (let i = 0; i < QUESTIONS_PER_STATION; i++) {
    answerQuiz(run, 0, quiz.questions[i].answer);
    advanceQuiz(run, 0);
  }
  assert.equal(player.fuel, 6 + 4 - STATION_COST);
  assert.equal(player.status, 'racing');
  assert.equal(player.stationsCleared, 1);
  assert.equal(run.quizOwner, null);
});

test('leaving a station with too little fuel eliminates the player', () => {
  const run = createRace({ names: ['甲'], startFuel: 2, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  player.x = run.track.stations[0] - 1;
  stepRace(run, idle(1));
  const quiz = player.quiz!;
  for (let i = 0; i < QUESTIONS_PER_STATION; i++) {
    answerQuiz(run, 0, (quiz.questions[i].answer + 1) % 4);
    advanceQuiz(run, 0);
  }
  assert.equal(player.status, 'eliminated');
  assert.equal(player.fuel, 0);
});

test('without pause-all the other player keeps racing', () => {
  const run = createRace({ names: ['甲', '乙'], startFuel: 6, seed: 7, pauseAllOnQuiz: false });
  skipCountdown(run);
  run.players[0].x = run.track.stations[0] - 1;
  stepRace(run, idle(2));
  assert.equal(run.players[0].status, 'quiz');
  assert.equal(run.quizOwner, null);
  const before = run.players[1].x;
  stepFor(run, 1);
  assert.ok(run.players[1].x > before);
});

test('reaching the end finishes the player and standings sort by time', () => {
  const run = createRace({ names: ['甲', '乙'], startFuel: 10, seed: 7 });
  skipCountdown(run);
  run.players[0].x = run.track.length - 1;
  stepRace(run, idle(2));
  assert.equal(run.players[0].status, 'finished');
  assert.ok(run.players[0].finishMs !== null);
  stepFor(run, 1);
  run.players[1].x = run.track.length - 1;
  stepRace(run, idle(2));
  assert.equal(run.status, 'finished');
  const standings = raceStandings(run);
  assert.equal(standings.finished[0].name, '甲');
  assert.equal(standings.finished[1].name, '乙');
  assert.equal(standings.eliminated.length, 0);
  assert.equal(raceProgress(run, run.players[0]), 1);
});

test('different seeds deal different questions', () => {
  const a = createRace({ names: ['甲'], seed: 1 });
  const b = createRace({ names: ['甲'], seed: 999 });
  skipCountdown(a);
  skipCountdown(b);
  a.players[0].x = a.track.stations[0] - 1;
  b.players[0].x = b.track.stations[0] - 1;
  stepRace(a, idle(1));
  stepRace(b, idle(1));
  const idsA = a.players[0].quiz!.questions.map(q => q.id).join(',');
  const idsB = b.players[0].quiz!.questions.map(q => q.id).join(',');
  assert.notEqual(idsA, idsB);
});

test('every answer is recorded so the wrong ones can be reviewed later', () => {
  const run = createRace({ names: ['甲'], startFuel: 6, seed: 7 });
  skipCountdown(run);
  const player = run.players[0];
  player.x = run.track.stations[0] - 1;
  stepRace(run, idle(1));
  const quiz = player.quiz!;
  answerQuiz(run, 0, quiz.questions[0].answer);
  advanceQuiz(run, 0);
  const wrong = (quiz.questions[1].answer + 1) % 4;
  answerQuiz(run, 0, wrong);
  advanceQuiz(run, 0);
  assert.equal(player.answers.length, 2);
  assert.equal(player.answers[0].correct, true);
  assert.equal(player.answers[1].correct, false);
  assert.equal(player.answers[1].picked, wrong);
  assert.equal(player.answers[1].answer, quiz.questions[1].answer);
  assert.equal(player.answers[1].prompt, quiz.questions[1].prompt);
  assert.equal(player.answers[1].explain, quiz.questions[1].explain);
  assert.equal(player.answers[1].station, 0);
  assert.deepEqual([...player.answers[1].options], [...quiz.questions[1].options]);
});

test('a full solo loop: every station then finish, fuel economy holds', () => {
  const run = createRace({ names: ['甲'], startFuel: 6, seed: 2026, trackId: 'campus' });
  skipCountdown(run);
  const inputs = idle(1);
  const stations = run.track.stations.length;
  let guard = 0;
  while (run.status !== 'finished' && guard++ < 60 * 60 * 8) {
    const player = run.players[0];
    if (player.status === 'quiz' && player.quiz) {
      const quiz = player.quiz;
      if (quiz.phase === 'question') answerQuiz(run, 0, quiz.questions[quiz.index].answer);
      else advanceQuiz(run, 0);
      continue;
    }
    if (player.status === 'racing') {
      const ahead = run.obstacles.find(o => o.x > player.x && o.x < player.x + 260 && o.lane === player.lane && !player.hitObstacles.includes(run.obstacles.indexOf(o)));
      if (ahead) inputs[0] = { up: player.lane > 0, down: player.lane === 0 };
      else inputs[0] = { ...IDLE_INPUT };
    }
    stepRace(run, inputs);
    run.events.length = 0;
  }
  assert.equal(run.status, 'finished');
  assert.equal(run.players[0].status, 'finished');
  assert.equal(run.players[0].stationsCleared, stations);
  assert.equal(run.players[0].correctTotal, stations * QUESTIONS_PER_STATION);
  assert.ok(run.players[0].fuel >= 1);
});
test('a number gate rewards a correct lane once and respects the fuel cap', () => {
  for (const [fuel,correct,expected] of [[5,true,6],[10,true,10],[5,false,5]] as const) {
    const run=createRace({names:['试车'],seed:12,startFuel:fuel,course:{grade:2,term:2}});
    skipCountdown(run);
    const gate=run.gates[0],player=run.players[0];
    player.x=gate.x-.1;
    player.lane=correct ? gate.answerLane : (gate.answerLane+1)%3;
    player.laneY=player.lane;
    stepFor(run,.1);
    assert.equal(player.lastGateCorrect,correct);
    assert.equal(player.fuel,expected);
  }
});
