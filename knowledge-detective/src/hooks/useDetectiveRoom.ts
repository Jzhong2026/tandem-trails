import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { RoomAction, RoomMode, RoomView } from '../../shared/types.js';

interface Session {
  code: string;
  seat: 0 | 1;
  token: string;
}

interface Admission extends Session {
  room: RoomView;
}

type Ack<T> = { ok: true; value: T } | { ok: false; error: string };

const SESSION_KEY = 'detective-session-v1';
const ERROR_MESSAGES: Record<string, string> = {
  'room-not-found': '没有找到这个房间，请核对房间码。',
  'room-full': '房间已经满员。',
  'solo-room': '这是单人房间，不能加入。',
  'invalid-token': '调查凭证已失效，请重新加入。',
  'wrong-phase-or-revision': '房间状态刚刚变化，请刷新后再试。',
  'invalid-action': '当前状态不能执行这个操作。',
  'rate-limit': '操作有点快，请稍等几秒再试。',
  'server-busy': '调查服务暂时繁忙，请稍后再试。',
};

export function useDetectiveRoom() {
  const socketRef = useRef<Socket | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emit = useCallback(<T,>(event: string, payload?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        reject(new Error('还没有连上调查服务'));
        return;
      }
      const timer = setTimeout(() => reject(new Error('调查服务响应超时')), 8_000);
      socket.emit(event, payload, (response: Ack<T>) => {
        clearTimeout(timer);
        if (response.ok) resolve(response.value);
        else reject(new Error(response.error));
      });
    });
  }, []);

  const remember = useCallback((next: Session) => {
    setSession(next);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      // The current session still works when storage is unavailable.
    }
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing else to clean up.
    }
  }, []);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:state', (next: RoomView) => setView(next));
    socket.on('room:expired', () => {
      clearSession();
      setView(null);
      setError('房间已过期，请重新创建或加入。');
    });
    socket.on('connect', async () => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Session;
        if (!saved.code || !saved.token || (saved.seat !== 0 && saved.seat !== 1)) return;
        const resumed = await emit<RoomView>('room:resume', saved);
        setView(resumed);
        setSession(saved);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        if (['invalid-token', 'room-not-found', 'bad-request'].includes(message)) {
          clearSession();
          setView(null);
        } else {
          setError('暂时无法恢复调查，已保留本页进度，请稍后重试。');
        }
      }
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clearSession, emit]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(ERROR_MESSAGES[message] ?? (message || '操作失败，请再试一次'));
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(
    (mode: RoomMode, caseId: string, name: string, autoStart = false) =>
      run(async () => {
        const admission = await emit<Admission>('room:create', { mode, caseId, name });
        setView(admission.room);
        remember({ code: admission.code, seat: admission.seat, token: admission.token });
        if (autoStart && mode === 'solo') {
          await emit<RoomView>('room:ready', { ready: true, revision: admission.room.revision });
          const started = await emit<RoomView>('room:start');
          setView(started);
        }
      }),
    [emit, remember, run],
  );

  const join = useCallback(
    (code: string, name: string) =>
      run(async () => {
        const admission = await emit<Admission>('room:join', { code, name });
        setView(admission.room);
        remember({ code: admission.code, seat: admission.seat, token: admission.token });
      }),
    [emit, remember, run],
  );

  const ready = useCallback(
    (value: boolean) =>
      run(async () => {
        if (!view) return;
        const next = await emit<RoomView>('room:ready', { ready: value, revision: view.revision });
        setView(next);
      }),
    [emit, run, view],
  );

  const start = useCallback(
    () =>
      run(async () => {
        const next = await emit<RoomView>('room:start');
        setView(next);
      }),
    [emit, run],
  );

  const act = useCallback(
    (action: RoomAction) =>
      run(async () => {
        const next = await emit<RoomView>('room:action', { action });
        setView(next);
      }),
    [emit, run],
  );

  const replay = useCallback(
    () =>
      run(async () => {
        const next = await emit<RoomView>('room:replay');
        setView(next);
      }),
    [emit, run],
  );

  const leave = useCallback(
    () =>
      run(async () => {
        await emit('room:leave');
        clearSession();
        setView(null);
      }),
    [clearSession, emit, run],
  );

  return {
    view,
    session,
    connected,
    busy,
    error,
    create,
    join,
    ready,
    start,
    act,
    replay,
    leave,
    clearError: () => setError(''),
  };
}
