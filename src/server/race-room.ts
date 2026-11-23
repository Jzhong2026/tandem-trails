import { WorkshopMatch } from './workshop-match.js';
import { isWorkshopMode } from '../shared/workshop.js';
import type { WorkshopAction } from '../shared/workshop.js';
import { isTruckId } from '../shared/trucks.js';
import type { TruckId } from '../shared/trucks.js';
import { DEFAULT_COURSE, validCourse } from '../shared/study.js';
import { questionsFor } from './curriculum.js';
import { LearningMatch } from './learning-match.js';
import type { MatchMode, LearningAction } from '../shared/learning.js';
import { randomBytes } from 'node:crypto';
import {
  advanceQuiz, answerQuiz, changeLane, createRace, eliminatePlayer, FUEL_MAX, IDLE_INPUT,
  raceProgress, raceStandings, RACE_STEP, stepRace,
} from '../shared/race.js';
import type { RacePlayer, RaceRun } from '../shared/race.js';
import { trackById } from '../shared/race-tracks.js';
import { RESERVATION_MS } from '../shared/protocol.js';
import {
  RACE_MAX_PLAYERS, RACE_SEATS, sanitizeRaceColor, sanitizeRaceName,
} from '../shared/race-protocol.js';
import type {
  RaceAdmission, RaceConfig, RacePhase, RacePlayerView, RaceProfile, RaceQuizView,
  RaceResultRow, RaceReviewEntry, RaceRoomView, RaceSeat, RaceStandings,
} from '../shared/race-protocol.js';

export const RACE_IDLE_MS = 30 * 60_000;
const STEPS_PER_TICK = 2;

interface RaceMember {
  truck: TruckId;
  token: string;
  socketId: string | null;
  disconnectedAt: number | null;
  ready: boolean;
  name: string;
  color: number;
  reviewDone: boolean;
}

export class RaceRoom {
  readonly members: (RaceMember | null)[] = [null, null, null, null];
  private run: RaceRun | null = null;
  private workshop: WorkshopMatch|null=null;
  private learning: LearningMatch | null = null;
  private seatOrder: RaceSeat[] = [];
  private course = DEFAULT_COURSE;
  private trackId = 'campus';
  private startFuel = 6;
  private lobbyRevision = 0;
  private host: RaceSeat = 0;
  private activeAt: number;

  constructor(
    readonly code: string,
    now: number,
    private readonly idleMs: number = RACE_IDLE_MS,
    private readonly reservationMs: number = RESERVATION_MS,
    readonly mode: MatchMode = 'race',
  ) {
    this.activeAt = now;
  }

  get hostSeat(): RaceSeat { return this.host; }

  presentSeats(): RaceSeat[] {
    return RACE_SEATS.filter(seat => this.members[seat] !== null);
  }

  isEmpty() {
    return this.presentSeats().length === 0;
  }

  firstFreeSeat(): RaceSeat | undefined {
    return RACE_SEATS.find(seat => this.members[seat] === null);
  }

  admit(seat: RaceSeat, socketId: string, now: number) {
    this.members[seat] = {
      token: randomBytes(24).toString('base64url'),
      socketId, disconnectedAt: null, ready: false,
      truck: 'scania', name: `${this.mode === 'race' ? '车手' : '选手'} ${seat + 1}`, color: seat, reviewDone: false,
    };
    if (this.presentSeats().length === 1) this.host = seat;
    this.activeAt = now;
  }

  seatForToken(token: string): RaceSeat | undefined {
    return RACE_SEATS.find(seat => this.members[seat]?.token === token);
  }

  admission(seat: RaceSeat, now: number): RaceAdmission {
    return { room: this.view(seat, now), seat, token: this.members[seat]!.token };
  }

  reconnect(seat: RaceSeat, socketId: string, now: number) {
    const member = this.members[seat]!;
    member.socketId = socketId;
    member.disconnectedAt = null;
    this.activeAt = now;
  }

