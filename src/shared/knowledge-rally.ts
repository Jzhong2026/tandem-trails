import { RACE_QUESTIONS, QUESTIONS_PER_STATION } from './race-questions.js';
import type { RaceQuestion } from './race-questions.js';
import { mulberry32 } from './race.js';
import type { RaceTheme } from './race-tracks.js';

export type RallyVehicleKind = 'rally' | 'sport' | 'truck';
export type RallyBiome = 'forest' | 'desert' | 'snow' | 'night';

export interface RallyVehicle {
  id: string;
  name: string;
  make: string;
  kind: RallyVehicleKind;
  tagline: string;
  color: string;
  accent: string;
  maxIntegrity: number;
  speedFactor: number;
  grip: number;
  boostFactor: number;
  bodyLength: number;
  bodyWidth: number;
  bodyHeight: number;
  wheelRadius: number;
  trailer: boolean;
}

export interface RallyLevel {
  id: string;
  name: string;
  region: string;
  description: string;
  theme: RaceTheme;
  biome: RallyBiome;
  length: number;
  speed: number;
  checkpoints: number[];
  obstacleGap: [number, number];
  doubleChance: number;
  sky: string;
  ground: string;
  road: string;
  fog: string;
  sun: string;
  accent: string;
  seed: number;
  difficulty: number;
}

export const RALLY_VEHICLES: RallyVehicle[] = [
  {
    id: 'comet-rally', name: '赤焰拉力', make: 'COMET R4', kind: 'rally', tagline: '灵活好开，适合第一次上路',
    color: '#d9342b', accent: '#f7f2e8', maxIntegrity: 3, speedFactor: 1, grip: 1.2, boostFactor: 1.1,
    bodyLength: 4.3, bodyWidth: 1.9, bodyHeight: 1.45, wheelRadius: 0.36, trailer: false,
  },
  {
    id: 'apex-gt', name: '极光 GT', make: 'APEX GT', kind: 'sport', tagline: '速度最快，弯道需要更专注',
    color: '#1976c9', accent: '#e7f7ff', maxIntegrity: 3, speedFactor: 1.14, grip: 1, boostFactor: 1.25,
    bodyLength: 4.6, bodyWidth: 2, bodyHeight: 1.18, wheelRadius: 0.35, trailer: false,
  },
  {
    id: 'scania-s500', name: 'Scania S 520', make: 'SCANIA', kind: 'truck', tagline: '北欧重卡，耐撞、加速稳',
    color: '#b51f2e', accent: '#f3c64d', maxIntegrity: 4, speedFactor: 0.92, grip: 0.76, boostFactor: 0.92,
    bodyLength: 8.8, bodyWidth: 2.55, bodyHeight: 3.7, wheelRadius: 0.53, trailer: false,
  },
  {
    id: 'volvo-fh16', name: 'Volvo FH16', make: 'VOLVO', kind: 'truck', tagline: '长途王者，耐久最出色',
    color: '#e6e9e8', accent: '#20364b', maxIntegrity: 5, speedFactor: 0.88, grip: 0.72, boostFactor: 0.9,
    bodyLength: 9.2, bodyWidth: 2.58, bodyHeight: 3.85, wheelRadius: 0.55, trailer: false,
  },
  {
    id: 'man-tgx', name: 'MAN TGX', make: 'MAN', kind: 'truck', tagline: '德系重卡，兼顾速度与稳定',
    color: '#e88925', accent: '#252a2e', maxIntegrity: 4, speedFactor: 0.98, grip: 0.8, boostFactor: 1,
    bodyLength: 8.9, bodyWidth: 2.55, bodyHeight: 3.75, wheelRadius: 0.54, trailer: false,
  },
];

