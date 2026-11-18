import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Ack, Admission, ClientEvents, RoomError, RoomView, Seat, ServerEvents, Session } from '../shared/protocol.js';

const storageKey = 'tandem-trails.session';
const timeoutMs = 4500;
const errorMessage: Record<RoomError, string> = {
  'bad-code': '请检查 6 位房间码。',
  missing: '找不到这个房间。请确认房间码，或请队友重新建房。',
  full: '这个房间已经有两位玩家。',
  'in-room': '你已经加入另一间房间。',
  'not-member': '你已离开房间，请回到大厅。',
  expired: '房间已关闭或无法恢复，请重新建房。',
  busy: '当前房间较多，请稍后再试。',
  'wrong-phase': '房间状态已改变，请根据当前页面继续。',
  'bad-request': '操作没有通过校验，请重试。',
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

export function useRoom() {
  const [socket] = useState<Socket<ServerEvents, ClientEvents>>(() => io({ autoConnect: false }));
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
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

  const admit = useCallback((value: Admission) => {
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
        const result: Ack<Admission> = await socket.timeout(timeoutMs).emitWithAck('room:resume', session.current);
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
    socket.on('room:view', next => {
      if (session.current?.code === next.code) setRoom(next);
    });
    socket.on('room:closed', reason => {
      if (!session.current) return;
      reset();
      setError(reason === 'left' ? '队友结束了房间。'
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

  const paddle = useCallback((pressed: boolean) => {
    if (socket.connected) {
      if (pressed) socket.volatile.emit('game:paddle', true);
      else socket.emit('game:paddle', false);
    }
  }, [socket]);

  return {
    room, seat, connection, error, busy, paddle,
    retry: () => {
      setConnection('connecting');
      socket.disconnect().connect();
    },
    create: () => command<Admission>(() => socket.timeout(timeoutMs).emitWithAck('room:create'), admit),
    join: (code: string) => command<Admission>(() => socket.timeout(timeoutMs).emitWithAck('room:join', code), admit),
    ready: (ready: boolean) => command<RoomView>(() => socket.timeout(timeoutMs).emitWithAck('room:ready', ready), setRoom),
    replay: () => command<RoomView>(() => socket.timeout(timeoutMs).emitWithAck('room:replay'), setRoom),
    leave: () => command<null>(() => socket.timeout(timeoutMs).emitWithAck('room:leave'), reset),
  };
}
