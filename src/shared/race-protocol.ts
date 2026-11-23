import type { StudyCourse } from './study.js';
import type { TruckId } from './trucks.js';
import type { LearningMode, LearningAction, LearningView, MatchMode } from './learning.js';
import type { PlayerStatus } from './race.js';
import type { RaceSubject } from './race-questions.js';
import type { Ack, ClosedReason, Respond, RoomError, Session } from './protocol.js';

export const RACE_SEATS = [0, 1, 2, 3] as const;
export type RaceSeat = typeof RACE_SEATS[number];
export const RACE_MAX_PLAYERS = RACE_SEATS.length;
export const RACE_NAME_MAX = 8;

export type RacePhase = 'lobby' | 'playing' | 'finished';

export interface RacePlayerView {
  truck: TruckId;
  seat: RaceSeat;
  name: string;
  color: number;
  online: boolean;
  ready: boolean;
  x: number;
  lane: number;
  lastGateCorrect: boolean | null;
  fuel: number;
  status: PlayerStatus;
  hits: number;
  correctTotal: number;
  wrongTotal: number;
  stationsCleared: number;
  finishMs: number | null;
  progress: number;
  reviewWrong: number;
  reviewDone: boolean;
}

export interface RaceQuizView {
  station: number;
  index: number;
  total: number;
  phase: 'question' | 'reveal';
  subject: RaceSubject;
  topic: string;
  prompt: string;
  options: string[];
  picked: number | null;
  wasCorrect: boolean | null;
  gainedFuel: boolean;
  answer: number | null;
  explain: string | null;
  correct: number;
}

export interface RaceReviewEntry {
  id: string;
  subject: RaceSubject;
  topic: string;
  prompt: string;
  options: string[];
  answer: number;
  picked: number;
  explain: string;
  station: number;
}

export interface RaceResultRow {
  seat: RaceSeat;
  name: string;
  color: number;
  progress: number;
  correctTotal: number;
  wrongTotal: number;
  hits: number;
  stationsCleared: number;
  finishMs: number | null;
}

export interface RaceStandings {
  finished: RaceResultRow[];
  eliminated: RaceResultRow[];
}

export interface RaceRoomView {
  course: StudyCourse;
  mode: MatchMode;
  learning: LearningView | null;
  code: string;
  phase: RacePhase;
  trackId: string;
  startFuel: number;
  hostSeat: RaceSeat;
  lobbyRevision: number;
  elapsedMs: number;
  countdownMs: number | null;
  players: (RacePlayerView | null)[];
  quiz: RaceQuizView | null;
  standings: RaceStandings | null;
  review: RaceReviewEntry[];
  reviewDone: boolean;
}

export interface RaceAdmission {
  room: RaceRoomView;
  seat: RaceSeat;
  token: string;
}

export interface RaceConfig {
  course?: StudyCourse;
  trackId?: string;
  startFuel?: number;
}

export interface RaceProfile {
  truck?: TruckId;
  name?: string;
  color?: number;
}

export type RaceAck<T> = Ack<T>;
export type RaceRespond<T> = Respond<T>;
export type { ClosedReason, RoomError, Session };

export interface RaceClientEvents {
  'learning:create': (mode: LearningMode, respond: RaceRespond<RaceAdmission>) => void;
  'learning:act': (action: LearningAction) => void;
  'race:create': (respond: RaceRespond<RaceAdmission>) => void;
  'race:join': (code: string, respond: RaceRespond<RaceAdmission>) => void;
  'race:resume': (session: Session, respond: RaceRespond<RaceAdmission>) => void;
  'race:leave': (respond: RaceRespond<null>) => void;
  'race:config': (config: RaceConfig, respond: RaceRespond<RaceRoomView>) => void;
  'race:profile': (profile: RaceProfile, respond: RaceRespond<RaceRoomView>) => void;
  'race:ready': (ready: boolean, lobbyRevision: number, respond: RaceRespond<RaceRoomView>) => void;
  'race:start': (respond: RaceRespond<RaceRoomView>) => void;
  'race:replay': (respond: RaceRespond<RaceRoomView>) => void;
  'race:lane': (direction: number) => void;
  'race:answer': (option: number) => void;
  'race:advance': () => void;
  'race:review-done': (respond: RaceRespond<RaceRoomView>) => void;
}

export interface RaceServerEvents {
  'race:view': (room: RaceRoomView) => void;
  'race:closed': (reason: ClosedReason) => void;
}

export function sanitizeRaceName(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim().slice(0, RACE_NAME_MAX);
  return trimmed || fallback;
}

export function sanitizeRaceColor(input: unknown, fallback: number): number {
  return typeof input === 'number' && Number.isInteger(input) && input >= 0 && input < RACE_MAX_PLAYERS
    ? input : fallback;
}