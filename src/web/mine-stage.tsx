import { MINE_LEVEL_TITLE, MINE_TITLE } from '../shared/game-levels.js';
import { minerAtExit, MINE, nearMineSwitch } from '../shared/mine.js';
import type { MineView } from '../shared/mine.js';
import type { RoomPhase, Seat } from '../shared/protocol.js';
import type { useRoom } from './use-room.js';
import { MineCanvas } from './mine-canvas.js';
import { MovementDeck } from './movement-deck.js';
import { FinishOverlay } from './finish-overlay.js';
import { PauseOverlay } from './pause-overlay.js';

type Game = ReturnType<typeof useRoom>;

function mineGoal(run: MineView, seat: Seat) {
  if (run.finished) return '两盏萤火虫灯都点亮了';
  if (run.liftProgress === 1) {
    return minerAtExit(run, seat) ? '你已到出口，等队友过来' : '沿上层路往右，一起到出口';
  }
  if (run.bridgeCrossed) {
    if (seat === 'left') {
      return run.players.left.x < MINE.lift.x ? '队友已过桥，往右走到升降台' : '停在升降台，等上层队友升起平台';
    }
    return nearMineSwitch(run.players.right.x, MINE.lift.switchX)
      ? '按住橙色开关，直到队友升上来'
      : run.players.right.x < MINE.lift.switchX ? '向右走到橙色开关旁' : '向左回到橙色开关旁';
  }
  if (seat === 'left') {
    return nearMineSwitch(run.players.left.x, MINE.bridge.switchX)
      ? '按住绿色开关，等上层队友过桥'
      : run.players.left.x < MINE.bridge.switchX ? '向右走到绿色开关旁' : '向左回到绿色开关旁';
  }
  if (run.bridgeOpen) return '桥已放下，往右走到对岸';
  return run.players.right.x < MINE.bridge.start ? '走到桥边，等下层队友放桥' : '原地等下层队友按住开关';
}

export function MineStage({ run, phase, seat, game }: {
  run: MineView;
  phase: RoomPhase;
  seat: Seat;
  game: Game;
}) {
  const disabled = game.connection !== 'online' || game.busy;
  const fireflies = Number(run.players.left.firefly) + Number(run.players.right.firefly);
  return <section className="stage">
    <div className="stage-title">
      <div><span className="chapter">{MINE_LEVEL_TITLE} · {seat === 'left' ? '下层' : '上层'}</span><h1>{MINE_TITLE}</h1></div>
      <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
    </div>
    <div className="stage-hud">
      <span aria-live="polite">{mineGoal(run, seat)}</span>
      <span className="mine-count">萤火虫 {fireflies} / 2</span>
    </div>
    <div className="stage-scene">
      <MineCanvas run={run} seat={seat} frozen={phase !== 'playing' || game.connection !== 'online'} />
      {phase === 'paused' && <PauseOverlay />}
      {phase === 'finished' && <FinishOverlay level={run.level} title="一起走出矿洞了！"
        summary={`用时 ${Math.floor(run.elapsedMs / 1000)} 秒 · 点亮两盏萤火虫灯`}>
        <button className="primary" disabled={disabled} onClick={game.replay}>再玩一次</button>
      </FinishOverlay>}
    </div>
    {phase !== 'finished' && <MovementDeck enabled={!disabled && phase === 'playing'}
      onInput={game.movementInput} actionLabel="按住操作机关" keyLabel="操作机关" />}
  </section>;
}