export const RALLY_LEVELS: RallyLevel[] = [
  {
    id: 'campus', name: '晨光校园', region: '第一站 · 绿色山谷', description: '在清爽的晨光里熟悉驾驶，收集第一批知识星星。',
    theme: 'day', biome: 'forest', length: 1500, speed: 25, checkpoints: [500, 1000], obstacleGap: [65, 95], doubleChance: 0.08,
    sky: '#8dc9e7', ground: '#5c8c55', road: '#41464a', fog: '#b8d3d4', sun: '#fff0cc', accent: '#e5b943', seed: 1201, difficulty: 1,
  },
  {
    id: 'forest', name: '松林弯道', region: '第二站 · 迷雾松林', description: '穿过松林与晨雾，连续答对可以积攒氮气。',
    theme: 'day', biome: 'forest', length: 1800, speed: 28, checkpoints: [600, 1200], obstacleGap: [58, 88], doubleChance: 0.14,
    sky: '#779fae', ground: '#365b42', road: '#383d41', fog: '#9cb8b8', sun: '#ffe4b0', accent: '#75c9a5', seed: 1202, difficulty: 2,
  },
  {
    id: 'desert', name: '落日沙丘', region: '第三站 · 金色荒漠', description: '在落日中穿越沙丘，重卡的稳定性会帮上大忙。',
    theme: 'sunset', biome: 'desert', length: 2100, speed: 30, checkpoints: [700, 1400], obstacleGap: [55, 82], doubleChance: 0.2,
    sky: '#e89869', ground: '#b98850', road: '#4a4642', fog: '#d7a77f', sun: '#ffb56f', accent: '#ffb34c', seed: 1203, difficulty: 3,
  },
  {
    id: 'snow', name: '雪岭公路', region: '第四站 · 高山雪线', description: '路面更滑、障碍更多，稳稳驾驶比一味冲刺更重要。',
    theme: 'day', biome: 'snow', length: 2400, speed: 31, checkpoints: [800, 1600], obstacleGap: [52, 78], doubleChance: 0.24,
    sky: '#91b8d1', ground: '#dbe5e6', road: '#454d53', fog: '#d6e3e7', sun: '#f2f6ff', accent: '#75c9e8', seed: 1204, difficulty: 4,
  },
  {
    id: 'storm', name: '风暴峡谷', region: '第五站 · 赤岩峡谷', description: '在峡谷风暴里保持连击，把每一次失误都变成经验。',
    theme: 'sunset', biome: 'desert', length: 2700, speed: 33, checkpoints: [900, 1800], obstacleGap: [49, 74], doubleChance: 0.28,
    sky: '#8a7182', ground: '#925a42', road: '#393b40', fog: '#a78b91', sun: '#ffc69e', accent: '#ef8d63', seed: 1205, difficulty: 5,
  },
  {
    id: 'final', name: '星夜总决赛', region: '最终站 · 知识之巅', description: '集齐知识能量，在星空下完成最后的冠军挑战。',
    theme: 'night', biome: 'night', length: 3000, speed: 35, checkpoints: [1000, 2000], obstacleGap: [46, 70], doubleChance: 0.32,
    sky: '#111b35', ground: '#182a2d', road: '#262b31', fog: '#273a52', sun: '#a9c6ff', accent: '#9fc8ff', seed: 1206, difficulty: 6,
  },
];

export interface RallyObstacle {
  id: number;
  distance: number;
  lane: number;
  kind: 'cone' | 'barrier' | 'crate';
}

export type RallyPhase = 'countdown' | 'driving' | 'quiz' | 'finished' | 'crashed';
export type RallyEventKind = 'count' | 'go' | 'lane' | 'hit' | 'boost' | 'checkpoint' | 'correct' | 'wrong' | 'finish' | 'crash';

export interface RallyEvent {
  kind: RallyEventKind;
  value?: number;
}

export interface RallyQuiz {
  checkpoint: number;
  questions: RaceQuestion[];
  index: number;
  firstTry: boolean;
  feedback: 'correct' | 'wrong' | null;
  picked: number | null;
  firstPicked: number | null;
}

export interface RallyAnswer {
  id: string;
  subject: RaceQuestion['subject'];
  topic: string;
  prompt: string;
  options: RaceQuestion['options'];
  answer: number;
  picked: number;
  firstPicked: number;
  firstTryCorrect: boolean;
  explain: string;
  mastered: boolean;
}

export interface RallyRun {
  level: RallyLevel;
  vehicle: RallyVehicle;
  seed: number;
  phase: RallyPhase;
  countdownMs: number;
  elapsedMs: number;
  distance: number;
  speed: number;
  lane: number;
  laneVisual: number;
  energy: number;
  integrity: number;
  boostMs: number;
  boostArmed: boolean;
  invulnMs: number;
  combo: number;
  bestCombo: number;
  score: number;
  firstTryCorrect: number;
  answered: number;
  checkpointIndex: number;
  quiz: RallyQuiz | null;
  obstacles: RallyObstacle[];
  hitObstacles: number[];
  answers: RallyAnswer[];
  events: RallyEvent[];
}