  disconnect(seat: RaceSeat, now: number) {
    const member = this.members[seat];
    if (!member) return;
    member.socketId = null;
    member.disconnectedAt = now;
    if (this.phase === 'lobby') member.ready = false;
    this.activeAt = now;
  }

  expired(now: number) {
    if (now - this.activeAt >= this.idleMs) return true;
    const present = this.presentSeats().map(seat => this.members[seat]!);
    if (present.length === 0) return true;
    return present.every(member =>
      member.disconnectedAt !== null && now - member.disconnectedAt >= this.reservationMs);
  }

  setConfig(config: RaceConfig, now: number): boolean {
    if (this.phase !== 'lobby') return false;
    let changed = false;
    if (config.course !== undefined) {
      if (!validCourse(config.course)) return false;
      if (config.course.grade !== this.course.grade || config.course.term !== this.course.term) {
        this.course = {grade:config.course.grade,term:config.course.term};
        changed=true;
      }
    }
    if (typeof config.trackId === 'string' && trackById(config.trackId).id === config.trackId && config.trackId !== this.trackId) {
      this.trackId = config.trackId;
      changed = true;
    }
    if (typeof config.startFuel === 'number' && Number.isInteger(config.startFuel)
      && config.startFuel >= 1 && config.startFuel <= FUEL_MAX && config.startFuel !== this.startFuel) {
      this.startFuel = config.startFuel;
      changed = true;
    }
    if (changed) this.resetLobby(now);
    return true;
  }

  setProfile(seat: RaceSeat, profile: RaceProfile, now: number): boolean {
    const member = this.members[seat];
    if (!member) return false;
    if (this.phase !== 'lobby') return false;
    if (isTruckId(profile.truck)) member.truck = profile.truck;
    member.name = sanitizeRaceName(profile.name, member.name);
    const color = sanitizeRaceColor(profile.color, member.color);
    const taken = this.presentSeats().some(other => other !== seat && this.members[other]!.color === color);
    if (!taken) member.color = color;
    this.activeAt = now;
    return true;
  }

  ready(seat: RaceSeat, ready: boolean, lobbyRevision: number, now: number): boolean {
    if (lobbyRevision !== this.lobbyRevision || this.phase !== 'lobby') return false;
    const member = this.members[seat];
    if (!member) return false;
    member.ready = ready;
    this.activeAt = now;
    return true;
  }

  canStart(): boolean {
    if (this.phase !== 'lobby') return false;
    const present = this.presentSeats();
    return present.length > 0 && present.every(seat => this.members[seat]!.ready);
  }

  start(now: number): boolean {
    if (!this.canStart()) return false;
    this.seatOrder = this.presentSeats();
    const seats=this.seatOrder.map(seat=>({seat,name:this.members[seat]!.name}));
    if(isWorkshopMode(this.mode)){
      this.workshop=new WorkshopMatch(this.mode,this.course,seats);
      this.activeAt=now;
      return true;
    }
    const bank=questionsFor(this.course);
    if (this.mode !== 'race') {
      this.learning = new LearningMatch(this.mode, bank, seats);
      this.activeAt = now;
      return true;
    }
    this.run = createRace({
      bank, course:this.course,
      names: this.seatOrder.map(seat => this.members[seat]!.name),
      colors: this.seatOrder.map(seat => this.members[seat]!.color),
      trackId: this.trackId,
      startFuel: this.startFuel,
      pauseAllOnQuiz: false,
    });
    for (const seat of this.seatOrder) this.members[seat]!.reviewDone = false;
    this.activeAt = now;
    return true;
  }

  workshopAction(seat:RaceSeat,action:WorkshopAction,now:number){
    if(!this.workshop?.act(seat,action)) return false;
    this.activeAt=now;
    return true;
  }
  learningAction(seat: RaceSeat, action: LearningAction, now: number) {
    if (!this.learning?.act(seat, action)) return false;
    this.activeAt = now;
    return true;
  }

