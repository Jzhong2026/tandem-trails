import { randomUUID } from 'node:crypto';
import { caseById } from './cases.js';
import { DetectiveGame } from './game-engine.js';
import type {
  CaseDefinition,
  RoomAction,
  RoomMode,
  RoomPhase,
  RoomPlayer,
  RoomView,
  Role,
} from '../shared/types.js';

interface Member {
  seat: 0 | 1;
  name: string;
  role: Role;
  token: string;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
}

const IDLE_MS = 30 * 60_000;
const RESERVATION_MS = 90_000;

export class DetectiveRoom {
  readonly code: string;
  readonly mode: RoomMode;
  readonly caseId: string;
  private readonly members: [Member | null, Member | null] = [null, null];
  private readonly definition: CaseDefinition | undefined;
  private phase: RoomPhase = 'lobby';
  private game: DetectiveGame | null = null;
  private revision = 0;
  private activeAt: number;

  constructor(code: string, mode: RoomMode, caseId: string, now = Date.now()) {
    this.code = code;
    this.mode = mode;
    this.caseId = caseId;
    this.definition = caseById(caseId);
    this.activeAt = now;
  }

  get hostSeat(): 0 | 1 {
    return this.members.findIndex((member) => member !== null) === 1 ? 1 : 0;
  }

  get freeSeat(): 0 | 1 | null {
    if (!this.members[0]) return 0;
    if (!this.members[1]) return 1;
    return null;
  }

  admit(seat: 0 | 1, name: string, now: number) {
    if (!this.definition || this.phase !== 'lobby' || this.members[seat]) return null;
    if (this.mode === 'solo' && seat !== 0) return null;
    const cleanName = name.trim().slice(0, 8) || (seat === 0 ? '小侦探' : '搭档');
    const token = randomUUID();
    this.members[seat] = {
      seat,
      name: cleanName,
      role: seat === 0 ? 'investigator' : 'analyst',
      token,
      ready: false,
      connected: true,
      disconnectedAt: null,
    };
    this.touch(now);
    return token;
  }

  setReady(seat: 0 | 1, ready: boolean, revision: number, now: number) {
    const member = this.members[seat];
    if (!member || this.phase !== 'lobby' || revision !== this.revision) return false;
    member.ready = Boolean(ready);
    this.touch(now);
    return true;
  }

  start(now: number) {
    if (this.phase !== 'lobby' || !this.definition) return false;
    const present = this.presentMembers();
    if (present.length !== (this.mode === 'solo' ? 1 : 2)) return false;
    if (!present.every((member) => member.ready && member.connected)) return false;
    this.game = new DetectiveGame(this.definition);
    this.phase = 'playing';
    this.touch(now);
    return true;
  }

  act(seat: 0 | 1, action: RoomAction, now: number) {
    const member = this.members[seat];
    if (!member || !member.connected || this.phase !== 'playing' || !this.game || !action) return false;
    let accepted = false;
    if (action.type === 'switch-role') {
      if (this.mode !== 'solo' || (action.role !== 'investigator' && action.role !== 'analyst')) return false;
      member.role = action.role;
      accepted = true;
    } else if (action.type === 'reveal' && typeof action.clueId === 'string') {
      accepted = this.game.revealClue(member.role, action.clueId);
    } else if (action.type === 'share' && typeof action.clueId === 'string') {
      accepted = this.game.shareClue(member.role, action.clueId);
    } else if (action.type === 'answer' && typeof action.option === 'number') {
      accepted = this.game.answerStep(member.role, action.option);
    } else if (action.type === 'repair' && typeof action.option === 'number') {
      accepted = this.game.answerRepair(member.role, action.option);
    } else if (
      action.type === 'accuse' &&
      typeof action.option === 'number' &&
      Array.isArray(action.evidenceIds) &&
      action.evidenceIds.every((id) => typeof id === 'string')
    ) {
      accepted = this.game.accuse(member.role, action.option, action.evidenceIds);
    }
    if (!accepted) return false;
    if (this.game.view(member.role).phase === 'solved') this.phase = 'finished';
    this.touch(now);
    return true;
  }

  disconnect(seat: 0 | 1, now: number) {
    const member = this.members[seat];
    if (!member || !member.connected) return false;
    member.connected = false;
    member.disconnectedAt = now;
    if (this.phase === 'lobby') member.ready = false;
    this.touch(now);
    return true;
  }

  reconnect(seat: 0 | 1, token: string, now: number) {
    const member = this.members[seat];
    if (!member || member.token !== token) return false;
    member.connected = true;
    member.disconnectedAt = null;
    this.touch(now);
    return true;
  }

  leave(seat: 0 | 1, now: number) {
    if (!this.members[seat]) return false;
    this.members[seat] = null;
    this.game = null;
    this.phase = 'lobby';
    this.touch(now);
    return true;
  }

  replay(now: number) {
    if (this.phase !== 'finished') return false;
    this.game = null;
    this.phase = 'lobby';
    for (const member of this.presentMembers()) {
      member.ready = false;
      member.role = member.seat === 0 ? 'investigator' : 'analyst';
    }
    this.touch(now);
    return true;
  }

  sync(now: number) {
    this.activeAt = now;
  }

  expired(now: number) {
    const present = this.presentMembers();
    if (present.length === 0) return true;
    if (present.some((member) => member.connected)) return false;
    if (now - this.activeAt >= IDLE_MS) return true;
    return present.every((member) => member.disconnectedAt !== null && now - member.disconnectedAt >= RESERVATION_MS);
  }

  view(seat: 0 | 1, now: number): RoomView | null {
    const member = this.members[seat];
    if (!member) return null;
    void now;
    return {
      code: this.code,
      mode: this.mode,
      caseId: this.caseId,
      phase: this.phase,
      hostSeat: this.hostSeat,
      revision: this.revision,
      players: [
        this.playerView(this.members[0]),
        this.playerView(this.members[1]),
      ],
      game: this.game?.view(member.role) ?? null,
    };
  }

  private playerView(member: Member | null): RoomPlayer | null {
    if (!member) return null;
    return {
      seat: member.seat,
      name: member.name,
      role: member.role,
      ready: member.ready,
      connected: member.connected,
    };
  }

  private presentMembers() {
    return this.members.filter((member): member is Member => member !== null);
  }

  private touch(now: number) {
    this.activeAt = now;
    this.revision++;
  }
}
