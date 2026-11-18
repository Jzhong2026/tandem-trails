import { randomBytes, randomInt } from 'node:crypto';
import { createEgg, stepEgg } from '../shared/egg.js';
import type { EggView } from '../shared/egg.js';
import { GAME_LEVELS, usesMovementControls } from '../shared/game-levels.js';
import type { GameLevel } from '../shared/game-levels.js';
import { createMine, mineView, stepMine } from '../shared/mine.js';
import type { MineView } from '../shared/mine.js';
import { IDLE_MOVEMENT } from '../shared/movement.js';
import type { MovementInput } from '../shared/movement.js';
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
  movement: { controls: MovementInput; until: number } | null;
}

export class Room {
  readonly members: Record<Seat, Member | null> = { left: null, right: null };
  private run: RiverRun | MineView | EggView | null = null;
  private level: GameLevel = RIVER_ORDER[0];
  private lobbyRevision = 0;
  private readonly completed = new Set<GameLevel>();
  private activeAt: number;

  constructor(readonly code: string, now: number) {
    this.activeAt = now;
  }

  admit(seat: Seat, socketId: string, now: number) {
    this.members[seat] = {
      token: randomBytes(24).toString('base64url'), socketId,
      disconnectedAt: null, ready: false, pressedUntil: 0, movement: null,
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
    this.clearInputs();
  }

  disconnect(seat: Seat, now: number) {
    const member = this.members[seat]!;
    member.socketId = null;
    member.disconnectedAt = now;
    if (!this.run) member.ready = false;
    this.clearInputs();
  }

  expired(now: number, reservationMs: number) {
    return now - this.activeAt >= ROOM_IDLE_MS || SEATS.some(seat => {
      const disconnectedAt = this.members[seat]?.disconnectedAt;
      return disconnectedAt != null && now - disconnectedAt >= reservationMs;
    });
  }

  selectLevel(level: GameLevel, now: number) {
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
      switch (this.level) {
        case 'mine': this.run = createMine(); break;
        case 'egg': this.run = createEgg(); break;
        default: this.run = createRiverRun(this.level, layout);
      }
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
    const fog = this.run?.level === 'fog' ? this.run.fog : null;
    if (!fog || this.phase !== 'playing') return false;
    fog.shared[seat === 'left' ? 0 : 1] = true;
    this.activeAt = now;
    return true;
  }

  private resetLobby(level: GameLevel, now: number) {
    this.level = level;
    this.lobbyRevision++;
    this.run = null;
    this.activeAt = now;
    for (const member of Object.values(this.members)) {
      if (member) member.ready = false;
    }
    this.clearInputs();
  }

  paddle(seat: Seat, pressed: boolean, now: number) {
    if (this.phase !== 'playing' || usesMovementControls(this.run?.level)) return;
    this.members[seat]!.pressedUntil = pressed ? now + INPUT_LEASE_MS : 0;
    this.activeAt = now;
  }

  movementInput(seat: Seat, controls: MovementInput, now: number) {
    if (this.phase !== 'playing' || !usesMovementControls(this.run?.level)) return;
    this.members[seat]!.movement = { controls, until: now + INPUT_LEASE_MS };
    this.activeAt = now;
  }

  tick(now: number) {
    if (!this.run || this.phase !== 'playing') return;
    if (this.run.level === 'mine' || this.run.level === 'egg') {
      const held = (seat: Seat) => {
        const input = this.members[seat]!.movement;
        return input && input.until > now ? input.controls : IDLE_MOVEMENT;
      };
      const inputs = { left: held('left'), right: held('right') };
      if (this.run.level === 'mine') stepMine(this.run, inputs);
      else stepEgg(this.run, inputs);
    } else {
      stepRiver(this.run, this.paddles(now));
    }
    if (this.run.finished) {
      this.completed.add(this.level);
      this.clearInputs();
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
      completed: GAME_LEVELS.filter(level => this.completed.has(level)),
      players: { left: playerView('left'), right: playerView('right') },
      paddles: this.paddles(now),
      run: this.runView(),
      clues: this.fogClues(seat),
    };
  }

  private runView(): RoomView['run'] {
    const run = this.run;
    if (!run) return null;
    if (run.level === 'mine') return mineView(run);
    if (run.level === 'egg') return { ...run, raised: { ...run.raised }, elapsedMs: Math.round(run.elapsedMs) };
    return riverView(run);
  }

  private fogClues(seat: Seat): FogClues | null {
    const fog = this.run?.level === 'fog' ? this.run.fog : null;
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

  private clearInputs() {
    for (const member of Object.values(this.members)) {
      if (member) {
        member.pressedUntil = 0;
        member.movement = null;
      }
    }
  }
}
