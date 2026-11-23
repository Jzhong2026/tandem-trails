import { randomInt } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import {
  normalizeRoomCode, validRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, RESERVATION_MS, SEATS,
} from '../shared/protocol.js';
import type { ClientEvents, ClosedReason, Respond, RoomError, RoomView, Seat, ServerEvents } from '../shared/protocol.js';
import { GAME_TICK_MS, isGameLevel } from '../shared/game-levels.js';
import { isMovementInput } from '../shared/movement.js';
import { Room, ROOM_IDLE_MS } from './room.js';
import { RaceRoom, RACE_IDLE_MS } from './race-room.js';
import { RACE_SEATS } from '../shared/race-protocol.js';
import type {
  RaceClientEvents, RaceConfig, RaceProfile, RaceRespond, RaceRoomView, RaceSeat, RaceServerEvents,
} from '../shared/race-protocol.js';

interface Membership {
  code: string;
  seat: Seat;
}

interface RaceMembership {
  code: string;
  seat: RaceSeat;
}

interface ConnectionData {
  membership?: Membership;
  raceMembership?: RaceMembership;
}

type GameSocket = Socket<ClientEvents & RaceClientEvents, ServerEvents & RaceServerEvents, Record<never, never>, ConnectionData>;

interface ServerOptions {
  webDirectory?: string;
  reservationMs?: number;
  maxRooms?: number;
  idleMs?: number;
}

