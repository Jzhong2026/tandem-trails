import assert from 'node:assert/strict';
import test from 'node:test';
import { questionsFor } from '../src/server/curriculum.js';
import { COURSE_SUBJECTS, GRADE_NAMES, subjectQuestions } from '../src/shared/study.js';
import type { CourseSubject } from '../src/shared/study.js';
import {
  RALLY_LEVELS, RALLY_VEHICLES, advanceRallyQuiz, answerRally, applyVehicleUpgrades, calculateRallyStars, canStartRally,
  completeRallyReview, createRallyProgress, createRallyRun, evaluateRallyChallenges, loadRallyProgress, rallyChallengeStatus,
  rallyResultRewards, recordRallyResult,
  activeRallyZone, enterRallyCheckpoint, retryRallyQuestion, saveRallyProgress, steerRally, stepRally, upgradeVehicle,
} from '../src/shared/knowledge-rally.js';

test('every semester and subject supplies two complete stops with valid choices from its own course', () => {
  for (let grade = 2; grade < GRADE_NAMES.length; grade++) {
    for (const term of [1, 2]) {
      const semester = questionsFor({ grade, term });
      for (const subject of Object.keys(COURSE_SUBJECTS) as CourseSubject[]) {
        const bank = subjectQuestions(semester, subject);
        const run = createRallyRun('campus', 'comet-rally', 7, bank);
        for (let stop = 0; stop < 2; stop++) {
          enterRallyCheckpoint(run);
          const questions = run.quiz!.questions;
          assert.equal(questions.length, 4);
          const subjects = new Set(questions.map(q => q.subject));
          assert.deepEqual(subjects, new Set(subject === 'mixed' ? ['chinese', 'math', 'english'] : [subject]));
          for (const q of questions) {
            const original = bank.find(entry => entry.id === q.id)!;
            assert.equal(q.options[q.answer], original.options[original.answer]);
            assert.deepEqual([...q.options].sort(), [...original.options].sort());
            assert.equal(answerRally(run, q.options.length), false);
            assert.equal(run.quiz!.feedback, null);
            assert.ok(answerRally(run, q.answer));
            advanceRallyQuiz(run);
          }
        }
        assert.equal(new Set(run.answers.map(q => q.id)).size, 8);
      }
    }
  }
});

test('a new rally uses the selected level and selectable vehicle', () => {
  const run = createRallyRun('forest', 'scania-s500', 7);
  assert.equal(run.level.id, 'forest');
  assert.equal(run.vehicle.id, 'scania-s500');
  assert.equal(run.phase, 'countdown');
  assert.equal(run.lane, 1);
  assert.ok(run.integrity > 0);
  assert.equal(RALLY_LEVELS[0].id, 'campus');
  assert.ok(RALLY_VEHICLES.some(vehicle => vehicle.id === 'scania-s500'));
});

test('countdown gives way to driving and steering stays inside three lanes', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  assert.equal(run.phase, 'driving');
  const before = run.distance;
  stepRally(run, 1);
  assert.ok(run.distance > before);
  assert.equal(steerRally(run, -1), true);
  assert.equal(run.lane, 0);
  assert.equal(steerRally(run, -1), false);
  assert.equal(steerRally(run, 1), true);
  assert.equal(run.lane, 1);
  assert.equal(steerRally(run, 1), true);
  assert.equal(run.lane, 2);
  assert.equal(steerRally(run, 1), false);
});

test('knowledge energy powers a single boost and obstacles never block every lane', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  assert.ok(run.obstacles.length > 5);
  for (const obstacle of run.obstacles) {
    const cluster = run.obstacles.filter(item => Math.abs(item.distance - obstacle.distance) < 5);
    assert.ok(new Set(cluster.map(item => item.lane)).size <= 2);
    assert.ok(run.level.checkpoints.every(checkpoint => Math.abs(checkpoint - obstacle.distance) > 100));
  }
  run.energy = 60;
  stepRally(run, 0.1, true);
  assert.equal(run.energy, 25);
  assert.ok(run.boostMs > 0);
  assert.equal(run.boostArmed, false);
  stepRally(run, 0.1, false);
  assert.equal(run.boostArmed, true);
});

