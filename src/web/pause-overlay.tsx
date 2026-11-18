import { RESERVATION_MS } from '../shared/protocol.js';

export function PauseOverlay() {
  return <div className="stage-overlay" role="status">
    <strong>队友掉线，等对方回来继续。</strong>
    <span>房间会保留 {RESERVATION_MS / 1000} 秒。</span>
  </div>;
}
