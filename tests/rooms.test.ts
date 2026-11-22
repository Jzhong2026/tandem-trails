import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createGameServer } from '../src/server/game-server.js';
import type { GameLevel } from '../src/shared/game-levels.js';
import type { Ack, ClientEvents, ServerEvents, RoomView, Admission } from '../src/shared/protocol.js';

type Client = Socket<ServerEvents, ClientEvents>;

async function fixture(t: TestContext, reservationMs = 1_500, idleMs?: number) {
  const server = createGameServer({ reservationMs, idleMs });
  server.http.listen(0, '127.0.0.1');
  await once(server.http, 'listening');
  const address = server.http.address();
  assert.ok(address && typeof address === 'object');
  const clients: Client[] = [];
  t.after(async () => {
    clients.forEach(client => client.disconnect());
    await server.close();
  });
  return async () => {
    const socket: Client = io(`http://127.0.0.1:${address.port}`, {
      transports: ['websocket'], reconnection: false, forceNew: true,
    });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };
}

function accepted<T>(result: Ack<T>): T {
  assert.ok(result.ok, JSON.stringify(result));
  return result.value;
}

function roomWhen(client: Client, condition: (event: RoomView) => boolean) {
  return new Promise<RoomView>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off('room:view', match);
      reject(new Error('Timed out waiting for room update'));
    }, 2500);
    function match(event: RoomView) {
      if (!condition(event)) return;
      clearTimeout(timeout);
      client.off('room:view', match);
      resolve(event);
    }
    client.on('room:view', match);
  });
}

async function create(client: Client): Promise<Admission> {
  return accepted(await client.timeout(1000).emitWithAck('room:create'));
}

test('two seats, idempotent admission and isolated rooms', async t => {
  const connect = await fixture(t);
  const [host, guest, outsider] = await Promise.all([connect(), connect(), connect()]);
  const first = await create(host);
  assert.equal((await create(host)).token, first.token);
  const second = accepted<Admission>(await guest.timeout(1000).emitWithAck('room:join', first.room.code.toLowerCase()));
  assert.equal(second.seat, 'right');
  assert.notEqual(second.token, first.token);
  assert.deepEqual(await outsider.timeout(1000).emitWithAck('room:join', first.room.code), { ok: false, error: 'full' });
  const independent = await create(outsider);
  assert.notEqual(first.room.code, independent.room.code);
  assert.equal(independent.room.players.right, null);
});

test('only admitted players can start, input leases expire and a returning player resumes the frozen run', async t => {
  const connect = await fixture(t);
  const [host, guest, outsider] = await Promise.all([connect(), connect(), connect()]);
  const first = await create(host);
  const second = accepted<Admission>(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  const bend = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'bend'));
  const revision = bend.lobbyRevision;
  assert.deepEqual(await outsider.timeout(1000).emitWithAck('room:ready', true, revision), { ok: false, error: 'not-member' });
  assert.equal(accepted<RoomView>(await host.timeout(1000).emitWithAck('room:ready', true, revision)).phase, 'lobby');
  assert.equal(accepted<RoomView>(await guest.timeout(1000).emitWithAck('room:ready', true, revision)).phase, 'playing');

  const advance = roomWhen(host, current => current.run?.level === 'bend' && current.run.x > 126);
  host.emit('game:paddle', true);
  guest.emit('game:paddle', true);
  await advance;
  const expired = await roomWhen(host, current => current.run !== null && !current.paddles[0] && !current.paddles[1]);
  const still = await roomWhen(host, current => (current.run?.elapsedMs ?? 0) > expired.run!.elapsedMs + 70);
  assert.ok(still.run?.level === 'bend' && expired.run?.level === 'bend');
  assert.equal(still.run.x, expired.run.x);

  const pausedUpdate = roomWhen(host, current => current.phase === 'paused');
  guest.disconnect();
  const paused = await pausedUpdate;
  await delay(130);
  const reconnect = await connect();
  assert.deepEqual(await reconnect.timeout(1000).emitWithAck('room:resume', { code: first.room.code, token: 'wrong' }),
    { ok: false, error: 'expired' });
  const resumed = accepted<Admission>(await reconnect.timeout(1000).emitWithAck('room:resume', { code: first.room.code, token: second.token }));
  assert.equal(resumed.seat, 'right');
  assert.equal(resumed.room.phase, 'playing');
  assert.deepEqual(resumed.room.run, paused.run);
  assert.deepEqual(resumed.room.paddles, [false, false]);
});