test('a collision costs one durability and energy but only happens once', () => {
  const run = createRallyRun('forest', 'volvo-fh16', 7);
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  const maxIntegrity = run.integrity;
  const obstacle = run.obstacles[0];
  run.distance = obstacle.distance - 1;
  run.lane = obstacle.lane;
  run.laneVisual = obstacle.lane;
  run.energy = 60;
  stepRally(run, 0.1);
  assert.equal(run.integrity, maxIntegrity - 1);
  assert.equal(run.energy, 40);
  assert.ok(run.invulnMs > 0);
  assert.equal(run.hitObstacles.length, 1);
  stepRally(run, 0.1);
  assert.equal(run.integrity, maxIntegrity - 1);
});

test('each checkpoint opens a mixed-subject learning stop with level-appropriate question count', () => {
  const campus = createRallyRun('campus', 'comet-rally', 7);
  const desert = createRallyRun('desert', 'man-tgx', 7);
  for (const run of [campus, desert]) {
    for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
    run.distance = run.level.checkpoints[0];
    stepRally(run, 0.1);
    assert.equal(run.phase, 'quiz');
    assert.equal(run.distance, run.level.checkpoints[0]);
    assert.equal(run.quiz?.questions.length, run.level.difficulty < 3 ? 4 : 3);
    assert.equal(new Set(run.quiz?.questions.map(question => question.id)).size, run.quiz?.questions.length);
    assert.ok(run.quiz?.questions.some(question => question.subject === 'chinese'));
    assert.ok(run.quiz?.questions.some(question => question.subject === 'math'));
  }
});

test('wrong answers teach before retry and never eliminate the player', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  run.distance = run.level.checkpoints[0];
  stepRally(run, 0.1);
  const quiz = run.quiz!;
  const question = quiz.questions[0];
  const wrong = (question.answer + 1) % 4;
  assert.equal(answerRally(run, wrong), false);
  assert.equal(run.phase, 'quiz');
  assert.equal(run.integrity, 3);
  assert.equal(quiz.feedback, 'wrong');
  assert.equal(quiz.firstTry, true);
  assert.equal(run.combo, 0);
  assert.equal(run.energy, 20);

  retryRallyQuestion(run);
  assert.equal(quiz.feedback, null);
  assert.equal(quiz.firstTry, false);
  assert.equal(answerRally(run, question.answer), true);
  assert.equal(quiz.feedback, 'correct');
  assert.equal(run.answered, 1);
  assert.equal(run.firstTryCorrect, 0);
  assert.equal(run.combo, 1);
  assert.equal(run.bestCombo, 1);
  assert.equal(run.energy, 30);
  assert.equal(run.score, 40);
  assert.equal(run.answers[0].firstTryCorrect, false);
  assert.equal(run.answers[0].firstPicked, wrong);
  assert.equal(run.answers[0].mastered, true);

  advanceRallyQuiz(run);
  assert.equal(quiz.index, 1);
  assert.equal(quiz.firstTry, true);
  const next = quiz.questions[1];
  answerRally(run, next.answer);
  assert.equal(run.firstTryCorrect, 1);
  assert.equal(run.combo, 2);
  assert.equal(run.energy, 60);
  assert.equal(run.score, 180);
});

function finishPerfectRun(run: ReturnType<typeof createRallyRun>) {
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  for (const checkpoint of run.level.checkpoints) {
    run.distance = checkpoint;
    stepRally(run, 0.1);
    while (run.quiz) {
      const quiz = run.quiz;
      const question = quiz.questions[quiz.index];
      answerRally(run, question.answer);
      advanceRallyQuiz(run);
    }
  }
  run.distance = run.level.length;
  stepRally(run, 0.1);
  assert.equal(run.phase, 'finished');
}

