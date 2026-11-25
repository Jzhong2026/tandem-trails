import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as SocketClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { createGameServer } from '../server/app.js';
import type { RoomView } from '../shared/types.js';

type Ack<T> = { ok: true; value: T } | { ok: false; error: string };

function request<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 5_000);
    socket.emit(event, payload, (response: Ack<T>) => {
      clearTimeout(timer);
      if (response.ok) resolve(response.value);
      else reject(new Error(response.error));
    });
  });
}

async function start() {
  const game = createGameServer();
  const server = createServer(game.app);
  game.io.attach(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    async close() {
      game.io.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

function connect(url: string) {
  return SocketClient(url, { transports: ['websocket'], forceNew: true });
}

test('the public case catalog exposes three playable cases without answers', async () => {
  const running = await start();
  try {
    const response = await fetch(`${running.url}/api/cases`);
    assert.equal(response.status, 200);
    const cases = await response.json();
    assert.equal(cases.length, 3);
    assert.deepEqual(cases.map((item: { id: string }) => item.id), [
      'campus-broadcast',
      'compass-lost-cup',
      'museum-timeline',
    ]);
    assert.equal('steps' in cases[0], false);
    assert.equal('clues' in cases[0], false);
  } finally {
    await running.close();
  }
});

test('a solo socket can create, ready, start, and reveal a private clue', async () => {
  const running = await start();
  const client = connect(running.url);
  try {
    const admission = await request<{ code: string; seat: 0 | 1; token: string; room: RoomView }>(
      client,
      'room:create',
      { mode: 'solo', caseId: 'campus-broadcast', name: '小禾' },
    );
    assert.equal(admission.room.mode, 'solo');
    await request(client, 'room:ready', { ready: true, revision: admission.room.revision });
    await request(client, 'room:start');
    const view = await request<RoomView>(client, 'room:action', {
      action: { type: 'reveal', clueId: 'broadcast-i-1' },
    });
    assert.equal(view.phase, 'playing');
    assert.equal(view.game?.clues[0]?.revealed, true);
    assert.equal(view.game?.clues[0]?.text?.includes('Good afternoon'), true);
  } finally {
    client.disconnect();
    await running.close();
  }
});

test('resuming a seat replaces the old socket and stale disconnect cannot freeze it', async () => {
  const running = await start();
  const first = connect(running.url);
  const second = connect(running.url);
  try {
    const admission = await request<{ code: string; seat: 0 | 1; token: string; room: RoomView }>(
      first,
      'room:create',
      { mode: 'solo', caseId: 'campus-broadcast', name: '小禾' },
    );
    await request(first, 'room:ready', { ready: true, revision: admission.room.revision });
    await request(first, 'room:start');
    await request(second, 'room:resume', {
      code: admission.code,
      seat: admission.seat,
      token: admission.token,
    });
    first.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const view = await request<RoomView>(second, 'room:sync');
    assert.equal(view.players[0]?.connected, true);
    await request(second, 'room:action', { action: { type: 'reveal', clueId: 'broadcast-i-1' } });
  } finally {
    first.disconnect();
    second.disconnect();
    await running.close();
  }
});

test('room events are rate limited across repeated requests', async () => {
  const running = await start();
  const client = connect(running.url);
  try {
    await request(client, 'room:create', { mode: 'solo', caseId: 'campus-broadcast', name: '小禾' });
    let limited = false;
    for (let index = 0; index < 100; index++) {
      try {
        await request(client, 'room:sync');
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'rate-limit') {
          limited = true;
          break;
        }
        throw cause;
      }
    }
    assert.equal(limited, true);
  } finally {
    client.disconnect();
    await running.close();
  }
});

test('an invalid resume token does not disturb the existing binding or progress', async () => {
  const running = await start();
  const first = connect(running.url);
  const second = connect(running.url);
  try {
    const admission = await request<{ code: string; seat: 0 | 1; token: string; room: RoomView }>(
      first,
      'room:create',
      { mode: 'solo', caseId: 'campus-broadcast', name: '小禾' },
    );
    await request(first, 'room:ready', { ready: true, revision: admission.room.revision });
    await request(first, 'room:start');
    await request(first, 'room:action', { action: { type: 'reveal', clueId: 'broadcast-i-1' } });
    await assert.rejects(
      () => request(second, 'room:resume', { code: admission.code, seat: admission.seat, token: 'wrong-token' }),
      /invalid-token/,
    );
    const view = await request<RoomView>(first, 'room:sync');
    assert.equal(view.players[0]?.connected, true);
    assert.equal(view.game?.clues[0]?.revealed, true);
  } finally {
    first.disconnect();
    second.disconnect();
    await running.close();
  }
});

test('two sockets receive different private clues in the same duo room', async () => {
  const running = await start();
  const host = connect(running.url);
  const guest = connect(running.url);
  try {
    const admission = await request<{ code: string; room: RoomView }>(host, 'room:create', {
      mode: 'duo',
      caseId: 'campus-broadcast',
      name: '小禾',
    });
    const joined = await request<{ seat: 0 | 1; room: RoomView }>(guest, 'room:join', {
      code: admission.code,
      name: '爸爸',
    });
    assert.equal(joined.seat, 1);
    const hostLobby = await request<RoomView>(host, 'room:sync');
    const hostReady = await request<RoomView>(host, 'room:ready', {
      ready: true,
      revision: hostLobby.revision,
    });
    const guestLobby = await request<RoomView>(guest, 'room:sync');
    await request(guest, 'room:ready', { ready: true, revision: guestLobby.revision });
    await request(host, 'room:start');
    const hostView = await request<RoomView>(host, 'room:sync');
    const guestView = await request<RoomView>(guest, 'room:sync');
    assert.deepEqual(hostView.game?.clues.map((clue) => clue.id), ['broadcast-i-1', 'broadcast-i-2']);
    assert.deepEqual(guestView.game?.clues.map((clue) => clue.id), ['broadcast-a-1', 'broadcast-a-2']);
    assert.ok(hostReady.players[0]);
  } finally {
    host.disconnect();
    guest.disconnect();
    await running.close();
  }
});
