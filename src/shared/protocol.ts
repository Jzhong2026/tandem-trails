import type { Paddles, RiverView } from './river.js';
import type { Channel, Flag } from './river-levels.js';
import type { GameLevel } from './game-levels.js';
import type { MineView } from './mine.js';
import type { EggView } from './egg.js';
import type { SubView } from './sub.js';
import type { MovementInput } from './movement.js';
import type { Appearance } from './buddy.js';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const INPUT_REFRESH_MS = 100;
export const RESERVATION_MS = 90_000;
export const SEATS = ['left', 'right'] as const;

export type Seat = typeof SEATS[number];
export type RoomPhase = 'lobby' | 'playing' | 'paused' | 'finished';
export type ClosedReason = 'expired' | 'left' | 'replaced';
export type RoomError = 'bad-code' | 'missing' | 'full' | 'in-room' | 'not-member'
  | 'expired' | 'busy' | 'wrong-phase' | 'bad-request' | 'host-only' | 'review-pending';

export interface PlayerView {
  online: boolean;
  ready: boolean;
  appearance: Appearance;
}

export interface FogClues {
  own: { kind: 'flag'; value: Flag } | { kind: 'channel'; value: Channel };
  flag: Flag | null;
  channel: Channel | null;
}

export interface RoomView {
  code: string;
  phase: RoomPhase;
  level: GameLevel;
  lobbyRevision: number;
  completed: GameLevel[];
  players: Record<Seat, PlayerView | null>;
  paddles: Paddles;
  run: RiverView | MineView | EggView | SubView | null;
  clues: FogClues | null;
}

export interface Session {
  code: string;
  token: string;
}

export interface Admission {
  room: RoomView;
  seat: Seat;
  token: string;
}

export type Ack<T> = { ok: true; value: T } | { ok: false; error: RoomError };
export type Respond<T> = (response: Ack<T>) => void;

export interface ClientEvents {
  'room:create': (respond: Respond<Admission>) => void;
  'room:join': (code: string, respond: Respond<Admission>) => void;
  'room:resume': (session: Session, respond: Respond<Admission>) => void;
  'room:select-level': (level: GameLevel, respond: Respond<RoomView>) => void;
  'room:ready': (ready: boolean, lobbyRevision: number, respond: Respond<RoomView>) => void;
  'room:appearance': (appearance: Appearance, respond?: Respond<RoomView>) => void;
  'room:replay': (respond: Respond<RoomView>) => void;
  'room:next': (level: GameLevel, respond: Respond<RoomView>) => void;
  'room:leave': (respond: Respond<null>) => void;
  'game:paddle': (pressed: boolean) => void;
  'game:movement': (controls: MovementInput) => void;
  'game:share-clue': (respond: Respond<RoomView>) => void;
}

export interface ServerEvents {
  'room:view': (room: RoomView) => void;
  'room:closed': (reason: ClosedReason) => void;
}

export function normalizeRoomCode(input: string) {
  return input.trim().toUpperCase();
}

export function validRoomCode(code: string) {
  return code.length === ROOM_CODE_LENGTH && [...code].every(letter => ROOM_CODE_ALPHABET.includes(letter));
}
