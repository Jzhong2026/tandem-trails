import { traceLight, workshopPuzzle, WORKSHOP_ROUNDS } from '../shared/workshop.js';
import type { WorkshopAction, WorkshopMode, WorkshopPlayer, WorkshopView } from '../shared/workshop.js';
import type { StudyCourse } from '../shared/study.js';

export class WorkshopMatch {
  private round = 0;
  private revision = 0;
  private puzzle;
  private selection: number[] = [];
  private solved = false;
  private showHint = false;
  private message = '';
  private complete = false;
  private contributors = new Set<number>();
  private players: WorkshopPlayer[];
  constructor(
    readonly mode: WorkshopMode,
    private course: StudyCourse,
    seats: { seat: number; name: string }[],
    private variant = Math.floor(Math.random() * 120),
  ) {
    this.puzzle = workshopPuzzle(mode, course, 0, variant);
    this.players = seats.map((p) => ({ ...p, points: 0, retired: false }));
  }
  get finished() {
    return this.complete || this.players.every((p) => p.retired);
  }
  retire(seat: number) {
    const player = this.players.find((p) => p.seat === seat);
    if (!player || player.retired || this.finished) return false;
    player.retired = true;
    this.revision++;
    return true;
  }
  act(seat: number, action: WorkshopAction) {
    const player = this.players.find((p) => p.seat === seat);
    if (
      !player ||
      player.retired ||
      this.finished ||
      !action ||
      action.round !== this.round ||
      action.revision !== this.revision
    )
      return false;
    if (action.type === 'next') {
      if (!this.solved) return false;
      if (++this.round === WORKSHOP_ROUNDS) {
        this.round--;
        this.complete = true;
      } else {
        this.puzzle = workshopPuzzle(this.mode, this.course, this.round, this.variant);
        this.selection = [];
        this.solved = false;
        this.showHint = false;
        this.message = '';
        this.contributors.clear();
      }
    } else {
      if (this.solved) return false;
      if (action.type === 'hint') {
        if (this.showHint) return false;
        this.showHint = true;
      } else if (action.type === 'select') {
        if (!this.select(action.index)) return false;
        this.contributors.add(seat);
        this.message = '';
      } else if (action.type === 'move') {
        const from = action.index,
          to = action.destination;
        if (
          this.mode !== 'chronicle' ||
          typeof from !== 'number' ||
          typeof to !== 'number' ||
          !Number.isInteger(from) ||
          !Number.isInteger(to) ||
          from < 0 ||
          to < 0 ||
          from >= this.selection.length ||
          to >= this.selection.length ||
          from === to
        )
          return false;
        const [entry] = this.selection.splice(from, 1);
        this.selection.splice(to, 0, entry);
        this.contributors.add(seat);
        this.message = '';
      } else if (action.type === 'undo' || action.type === 'clear') {
        if (!this.selection.length) return false;
        if (action.type === 'undo') this.selection.pop();
        else this.selection = [];
        this.message = '';
      } else if (action.type === 'test') {
        const board = this.puzzle.board;
        if (board.kind !== 'optics' && this.selection.length !== this.puzzle.answer.length) return false;
        const right =
          board.kind === 'optics'
            ? traceLight(board).lit
            : this.selection.every((v, i) => v === this.puzzle.answer[i]);
        if (right) {
          this.solved = true;
          this.message = this.puzzle.explanation;
          this.contributors.add(seat);
          for (const p of this.players) if (!p.retired && this.contributors.has(p.seat)) p.points++;
          player.points++;
        } else {
          this.message =
            board.kind === 'optics'
              ? '光束还没有到达水晶。找一找最先偏离目标的镜片。'
              : board.kind === 'atlas'
                ? '这里还没有宝箱。从灯塔重新读一次方向和格数。'
                : '展签还需要调整。可以撤回最后一件，或清空重排。';
        }
      } else return false;
    }
    this.revision++;
    return true;
  }
  private select(index: number | undefined) {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return false;
    const board = this.puzzle.board;
    if (board.kind === 'optics') {
      const mirror = board.mirrors.find((m) => m.cell === index);
      if (!mirror) return false;
      mirror.slash = !mirror.slash;
    } else if (board.kind === 'atlas') {
      if (index >= board.size ** 2 || this.selection[0] === index) return false;
      this.selection = [index];
    } else {
      if (index >= board.cards.length || this.selection.includes(index)) return false;
      this.selection.push(index);
    }
    return true;
  }
  view(): WorkshopView {
    return {
      board: this.puzzle.board,
      title: this.puzzle.title,
      prompt: this.puzzle.prompt,
      round: this.round,
      revision: this.revision,
      solved: this.solved,
      finished: this.finished,
      selection: [...this.selection],
      hint: this.showHint ? this.puzzle.hint : null,
      message: this.message,
      players: this.players.map((p) => ({ ...p })),
    };
  }
}
