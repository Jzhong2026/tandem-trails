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
type MoveLabels = { left: string; right: string };

function MoveButton({ action, enabled, onInput, actionLabel, moveLabels }: {
  action: MovementAction; enabled: boolean; onInput: Input; actionLabel?: string; moveLabels?: MoveLabels;
}) {
  const onHold = useCallback((pressed: boolean) => onInput(action, pressed), [action, onInput]);
  const label = action === 'interact' ? actionLabel : moveLabels?.[action] ?? controls[action].label;
  return <HoldButton className={`movement-button ${action}`} enabled={enabled}
    keyCode={controls[action].key} onHold={onHold} refresh={false}>
    {label}
  </HoldButton>;
}

export function MovementDeck({ enabled, onInput, actionLabel, keyLabel, moveLabels }: {
  enabled: boolean; onInput: Input; actionLabel?: string; keyLabel?: string; moveLabels?: MoveLabels;
}) {
  const actions = actionLabel ? MOVEMENT_ACTIONS : MOVEMENT_ACTIONS.filter(action => action !== 'interact');
  return <div className="movement-deck">
    <div className="movement-actions">
      {actions.map(action => <MoveButton key={action} action={action}
        enabled={enabled} onInput={onInput} actionLabel={actionLabel} moveLabels={moveLabels} />)}
    </div>
    <span className="keyboard-guide">键盘 <kbd>A</kbd> / <kbd>D</kbd> 移动{keyLabel && <> · <kbd>E</kbd> {keyLabel}</>}</span>
  </div>;
}