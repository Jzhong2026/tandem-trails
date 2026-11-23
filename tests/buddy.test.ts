import assert from 'node:assert/strict';
import test from 'node:test';
import { BODY_DEFAULT_NAME, BUDDY_NAME_MAX, DEFAULT_APPEARANCE, sanitizeAppearance } from '../src/shared/buddy.js';

const base = DEFAULT_APPEARANCE.left;
const bell = String.fromCharCode(7);
const nul = String.fromCharCode(0);

test('sanitize keeps a valid appearance unchanged', () => {
  const input = { body: 'fox', palette: 3, size: 'small', name: '小焰' };
  assert.deepEqual(sanitizeAppearance(input, base), input);
});

test('sanitize falls back per field on invalid values', () => {
  assert.deepEqual(sanitizeAppearance({ body: 'dragon', palette: 'x', size: 'huge', name: 42 }, base), base);
  assert.equal(sanitizeAppearance({ palette: -4 }, base).palette, 0);
  assert.equal(sanitizeAppearance({ palette: 99 }, base).palette, 5);
  assert.equal(sanitizeAppearance({ palette: 2.9 }, base).palette, 2);
  assert.equal(sanitizeAppearance({ palette: Number.NaN }, base).palette, base.palette);
  assert.deepEqual(sanitizeAppearance(null, base), base);
  assert.deepEqual(sanitizeAppearance('bear', base), base);
});

test('sanitize trims, strips control characters and caps name length', () => {
  const result = sanitizeAppearance({ name: '  熊' + bell + '墩' + nul + '  ' }, base);
  assert.equal(result.name, '熊墩');
  const long = sanitizeAppearance({ name: '一二三四五六七八九十' }, base);
  assert.equal([...long.name].length, BUDDY_NAME_MAX);
  assert.equal(long.name, '一二三四五六七八');
});

test('empty name falls back to the body default name', () => {
  assert.equal(sanitizeAppearance({ body: 'penguin', name: '   ' }, base).name, BODY_DEFAULT_NAME.penguin);
  assert.equal(sanitizeAppearance({ body: 'bear' }, base).name, BODY_DEFAULT_NAME.bear);
});

test('default appearances differ per seat and stay inside the palette range', () => {
  assert.equal(DEFAULT_APPEARANCE.left.size, 'big');
  assert.equal(DEFAULT_APPEARANCE.right.size, 'small');
  assert.notEqual(DEFAULT_APPEARANCE.left.palette, DEFAULT_APPEARANCE.right.palette);
});