import { useCallback, useEffect, useState } from 'react';
import {
  RALLY_LEVELS, canStartRally, completeRallyReview, createRallyProgress, createRallyRun, loadRallyProgress,
  recordRallyResult, saveRallyProgress,
} from '../shared/knowledge-rally.js';
import type { RallyProgress, RallyRun } from '../shared/knowledge-rally.js';
import { RallyHome } from './rally-home.js';
import { RallyStage } from './rally-stage.js';
import { RallyReview } from './rally-review.js';
import './rally.css';

interface Props {
  onExit: () => void;
}

export function RallyGame({ onExit }: Props) {
  const [progress, setProgress] = useState<RallyProgress>(() => {
    try {
      return loadRallyProgress(window.localStorage);
    } catch {
      return createRallyProgress();
    }
  });
  const [screen, setScreen] = useState<'home' | 'race' | 'review'>('home');
  const [run, setRun] = useState<RallyRun | null>(null);

  useEffect(() => {
    try {
      saveRallyProgress(window.localStorage, progress);
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }, [progress]);

  const selectVehicle = useCallback((id: string) => {
    setProgress(value => ({ ...value, selectedVehicleId: id }));
  }, []);

  const launch = useCallback((levelId: string) => {
    setRun(createRallyRun(levelId, progress.selectedVehicleId));
    setScreen('race');
  }, [progress.selectedVehicleId]);

  const start = useCallback((levelId: string) => {
    if (canStartRally(progress, levelId)) launch(levelId);
  }, [progress, launch]);

  const record = useCallback((finished: RallyRun) => {
    setProgress(value => recordRallyResult(value, finished));
  }, []);

  const mastered = useCallback((id: string) => {
    setProgress(value => completeRallyReview(value, id));
  }, []);

  const home = useCallback(() => {
    setRun(null);
    setScreen('home');
  }, []);

  if (screen === 'review' && progress.pendingReview.length > 0) {
    return <RallyReview questionIds={progress.pendingReview} onMastered={mastered} onExit={home} />;
  }

  if (screen === 'race' && run) {
    const index = RALLY_LEVELS.findIndex(level => level.id === run.level.id);
    const nextLevelId = RALLY_LEVELS[index + 1]?.id ?? null;
    return <RallyStage
      key={`${run.seed}-${run.vehicle.id}`}
      run={run}
      nextLevelId={nextLevelId}
      canContinue={progress.pendingReview.length === 0}
      onRecord={record}
      onRetry={() => launch(run.level.id)}
      onNext={launch}
      onReview={() => setScreen('review')}
      onHome={home}
      onExit={onExit}
    />;
  }

  return <RallyHome
    progress={progress}
    onSelectVehicle={selectVehicle}
    onStart={start}
    onReview={() => setScreen('review')}
    onExit={onExit}
  />;
}
