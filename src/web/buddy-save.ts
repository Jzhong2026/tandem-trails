import { DEFAULT_APPEARANCE, sanitizeAppearance } from '../shared/buddy.js';
import type { Appearance } from '../shared/buddy.js';
import type { Seat } from '../shared/protocol.js';

const storageKey = 'tandem-buddy-v1';

export function loadBuddyPreference(seat: Seat): Appearance | null {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const raw = data?.[seat];
    return raw ? sanitizeAppearance(raw, DEFAULT_APPEARANCE[seat]) : null;
  } catch {
    return null;
  }
}

export function saveBuddyPreference(seat: Seat, appearance: Appearance) {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {};
    data[seat] = appearance;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    return;
  }
}