  reviewList(seat: RaceSeat): RaceReviewEntry[] {
    const index = this.playerIndex(seat);
    const player = index >= 0 ? this.run?.players[index] : undefined;
    if (!player) return [];
    return player.answers
      .filter(record => !record.correct)
      .map(record => ({
        id: record.id,
        subject: record.subject,
        topic: record.topic,
        prompt: record.prompt,
        options: [...record.options],
        answer: record.answer,
        picked: record.picked,
        explain: record.explain,
        station: record.station,
      }));
  }

  markReviewed(seat: RaceSeat, now: number): boolean {
    const member = this.members[seat];
    if (!member || this.phase !== 'finished') return false;
    member.reviewDone = true;
    this.activeAt = now;
    return true;
  }

  canReplay(): boolean {
    if (this.workshop) return this.workshop.finished;
    if (this.learning) return this.learning.finished;
    if (!this.run || this.run.status !== 'finished') return false;
    return this.presentSeats().every(other => {
      if (this.reviewList(other).length === 0) return true;
      return this.members[other]?.reviewDone === true;
    });
  }

  replay(now: number): boolean {
    if (!this.canReplay()) return false;
    this.resetLobby(now);
    return true;
  }

  leave(seat: RaceSeat, now: number) {
    if (this.run && this.phase === 'playing') {
      const index = this.playerIndex(seat);
      if (index >= 0) eliminatePlayer(this.run, index);
    }
    this.workshop?.retire(seat);
    this.learning?.retire(seat);
    this.members[seat] = null;
    if (this.phase === 'lobby') {
      this.lobbyRevision++;
      const present = this.presentSeats();
      if (!present.includes(this.host)) this.host = present[0] ?? 0;
      for (const other of present) this.members[other]!.ready = false;
    }
    this.activeAt = now;
  }

  lane(seat: RaceSeat, direction: number, now: number) {
    if (this.phase !== 'playing' || !this.run) return;
    const index = this.playerIndex(seat);
    if (index >= 0 && (direction === -1 || direction === 1)) changeLane(this.run, index, direction);
    this.activeAt = now;
  }

  answer(seat: RaceSeat, option: number, now: number) {
    if (this.phase !== 'playing' || !this.run) return;
    const index = this.playerIndex(seat);
    if (index >= 0 && Number.isInteger(option) && option >= 0 && option <= 3) answerQuiz(this.run, index, option);
    this.activeAt = now;
  }

  advance(seat: RaceSeat, now: number) {
    if (this.phase !== 'playing' || !this.run) return;
    const index = this.playerIndex(seat);
    if (index >= 0) advanceQuiz(this.run, index);
    this.activeAt = now;
  }

  tick(now: number, steps: number = STEPS_PER_TICK) {
    const run = this.run;
    const sharedMatch=this.workshop ?? this.learning;
    if (sharedMatch) {
      let changed = false;
      for (const seat of this.seatOrder) {
        const away = this.members[seat]?.disconnectedAt;
        if (away != null && now - away >= this.reservationMs) changed = sharedMatch.retire(seat) || changed;
      }
      return changed;
    }
    if (!run || this.phase !== 'playing') return;
    for (const seat of this.seatOrder) {
      const member = this.members[seat];
      const index = this.playerIndex(seat);
      if (member?.disconnectedAt != null && now - member.disconnectedAt >= this.reservationMs && index >= 0) {
        eliminatePlayer(run, index);
      }
    }
    const inputs = this.seatOrder.map(() => ({ ...IDLE_INPUT }));
    for (let step = 0; step < steps; step++) stepRace(run, inputs);
    run.events.length = 0;
    this.activeAt = now;
  }

  get phase(): RacePhase {
    if (this.workshop) return this.workshop.finished ? 'finished':'playing';
    if (this.learning) return this.learning.finished ? 'finished' : 'playing';
    if (!this.run) return 'lobby';
    if (this.run.status === 'finished') return 'finished';
    return 'playing';
  }

  private playerIndex(seat: RaceSeat): number {
    return this.seatOrder.indexOf(seat);
  }

