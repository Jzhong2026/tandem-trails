import type { Seat } from './protocol.js';

export const MOVEMENT_ACTIONS = ['left', 'right', 'interact'] as const;
export type MovementAction = typeof MOVEMENT_ACTIONS[number];
export type MovementInput = Record<MovementAction, boolean>;
export type MovementInputs = Record<Seat, MovementInput>;
export const IDLE_MOVEMENT: Readonly<MovementInput> = { left: false, right: false, interact: false };

export function isMovementInput(input: unknown): input is MovementInput {
  if (!input || typeof input !== 'object') return false;
  const controls = input as Partial<Record<MovementAction, unknown>>;
  return MOVEMENT_ACTIONS.every(action => typeof controls[action] === 'boolean');
}

export function movementDirection(input: MovementInput) {
  return Number(input.right) - Number(input.left);
}
