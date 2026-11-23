import { QUESTIONS_PER_STATION, RACE_QUESTIONS } from './race-questions.js';
import type { RaceQuestion } from './race-questions.js';
import { trackById } from './race-tracks.js';
import type { RaceTrackDef } from './race-tracks.js';

export const RACE_STEP = 1 / 60;
export const FUEL_MAX = 10;
export const STATION_COST = 3;
export const LANE_COUNT = 3;
export const COUNTDOWN_MS = 3200;
export const CAR_LENGTH = 74;

export type ObstacleKind = 'cone' | 'barrel' | 'rock';

export interface Obstacle {
  x: number;
  lane: number;
  kind: ObstacleKind;
  w: number;
}

export interface RaceInput {
  up: boolean;
  down: boolean;
}

export const IDLE_INPUT: RaceInput = { up: false, down: false };

export type PlayerStatus = 'racing' | 'quiz' | 'finished' | 'eliminated';
export type RunStatus = 'countdown' | 'racing' | 'finished';

export interface QuizState {
  station: number;
  questions: RaceQuestion[];
  index: number;
  correct: number;
  phase: 'question' | 'reveal';
  picked: number | null;
  wasCorrect: boolean | null;
}

export interface RacePlayer {
  name: string;
  color: number;
  x: number;
  lane: number;
  laneY: number;
  fuel: number;
  status: PlayerStatus;
  quiz: QuizState | null;
  invulnMs: number;
  slowMs: number;
  hits: number;
  correctTotal: number;
  wrongTotal: number;
  stationsCleared: number;
  finishMs: number | null;
  hitObstacles: number[];
  prevUp: boolean;
  prevDown: boolean;
  lowFuelWarned: boolean;
}

export type RaceEventKind =
  | 'count' | 'go' | 'lane' | 'hit' | 'station' | 'correct' | 'wrong'
  | 'exit' | 'eliminated' | 'finish' | 'lowfuel';

export interface RaceEvent {
  kind: RaceEventKind;
  player: number;
  value?: number;
}

export interface RaceRun {
  track: RaceTrackDef;
  obstacles: Obstacle[];
  players: RacePlayer[];
  status: RunStatus;
  countdownMs: number;
  elapsedMs: number;
  events: RaceEvent[];
  pauseAllOnQuiz: boolean;
  quizOwner: number | null;
  startFuel: number;
  seed: number;
}