export function createGameServer({
  webDirectory, reservationMs = RESERVATION_MS, maxRooms = 500, idleMs = ROOM_IDLE_MS,
}: ServerOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  if (webDirectory) app.use(express.static(webDirectory));
  const http = createServer(app);
  const io = new Server<ClientEvents & RaceClientEvents, ServerEvents & RaceServerEvents, Record<never, never>, ConnectionData>(http, {
    maxHttpBufferSize: 4096,
    pingInterval: 5000,
    pingTimeout: 5000,
    allowRequest: (request, done) => {
      const origin = request.headers.origin;
      const parsed = origin ? URL.parse(origin) : null;
      done(null, !origin || parsed?.host === request.headers.host);
    },
  });
  const rooms = new Map<string, Room>();
  const raceRooms = new Map<string, RaceRoom>();
  let tickNumber = 0;

  function broadcast(room: Room, now: number, volatile = false) {
    for (const seat of SEATS) {
      const socketId = room.members[seat]?.socketId;
      const socket = socketId ? io.sockets.sockets.get(socketId) : undefined;
      if (socket) (volatile ? socket.volatile : socket).emit('room:view', room.view(seat, now));
    }
  }

  function closeRoom(room: Room, reason: ClosedReason) {
    rooms.delete(room.code);
    io.to(room.code).emit('room:closed', reason);
    io.in(room.code).socketsLeave(room.code);
    for (const member of Object.values(room.members)) {
      const socket = member?.socketId && io.sockets.sockets.get(member.socketId);
      if (socket) delete socket.data.membership;
    }
  }

  function openRoom(code: string, now: number) {
    const room = rooms.get(code);
    if (room?.expired(now, reservationMs)) {
      closeRoom(room, 'expired');
      return;
    }
    return room;
  }

  function memberOf(socket: GameSocket, now: number) {
    const membership = socket.data.membership;
    if (!membership) return;
    const room = openRoom(membership.code, now);
    if (room?.members[membership.seat]?.socketId === socket.id) {
      return { room, seat: membership.seat };
    }
  }

  function bind(socket: GameSocket, room: Room, seat: Seat) {
    socket.data.membership = { code: room.code, seat };
    socket.join(room.code);
  }

  const raceKey = (code: string) => `race:${code}`;

  function broadcastRace(room: RaceRoom, now: number, volatile = false) {
    for (const seat of room.presentSeats()) {
      const socketId = room.members[seat]?.socketId;
      const socket = socketId ? io.sockets.sockets.get(socketId) : undefined;
      if (socket) (volatile ? socket.volatile : socket).emit('race:view', room.view(seat, now));
    }
  }

  function closeRaceRoom(room: RaceRoom, reason: ClosedReason) {
    raceRooms.delete(room.code);
    io.to(raceKey(room.code)).emit('race:closed', reason);
    io.in(raceKey(room.code)).socketsLeave(raceKey(room.code));
    for (const member of room.members) {
      const socket = member?.socketId && io.sockets.sockets.get(member.socketId);
      if (socket) delete socket.data.raceMembership;
    }
  }

  function raceMemberOf(socket: GameSocket, now: number) {
    const membership = socket.data.raceMembership;
    if (!membership) return;
    const room = raceRooms.get(membership.code);
    if (!room) return;
    if (room.expired(now)) {
      closeRaceRoom(room, 'expired');
      return;
    }
    if (room.members[membership.seat]?.socketId === socket.id) {
      return { room, seat: membership.seat };
    }
  }

  function bindRace(socket: GameSocket, room: RaceRoom, seat: RaceSeat) {
    socket.data.raceMembership = { code: room.code, seat };
    socket.join(raceKey(room.code));
  }

  const clock = setInterval(() => {
    const now = performance.now();
    tickNumber++;
    for (const room of rooms.values()) {
      if (room.expired(now, reservationMs)) {
        closeRoom(room, 'expired');
      } else if (room.phase === 'playing') {
        room.tick(now);
        if (room.phase === 'playing') {
          if (tickNumber % 2 === 0) broadcast(room, now, true);
        } else {
          broadcast(room, now);
        }
      }
    }
    for (const room of raceRooms.values()) {
      if (room.expired(now)) {
        closeRaceRoom(room, 'expired');
      } else if (room.phase === 'playing') {
        room.tick(now);
        if (room.phase === 'playing') {
          if (tickNumber % 2 === 0) broadcastRace(room, now, true);
        } else {
          broadcastRace(room, now);
        }
      }
    }
  }, GAME_TICK_MS);
  clock.unref();

  io.on('connection', socket => {
    function updateRoom(
      respond: Respond<RoomView>,
      change: (room: Room, seat: Seat, now: number) => RoomError | null,
    ) {
      if (typeof respond !== 'function') return;
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (!membership) return respond({ ok: false, error: 'not-member' });
      const { room, seat } = membership;
      const error = change(room, seat, now);
      if (error) return respond({ ok: false, error });
      respond({ ok: true, value: room.view(seat, now) });
      broadcast(room, now);
    }

    socket.on('room:create', respond => {
      if (typeof respond !== 'function') return;
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (membership) return respond({ ok: true, value: membership.room.admission(membership.seat, now) });
      if (rooms.size >= maxRooms) return respond({ ok: false, error: 'busy' });
      let code: string;
      do {
        code = Array.from({ length: ROOM_CODE_LENGTH },
          () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
      } while (rooms.has(code));
      const room = new Room(code, now, idleMs);
      rooms.set(code, room);
      room.admit('left', socket.id, now);
      bind(socket, room, 'left');
      respond({ ok: true, value: room.admission('left', now) });
    });

    socket.on('room:join', (input, respond) => {
      if (typeof respond !== 'function') return;
      const code = typeof input === 'string' ? normalizeRoomCode(input) : '';
      if (!validRoomCode(code)) return respond({ ok: false, error: 'bad-code' });
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (membership) {
        return respond(membership.room.code === code
          ? { ok: true, value: membership.room.admission(membership.seat, now) }
          : { ok: false, error: 'in-room' });
      }
      const room = openRoom(code, now);
      if (!room) return respond({ ok: false, error: 'missing' });
      if (room.members.right) return respond({ ok: false, error: 'full' });
      room.admit('right', socket.id, now);
      bind(socket, room, 'right');
      respond({ ok: true, value: room.admission('right', now) });
      broadcast(room, now);
    });

    socket.on('room:resume', (session, respond) => {
      if (typeof respond !== 'function') return;
      if (!session || typeof session.code !== 'string' || typeof session.token !== 'string') {
        return respond({ ok: false, error: 'bad-request' });
      }
      const now = performance.now();
      const room = openRoom(session.code, now);
      const seat = room?.seatForToken(session.token);
      if (!room || !seat) return respond({ ok: false, error: 'expired' });
      const membership = memberOf(socket, now);
      if (membership && (membership.room !== room || membership.seat !== seat)) {
        return respond({ ok: false, error: 'in-room' });
      }
      const previous = room.members[seat]?.socketId;
      if (previous && previous !== socket.id) {
        const oldSocket = io.sockets.sockets.get(previous);
        if (oldSocket) {
          delete oldSocket.data.membership;
          oldSocket.leave(room.code);
          oldSocket.emit('room:closed', 'replaced');
        }
      }
      room.reconnect(seat, socket.id, now);
      bind(socket, room, seat);
      respond({ ok: true, value: room.admission(seat, now) });
      broadcast(room, now);
    });

    socket.on('room:select-level', (level, respond) => {
      updateRoom(respond, (room, seat, now) => {
        if (!isGameLevel(level)) return 'bad-request';
        if (seat !== 'left') return 'host-only';
        return room.selectLevel(level, now) ? null : 'wrong-phase';
      });
    });

    socket.on('room:ready', (ready, lobbyRevision, respond) => {
      updateRoom(respond, (room, seat, now) => {
        if (typeof ready !== 'boolean' || !Number.isSafeInteger(lobbyRevision)) return 'bad-request';
        return room.ready(seat, ready, lobbyRevision, now) ? null : 'wrong-phase';
      });
    });

    socket.on('room:replay', respond => {
      updateRoom(respond, (room, _seat, now) => room.replay(now) ? null : 'wrong-phase');
    });

    socket.on('room:next', (level, respond) => {
      updateRoom(respond, (room, _seat, now) => {
        if (!isGameLevel(level)) return 'bad-request';
        return room.advance(level, now) ? null : 'wrong-phase';
      });
    });

    socket.on('game:share-clue', respond => {
      updateRoom(respond, (room, seat, now) => room.shareClue(seat, now) ? null : 'wrong-phase');
    });

    socket.on('room:appearance', (appearance, respond) => {
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (!membership) {
        if (typeof respond === 'function') respond({ ok: false, error: 'not-member' });
        return;
      }
      membership.room.setAppearance(membership.seat, appearance, now);
      if (typeof respond === 'function') {
        respond({ ok: true, value: membership.room.view(membership.seat, now) });
      }
      broadcast(membership.room, now);
    });

    socket.on('room:leave', respond => {
      if (typeof respond !== 'function') return;
      const membership = memberOf(socket, performance.now());
      respond({ ok: true, value: null });
      if (membership) closeRoom(membership.room, 'left');
    });

    socket.on('game:paddle', pressed => {
      if (typeof pressed !== 'boolean') return;
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (membership) membership.room.paddle(membership.seat, pressed, now);
    });

    socket.on('game:movement', controls => {
      if (!isMovementInput(controls)) return;
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (membership) membership.room.movementInput(membership.seat, controls, now);
    });

    function updateRaceRoom(
      respond: RaceRespond<RaceRoomView>,
      change: (room: RaceRoom, seat: RaceSeat, now: number) => RoomError | null,
    ) {
      if (typeof respond !== 'function') return;
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      if (!membership) return respond({ ok: false, error: 'not-member' });
      const { room, seat } = membership;
      const error = change(room, seat, now);
      if (error) return respond({ ok: false, error });
      respond({ ok: true, value: room.view(seat, now) });
      broadcastRace(room, now);
    }

    socket.on('race:create', respond => {
      if (typeof respond !== 'function') return;
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      if (membership) return respond({ ok: true, value: membership.room.admission(membership.seat, now) });
      if (raceRooms.size >= maxRooms) return respond({ ok: false, error: 'busy' });
      let code: string;
      do {
        code = Array.from({ length: ROOM_CODE_LENGTH },
          () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
      } while (raceRooms.has(code) || rooms.has(code));
      const room = new RaceRoom(code, now, idleMs, reservationMs);
      raceRooms.set(code, room);
      const seat = room.firstFreeSeat()!;
      room.admit(seat, socket.id, now);
      bindRace(socket, room, seat);
      respond({ ok: true, value: room.admission(seat, now) });
    });

    socket.on('race:join', (input, respond) => {
      if (typeof respond !== 'function') return;
      const code = typeof input === 'string' ? normalizeRoomCode(input) : '';
      if (!validRoomCode(code)) return respond({ ok: false, error: 'bad-code' });
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      if (membership) {
        return respond(membership.room.code === code
          ? { ok: true, value: membership.room.admission(membership.seat, now) }
          : { ok: false, error: 'in-room' });
      }
      const room = raceRooms.get(code);
      if (!room || room.expired(now)) {
        if (room) closeRaceRoom(room, 'expired');
        return respond({ ok: false, error: 'missing' });
      }
      if (room.phase !== 'lobby') return respond({ ok: false, error: 'wrong-phase' });
      const seat = room.firstFreeSeat();
      if (seat === undefined) return respond({ ok: false, error: 'full' });
      room.admit(seat, socket.id, now);
      bindRace(socket, room, seat);
      respond({ ok: true, value: room.admission(seat, now) });
      broadcastRace(room, now);
    });

    socket.on('race:resume', (session, respond) => {
      if (typeof respond !== 'function') return;
      if (!session || typeof session.code !== 'string' || typeof session.token !== 'string') {
        return respond({ ok: false, error: 'bad-request' });
      }
      const now = performance.now();
      const room = raceRooms.get(session.code);
      const seat = room?.seatForToken(session.token);
      if (!room || seat === undefined) return respond({ ok: false, error: 'expired' });
      const membership = raceMemberOf(socket, now);
      if (membership && (membership.room !== room || membership.seat !== seat)) {
        return respond({ ok: false, error: 'in-room' });
      }
      const previous = room.members[seat]?.socketId;
      if (previous && previous !== socket.id) {
        const oldSocket = io.sockets.sockets.get(previous);
        if (oldSocket) {
          delete oldSocket.data.raceMembership;
          oldSocket.leave(raceKey(room.code));
          oldSocket.emit('race:closed', 'replaced');
        }
      }
      room.reconnect(seat, socket.id, now);
      bindRace(socket, room, seat);
      respond({ ok: true, value: room.admission(seat, now) });
      broadcastRace(room, now);
    });

    socket.on('race:config', (config, respond) => {
      updateRaceRoom(respond, (room, seat, now) => {
        if (seat !== room.hostSeat) return 'host-only';
        if (!config || typeof config !== 'object') return 'bad-request';
        return room.setConfig(config as RaceConfig, now) ? null : 'wrong-phase';
      });
    });

    socket.on('race:profile', (profile, respond) => {
      updateRaceRoom(respond, (room, seat, now) => {
        if (!profile || typeof profile !== 'object') return 'bad-request';
        return room.setProfile(seat, profile as RaceProfile, now) ? null : 'wrong-phase';
      });
    });

    socket.on('race:ready', (ready, lobbyRevision, respond) => {
      updateRaceRoom(respond, (room, seat, now) => {
        if (typeof ready !== 'boolean' || !Number.isSafeInteger(lobbyRevision)) return 'bad-request';
        return room.ready(seat, ready, lobbyRevision, now) ? null : 'wrong-phase';
      });
    });

    socket.on('race:start', respond => {
      updateRaceRoom(respond, (room, seat, now) => {
        if (seat !== room.hostSeat) return 'host-only';
        return room.start(now) ? null : 'wrong-phase';
      });
    });

    socket.on('race:replay', respond => {
      updateRaceRoom(respond, (room, _seat, now) => room.replay(now) ? null : 'wrong-phase');
    });

    socket.on('race:leave', respond => {
      if (typeof respond !== 'function') return;
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      respond({ ok: true, value: null });
      if (!membership) return;
      const { room, seat } = membership;
      delete socket.data.raceMembership;
      socket.leave(raceKey(room.code));
      room.leave(seat, now);
      if (room.isEmpty()) closeRaceRoom(room, 'left');
      else broadcastRace(room, now);
    });

    socket.on('race:lane', direction => {
      if (typeof direction !== 'number') return;
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      if (membership) membership.room.lane(membership.seat, direction, now);
    });

    socket.on('race:answer', option => {
      if (typeof option !== 'number') return;
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      if (!membership) return;
      membership.room.answer(membership.seat, option, now);
      broadcastRace(membership.room, now);
    });

    socket.on('race:advance', () => {
      const now = performance.now();
      const membership = raceMemberOf(socket, now);
      if (!membership) return;
      membership.room.advance(membership.seat, now);
      broadcastRace(membership.room, now);
    });

    socket.on('disconnect', () => {
      const now = performance.now();
      const membership = memberOf(socket, now);
      if (membership) {
        membership.room.disconnect(membership.seat, now);
        broadcast(membership.room, now);
      }
      const raceMembership = raceMemberOf(socket, now);
      if (raceMembership) {
        raceMembership.room.disconnect(raceMembership.seat, now);
        broadcastRace(raceMembership.room, now);
      }
    });
  });

  return {
    http,
    async close() {
      clearInterval(clock);
      await io.close();
    },
  };
}