test('a perfect run earns three stars and unlocks the next level', () => {
  const run = createRallyRun('campus', 'scania-s500', 7);
  finishPerfectRun(run);
  assert.equal(run.answered, 8);
  assert.equal(calculateRallyStars(run), 3);
  const progress = createRallyProgress();
  assert.equal(canStartRally(progress, 'campus'), true);
  assert.equal(canStartRally(progress, 'forest'), false);
  const updated = recordRallyResult(progress, run);
  assert.equal(updated.unlockedLevel, 2);
  assert.equal(updated.stars.campus, 3);
  assert.equal(updated.pendingReview.length, 0);
  assert.equal(canStartRally(updated, 'forest'), true);
  assert.ok(updated.totalScore > 0);
});

test('a first-try mistake enters review and blocks the next level until mastered', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  for (const checkpoint of run.level.checkpoints) {
    run.distance = checkpoint;
    stepRally(run, 0.1);
    while (run.quiz) {
      const quiz = run.quiz;
      const question = quiz.questions[quiz.index];
      const wrong = (question.answer + 1) % 4;
      answerRally(run, quiz.firstTry && quiz.index === 0 && checkpoint === run.level.checkpoints[0] ? wrong : question.answer);
      if (quiz.feedback === 'wrong') retryRallyQuestion(run);
      else advanceRallyQuiz(run);
    }
  }
  run.distance = run.level.length;
  stepRally(run, 0.1);
  assert.equal(run.phase, 'finished');
  assert.equal(calculateRallyStars(run), 2);
  const updated = recordRallyResult(createRallyProgress(), run);
  assert.equal(updated.stars.campus, 2);
  assert.equal(updated.unlockedLevel, 2);
  assert.equal(updated.pendingReview.length, 1);
  assert.equal(canStartRally(updated, 'forest'), false);
  const reviewed = completeRallyReview(updated, updated.pendingReview[0]);
  assert.equal(reviewed.pendingReview.length, 0);
  assert.equal(reviewed.masteredQuestions[updated.pendingReview[0]], 2);
  assert.equal(canStartRally(reviewed, 'forest'), true);
});

test('progress persists the selected vehicle and safely ignores damaged saved data', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const progress = { ...createRallyProgress(), selectedVehicleId: 'man-tgx', unlockedLevel: 3 };
  saveRallyProgress(storage, progress);
  assert.equal(loadRallyProgress(storage).selectedVehicleId, 'man-tgx');
  assert.equal(loadRallyProgress(storage).unlockedLevel, 3);
  values.set('tandem-trails.rally-progress', '{broken');
  assert.equal(loadRallyProgress(storage).selectedVehicleId, 'comet-rally');
  values.set('tandem-trails.rally-progress', JSON.stringify({ ...progress, selectedVehicleId: 'missing', unlockedLevel: 999 }));
  const sanitized = loadRallyProgress(storage);
  assert.equal(sanitized.selectedVehicleId, 'comet-rally');
  assert.equal(sanitized.unlockedLevel, RALLY_LEVELS.length);
});

test('every rally track has valid sand, ice, and boost zones outside checkpoints', () => {
  for (const level of RALLY_LEVELS) {
    assert.deepEqual(new Set(level.zones.map(zone => zone.kind)), new Set(['sand', 'ice', 'boost']));
    for (const zone of level.zones) {
      assert.ok(zone.from > 0 && zone.to > zone.from && zone.to < level.length);
      assert.ok(level.checkpoints.every(checkpoint => checkpoint < zone.from || checkpoint > zone.to));
    }
  }
  const run = createRallyRun('campus', 'comet-rally', 7);
  const sand = RALLY_LEVELS[0].zones.find(zone => zone.kind === 'sand')!;
  run.distance = sand.from + 1;
  assert.equal(activeRallyZone(run)?.kind, 'sand');
});

