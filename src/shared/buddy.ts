import type { Seat } from './protocol.js';

export const BUDDY_BODIES = ['kid', 'bear', 'fox', 'penguin'] as const;
export type BuddyBody = typeof BUDDY_BODIES[number];
export const BUDDY_SIZES = ['big', 'small'] as const;
export type BuddySize = typeof BUDDY_SIZES[number];
export const BUDDY_PALETTE_COUNT = 6;
export const BUDDY_NAME_MAX = 8;

export interface Appearance {
  body: BuddyBody;
  palette: number;
  size: BuddySize;
  name: string;
}

export const BODY_DEFAULT_NAME: Record<BuddyBody, string> = {
  kid: '芽芽',
  bear: '熊墩墩',
  fox: '狐小焰',
  penguin: '企鹅波波',
};

export const DEFAULT_APPEARANCE: Record<Seat, Appearance> = {
  left: { body: 'kid', palette: 0, size: 'big', name: '芽芽' },
  right: { body: 'kid', palette: 1, size: 'small', name: '豆豆' },
};

export function sanitizeAppearance(input: unknown, fallback: Appearance): Appearance {
  if (!input || typeof input !== 'object') return { ...fallback };
  const raw = input as Record<string, unknown>;
  const body = BUDDY_BODIES.includes(raw.body as BuddyBody) ? raw.body as BuddyBody : fallback.body;
  const size = BUDDY_SIZES.includes(raw.size as BuddySize) ? raw.size as BuddySize : fallback.size;
  const palette = typeof raw.palette === 'number' && Number.isFinite(raw.palette)
    ? Math.min(BUDDY_PALETTE_COUNT - 1, Math.max(0, Math.floor(raw.palette)))
    : fallback.palette;
  const cleaned = typeof raw.name === 'string'
    ? [...raw.name].filter(ch => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127).join('').trim()
    : '';
  const name = [...cleaned].slice(0, BUDDY_NAME_MAX).join('');
  return { body, palette, size, name: name || BODY_DEFAULT_NAME[body] };
}