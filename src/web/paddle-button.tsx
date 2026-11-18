import { useEffect, useRef, useState } from 'react';
import { INPUT_REFRESH_MS } from '../shared/protocol.js';
import type { Seat } from '../shared/protocol.js';

interface Props {
  seat: Seat;
  enabled: boolean;
  onPaddle: (pressed: boolean) => void;
}

export function PaddleButton({ seat, enabled, onPaddle }: Props) {
  const [pressed, setPressed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const keys = useRef(false);
  const pointer = useRef<number | null>(null);
  const sent = useRef(false);

  function update() {
    const active = keys.current || pointer.current !== null;
    if (active === sent.current) return;
    sent.current = active;
    setPressed(active);
    onPaddle(active);
  }

  useEffect(() => {
    if (!enabled) {
      setPressed(false);
      return;
    }
    function keyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement
        && event.target.closest('button, input, a') && event.target !== button.current) return;
      event.preventDefault();
      keys.current = true;
      update();
    }
    function keyUp(event: KeyboardEvent) {
      if (event.code !== 'Space' || !keys.current) return;
      event.preventDefault();
      keys.current = false;
      update();
    }
    function release() {
      keys.current = false;
      pointer.current = null;
      update();
    }
    function onVisibility() {
      if (document.hidden) release();
    }
    const refresh = window.setInterval(() => {
      if (sent.current) onPaddle(true);
    }, INPUT_REFRESH_MS);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', release);
      window.removeEventListener('pagehide', release);
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [enabled, onPaddle]);

  const releasePointer = (id: number) => {
    if (pointer.current !== id) return;
    pointer.current = null;
    update();
  };

  return <button
    ref={button}
    type="button"
    aria-pressed={pressed}
    disabled={!enabled}
    className={`paddle-button ${seat}`}
    onPointerDown={event => {
      if (!enabled || event.button !== 0 || pointer.current !== null) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      update();
    }}
    onPointerUp={event => releasePointer(event.pointerId)}
    onPointerCancel={event => releasePointer(event.pointerId)}
    onLostPointerCapture={event => releasePointer(event.pointerId)}
  >按住划{seat === 'left' ? '左' : '右'}桨</button>;
}
