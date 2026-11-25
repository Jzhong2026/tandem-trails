import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RALLY_LEVELS, RALLY_VEHICLES, advanceRallyQuiz, answerRally, calculateRallyStars, canStartRally,
  completeRallyReview, createRallyProgress, createRallyRun, loadRallyProgress, recordRallyResult,
  retryRallyQuestion, saveRallyProgress, steerRally, stepRally,
} from '../src/shared/knowledge-rally.js';

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
