import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { CaseMeta } from '../shared/types.js';
import { useDetectiveRoom } from './hooks/useDetectiveRoom.js';
import { Home } from './components/Home.js';
import { Lobby } from './components/Lobby.js';
import { GameBoard } from './components/GameBoard.js';

interface Progress {
  solved: string[];
  concepts: string[];
}

const PROGRESS_KEY = 'detective-progress-v1';

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { solved: [], concepts: [] };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      solved: Array.isArray(parsed.solved) ? parsed.solved.filter((id): id is string => typeof id === 'string') : [],
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts.filter((item): item is string => typeof item === 'string') : [],
    };
  } catch {
    return { solved: [], concepts: [] };
  }
}

export default function App() {
  const room = useDetectiveRoom();
  const [cases, setCases] = useState<CaseMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const progress = loadProgress();

  useEffect(() => {
    fetch('/api/cases')
      .then((response) => response.json())
      .then((items: CaseMeta[]) => setCases(items))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (room.view?.phase !== 'finished' || room.view.game?.phase !== 'solved') return;
    const current = loadProgress();
    const next = {
      solved: [...new Set([...current.solved, room.view.caseId])],
      concepts: [...new Set([...current.concepts, ...room.view.game.masteredConcepts])],
    };
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    } catch {
      // Progress remains available for this visit.
    }
  }, [room.view]);

  const caseMeta = cases.find((item) => item.id === room.view?.caseId);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="text-center"><LoaderCircle className="mx-auto animate-spin text-brand" size={34} /><p className="mt-4 font-display text-xl">正在调取案件档案…</p></div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto text-clue" size={34} />
          <h1 className="mt-4 font-display text-2xl">案件档案暂时加载失败</h1>
          <p className="mt-2 leading-7 text-muted">请确认调查服务已经启动，然后重新载入页面。</p>
          <button className="mt-5 min-h-11 rounded-xl bg-brand px-6 font-semibold text-brand-foreground" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      </main>
    );
  }

  return (
    <>
      {room.error && (
        <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-clue px-4 py-3 text-sm font-semibold text-clue-foreground" role="alert">
          <AlertCircle size={17} /> {room.error}
          <button className="ml-3 underline" onClick={room.clearError}>关闭</button>
        </div>
      )}
      {!room.view ? (
        <Home
          cases={cases}
          solvedIds={progress.solved}
          initialRoom={new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''}
          error={room.error}
          connected={room.connected}
          busy={room.busy}
          onCreateSolo={(caseId) => void room.create('solo', caseId, '小侦探', true)}
          onCreateDuo={(caseId) => void room.create('duo', caseId, '小侦探')}
          onJoin={(code) => void room.join(code, '小侦探')}
        />
      ) : room.view.phase === 'lobby' ? (
        <Lobby
          view={room.view}
          seat={room.session?.seat ?? room.view.hostSeat}
          caseMeta={caseMeta}
          connected={room.connected}
          busy={room.busy}
          onReady={(ready) => void room.ready(ready)}
          onStart={() => void room.start()}
          onLeave={() => void room.leave()}
        />
      ) : (
        <GameBoard
          view={room.view}
          seat={room.session?.seat ?? room.view.hostSeat}
          caseMeta={caseMeta}
          busy={room.busy}
          canReplay
          onAct={(action) => void room.act(action)}
          onReplay={() => void room.replay()}
          onLeave={() => void room.leave()}
        />
      )}
    </>
  );
}
