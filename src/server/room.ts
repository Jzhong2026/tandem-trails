import { randomBytes } from 'node:crypto';
import { SEATS } from '../shared/protocol.js';
import type { Admission, PlayerView, RoomPhase, RoomView, Seat } from '../shared/protocol.js';
import { createRiverRun, riverView, stepRiver } from '../shared/river.js';
import type { Paddles, RiverRun } from '../shared/river.js';

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
    return { room: this.view(now), seat, token: this.members[seat]!.token };
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

  ready(seat: Seat, ready: boolean, now: number) {
    if (this.run) return ready && this.phase === 'playing';
    this.members[seat]!.ready = ready;
    this.activeAt = now;
    if (SEATS.every(key => this.members[key]?.socketId && this.members[key]?.ready)) {
      this.run = createRiverRun();
    }
    return true;
  }

  replay(now: number) {
    if (!this.run?.finished) return this.run === null;
    this.run = null;
    this.activeAt = now;
    for (const seat of SEATS) this.members[seat]!.ready = false;
    this.clearPaddles();
    return true;
  }

  paddle(seat: Seat, pressed: boolean, now: number) {
    if (this.phase !== 'playing') return;
    this.members[seat]!.pressedUntil = pressed ? now + INPUT_LEASE_MS : 0;
    this.activeAt = now;
  }

  tick(now: number) {
    if (!this.run || this.phase !== 'playing') return;
    stepRiver(this.run, this.paddles(now));
    if (this.run.finished) this.clearPaddles();
  }

  get phase(): RoomPhase {
    if (!this.run) return 'lobby';
    if (this.run.finished) return 'finished';
    return SEATS.every(seat => this.members[seat]?.socketId) ? 'playing' : 'paused';
  }

  view(now: number): RoomView {
    const playerView = (seat: Seat): PlayerView | null => {
      const member = this.members[seat];
      return member ? { online: member.socketId !== null, ready: member.ready } : null;
    };
    return {
      code: this.code, phase: this.phase,
      players: { left: playerView('left'), right: playerView('right') },
      paddles: this.paddles(now), run: this.run ? riverView(this.run) : null,
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
