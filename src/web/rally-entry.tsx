import './rally.css';

export function RallyHomeEntry({ onPlay }: { onPlay: () => void }) {
  return <section className="rally-entry">
    <div className="rally-entry-art" aria-hidden="true"><span>NEW</span><strong>6</strong><small>成长赛道</small></div>
    <div className="rally-entry-copy">
      <span className="rally-entry-kicker">知识赛车 · 全新单人闯关版</span>
      <h2>把知识<br /><em>开向远方</em></h2>
      <p>更真实的 3D 拉力赛道，5 款可选车辆——包含 Scania、Volvo、MAN 重卡。答对积攒氮气，答错解析重试，用错题复盘解锁下一站。</p>
      <div className="rally-entry-actions"><button className="rally-btn primary" onClick={onPlay}>进入全新知识赛车 <span aria-hidden="true">→</span></button><span className="rally-chip mint">无需联机 · 进度自动保存</span></div>
    </div>
  </section>;
}