test('sand slows the car and ice reduces lane response', () => {
  const normal = createRallyRun('campus', 'comet-rally', 7);
  const sand = createRallyRun('campus', 'comet-rally', 7);
  for (const run of [normal, sand]) {
    for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
    run.obstacles = [];
    run.speed = 20;
  }
  const sandZone = RALLY_LEVELS[0].zones.find(zone => zone.kind === 'sand')!;
  sand.distance = sandZone.from + 10;
  stepRally(normal, 0.1);
  stepRally(sand, 0.1);
  assert.ok(sand.distance - (sandZone.from + 10) < normal.distance);

  const ice = createRallyRun('campus', 'comet-rally', 7);
  for (let i = 0; i < 181; i++) stepRally(ice, 1 / 60);
  ice.obstacles = [];
  ice.lane = 0;
  ice.laneVisual = 2;
  const iceZone = RALLY_LEVELS[0].zones.find(zone => zone.kind === 'ice')!;
  ice.checkpointIndex = 1;
  ice.distance = iceZone.from + 10;
  stepRally(ice, 0.1);
  assert.ok(ice.laneVisual > 0.5);
});

test('a boost strip triggers one free boost and paid nitro counts toward challenges', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
  run.obstacles = [];
  run.energy = 0;
  const boost = RALLY_LEVELS[0].zones.find(zone => zone.kind === 'boost')!;
  run.checkpointIndex = 2;
  run.distance = boost.from + 1;
  stepRally(run, 0.1);
  assert.ok(run.boostMs > 0);
  assert.equal(run.energy, 0);
  assert.equal(run.nitroUses, 0);

  run.boostMs = 0;
  run.boostArmed = true;
  run.energy = 60;
  stepRally(run, 0.1, true);
  assert.equal(run.nitroUses, 1);
  assert.equal(run.energy, 25);
});

test('challenge evaluation uses first-try accuracy, collisions, and nitro uses', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  finishPerfectRun(run);
  run.nitroUses = 2;
  assert.deepEqual(evaluateRallyChallenges(run), ['accuracy', 'no-collision', 'nitro']);
  run.hitObstacles.push(999);
  run.nitroUses = 1;
  assert.deepEqual(evaluateRallyChallenges(run), ['accuracy']);
});

test('vehicle upgrades change stats and spend the documented parts costs', () => {
  const base = RALLY_VEHICLES[0];
  const upgraded = applyVehicleUpgrades(base, { engine: 2, tires: 1, nitro: 3 });
  assert.equal(upgraded.speedFactor, Number((base.speedFactor * 1.1).toFixed(3)));
  assert.equal(upgraded.grip, Number((base.grip * 1.1).toFixed(3)));
  assert.equal(upgraded.boostFactor, Number((base.boostFactor * 1.3).toFixed(3)));

  const progress = { ...createRallyProgress(), parts: 20 };
  const first = upgradeVehicle(progress, base.id, 'engine');
  assert.equal(first.parts, 17);
  assert.equal(first.upgrades[base.id].engine, 1);
  const second = upgradeVehicle(first, base.id, 'engine');
  assert.equal(second.parts, 11);
  assert.equal(second.upgrades[base.id].engine, 2);
  const poor = upgradeVehicle({ ...second, parts: 0 }, base.id, 'engine');
  assert.equal(poor.parts, 0);
  assert.equal(poor.upgrades[base.id].engine, 2);
});

test('finished runs award parts and one-time challenge rewards', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  finishPerfectRun(run);
  run.nitroUses = 2;
  const first = recordRallyResult(createRallyProgress(), run);
  assert.equal(first.parts, 13);
  assert.deepEqual(first.completedTasks.campus, ['accuracy', 'no-collision', 'nitro']);
  const replay = recordRallyResult(first, run);
  assert.equal(replay.parts, 16);
  assert.deepEqual(replay.completedTasks.campus, ['accuracy', 'no-collision', 'nitro']);
});