export function vehicleById(id: string): RallyVehicle {
  return RALLY_VEHICLES.find(vehicle => vehicle.id === id) ?? RALLY_VEHICLES[0];
}

export function levelById(id: string): RallyLevel {
  return RALLY_LEVELS.find(level => level.id === id) ?? RALLY_LEVELS[0];
}

export function generateRallyObstacles(level: RallyLevel, seed: number): RallyObstacle[] {
  const random = mulberry32(seed);
  const obstacles: RallyObstacle[] = [];
  let distance = 120;
  while (distance < level.length - 160) {
    if (level.checkpoints.every(checkpoint => Math.abs(checkpoint - distance) > 110)) {
      const lane = Math.floor(random() * 3);
      const kinds: RallyObstacle['kind'][] = ['cone', 'barrier', 'crate'];
      const kind = kinds[Math.floor(random() * kinds.length)];
      obstacles.push({ id: obstacles.length, distance, lane, kind });
      if (random() < level.doubleChance) {
        const other = (lane + (random() < 0.5 ? 1 : 2)) % 3;
        obstacles.push({ id: obstacles.length, distance: distance + 2, lane: other, kind: kinds[Math.floor(random() * kinds.length)] });
      }
    }
    distance += level.obstacleGap[0] + random() * (level.obstacleGap[1] - level.obstacleGap[0]);
  }
  return obstacles;
}

export function createRallyRun(levelId: string, vehicleId: string, seed = Math.floor(Math.random() * 1e9)): RallyRun {
  const level = levelById(levelId);
  const vehicle = vehicleById(vehicleId);
  return {
    level, vehicle, seed, phase: 'countdown', countdownMs: 3000, elapsedMs: 0, distance: 0,
    speed: 0, lane: 1, laneVisual: 1, energy: 20, integrity: vehicle.maxIntegrity,
    boostMs: 0, boostArmed: true, invulnMs: 0, combo: 0, bestCombo: 0, score: 0,
    firstTryCorrect: 0, answered: 0, checkpointIndex: 0, quiz: null,
    obstacles: generateRallyObstacles(level, seed), hitObstacles: [], answers: [], events: [],
  };
}

export function questionsPerStop(level: RallyLevel): number {
  return level.difficulty < 3 ? QUESTIONS_PER_STATION : 3;
}

export { RACE_QUESTIONS };

export const RALLY_PROGRESS_KEY = 'tandem-trails.rally-progress';

export interface RallyProgress {
  version: 1;
  unlockedLevel: number;
  stars: Record<string, number>;
  masteredQuestions: Record<string, number>;
  pendingReview: string[];
  totalScore: number;
  selectedVehicleId: string;
}

export interface RallyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createRallyProgress(): RallyProgress {
  return {
    version: 1,
    unlockedLevel: 1,
    stars: {},
    masteredQuestions: {},
    pendingReview: [],
    totalScore: 0,
    selectedVehicleId: RALLY_VEHICLES[0].id,
  };
}

export function calculateRallyStars(run: RallyRun): number {
  if (run.phase !== 'finished' || run.answered === 0) return 0;
  const accuracy = run.firstTryCorrect / run.answered;
  const durability = run.integrity / run.vehicle.maxIntegrity;
  if (accuracy >= 0.9 && durability >= 0.5) return 3;
  if (accuracy >= 0.65) return 2;
  return 1;
}

export function canStartRally(progress: RallyProgress, levelId: string): boolean {
  const index = RALLY_LEVELS.findIndex(level => level.id === levelId);
  if (index < 0 || index >= progress.unlockedLevel) return false;
  return index === 0 || progress.pendingReview.length === 0;
}

export function recordRallyResult(progress: RallyProgress, run: RallyRun): RallyProgress {
  if (run.phase !== 'finished') return progress;
  const stars = calculateRallyStars(run);
  const levelIndex = RALLY_LEVELS.findIndex(level => level.id === run.level.id);
  const masteredQuestions = { ...progress.masteredQuestions };
  for (const answer of run.answers) masteredQuestions[answer.id] = (masteredQuestions[answer.id] ?? 0) + 1;
  return {
    ...progress,
    unlockedLevel: Math.max(progress.unlockedLevel, Math.min(RALLY_LEVELS.length, levelIndex + 2)),
    stars: { ...progress.stars, [run.level.id]: Math.max(progress.stars[run.level.id] ?? 0, stars) },
    masteredQuestions,
    pendingReview: [...new Set([...progress.pendingReview, ...run.answers.filter(answer => !answer.firstTryCorrect).map(answer => answer.id)])],
    totalScore: progress.totalScore + run.score,
  };
}