test('leaving clears room membership for both players', async t => {
  const connect = await fixture(t);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  accepted(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  const closed = new Promise(resolve => guest.once('room:closed', resolve));
  accepted(await host.timeout(1000).emitWithAck('room:leave'));
  assert.equal(await closed, 'left');
  assert.equal((await create(guest)).seat, 'left');
});

test('an expired reservation closes the old room and allows a new invitation', async t => {
  const connect = await fixture(t, 250);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  const joined = accepted<Admission>(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  const closed = new Promise(resolve => host.once('room:closed', resolve));
  guest.disconnect();
  assert.equal(await closed, 'expired');
  const returning = await connect();
  assert.deepEqual(await returning.timeout(1000).emitWithAck('room:resume', {
    code: first.room.code, token: joined.token,
  }), { ok: false, error: 'expired' });
  assert.notEqual((await create(host)).room.code, first.room.code);
});

test('a room with both players online is recycled after the idle window', async t => {
  const connect = await fixture(t, 1_500, 300);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  accepted(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  const closed = new Promise(resolve => host.once('room:closed', resolve));
  assert.equal(await closed, 'expired');
  assert.deepEqual(await host.timeout(1000).emitWithAck('room:resume', {
    code: first.room.code, token: first.token,
  }), { ok: false, error: 'expired' });
});

test('lobby activity postpones idle recycling', async t => {
  const connect = await fixture(t, 1_500, 500);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  accepted(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  await delay(300);
  accepted<RoomView>(await host.timeout(1000).emitWithAck('room:ready', true, first.room.lobbyRevision));
  await delay(300);
  // Past the idle window since joining, but only 300ms since the last activity.
  accepted<RoomView>(await host.timeout(1000).emitWithAck('room:ready', false, first.room.lobbyRevision));
  const closed = new Promise(resolve => host.once('room:closed', resolve));
  assert.equal(await closed, 'expired');
});

test('only the host selects a level and changing it clears both ready states', async t => {
  const connect = await fixture(t);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  assert.equal(first.room.level, 'practice');
  await guest.timeout(1000).emitWithAck('room:join', first.room.code);
  accepted<RoomView>(await host.timeout(1000).emitWithAck('room:ready', true, first.room.lobbyRevision));
  assert.deepEqual(await guest.timeout(1000).emitWithAck('room:select-level', 'fog'),
    { ok: false, error: 'host-only' });

  const update = roomWhen(guest, current => current.level === 'fog');
  const changed = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'fog'));
  assert.equal(changed.players.left?.ready, false);
  assert.equal((await update).players.right?.ready, false);
  assert.deepEqual(await guest.timeout(1000).emitWithAck('room:ready', true, first.room.lobbyRevision),
    { ok: false, error: 'wrong-phase' });
  assert.equal(changed.clues, null);
});

test('a ready request from an earlier visit to the same level cannot start a new round', async t => {
  const connect = await fixture(t);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  await guest.timeout(1000).emitWithAck('room:join', first.room.code);
  await host.timeout(1000).emitWithAck('room:select-level', 'bend');
  const revisited = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'practice'));
  assert.equal(revisited.level, 'practice');
  assert.notEqual(revisited.lobbyRevision, first.room.lobbyRevision);
  assert.deepEqual(await guest.timeout(1000).emitWithAck('room:ready', true, first.room.lobbyRevision),
    { ok: false, error: 'wrong-phase' });
  const after = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:ready', true, revisited.lobbyRevision));
  assert.equal(after.phase, 'lobby');
  assert.equal(after.players.right?.ready, false);
});

test('a fog clue is private until its owner shares it and the other seat sees only the authorized view on resume', async t => {
  const connect = await fixture(t);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  const joined = accepted<Admission>(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  const fog = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'fog'));
  const leftUpdate = roomWhen(host, current => current.phase === 'playing');
  await host.timeout(1000).emitWithAck('room:ready', true, fog.lobbyRevision);
  const right = accepted<RoomView>(await guest.timeout(1000).emitWithAck('room:ready', true, fog.lobbyRevision));
  const left = await leftUpdate;
  assert.equal(left.clues?.own.kind, 'flag');
  assert.equal(right.clues?.own.kind, 'channel');
  assert.equal(left.clues?.channel, null);
  assert.equal(right.clues?.flag, null);
  assert.equal(Object.hasOwn(left.run!, 'fog'), false);
  assert.equal(Object.hasOwn(right.run!, 'fog'), false);
  assert.deepEqual(Object.keys(left.clues!).sort(), ['channel', 'flag', 'own']);
  assert.deepEqual(await host.timeout(1000).emitWithAck('room:select-level', 'bend'),
    { ok: false, error: 'wrong-phase' });

  const rightUpdate = roomWhen(guest, current => Boolean(current.clues?.flag));
  const shared = accepted<RoomView>(await host.timeout(1000).emitWithAck('game:share-clue'));
  const updated = await rightUpdate;
  assert.deepEqual(updated.clues?.flag, left.clues?.own.value);
  assert.equal(shared.clues?.channel, null);
  const paused = roomWhen(host, current => current.phase === 'paused');
  guest.disconnect();
  await paused;
  const reconnect = await connect();
  const resumed = accepted<Admission>(await reconnect.timeout(1000).emitWithAck('room:resume', {
    code: first.room.code, token: joined.token,
  }));
  assert.deepEqual(resumed.room.clues, updated.clues);
  assert.equal(resumed.room.phase, 'playing');
});

