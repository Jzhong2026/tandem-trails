import { randomBytes, randomInt } from 'node:crypto';
import { SEATS } from '../shared/protocol.js';
import type { Admission, FogClues, PlayerView, RoomPhase, RoomView, Seat } from '../shared/protocol.js';
import { createRiverRun, riverView, stepRiver } from '../shared/river.js';
import type { Paddles, RiverRun } from '../shared/river.js';
import { nextRiverLevel, RIVER_ORDER } from '../shared/river-levels.js';
import type { RiverLevel } from '../shared/river-levels.js';

const INPUT_LEASE_MS = 450;
const ROOM_IDLE_MS = 30 * 60_000;

interface Member {
  token: string;
  socketId: string | null;
  disconnectedAt: number | null;
  ready: boolean;
  pressedUntil: number;
}

export class Room {
  readonly members: Record<Seat, Member | null> = { left: null, right: null };
  private run: RiverRun | null = null;
  private level: RiverLevel = RIVER_ORDER[0];
  private lobbyRevision = 0;
  private readonly completed = new Set<RiverLevel>();
  private activeAt: number;

  constructor(readonly code: string, now: number) {
    this.activeAt = now;
  }

  admit(seat: Seat, socketId: string, now: number) {
    this.members[seat] = {
      token: randomBytes(24).toString('base64url'), socketId,
      disconnectedAt: null, ready: false, pressedUntil: 0,
    };
    this.activeAt = now;
  }

  seatForToken(token: string) {
    return SEATS.find(seat => this.members[seat]?.token === token);
  }

  admission(seat: Seat, now: number): Admission {
    return { room: this.view(seat, now), seat, token: this.members[seat]!.token };
  }

  reconnect(seat: Seat, socketId: string, now: number) {
    const member = this.members[seat]!;
    member.socketId = socketId;
    member.disconnectedAt = null;
    this.activeAt = now;
    this.clearPaddles();
  }

  disconnect(seat: Seat, now: number) {
    const member = this.members[seat]!;
    member.socketId = null;
    member.disconnectedAt = now;
    if (!this.run) member.ready = false;
    this.clearPaddles();
  }

  expired(now: number, reservationMs: number) {
    return now - this.activeAt >= ROOM_IDLE_MS || SEATS.some(seat => {
      const disconnectedAt = this.members[seat]?.disconnectedAt;
      return disconnectedAt != null && now - disconnectedAt >= reservationMs;
    });
  }

  selectLevel(level: RiverLevel, now: number) {
    if (this.run) return false;
    if (level !== this.level) this.resetLobby(level, now);
    return true;
  }

  ready(seat: Seat, ready: boolean, lobbyRevision: number, now: number) {
    if (lobbyRevision !== this.lobbyRevision) return false;
    if (this.run) return ready && this.phase === 'playing';
    this.members[seat]!.ready = ready;
    this.activeAt = now;
    if (SEATS.every(key => this.members[key]?.socketId && this.members[key]?.ready)) {
      const layout = this.level === 'fog' ? {
        flag: randomInt(2) === 0 ? 'triangle' as const : 'circle' as const,
        channel: randomInt(2) === 0 ? 'upper' as const : 'lower' as const,
      } : undefined;
      this.run = createRiverRun(this.level, layout);
    }
    return true;
  }

  replay(now: number) {
    if (!this.run?.finished) return this.run === null;
    this.resetLobby(this.level, now);
    return true;
  }

  advance(from: RiverLevel, now: number) {
    const next = nextRiverLevel(from);
    if (!next) return false;
    if (this.level === next && !this.run) return true;
    if (this.level !== from || !this.run?.finished) return false;
    this.resetLobby(next, now);
    return true;
  }

  shareClue(seat: Seat, now: number) {
    const fog = this.run?.fog;
    if (!fog || this.phase !== 'playing') return false;
    fog.shared[seat === 'left' ? 0 : 1] = true;
    this.activeAt = now;
    return true;
  }

  private resetLobby(level: RiverLevel, now: number) {
    this.level = level;
    this.lobbyRevision++;
    this.run = null;
    this.activeAt = now;
    for (const member of Object.values(this.members)) {
      if (member) member.ready = false;
    }
    this.clearPaddles();
  }

  paddle(seat: Seat, pressed: boolean, now: number) {
    if (this.phase !== 'playing') return;
    this.members[seat]!.pressedUntil = pressed ? now + INPUT_LEASE_MS : 0;
    this.activeAt = now;
  }

  tick(now: number) {
    if (!this.run || this.phase !== 'playing') return;
    stepRiver(this.run, this.paddles(now));
    if (this.run.finished) {
      this.completed.add(this.level);
      this.clearPaddles();
    }
  }

  get phase(): RoomPhase {
    if (!this.run) return 'lobby';
    if (this.run.finished) return 'finished';
    return SEATS.every(seat => this.members[seat]?.socketId) ? 'playing' : 'paused';
  }

  view(seat: Seat, now: number): RoomView {
    const playerView = (seat: Seat): PlayerView | null => {
      const member = this.members[seat];
      return member ? { online: member.socketId !== null, ready: member.ready } : null;
    };
    return {
      code: this.code, phase: this.phase, level: this.level, lobbyRevision: this.lobbyRevision,
      completed: RIVER_ORDER.filter(level => this.completed.has(level)),
      players: { left: playerView('left'), right: playerView('right') },
      paddles: this.paddles(now), run: this.run ? riverView(this.run) : null,
      clues: this.fogClues(seat),
    };
  }

  private fogClues(seat: Seat): FogClues | null {
    const fog = this.run?.fog;
    if (!fog) return null;
    return {
      own: seat === 'left' ? { kind: 'flag', value: fog.flag } : { kind: 'channel', value: fog.channel },
      flag: fog.shared[0] ? fog.flag : null,
      channel: fog.shared[1] ? fog.channel : null,
    };
  }

  private paddles(now: number): Paddles {
    return [this.members.left, this.members.right].map(member =>
      member !== null && member.pressedUntil > now) as Paddles;
  }

  private clearPaddles() {
    for (const member of Object.values(this.members)) {
      if (member) member.pressedUntil = 0;
    }
  }
}
