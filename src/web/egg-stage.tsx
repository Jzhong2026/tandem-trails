import { EGG_LEVEL_TITLE, EGG_TITLE, EGG2_LEVEL_TITLE, nextGameLevel } from '../shared/game-levels.js';
import { eggSlope, eggWind } from '../shared/egg.js';
import type { EggView } from '../shared/egg.js';
import type { RoomPhase, Seat } from '../shared/protocol.js';
import type { useRoom } from './use-room.js';
import { EggCanvas } from './egg-canvas.js';
import { looksOf } from './buddy.js';
import { MovementDeck } from './movement-deck.js';
import { FinishOverlay } from './finish-overlay.js';
import { PauseOverlay } from './pause-overlay.js';

type Game = ReturnType<typeof useRoom>;

function goal(run: EggView, seat: Seat) {
  if (run.finished) return '龙蛋已经回到巢里';
  if (run.recoveryMs > 0) return '龙蛋落到软垫上了，从这里重新抬。';
  const wind = eggWind(run.x, run.level);
  if (wind) {
    if (run.raised.left && run.raised.right) return '两人扶稳了，顶风慢慢往前走';
    if (run.raised[seat]) return '你已扶稳，等队友也按住扶稳';
    return '风口来了，按住抬高按钮，和队友一起扶稳';
  }
  const other = seat === 'left' ? 'right' : 'left';
  const slope = eggSlope(run.x, run.level);
  if (!slope) {
    if (run.raised[seat] !== run.raised[other]) {
      return run.raised[seat] ? '到了平地，松开抬高按钮' : '到了平地，等队友松开抬高按钮';
    }
    return '两人同方向走，把龙蛋抬向巢穴';
  }
  if (run.tilt === 0) return '担架平了，一起稳稳地走';
  const high = slope.low === 'left' ? 'right' : 'left';
  if (run.raised[high]) {
    return seat === high ? '你这端较高，松开抬高按钮' : '等队友松开较高的一端';
  }
  return seat === slope.low ? '你这端低了，按住抬高担架' : '等队友抬高较低的一端';
}

export function EggStage({ run, phase, seat, game }: {
  run: EggView; phase: RoomPhase; seat: Seat; game: Game;
}) {
  const disabled = game.connection !== 'online' || game.busy;
  const levelTitle = run.level === 'egg2' ? EGG2_LEVEL_TITLE : EGG_LEVEL_TITLE;
  const next = nextGameLevel(run.level);
  return <section className="stage">
    <div className="stage-title">
      <div><span className="chapter">{levelTitle} · {seat === 'left' ? '左端' : '右端'}</span><h1>{EGG_TITLE}</h1></div>
      <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
    </div>
    <div className="stage-hud">
      <span aria-live="polite">{goal(run, seat)}</span>
      <label className="egg-meter">
        滑落风险 <meter aria-label="滑落风险" min={0} max={1} low={.35} high={.7} optimum={0} value={Math.abs(run.roll)} />
      </label>
    </div>
    <div className="stage-scene">
      <EggCanvas run={run} seat={seat} frozen={phase !== 'playing' || game.connection !== 'online'} looks={looksOf(game.room)} />
      {phase === 'paused' && <PauseOverlay />}
      {phase === 'finished' && <FinishOverlay level={run.level} looks={looksOf(game.room)} title="龙蛋回到巢里了！"
        summary={`用时 ${Math.floor(run.elapsedMs / 1000)} 秒 · 软垫重试 ${run.drops} 次`}>
        {next && <button className="primary" disabled={disabled} onClick={() => game.next(run.level)}>下一关</button>}
        <button className={next ? 'secondary' : 'primary'} disabled={disabled} onClick={game.replay}>再玩一次</button>
      </FinishOverlay>}
    </div>
    {phase !== 'finished' && <MovementDeck enabled={!disabled && phase === 'playing'}
      onInput={game.movementInput} actionLabel="按住抬高担架" keyLabel="抬高担架" />}
  </section>;
}