export interface RaceOptions {
  names: string[];
  colors?: number[];
  trackId?: string;
  pauseAllOnQuiz?: boolean;
  startFuel?: number;
  seed?: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawQuestions(rand: () => number, subjectMix: boolean): RaceQuestion[] {
  const pool = shuffle(RACE_QUESTIONS, rand);
  const picked: RaceQuestion[] = [];
  if (subjectMix) {
    const chinese = pool.filter(q => q.subject === 'chinese');
    const math = pool.filter(q => q.subject === 'math');
    for (let i = 0; i < QUESTIONS_PER_STATION; i++) {
      const source = i % 2 === 0 ? chinese : math;
      picked.push(source[Math.floor(i / 2)] ?? pool[i]);
    }
  } else {
    picked.push(...pool.slice(0, QUESTIONS_PER_STATION));
  }
  return picked.map(question => {
    const order = shuffle([0, 1, 2, 3], rand);
    const options = order.map(i => question.options[i]) as [string, string, string, string];
    return { ...question, options, answer: order.indexOf(question.answer) };
  });
}

export function generateObstacles(track: RaceTrackDef, seed: number): Obstacle[] {
  const rand = mulberry32(seed);
  const obstacles: Obstacle[] = [];
  const kinds: ObstacleKind[] = ['cone', 'barrel', 'rock'];
  let x = 720;
  while (x < track.length - 480) {
    const nearStation = track.stations.some(station => Math.abs(station - x) < 420);
    if (!nearStation) {
      const lane = Math.floor(rand() * LANE_COUNT);
      const kind = kinds[Math.floor(rand() * kinds.length)];
      obstacles.push({ x, lane, kind, w: kind === 'barrel' ? 52 : 46 });
      if (rand() < track.doubleChance) {
        const other = (lane + (rand() < 0.5 ? 1 : 2)) % LANE_COUNT;
        obstacles.push({ x: x + 10, lane: other, kind: kinds[Math.floor(rand() * kinds.length)], w: 46 });
      }
    }
    x += track.gap[0] + rand() * (track.gap[1] - track.gap[0]);
  }
  return obstacles;
}

export function createRace(options: RaceOptions): RaceRun {
  const track = trackById(options.trackId ?? 'campus');
  const seed = options.seed ?? Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const startFuel = Math.max(1, Math.min(FUEL_MAX, options.startFuel ?? 6));
  const players: RacePlayer[] = options.names.slice(0, 4).map((name, index) => ({
    name: name.trim() || `车手 ${index + 1}`,
    color: options.colors?.[index] ?? index,
    x: 0,
    lane: 1,
    laneY: 1,
    fuel: startFuel,
    status: 'racing',
    quiz: null,
    invulnMs: 0,
    slowMs: 0,
    hits: 0,
    correctTotal: 0,
    wrongTotal: 0,
    stationsCleared: 0,
    finishMs: null,
    hitObstacles: [],
    prevUp: false,
    prevDown: false,
    lowFuelWarned: false,
  }));
  return {
    track,
    obstacles: generateObstacles(track, track.seed),
    players,
    status: 'countdown',
    countdownMs: COUNTDOWN_MS,
    elapsedMs: 0,
    events: [],
    pauseAllOnQuiz: options.pauseAllOnQuiz ?? true,
    quizOwner: null,
    startFuel,
    seed,
  };
}

export function raceProgress(run: RaceRun, player: RacePlayer): number {
  return Math.max(0, Math.min(1, player.x / run.track.length));
}

export function changeLane(run: RaceRun, index: number, direction: number): boolean {
  const player = run.players[index];
  if (!player || player.status !== 'racing') return false;
  const next = player.lane + (direction < 0 ? -1 : 1);
  if (next < 0 || next >= LANE_COUNT) return false;
  player.lane = next;
  run.events.push({ kind: 'lane', player: index, value: next });
  return true;
}

export function eliminatePlayer(run: RaceRun, index: number) {
  const player = run.players[index];
  if (player && (player.status === 'racing' || player.status === 'quiz')) eliminate(run, index);
}

export function activePlayers(run: RaceRun): RacePlayer[] {
  return run.players.filter(player => player.status === 'racing' || player.status === 'quiz');
}

function enterStation(run: RaceRun, index: number, station: number) {
  const player = run.players[index];
  player.status = 'quiz';
  player.x = run.track.stations[station];
  player.quiz = {
    station,
    questions: drawQuestions(mulberry32(run.seed + index * 977 + station * 131), true),
    index: 0,
    correct: 0,
    phase: 'question',
    picked: null,
    wasCorrect: null,
  };
  if (run.pauseAllOnQuiz) run.quizOwner = index;
  run.events.push({ kind: 'station', player: index, value: station });
}

function eliminate(run: RaceRun, index: number) {
  const player = run.players[index];
  player.fuel = 0;
  player.status = 'eliminated';
  player.quiz = null;
  if (run.quizOwner === index) run.quizOwner = null;
  run.events.push({ kind: 'eliminated', player: index });
}

export function stepRace(run: RaceRun, inputs: RaceInput[]) {
  const dtMs = RACE_STEP * 1000;
  if (run.status === 'countdown') {
    const before = Math.ceil(run.countdownMs / 1000);
    run.countdownMs -= dtMs;
    const after = Math.ceil(run.countdownMs / 1000);
    if (after < before && after >= 1) run.events.push({ kind: 'count', player: -1, value: after });
    if (run.countdownMs <= 0) {
      run.status = 'racing';
      run.events.push({ kind: 'go', player: -1 });
    }
    return;
  }
  if (run.status !== 'racing') return;

  run.elapsedMs += dtMs;
  for (let i = 0; i < run.players.length; i++) {
    const player = run.players[i];
    const input = inputs[i] ?? IDLE_INPUT;
    if (player.status !== 'racing') { player.prevUp = input.up; player.prevDown = input.down; continue; }
    if (run.pauseAllOnQuiz && run.quizOwner !== null && run.quizOwner !== i) continue;

    if (input.up && !player.prevUp) changeLane(run, i, -1);
    if (input.down && !player.prevDown) changeLane(run, i, 1);
    player.prevUp = input.up;
    player.prevDown = input.down;

    player.invulnMs = Math.max(0, player.invulnMs - dtMs);
    player.slowMs = Math.max(0, player.slowMs - dtMs);
    const speed = run.track.speed * (player.slowMs > 0 ? 0.45 : 1);
    const previousX = player.x;
    player.x += speed * RACE_STEP;
    player.laneY += (player.lane - player.laneY) * Math.min(1, RACE_STEP * 11);

    for (let o = 0; o < run.obstacles.length; o++) {
      const obstacle = run.obstacles[o];
      if (obstacle.x > player.x + CAR_LENGTH || obstacle.x + obstacle.w < player.x) continue;
      if (player.hitObstacles.includes(o) || player.invulnMs > 0) continue;
      if (Math.abs(player.laneY - obstacle.lane) > 0.45) continue;
      player.hitObstacles.push(o);
      player.hits++;
      player.fuel--;
      player.invulnMs = 1200;
      player.slowMs = 950;
      run.events.push({ kind: 'hit', player: i, value: o });
      if (player.fuel <= 0) { eliminate(run, i); break; }
      if (player.fuel <= 2 && !player.lowFuelWarned) {
        player.lowFuelWarned = true;
        run.events.push({ kind: 'lowfuel', player: i });
      }
    }
    if (player.status !== 'racing') continue;

    for (let s = 0; s < run.track.stations.length; s++) {
      const stationX = run.track.stations[s];
      if (previousX < stationX && player.x >= stationX && player.stationsCleared === s) {
        enterStation(run, i, s);
        break;
      }
    }
    if (player.status !== 'racing') continue;

    if (player.x >= run.track.length) {
      player.x = run.track.length;
      player.status = 'finished';
      player.finishMs = run.elapsedMs;
      run.events.push({ kind: 'finish', player: i });
    }
  }

  if (run.players.every(player => player.status === 'finished' || player.status === 'eliminated')) {
    run.status = 'finished';
  }
}

export function answerQuiz(run: RaceRun, index: number, option: number): boolean {
  const player = run.players[index];
  const quiz = player.quiz;
  if (!quiz || quiz.phase !== 'question' || option < 0 || option > 3) return false;
  const question = quiz.questions[quiz.index];
  const correct = option === question.answer;
  quiz.picked = option;
  quiz.wasCorrect = correct;
  quiz.phase = 'reveal';
  if (correct) {
    quiz.correct++;
    player.correctTotal++;
    player.fuel = Math.min(FUEL_MAX, player.fuel + 1);
    player.lowFuelWarned = player.fuel <= 2;
    run.events.push({ kind: 'correct', player: index, value: quiz.correct });
  } else {
    player.wrongTotal++;
    run.events.push({ kind: 'wrong', player: index });
  }
  return correct;
}

export function advanceQuiz(run: RaceRun, index: number) {
  const player = run.players[index];
  const quiz = player.quiz;
  if (!quiz || quiz.phase !== 'reveal') return;
  if (quiz.index + 1 < quiz.questions.length) {
    quiz.index++;
    quiz.phase = 'question';
    quiz.picked = null;
    quiz.wasCorrect = null;
    return;
  }
  player.fuel -= STATION_COST;
  player.stationsCleared++;
  run.events.push({ kind: 'exit', player: index, value: player.fuel });
  if (player.fuel <= 0) {
    eliminate(run, index);
    return;
  }
  player.quiz = null;
  player.status = 'racing';
  player.lowFuelWarned = player.fuel <= 2;
  if (run.quizOwner === index) run.quizOwner = null;
}

export function raceStandings(run: RaceRun): { finished: RacePlayer[]; eliminated: RacePlayer[] } {
  const finished = run.players
    .filter(player => player.status === 'finished')
    .sort((a, b) => (a.finishMs ?? 0) - (b.finishMs ?? 0));
  const eliminated = run.players
    .filter(player => player.status === 'eliminated')
    .sort((a, b) => b.x - a.x);
  return { finished, eliminated };
}