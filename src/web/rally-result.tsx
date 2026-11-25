import type { RallyRun } from '../shared/knowledge-rally.js';

interface Props {
  run: RallyRun;
  stars: number;
  nextLevelId: string | null;
  canContinue: boolean;
  onRetry: () => void;
  onNext: (levelId: string) => void;
  onReview: () => void;
  onHome: () => void;
}

export function RallyResult({ run, stars, nextLevelId, canContinue, onRetry, onNext, onReview, onHome }: Props) {
  const crashed = run.phase === 'crashed';
  const wrong = run.answers.filter(answer => !answer.firstTryCorrect).length;
  const accuracy = run.answered ? Math.round(run.firstTryCorrect / run.answered * 100) : 0;
  return <section className="rally-result-card" aria-labelledby="rally-result-title">
    <div className="rally-result-kicker">{crashed ? '车辆需要维修' : 'STAGE COMPLETE'}</div>
    <h2 id="rally-result-title">{crashed ? '休息一下，再出发' : stars === 3 ? '冠军车手，太棒了！' : '完成挑战，继续成长！'}</h2>
    <div className="rally-result-stars" aria-label={`${stars} 颗星`}>{[0, 1, 2].map(index => <span key={index} style={{ opacity: index < stars ? 1 : 0.22 }}>★</span>)}</div>
    <p style={{ marginTop: 8, color: 'hsl(var(--rally-muted))', lineHeight: 1.7 }}>
      {crashed ? '碰撞耗尽了车辆耐久。换一辆更耐撞的卡车，或回到赛道再试一次。' : `你驾驶 ${run.vehicle.name} 完成了「${run.level.name}」，知识能量已经装进背包。`}
    </p>
    <div className="rally-result-stats">
      <div className="rally-result-stat"><b>{accuracy}%</b><span>首次答对率</span></div>
      <div className="rally-result-stat"><b>{run.bestCombo}</b><span>最高连击</span></div>
      <div className="rally-result-stat"><b>{Math.floor(run.elapsedMs / 1000)}s</b><span>驾驶用时</span></div>
      <div className="rally-result-stat"><b>{run.score}</b><span>本局积分</span></div>
    </div>
    {wrong > 0 && !crashed && <div className="rally-review-banner">有 {wrong} 道题第一次没答对。复盘后就能继续挑战下一站。<button className="rally-btn small" style={{ marginLeft: 10 }} onClick={onReview}>开始错题复盘</button></div>}
    <div className="rally-result-actions">
      <button className="rally-btn primary" onClick={onRetry}>{crashed ? '重新挑战' : '再跑一次'}</button>
      {!crashed && nextLevelId && <button className="rally-btn mint" disabled={!canContinue} onClick={() => onNext(nextLevelId)}>{canContinue ? '挑战下一站' : '复习后解锁下一站'}</button>}
      <button className="rally-btn ghost" onClick={onHome}>返回车库</button>
    </div>
  </section>;
}
