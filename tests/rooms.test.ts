import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createGameServer } from '../src/server/game-server.js';
import type { Ack, ClientEvents, ServerEvents, RoomView, Admission } from '../src/shared/protocol.js';

type Client = Socket<ServerEvents, ClientEvents>;

async function fixture(t: TestContext, reservationMs = 1_500) {
  const server = createGameServer({ reservationMs });
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
  assert.deepEqual(await outsider.timeout(1000).emitWithAck('room:ready', true), { ok: false, error: 'not-member' });
  assert.equal(accepted<RoomView>(await host.timeout(1000).emitWithAck('room:ready', true)).phase, 'lobby');
  assert.equal(accepted<RoomView>(await guest.timeout(1000).emitWithAck('room:ready', true)).phase, 'playing');

  const advance = roomWhen(host, current => (current.run?.x ?? 0) > 126);
  host.emit('game:paddle', true);
  guest.emit('game:paddle', true);
  await advance;
  const expired = await roomWhen(host, current => current.run !== null && !current.paddles[0] && !current.paddles[1]);
  const still = await roomWhen(host, current => (current.run?.elapsedMs ?? 0) > expired.run!.elapsedMs + 70);
  assert.equal(still.run?.x, expired.run?.x);

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
