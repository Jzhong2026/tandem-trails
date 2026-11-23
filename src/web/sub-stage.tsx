import { nextGameLevel, SUB_LEVEL_TITLE, SUB_TITLE } from '../shared/game-levels.js';
import { SUB } from '../shared/sub.js';
import type { SubView } from '../shared/sub.js';
import type { RoomPhase, Seat } from '../shared/protocol.js';
import type { useRoom } from './use-room.js';
import { SubCanvas } from './sub-canvas.js';
import { looksOf } from './buddy.js';
import { MovementDeck } from './movement-deck.js';
import { FinishOverlay } from './finish-overlay.js';
import { PauseOverlay } from './pause-overlay.js';

type Game = ReturnType<typeof useRoom>;

function goal(run: SubView) {
  if (run.finished) return '小海马到珊瑚站了';
  if (run.recoveryMs > 0) return '碰到礁石了，从最近的浮标重新出发。';
  if (!run.bubbles[0]) return '下潜绕过第一道礁石，收集低处的气泡';
  if (!run.bubbles[1]) return '上浮绕过第二道礁石，收集高处的气泡';
  if (!run.rescued) return '穿过前面的石缝，去接小海马';
  return '小海马已上艇，开向珊瑚站';
}

export function SubStage({ run, phase, seat, game }: {
  run: SubView; phase: RoomPhase; seat: Seat; game: Game;
}) {
  const disabled = game.connection !== 'online' || game.busy;
  const next = nextGameLevel(run.level);
  const bubbles = Number(run.bubbles[0]) + Number(run.bubbles[1]);
  const progress = phase === 'finished' ? 100 : Math.min(99, Math.round(
    (run.x - SUB.start.x) / (SUB.dock.x - SUB.start.x) * 100,
  ));
  const moveLabels = seat === 'left' ? { left: '上浮', right: '下潜' } : { left: '后退', right: '前进' };
  return <section className="stage">
    <div className="stage-title">
      <div><span className="chapter">{SUB_LEVEL_TITLE} · {seat === 'left' ? '升降驾驶员' : '前进驾驶员'}</span><h1>{SUB_TITLE}</h1></div>
      <button className="text-button" disabled={disabled} onClick={game.leave}>退出房间</button>
    </div>
    <div className="stage-hud">
      <span aria-live="polite">{goal(run)}</span>
      <span className="sub-count">气泡 {bubbles} / 2{run.rescued ? ' · 小海马已上艇' : ''}</span>
    </div>
    <div className="stage-scene">
      <SubCanvas run={run} seat={seat} frozen={phase !== 'playing' || game.connection !== 'online'} looks={looksOf(game.room)} />
      {phase === 'paused' && <PauseOverlay />}
      {phase === 'finished' && <FinishOverlay level={run.level} looks={looksOf(game.room)} title="小海马到珊瑚站了！"
        summary={`用时 ${Math.floor(run.elapsedMs / 1000)} 秒 · 碰撞 ${run.collisions} 次 · 气泡 ${bubbles} / 2`}>
        {next && <button className="primary" disabled={disabled} onClick={() => game.next(run.level)}>下一关</button>}
        <button className={next ? 'secondary' : 'primary'} disabled={disabled} onClick={game.replay}>再玩一次</button>
      </FinishOverlay>}
    </div>
    {phase !== 'finished' && <MovementDeck enabled={!disabled && phase === 'playing'}
      onInput={game.movementInput} moveLabels={moveLabels} />}
  </section>;
}