test('created runs apply upgrades to speed, steering response, and nitro performance', () => {
  const base = createRallyRun('campus', 'comet-rally', 7);
  const engine = createRallyRun('campus', 'comet-rally', 7, undefined, { engine: 3, tires: 0, nitro: 0 });
  const tires = createRallyRun('campus', 'comet-rally', 7, undefined, { engine: 0, tires: 3, nitro: 0 });
  const nitro = createRallyRun('campus', 'comet-rally', 7, undefined, { engine: 0, tires: 0, nitro: 3 });
  for (const run of [base, engine, tires, nitro]) {
    for (let i = 0; i < 181; i++) stepRally(run, 1 / 60);
    run.obstacles = [];
  }
  stepRally(base, 0.5);
  stepRally(engine, 0.5);
  assert.ok(engine.distance > base.distance);

  for (const run of [base, tires]) {
    run.lane = 0;
    run.laneVisual = 2;
  }
  stepRally(base, 0.02);
  stepRally(tires, 0.02);
  assert.ok(tires.laneVisual < base.laneVisual);

  for (const run of [base, nitro]) {
    run.energy = 100;
    run.boostMs = 0;
    run.boostArmed = true;
  }
  stepRally(base, 0.1, true);
  stepRally(nitro, 0.1, true);
  stepRally(base, 0.5);
  stepRally(nitro, 0.5);
  assert.ok(nitro.speed > base.speed);
});

test('legacy version-one saves migrate with empty parts, upgrades, and task records', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  values.set('tandem-trails.rally-progress', JSON.stringify({
    version: 1,
    unlockedLevel: 2,
    stars: { campus: 3 },
    masteredQuestions: { c08: 2 },
    pendingReview: [],
    totalScore: 800,
    selectedVehicleId: 'volvo-fh16',
  }));
  const migrated = loadRallyProgress(storage);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.parts, 0);
  assert.equal(migrated.upgrades['comet-rally'].engine, 0);
  assert.deepEqual(migrated.completedTasks, {});
  assert.equal(migrated.selectedVehicleId, 'volvo-fh16');
  assert.equal(migrated.stars.campus, 3);
});

test('rallyResultRewards reports stars, parts and first-time tasks once', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  finishPerfectRun(run);
  run.nitroUses = 2;
  const progress = createRallyProgress();
  assert.deepEqual(rallyResultRewards(progress, run), { stars: 3, parts: 13, newTasks: ['accuracy', 'no-collision', 'nitro'] });
  const recorded = recordRallyResult(progress, run);
  assert.deepEqual(rallyResultRewards(recorded, run), { stars: 3, parts: 3, newTasks: [] });
  run.phase = 'crashed';
  assert.deepEqual(rallyResultRewards(recorded, run), { stars: 0, parts: 0, newTasks: [] });
});

test('challenge status exposes live detail and uses the collision target', () => {
  const run = createRallyRun('campus', 'comet-rally', 7);
  const [accuracy, smooth, nitro] = run.level.challenges;
  assert.deepEqual(rallyChallengeStatus(run, accuracy), { done: false, detail: '0% / 80%' });
  assert.deepEqual(rallyChallengeStatus(run, smooth), { done: true, detail: '安全' });
  run.hitObstacles.push(1);
  assert.deepEqual(rallyChallengeStatus(run, smooth), { done: false, detail: '1 次碰撞' });
  run.nitroUses = 2;
  assert.deepEqual(rallyChallengeStatus(run, nitro), { done: true, detail: '2 / 2' });
});

test('saves from a newer progress version fall back instead of downgrading', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  values.set('tandem-trails.rally-progress', JSON.stringify({ version: 3, unlockedLevel: 6, parts: 500, totalScore: 999 }));
  assert.deepEqual(loadRallyProgress(storage), createRallyProgress());
});
