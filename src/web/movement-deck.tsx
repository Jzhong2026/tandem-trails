import { useCallback } from 'react';
import { MOVEMENT_ACTIONS } from '../shared/movement.js';
import type { MovementAction } from '../shared/movement.js';
import { HoldButton } from './paddle-button.js';

const controls = {
  left: { key: 'KeyA', label: '向左走' },
  right: { key: 'KeyD', label: '向右走' },
  interact: { key: 'KeyE', label: '' },
} as const;
type Input = (action: MovementAction, pressed: boolean) => void;

function MoveButton({ action, enabled, onInput, actionLabel }: {
  action: MovementAction; enabled: boolean; onInput: Input; actionLabel: string;
}) {
  const onHold = useCallback((pressed: boolean) => onInput(action, pressed), [action, onInput]);
  return <HoldButton className={`movement-button ${action}`} enabled={enabled}
    keyCode={controls[action].key} onHold={onHold} refresh={false}>
    {action === 'interact' ? actionLabel : controls[action].label}
  </HoldButton>;
}

export function MovementDeck({ enabled, onInput, actionLabel, keyLabel }: {
  enabled: boolean; onInput: Input; actionLabel: string; keyLabel: string;
}) {
  return <div className="movement-deck">
    <div className="movement-actions">
      {MOVEMENT_ACTIONS.map(action => <MoveButton key={action} action={action}
        enabled={enabled} onInput={onInput} actionLabel={actionLabel} />)}
    </div>
    <span className="keyboard-guide">键盘 <kbd>A</kbd> / <kbd>D</kbd> 移动 · <kbd>E</kbd> {keyLabel}</span>
  </div>;
}