test('the mine uses each seat’s own controls and a returning player resumes without a held input', async t => {
  const connect = await fixture(t);
  const [host, guest, outsider] = await Promise.all([connect(), connect(), connect()]);
  const first = await create(host);
  const joined = accepted<Admission>(await guest.timeout(1000).emitWithAck('room:join', first.room.code));
  const mine = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'mine'));
  await host.timeout(1000).emitWithAck('room:ready', true, mine.lobbyRevision);
  const playing = accepted<RoomView>(await guest.timeout(1000).emitWithAck('room:ready', true, mine.lobbyRevision));
  assert.equal(playing.run?.level, 'mine');
  outsider.emit('game:movement', { left: false, right: true, interact: true });
  guest.emit('game:paddle', true);
  const moved = roomWhen(host, current => current.run?.level === 'mine' && current.run.players.left.x > 119);
  host.emit('game:movement', { left: false, right: true, interact: true });
  const active = await moved;
  assert.ok(active.run?.level === 'mine');
  assert.equal(active.run.players.right.x, 105);
  const pause = roomWhen(host, current => current.phase === 'paused');
  guest.disconnect();
  const paused = await pause;
  const returning = await connect();
  const resumed = accepted<Admission>(await returning.timeout(1000).emitWithAck('room:resume', {
    code: first.room.code, token: joined.token,
  }));
  assert.deepEqual(resumed.room.run, paused.run);
  const after = await roomWhen(host, current => (current.run?.elapsedMs ?? 0) > paused.run!.elapsedMs + 120);
  assert.ok(after.run?.level === 'mine' && paused.run?.level === 'mine');
  assert.deepEqual(after.run.players, paused.run.players);
});

test('the second chapter levels start their own run and advancing is gated on finishing', async t => {
  const connect = await fixture(t);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  await guest.timeout(1000).emitWithAck('room:join', first.room.code);
  const mine2 = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'mine2'));
  await host.timeout(1000).emitWithAck('room:ready', true, mine2.lobbyRevision);
  const playing = accepted<RoomView>(await guest.timeout(1000).emitWithAck('room:ready', true, mine2.lobbyRevision));
  assert.equal(playing.run?.level, 'mine2');
  assert.deepEqual(await host.timeout(1000).emitWithAck('room:next', 'mine2'), { ok: false, error: 'wrong-phase' });
  assert.deepEqual(await host.timeout(1000).emitWithAck('room:next', 'bogus' as GameLevel), { ok: false, error: 'bad-request' });
});

test('the submarine gives each seat its own axis and ignores paddles', async t => {
  const connect = await fixture(t);
  const [host, guest] = await Promise.all([connect(), connect()]);
  const first = await create(host);
  await guest.timeout(1000).emitWithAck('room:join', first.room.code);
  const sub = accepted<RoomView>(await host.timeout(1000).emitWithAck('room:select-level', 'sub'));
  await host.timeout(1000).emitWithAck('room:ready', true, sub.lobbyRevision);
  const playing = accepted<RoomView>(await guest.timeout(1000).emitWithAck('room:ready', true, sub.lobbyRevision));
  assert.equal(playing.run?.level, 'sub');

  guest.emit('game:paddle', true);
  const dived = roomWhen(host, current => current.run?.level === 'sub' && current.run.y > 230);
  host.emit('game:movement', { left: false, right: true, interact: false });
  const active = await dived;
  assert.ok(active.run?.level === 'sub');
  assert.equal(active.run.x, 105);

  const cruised = roomWhen(host, current => current.run?.level === 'sub' && current.run.x > 130);
  guest.emit('game:movement', { left: false, right: true, interact: false });
  const moved = await cruised;
  assert.ok(moved.run?.level === 'sub');
  assert.ok(moved.run.y > 230);
});