  private resetLobby(now: number) {
    this.workshop = null;
    this.learning = null;
    this.run = null;
    if (!this.members[this.host]) this.host = this.presentSeats()[0] ?? 0;
    this.seatOrder = [];
    this.lobbyRevision++;
    for (const seat of this.presentSeats()) {
      this.members[seat]!.ready = false;
      this.members[seat]!.reviewDone = false;
    }
    this.activeAt = now;
  }

  view(seat: RaceSeat, now: number): RaceRoomView {
    const run = this.run;
    const players = RACE_SEATS.map(other => {
      const member = this.members[other];
      if (!member) return null;
      const index = run ? this.playerIndex(other) : -1;
      const player = index >= 0 ? run!.players[index] : null;
      return this.playerView(other, member, player, now);
    });
    return {
      course: this.course,
      mode: this.mode,
      workshop:this.workshop?.view()??null,
      learning: this.learning?.view(seat) ?? null,
      code: this.code,
      phase: this.phase,
      trackId: this.trackId,
      startFuel: this.startFuel,
      hostSeat: this.host,
      lobbyRevision: this.lobbyRevision,
      elapsedMs: run?.elapsedMs ?? 0,
      countdownMs: run && run.status === 'countdown' ? run.countdownMs : null,
      players,
      quiz: this.quizView(seat),
      standings: this.standingsView(),
      review: this.phase === 'finished' ? this.reviewList(seat) : [],
      reviewDone: this.members[seat]?.reviewDone ?? true,
    };
  }

  private playerView(seat: RaceSeat, member: RaceMember, player: RacePlayer | null, now: number): RacePlayerView {
    return {
      seat,
      truck: member.truck,
      name: member.name,
      color: member.color,
      online: member.socketId !== null,
      ready: member.ready,
      x: player?.x ?? 0,
      lane: player?.lane ?? 1,
      lastGateCorrect: player?.lastGateCorrect ?? null,
      fuel: player?.fuel ?? this.startFuel,
      status: player?.status ?? 'racing',
      hits: player?.hits ?? 0,
      correctTotal: player?.correctTotal ?? 0,
      wrongTotal: player?.wrongTotal ?? 0,
      stationsCleared: player?.stationsCleared ?? 0,
      finishMs: player?.finishMs ?? null,
      progress: player && this.run ? raceProgress(this.run, player) : 0,
      reviewWrong: player ? player.answers.filter(record => !record.correct).length : 0,
      reviewDone: member.reviewDone,
    };
  }

  private quizView(seat: RaceSeat): RaceQuizView | null {
    const run = this.run;
    const index = this.playerIndex(seat);
    if (!run || index < 0) return null;
    const player = run.players[index];
    const quiz = player.quiz;
    if (player.status !== 'quiz' || !quiz) return null;
    const question = quiz.questions[quiz.index];
    return {
      station: quiz.station,
      index: quiz.index,
      total: quiz.questions.length,
      phase: quiz.phase,
      subject: question.subject,
      topic: question.topic,
      prompt: question.prompt,
      options: [...question.options],
      picked: quiz.picked,
      wasCorrect: quiz.wasCorrect,
      gainedFuel: quiz.gainedFuel,
      answer: quiz.phase === 'reveal' ? question.answer : null,
      explain: quiz.phase === 'reveal' ? question.explain : null,
      correct: quiz.correct,
    };
  }

  private standingsView(): RaceStandings | null {
    const run = this.run;
    if (!run || run.status !== 'finished') return null;
    const row = (player: RacePlayer): RaceResultRow => {
      const seat = this.seatOrder[run.players.indexOf(player)];
      return {
        seat,
        name: player.name,
        color: player.color,
        progress: raceProgress(run, player),
        correctTotal: player.correctTotal,
        wrongTotal: player.wrongTotal,
        hits: player.hits,
        stationsCleared: player.stationsCleared,
        finishMs: player.finishMs,
      };
    };
    const standings = raceStandings(run);
    return { finished: standings.finished.map(row), eliminated: standings.eliminated.map(row) };
  }
}