export function completeRallyReview(progress: RallyProgress, questionId: string): RallyProgress {
  return {
    ...progress,
    pendingReview: progress.pendingReview.filter(id => id !== questionId),
    masteredQuestions: { ...progress.masteredQuestions, [questionId]: (progress.masteredQuestions[questionId] ?? 0) + 1 },
  };
}

export function saveRallyProgress(storage: RallyStorage, progress: RallyProgress): boolean {
  try {
    storage.setItem(RALLY_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

function safeInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function loadRallyProgress(storage: RallyStorage): RallyProgress {
  const fallback = createRallyProgress();
  try {
    const raw = storage.getItem(RALLY_PROGRESS_KEY);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return fallback;
    const data = value as Record<string, unknown>;
    const stars: Record<string, number> = {};
    const mastered: Record<string, number> = {};
    if (data.stars && typeof data.stars === 'object') {
      for (const level of RALLY_LEVELS) stars[level.id] = safeInteger((data.stars as Record<string, unknown>)[level.id], 0, 0, 3);
    }
    if (data.masteredQuestions && typeof data.masteredQuestions === 'object') {
      for (const question of RACE_QUESTIONS) mastered[question.id] = safeInteger((data.masteredQuestions as Record<string, unknown>)[question.id], 0, 0, 9999);
    }
    return {
      version: 1,
      unlockedLevel: safeInteger(data.unlockedLevel, 1, 1, RALLY_LEVELS.length),
      stars,
      masteredQuestions: mastered,
      pendingReview: Array.isArray(data.pendingReview)
        ? [...new Set(data.pendingReview.filter((id): id is string => typeof id === 'string' && RACE_QUESTIONS.some(question => question.id === id)))]
        : [],
      totalScore: safeInteger(data.totalScore, 0, 0, 999_999_999),
      selectedVehicleId: typeof data.selectedVehicleId === 'string' && RALLY_VEHICLES.some(vehicle => vehicle.id === data.selectedVehicleId)
        ? data.selectedVehicleId
        : fallback.selectedVehicleId,
    };
  } catch {
    return fallback;
  }
}

export function steerRally(run: RallyRun, direction: number): boolean {
  if (run.phase !== 'driving') return false;
  const next = Math.max(0, Math.min(2, run.lane + Math.sign(direction)));
  if (next === run.lane) return false;
  run.lane = next;
  run.events.push({ kind: 'lane', value: next });
  return true;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawRallyQuestions(run: RallyRun, checkpoint: number): RaceQuestion[] {
  const random = mulberry32(run.seed + checkpoint * 977);
  const used = new Set(run.answers.map(answer => answer.id));
  const pool = shuffled(RACE_QUESTIONS.filter(question => !used.has(question.id)), random);
  const count = questionsPerStop(run.level);
  const questions: RaceQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const subject = i % 2 === 0 ? 'chinese' : 'math';
    const question = pool.find(item => item.subject === subject && !questions.some(picked => picked.id === item.id))
      ?? pool.find(item => !questions.some(picked => picked.id === item.id));
    if (!question) break;
    const order = shuffled([0, 1, 2, 3], random);
    questions.push({
      ...question,
      options: order.map(index => question.options[index]) as RaceQuestion['options'],
      answer: order.indexOf(question.answer),
    });
  }
  return questions;
}

export function answerRally(run: RallyRun, option: number): boolean {
  const quiz = run.quiz;
  if (run.phase !== 'quiz' || !quiz || quiz.feedback !== null || option < 0 || option > 3) return false;
  const question = quiz.questions[quiz.index];
  const correct = option === question.answer;
  quiz.picked = option;
  if (quiz.firstTry && quiz.firstPicked === null) quiz.firstPicked = option;
  if (!correct) {
    quiz.feedback = 'wrong';
    run.combo = 0;
    run.events.push({ kind: 'wrong' });
    return false;
  }

  quiz.feedback = 'correct';
  run.answered++;
  run.combo++;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  if (quiz.firstTry) {
    run.firstTryCorrect++;
    run.energy = Math.min(100, run.energy + 20 + Math.min(5, run.combo) * 5);
    run.score += 100 + run.combo * 20;
  } else {
    run.energy = Math.min(100, run.energy + 10);
    run.score += 40;
  }
  run.answers.push({
    id: question.id,
    subject: question.subject,
    topic: question.topic,
    prompt: question.prompt,
    options: [...question.options],
    answer: question.answer,
    picked: option,
    firstPicked: quiz.firstTry ? option : quiz.firstPicked ?? option,
    firstTryCorrect: quiz.firstTry,
    explain: question.explain,
    mastered: true,
  });
  run.events.push({ kind: 'correct', value: run.combo });
  return true;
}

export function retryRallyQuestion(run: RallyRun) {
  const quiz = run.quiz;
  if (run.phase !== 'quiz' || !quiz || quiz.feedback !== 'wrong') return;
  quiz.feedback = null;
  quiz.picked = null;
  quiz.firstTry = false;
}

export function advanceRallyQuiz(run: RallyRun) {
  const quiz = run.quiz;
  if (run.phase !== 'quiz' || !quiz || quiz.feedback !== 'correct') return;
  if (quiz.index + 1 < quiz.questions.length) {
    quiz.index++;
    quiz.firstTry = true;
    quiz.feedback = null;
    quiz.picked = null;
    quiz.firstPicked = null;
    return;
  }
  run.checkpointIndex++;
  run.quiz = null;
  run.phase = 'driving';
}

export function enterRallyCheckpoint(run: RallyRun) {
  const checkpoint = run.level.checkpoints[run.checkpointIndex];
  run.distance = checkpoint;
  run.speed = 0;
  run.phase = 'quiz';
  run.quiz = {
    checkpoint: run.checkpointIndex,
    questions: drawRallyQuestions(run, run.checkpointIndex),
    index: 0,
    firstTry: true,
    feedback: null,
    picked: null,
    firstPicked: null,
  };
  run.events.push({ kind: 'checkpoint', value: run.checkpointIndex + 1 });
}

export function stepRally(run: RallyRun, dt: number, boostHeld = false) {
  if (run.phase === 'countdown') {
    const before = Math.ceil(run.countdownMs / 1000);
    run.countdownMs = Math.max(0, run.countdownMs - dt * 1000);
    const after = Math.ceil(run.countdownMs / 1000);
    if (after < before && after > 0) run.events.push({ kind: 'count', value: after });
    if (run.countdownMs === 0) {
      run.phase = 'driving';
      run.events.push({ kind: 'go' });
    }
    return;
  }
  if (run.phase !== 'driving') return;
  run.elapsedMs += dt * 1000;
  run.invulnMs = Math.max(0, run.invulnMs - dt * 1000);
  run.laneVisual += (run.lane - run.laneVisual) * Math.min(1, dt * run.vehicle.grip * 10);
  if (!boostHeld) run.boostArmed = true;
  if (boostHeld && run.boostArmed && run.energy >= 35 && run.boostMs === 0) {
    run.energy -= 35;
    run.boostMs = 2400;
    run.boostArmed = false;
    run.events.push({ kind: 'boost' });
  }
  run.boostMs = Math.max(0, run.boostMs - dt * 1000);
  const targetSpeed = run.level.speed * run.vehicle.speedFactor * (run.boostMs > 0 ? 1.5 * run.vehicle.boostFactor : 1);
  run.speed += (targetSpeed - run.speed) * Math.min(1, dt * 1.8);
  run.distance = Math.min(run.level.length, run.distance + run.speed * dt);

  for (const obstacle of run.obstacles) {
    if (run.hitObstacles.includes(obstacle.id) || obstacle.distance > run.distance + 4 || obstacle.distance < run.distance - 8) continue;
    if (Math.abs(run.laneVisual - obstacle.lane) > 0.42 || run.invulnMs > 0) continue;
    run.hitObstacles.push(obstacle.id);
    run.integrity--;
    run.energy = Math.max(0, run.energy - 20);
    run.invulnMs = 1200;
    run.combo = 0;
    run.events.push({ kind: 'hit', value: run.integrity });
    if (run.integrity <= 0) {
      run.phase = 'crashed';
      run.events.push({ kind: 'crash' });
      return;
    }
  }

  const checkpoint = run.level.checkpoints[run.checkpointIndex];
  if (checkpoint !== undefined && run.distance >= checkpoint) {
    enterRallyCheckpoint(run);
    return;
  }
  if (run.distance >= run.level.length) {
    run.phase = 'finished';
    run.speed = 0;
    run.events.push({ kind: 'finish' });
  }
}
