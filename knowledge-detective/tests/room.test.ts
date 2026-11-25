import assert from 'node:assert/strict';
import test from 'node:test';
import { DetectiveRoom } from '../server/room.js';
import type { Role } from '../shared/types.js';

const CASE_ID = 'campus-broadcast';

function ready(room: DetectiveRoom, seat: 0 | 1) {
  const revision = room.view(seat, 0).revision;
  assert.equal(room.setReady(seat, true, revision, 0), true);
}

function shareAll(room: DetectiveRoom, seat: 0 | 1, role: Role) {
  const prefix = role === 'investigator' ? 'broadcast-i' : 'broadcast-a';
  for (const suffix of ['1', '2']) {
    const id = `${prefix}-${suffix}`;
    assert.equal(room.act(seat, { type: 'reveal', clueId: id }, 0), true);
    assert.equal(room.act(seat, { type: 'share', clueId: id }, 0), true);
  }
}

test('solo mode starts with one player and can switch between clue roles', () => {
  const room = new DetectiveRoom('SOLO01', 'solo', CASE_ID);
  const token = room.admit(0, '小禾', 0);
  assert.ok(token);
  ready(room, 0);
  assert.equal(room.start(0), true);

  assert.deepEqual(room.view(0, 0).game?.clues.map((clue) => clue.id), ['broadcast-i-1', 'broadcast-i-2']);
  assert.equal(room.act(0, { type: 'switch-role', role: 'analyst' }, 0), true);
  assert.deepEqual(room.view(0, 0).game?.clues.map((clue) => clue.id), ['broadcast-a-1', 'broadcast-a-2']);
});

test('duo mode requires both players to be ready before starting', () => {
  const room = new DetectiveRoom('DUO001', 'duo', CASE_ID);
  room.admit(0, '小禾', 0);
  room.admit(1, '爸爸', 0);
  ready(room, 0);

  assert.equal(room.start(0), false);
  ready(room, 1);
  assert.equal(room.start(0), true);
  assert.equal(room.view(0, 0).phase, 'playing');
});

test('duo players receive different private clues and shared evidence is visible to both', () => {
  const room = new DetectiveRoom('DUO002', 'duo', CASE_ID);
  room.admit(0, '小禾', 0);
  room.admit(1, '爸爸', 0);
  ready(room, 0);
  ready(room, 1);
  room.start(0);

  assert.deepEqual(room.view(0, 0).game?.clues.map((clue) => clue.id), ['broadcast-i-1', 'broadcast-i-2']);
  assert.deepEqual(room.view(1, 0).game?.clues.map((clue) => clue.id), ['broadcast-a-1', 'broadcast-a-2']);
  assert.equal(room.act(0, { type: 'reveal', clueId: 'broadcast-i-1' }, 0), true);
  assert.equal(room.act(0, { type: 'share', clueId: 'broadcast-i-1' }, 0), true);
  assert.deepEqual(room.view(1, 0).game?.sharedEvidence.map((clue) => clue.id), ['broadcast-i-1']);
  assert.equal(room.view(1, 0).game?.sharedEvidence[0]?.sharedBy, 'investigator');
});

test('a wrong deduction puts the whole duo room into repair without advancing', () => {
  const room = new DetectiveRoom('DUO003', 'duo', CASE_ID);
  room.admit(0, '小禾', 0);
  room.admit(1, '爸爸', 0);
  ready(room, 0);
  ready(room, 1);
  room.start(0);
  shareAll(room, 0, 'investigator');
  shareAll(room, 1, 'analyst');

  assert.equal(room.act(0, { type: 'answer', option: 0 }, 0), true);
  assert.equal(room.view(0, 0).game?.phase, 'repair');
  assert.equal(room.view(1, 0).game?.phase, 'repair');
  assert.equal(room.view(1, 0).game?.stepIndex, 0);
});

test('duo players cannot switch roles and stale ready revisions are rejected', () => {
  const room = new DetectiveRoom('DUO004', 'duo', CASE_ID);
  room.admit(0, '小禾', 0);
  room.admit(1, '爸爸', 0);
  const revision = room.view(0, 0).revision;

  assert.equal(room.setReady(0, true, revision - 1, 0), false);
  ready(room, 0);
  ready(room, 1);
  assert.equal(room.start(0), true);
  assert.equal(room.act(0, { type: 'switch-role', role: 'analyst' }, 0), false);
});

