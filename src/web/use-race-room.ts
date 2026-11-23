import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Ack, RoomError, Session } from '../shared/protocol.js';
import type {
  RaceAdmission, RaceClientEvents, RaceConfig, RaceProfile, RaceRoomView, RaceSeat, RaceServerEvents,
} from '../shared/race-protocol.js';

const storageKey = 'tandem-trails.race-session';
const timeoutMs = 4500;
const errorMessage: Record<RoomError, string> = {
  'bad-code': '请检查 6 位房间码。',
  missing: '找不到这个房间。请确认房间码，或请队友重新建房。',
  full: '这个房间已经坐满四位车手了。',
  'in-room': '你已经加入另一间房间。',
  'not-member': '你已离开房间，请回到大厅。',
  expired: '房间已关闭或无法恢复，请重新建房。',
  busy: '当前房间较多，请稍后再试。',
  'wrong-phase': '房间状态已改变，请根据当前页面继续。',
  'bad-request': '操作没有通过校验，请重试。',
  'host-only': '请让房主来操作。',
  'review-pending': '请先把本局答错的题复习完，再开始下一局。',
};

function loadSession(): Session | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (typeof data?.code === 'string' && typeof data.token === 'string') return data;
  } catch {
    return null;
  }
  return null;
}

export function useRaceRoom() {
  const [socket] = useState<Socket<RaceServerEvents, RaceClientEvents>>(() => io({ autoConnect: false }));
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [room, setRoom] = useState<RaceRoomView | null>(null);
  const [seat, setSeat] = useState<RaceSeat | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef(loadSession());
  const commandPending = useRef(false);

  const saveSession = useCallback((next: Session | null) => {
    session.current = next;
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // The current tab can still reconnect with the in-memory session.
    }
  }, []);

  const admit = useCallback((value: RaceAdmission) => {
    saveSession({ code: value.room.code, token: value.token });
    setSeat(value.seat);
    setRoom(value.room);
  }, [saveSession]);

  const reset = useCallback(() => {
    saveSession(null);
    setSeat(null);
    setRoom(null);
  }, [saveSession]);

  useEffect(() => {
    socket.on('connect', async () => {
      const connectionId = socket.id;
      if (!session.current) {
        setConnection('online');
        return;
      }
      setConnection('connecting');
      try {
        const result: Ack<RaceAdmission> = await socket.timeout(timeoutMs).emitWithAck('race:resume', session.current);
        if (socket.id !== connectionId) return;
        if (result.ok) admit(result.value);
        else {
          reset();
          setError(errorMessage[result.error]);
        }
        setConnection('online');
      } catch {
        if (socket.id === connectionId) setConnection('offline');
      }
    });
    socket.on('connect_error', () => setConnection('offline'));
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('race:view', next => {
      if (session.current?.code !== next.code) return;
      setRoom(next);
    });
    socket.on('race:closed', reason => {
      if (!session.current) return;
      reset();
      setError(reason === 'left' ? '有车手结束了房间。'
        : reason === 'replaced' ? '这一席位已在另一个页面恢复。' : errorMessage.expired);
    });
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket, admit, reset]);

  async function command<T>(send: () => Promise<Ack<T>>, success: (value: T) => void) {
    if (!socket.connected || connection !== 'online' || commandPending.current) return;
    commandPending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await send();
      if (result.ok) success(result.value);
      else setError(errorMessage[result.error]);
    } catch {
      setError('操作暂时没有收到确认。请检查连接后再试。');
    } finally {
      commandPending.current = false;
      setBusy(false);
    }
  }

  return {
    room, seat, connection, error, busy,
    retry: () => {
      setConnection('connecting');
      socket.disconnect().connect();
    },
    create: () => command<RaceAdmission>(() => socket.timeout(timeoutMs).emitWithAck('race:create'), admit),
    join: (code: string) => command<RaceAdmission>(() => socket.timeout(timeoutMs).emitWithAck('race:join', code), admit),
    leave: () => command<null>(() => socket.timeout(timeoutMs).emitWithAck('race:leave'), reset),
    config: (config: RaceConfig) => command<RaceRoomView>(() => socket.timeout(timeoutMs).emitWithAck('race:config', config), setRoom),
    profile: (profile: RaceProfile) => command<RaceRoomView>(() => socket.timeout(timeoutMs).emitWithAck('race:profile', profile), setRoom),
    ready: (ready: boolean, lobbyRevision: number) => command<RaceRoomView>(() =>
      socket.timeout(timeoutMs).emitWithAck('race:ready', ready, lobbyRevision), setRoom),
    start: () => command<RaceRoomView>(() => socket.timeout(timeoutMs).emitWithAck('race:start'), setRoom),
    replay: () => command<RaceRoomView>(() => socket.timeout(timeoutMs).emitWithAck('race:replay'), setRoom),
    reviewDone: () => command<RaceRoomView>(() =>
      socket.timeout(timeoutMs).emitWithAck('race:review-done'), setRoom),
    lane: (direction: number) => {
      if (socket.connected) socket.volatile.emit('race:lane', direction);
    },
    answer: (option: number) => {
      if (socket.connected) socket.emit('race:answer', option);
    },
    advance: () => {
      if (socket.connected) socket.emit('race:advance');
    },
  };
}

export type RaceGame = ReturnType<typeof useRaceRoom>;