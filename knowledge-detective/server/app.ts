import { randomInt } from 'node:crypto';
import { resolve } from 'node:path';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { CASES } from './cases.js';
import { DetectiveRoom } from './room.js';
import type { CaseMeta, RoomAction, RoomMode, RoomView } from '../shared/types.js';

interface Binding {
  socketId: string;
  room: DetectiveRoom;
  seat: 0 | 1;
  token: string;
}

interface Admission {
  code: string;
  seat: 0 | 1;
  token: string;
  room: RoomView;
}

type Ack<T> = { ok: true; value: T } | { ok: false; error: string };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 200;
const MAX_CONNECTIONS_PER_IP = 40;
const RATE_WINDOW_MS = 10_000;
const MAX_ACTIONS_PER_WINDOW = 80;

export function createGameServer() {
  const app = express();
  const io = new SocketServer({
    maxHttpBufferSize: 100_000,
    cors: { origin: true },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      if (!origin) return callback(null, true);
      try {
        const source = new URL(origin);
        const host = request.headers.host ?? '';
        callback(null, source.host === host || source.hostname === host.split(':')[0]);
      } catch {
        callback(null, false);
      }
    },
  });
  const rooms = new Map<string, DetectiveRoom>();
  const bindings = new Map<string, Binding>();
  const seatBindings = new Map<string, Binding>();
  const connectionsByIp = new Map<string, number>();
  const actionWindows = new Map<string, { count: number; resetAt: number }>();
  const ipWindows = new Map<string, { count: number; resetAt: number }>();

  app.get('/api/cases', (_request, response) => {
    const catalog: CaseMeta[] = CASES.map(({ id, title, subtitle, subject, duration, cover, brief }) => ({
      id,
      title,
      subtitle,
      subject,
      duration,
      cover,
      brief,
    }));
    response.json(catalog);
  });
  app.get('/health', (_request, response) => response.json({ ok: true }));
  app.use('/api', (_request, response) => response.status(404).json({ ok: false, error: 'not-found' }));
  app.use(express.static(resolve('dist')));
  app.use((_request, response) => response.sendFile(resolve('dist/index.html')));

  const respond = <T>(callback: unknown, value: T) => {
    if (typeof callback === 'function') callback({ ok: true, value } satisfies Ack<T>);
  };
  const fail = (callback: unknown, error: string) => {
    if (typeof callback === 'function') callback({ ok: false, error } satisfies Ack<never>);
  };
  const bindingOf = (socket: Socket) => bindings.get(socket.id);
  const consumeWindow = (windows: Map<string, { count: number; resetAt: number }>, key: string, limit: number) => {
    const now = Date.now();
    const window = windows.get(key);
    if (!window || window.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return true;
    }
    if (window.count >= limit) return false;
    window.count++;
    return true;
  };
  const consumeAction = (socket: Socket) => {
    const ip = socket.handshake.address ?? 'unknown';
    return consumeWindow(actionWindows, socket.id, MAX_ACTIONS_PER_WINDOW) && consumeWindow(ipWindows, ip, MAX_ACTIONS_PER_WINDOW * 4);
  };
  const seatKey = (room: DetectiveRoom, seat: 0 | 1) => `${room.code}:${seat}`;
  const bind = (socket: Socket, room: DetectiveRoom, seat: 0 | 1, token: string) => {
    const key = seatKey(room, seat);
    const previous = seatBindings.get(key);
    if (previous && previous.socketId !== socket.id) {
      bindings.delete(previous.socketId);
      seatBindings.delete(key);
      io.sockets.sockets.get(previous.socketId)?.disconnect(true);
    }
    const binding: Binding = { socketId: socket.id, room, seat, token };
    bindings.set(socket.id, binding);
    seatBindings.set(key, binding);
  };
  const unbind = (socket: Socket, binding: Binding) => {
    bindings.delete(socket.id);
    const key = seatKey(binding.room, binding.seat);
    if (seatBindings.get(key)?.socketId === socket.id) seatBindings.delete(key);
  };
  const broadcast = (room: DetectiveRoom) => {
    for (const [socketId, binding] of bindings) {
      if (binding.room !== room) continue;
      const view = room.view(binding.seat, Date.now());
      if (view) io.to(socketId).emit('room:state', view);
    }
  };

  io.on('connection', (socket) => {
    const ip = socket.handshake.address ?? 'unknown';
    const connections = connectionsByIp.get(ip) ?? 0;
    if (connections >= MAX_CONNECTIONS_PER_IP) {
      socket.disconnect(true);
      return;
    }
    connectionsByIp.set(ip, connections + 1);
    socket.on('room:create', (payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      if (bindingOf(socket)) return fail(callback, 'already-in-room');
      if (rooms.size >= MAX_ROOMS) return fail(callback, 'server-busy');
      if (!payload || (payload.mode !== 'solo' && payload.mode !== 'duo')) return fail(callback, 'bad-mode');
      if (typeof payload.caseId !== 'string' || !CASES.some((item) => item.id === payload.caseId))
        return fail(callback, 'bad-case');
      if (typeof payload.name !== 'string') return fail(callback, 'bad-name');
      let code: string;
      do {
        code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      } while (rooms.has(code));
      const room = new DetectiveRoom(code, payload.mode as RoomMode, payload.caseId);
      const token = room.admit(0, payload.name, Date.now());
      if (!token) return fail(callback, 'bad-case');
      rooms.set(code, room);
      bind(socket, room, 0, token);
      const admission: Admission = { code, seat: 0, token, room: room.view(0, Date.now())! };
      respond(callback, admission);
    });

    socket.on('room:join', (payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      if (bindingOf(socket)) return fail(callback, 'already-in-room');
      if (!payload || typeof payload.code !== 'string' || typeof payload.name !== 'string')
        return fail(callback, 'bad-request');
      const room = rooms.get(payload.code.trim().toUpperCase());
      if (!room) return fail(callback, 'room-not-found');
      if (room.mode !== 'duo') return fail(callback, 'solo-room');
      const freeSeat = room.freeSeat;
      if (freeSeat === null) return fail(callback, 'room-full');
      const token = room.admit(freeSeat, payload.name, Date.now());
      if (!token) return fail(callback, 'room-full');
      bind(socket, room, freeSeat, token);
      broadcast(room);
      respond(callback, { code: room.code, seat: freeSeat, token, room: room.view(freeSeat, Date.now())! });
    });

    socket.on('room:resume', (payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      if (bindingOf(socket) || !payload || typeof payload.code !== 'string' || !Number.isInteger(payload.seat))
        return fail(callback, 'bad-request');
      const room = rooms.get(payload.code.trim().toUpperCase());
      const seat = payload.seat as 0 | 1;
      if (!room || (seat !== 0 && seat !== 1) || typeof payload.token !== 'string')
        return fail(callback, 'bad-request');
      if (!room.reconnect(seat, payload.token, Date.now())) return fail(callback, 'invalid-token');
      bind(socket, room, seat, payload.token);
      broadcast(room);
      respond(callback, room.view(seat, Date.now()));
    });

    socket.on('room:ready', (payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      const binding = bindingOf(socket);
      if (!binding || !payload || typeof payload.ready !== 'boolean' || !Number.isInteger(payload.revision))
        return fail(callback, 'bad-request');
      if (!binding.room.setReady(binding.seat, payload.ready, payload.revision, Date.now()))
        return fail(callback, 'wrong-phase-or-revision');
      broadcast(binding.room);
      respond(callback, binding.room.view(binding.seat, Date.now()));
    });

    socket.on('room:start', (_payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      const binding = bindingOf(socket);
      if (!binding || binding.seat !== binding.room.hostSeat) return fail(callback, 'host-only');
      if (!binding.room.start(Date.now())) return fail(callback, 'not-ready');
      broadcast(binding.room);
      respond(callback, binding.room.view(binding.seat, Date.now()));
    });

    socket.on('room:action', (payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      const binding = bindingOf(socket);
      if (!binding || !payload || !payload.action) return fail(callback, 'bad-request');
      if (!binding.room.act(binding.seat, payload.action as RoomAction, Date.now()))
        return fail(callback, 'invalid-action');
      broadcast(binding.room);
      respond(callback, binding.room.view(binding.seat, Date.now()));
    });

    socket.on('room:replay', (_payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      const binding = bindingOf(socket);
      if (!binding || binding.seat !== binding.room.hostSeat) return fail(callback, 'host-only');
      if (!binding.room.replay(Date.now())) return fail(callback, 'wrong-phase');
      broadcast(binding.room);
      respond(callback, binding.room.view(binding.seat, Date.now()));
    });

    socket.on('room:sync', (_payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      const binding = bindingOf(socket);
      if (!binding) return fail(callback, 'not-in-room');
      binding.room.sync(Date.now());
      respond(callback, binding.room.view(binding.seat, Date.now()));
    });

    socket.on('room:leave', (_payload, callback) => {
      if (!consumeAction(socket)) return fail(callback, 'rate-limit');
      const binding = bindingOf(socket);
      if (!binding) return fail(callback, 'not-in-room');
      binding.room.leave(binding.seat, Date.now());
      unbind(socket, binding);
      broadcast(binding.room);
      respond(callback, { left: true });
    });

    socket.on('disconnect', () => {
      actionWindows.delete(socket.id);
      const remaining = (connectionsByIp.get(ip) ?? 1) - 1;
      if (remaining <= 0) connectionsByIp.delete(ip);
      else connectionsByIp.set(ip, remaining);
      const binding = bindings.get(socket.id);
      if (!binding) return;
      unbind(socket, binding);
      binding.room.disconnect(binding.seat, Date.now());
      broadcast(binding.room);
    });
  });

  const cleanup = setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.expired(Date.now())) {
        for (const [socketId, binding] of bindings) {
          if (binding.room !== room) continue;
          bindings.delete(socketId);
          seatBindings.delete(seatKey(room, binding.seat));
          io.to(socketId).emit('room:expired');
        }
        rooms.delete(code);
      }
    }
  }, 30_000);
  cleanup.unref();

  return { app, io };
}
