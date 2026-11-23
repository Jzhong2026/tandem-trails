import type { RaceQuestion } from '../shared/race-questions.js';
import { gradeChallenge, makeChallenges } from '../shared/learning.js';
import type {
  Challenge,
  LearningAction,
  LearningMode,
  LearningScore,
  LearningView,
} from '../shared/learning.js';

interface Player extends LearningScore {
  round: number;
  verdict: LearningView['verdict'];
}

export class LearningMatch {
  private readonly questions: Challenge[];
  private readonly players: Player[];
  private readonly helpers = new Map<number, string>();

  constructor(
    readonly mode: LearningMode,
    bank: RaceQuestion[],
    seats: { seat: number; name: string }[],
  ) {
    this.questions = makeChallenges(mode, bank);
    this.players = seats.map((player) => ({
      ...player,
      round: 0,
      score: 0,
      completed: 0,
      verdict: null,
      done: false,
      retired: false,
    }));
  }

  get finished() {
    return this.players.every((player) => player.done);
  }

  retire(seat: number) {
    const player = this.players.find((other) => other.seat === seat);
    if (player && !player.done) {
      player.done = true;
      player.retired = true;
      return true;
    }
    return false;
  }

  act(seat: number, action: LearningAction) {
    const player = this.players.find((other) => other.seat === seat);
    if (!player || player.done || !action || action.round !== player.round) return false;
    const q = this.questions[player.round];
    if (action.type === 'next' && player.verdict) {
      player.verdict = null;
      if (player.completed === this.questions.length) player.done = true;
      else player.round++;
      return true;
    }
    if (player.verdict) return false;
    if (action.type === 'hint' && !this.helpers.has(player.round)) {
      this.helpers.set(player.round, player.name);
      return true;
    }
    if (action.type !== 'submit' || !Array.isArray(action.picks)) return false;
    const picks = action.picks;
    if (
      picks.length !== q.solution.length ||
      new Set(picks).size !== picks.length ||
      !picks.every((i) => Number.isInteger(i) && i >= 0 && i < q.options.length)
    )
      return false;
    if (this.mode === 'parcel' && (picks[0] >= 4 || picks[1] < 4)) return false;
    const correct = gradeChallenge(q, picks);
    player.verdict = {
      correct,
      explanation:
        q.target !== undefined && correct
          ? `${q.options[picks[0]]} + ${q.options[picks[1]]} = ${q.target}。${q.explanation}`
          : q.explanation,
    };
    if (correct) player.score++;
    player.completed++;
    return true;
  }

  view(seat: number): LearningView | null {
    const player = this.players.find((other) => other.seat === seat);
    if (!player) return null;
    const q = this.questions[player.round];
    const helper = this.helpers.get(player.round) ?? null;
    const scores = this.players
      .map(({ seat, name, score, completed, done, retired }) => ({
        seat,
        name,
        score,
        completed,
        done,
        retired,
      }))
      .sort((a, b) => b.score - a.score || a.seat - b.seat);
    return {
      round: player.round,
      total: this.questions.length,
      prompt: q.prompt,
      options: q.options,
      hint: helper ? q.hint : null,
      helper,
      scores,
      verdict: player.verdict,
      done: player.done,
    };
  }
}