test('a connected room stays alive and sync refreshes activity', () => {
  const room = new DetectiveRoom('SOLO03', 'solo', CASE_ID, 0);
  room.admit(0, '小禾', 0);
  room.sync(31 * 60_000);
  assert.equal(room.expired(31 * 60_000 + 1), false);
});

test('a disconnected seat expires at the 90-second reservation boundary', () => {
  const room = new DetectiveRoom('SOLO04', 'solo', CASE_ID, 0);
  room.admit(0, '小禾', 0);
  room.disconnect(0, 0);
  assert.equal(room.expired(89_999), false);
  assert.equal(room.expired(90_000), true);
});

test('disconnect and reconnect preserve the seat and case progress', () => {
  const room = new DetectiveRoom('DUO005', 'duo', CASE_ID);
  const token = room.admit(0, '小禾', 0)!;
  room.admit(1, '爸爸', 0);
  ready(room, 0);
  ready(room, 1);
  room.start(0);
  room.act(0, { type: 'reveal', clueId: 'broadcast-i-1' }, 0);

  assert.equal(room.disconnect(0, 100), true);
  assert.equal(room.view(0, 100).players[0]?.connected, false);
  assert.equal(room.reconnect(0, token, 200), true);
  assert.equal(room.view(0, 200).players[0]?.connected, true);
  assert.equal(room.view(0, 200).game?.clues[0]?.revealed, true);
  assert.equal(room.reconnect(0, 'wrong-token', 300), false);
});

test('lobby reservations expire per seat and the remaining host keeps control', () => {
  const room = new DetectiveRoom('DUO007', 'duo', CASE_ID, 0);
  const oldToken = room.admit(0, '房主', 0)!;
  room.admit(1, '搭档', 0);
  room.disconnect(0, 100);
  assert.equal(room.releaseExpiredLobbySeats(90_099), false);
  assert.equal(room.freeSeat, null);
  assert.equal(room.reconnect(0, oldToken, 90_099), true);
  room.disconnect(0, 100_000);
  assert.equal(room.releaseExpiredLobbySeats(190_000), true);
  assert.equal(room.freeSeat, 0);
  assert.equal(room.hostSeat, 1);
  const replacement = room.admit(0, '新搭档', 190_001);
  assert.ok(replacement && replacement !== oldToken);
  assert.equal(room.reconnect(0, oldToken, 190_002), false);
  assert.equal(room.hostSeat, 1);
  assert.equal(room.view(1, 190_002).players[1]?.connected, true);
});

test('a third player cannot join a duo room and an unknown case cannot start', () => {
  const room = new DetectiveRoom('DUO006', 'duo', CASE_ID);
  assert.ok(room.admit(0, '小禾', 0));
  assert.ok(room.admit(1, '爸爸', 0));
  assert.equal(room.admit(0, '第三人', 0), null);

  const unknown = new DetectiveRoom('BAD001', 'solo', 'missing-case');
  assert.equal(unknown.admit(0, '小禾', 0), null);
});

test('solving the case moves the room to finished and replay returns to lobby', () => {
  const room = new DetectiveRoom('SOLO02', 'solo', CASE_ID);
  room.admit(0, '小禾', 0);
  ready(room, 0);
  room.start(0);
  shareAll(room, 0, 'investigator');
  room.act(0, { type: 'switch-role', role: 'analyst' }, 0);
  shareAll(room, 0, 'analyst');
  room.act(0, { type: 'switch-role', role: 'investigator' }, 0);

  assert.equal(room.act(0, { type: 'answer', option: 1 }, 0), true);
  assert.equal(room.act(0, { type: 'answer', option: 1 }, 0), true);
  assert.equal(room.act(0, { type: 'accuse', option: 1, evidenceIds: ['broadcast-i-2', 'broadcast-a-2'] }, 0), true);
  assert.equal(room.view(0, 0).phase, 'finished');
  assert.equal(room.replay(0), true);
  assert.equal(room.view(0, 0).phase, 'lobby');
});
