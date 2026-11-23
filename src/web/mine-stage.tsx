import { MINE_LEVEL_TITLE, MINE_TITLE, MINE2_LEVEL_TITLE, nextGameLevel } from '../shared/game-levels.js';
import { minerAtExit, MINE, MINE2, nearMineSwitch } from '../shared/mine.js';
import type { MineView } from '../shared/mine.js';
import type { RoomPhase, Seat } from '../shared/protocol.js';
import type { useRoom } from './use-room.js';
import { MineCanvas } from './mine-canvas.js';
import { looksOf } from './buddy.js';
import { StoryBubble } from './story-bubble.js';
import { storyFor } from '../shared/story.js';
import { MovementDeck } from './movement-deck.js';
import { FinishOverlay } from './finish-overlay.js';
import { PauseOverlay } from './pause-overlay.js';

type Game = ReturnType<typeof useRoom>;

function mineGoal(run: MineView, seat: Seat) {
  if (run.level === 'mine2') return doubleBridgeGoal(run, seat);
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

function doubleBridgeGoal(run: MineView, seat: Seat) {
  const { bridge1, bridge2 } = MINE2;
  if (run.finished) return '两盏萤火虫灯都点亮了';
  if (run.bridge2Crossed) {
    if (minerAtExit(run, seat)) return '你已到出口，等队友过来';
    const { cart } = MINE2;
    if (seat === 'right') {
      if (run.cartX >= cart.to) return '矿车到站了，往右走到出口';
      return run.players.right.x >= cart.from - 2 ? '站在矿车上，等下层按住蓝色开关' : '向右走到矿车边';
    }
    if (!run.gateOpen && run.players.left.x >= cart.gateX - 4) return '水晶门认光：等两只萤火虫都到';
    if (!run.players.left.firefly) return '往右拿你的萤火虫，再回到蓝色开关';
    return nearMineSwitch(run.players.left.x, cart.switchX)
      ? '按住蓝色开关，送队友过矿车段'
      : run.players.left.x < cart.switchX ? '向右走到蓝色开关旁' : '向左回到蓝色开关旁';
  }
  if (run.bridgeCrossed) {
    if (seat === 'right') {
      return nearMineSwitch(run.players.right.x, bridge2.switchX)
        ? '按住橙色开关，帮下层队友过第二道桥'
        : run.players.right.x < bridge2.switchX ? '向右走到橙色开关旁' : '向左回到橙色开关旁';
    }
    if (run.bridge2Open) return '第二道桥放下了，往右过桥';
    return run.players.left.x < bridge2.start ? '向右走到第二道桥边，等上层队友放桥' : '原地等上层队友按住开关';
  }
  if (seat === 'left') {
    return nearMineSwitch(run.players.left.x, bridge1.switchX)
      ? '按住绿色开关，帮上层队友过第一道桥'
      : run.players.left.x < bridge1.switchX ? '向右走到绿色开关旁' : '向左回到绿色开关旁';
  }
  if (run.bridgeOpen) return '第一道桥放下了，往右过桥';
  return run.players.right.x < bridge1.start ? '走到第一道桥边，等下层队友放桥' : '原地等下层队友按住开关';
}

export function MineStage({ run, phase, seat, game }: {
  run: MineView;
  phase: RoomPhase;
  seat: Seat;
  game: Game;
}) {
  const disabled = game.connection !== 'online' || game.busy;
  const fireflies = Number(run.players.left.firefly) + Number(run.players.right.firefly);
  const levelTitle = run.level === 'mine2' ? MINE2_LEVEL_TITLE : MINE_LEVEL_TITLE;
  const next = nextGameLevel(run.level);
  return <section className="stage">
    <div className="stage-title">
      <div><span className="chapter">{levelTitle} · {seat === 'left' ? '下层' : '上层'}</span><h1>{MINE_TITLE}</h1></div>
      <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
    </div>
    <StoryBubble level={run.level} run={run} />
    <div className="stage-hud">
      <span aria-live="polite">{mineGoal(run, seat)}</span>
      <span className="mine-count">萤火虫 {fireflies} / 2</span>
    </div>
    <div className="stage-scene">
      <MineCanvas run={run} seat={seat} frozen={phase !== 'playing' || game.connection !== 'online'} looks={looksOf(game.room)} />
      {phase === 'paused' && <PauseOverlay />}
      {phase === 'finished' && <FinishOverlay level={run.level} looks={looksOf(game.room)} story={storyFor(run.level)} title="一起走出矿洞了！"
        summary={`用时 ${Math.floor(run.elapsedMs / 1000)} 秒 · 点亮两盏萤火虫灯`}>
        {next && <button className="primary" disabled={disabled} onClick={() => game.next(run.level)}>下一关</button>}
        <button className={next ? 'secondary' : 'primary'} disabled={disabled} onClick={game.replay}>再玩一次</button>
      </FinishOverlay>}
    </div>
    {phase !== 'finished' && <MovementDeck enabled={!disabled && phase === 'playing'}
      onInput={game.movementInput} actionLabel="按住操作机关" keyLabel="操作机关" />}
  </section>;
}