import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import semesters from 'virtual:rally-curriculum';
import { subjectQuestions } from '../shared/study.js';
import type { StudyCourse } from '../shared/study.js';
import type { RaceQuestion } from '../shared/race-questions.js';
import {
  RACE_QUESTIONS, RALLY_PROGRESS_KEY, RALLY_LEVELS, canStartRally, completeRallyReview, createRallyProgress, createRallyRun, loadRallyProgress,
  rallyResultRewards, recordRallyResult, saveRallyProgress, upgradeVehicle,
} from '../shared/knowledge-rally.js';
import type { RallyChallenge, RallyProgress, RallyRun, RallyUpgradeKind } from '../shared/knowledge-rally.js';
import { RallyHome } from './rally-home.js';
import { RallyStage } from './rally-stage.js';
import { RallyReview } from './rally-review.js';
import './rally.css';

interface Props {
  onExit: () => void;
  course: StudyCourse;
  onCourse: (course: StudyCourse) => void;
}

export function RallyGame({ course, onCourse, onExit }: Props) {
  const sessionProgress = useRef(new Map<string, RallyProgress>());
  const semester = `${course.grade}-${course.term}`;
  // The original single-course save belongs to the default mixed course.
  const subject = course.subject ?? 'mixed';
  const legacy = semester === '2-1' && subject === 'mixed';
  const progressKey = legacy ? RALLY_PROGRESS_KEY : `${RALLY_PROGRESS_KEY}.${semester}.${subject}`;
  const questions = useMemo(() => subjectQuestions(semesters[semester], subject), [semester, subject]);
  const reviewBank = useMemo(() => legacy ? [...questions, ...RACE_QUESTIONS] : questions, [legacy, questions]);
  return <RallySession key={progressKey} progressKey={progressKey} course={course} onCourse={onCourse}
    questions={questions} reviewBank={reviewBank} sessionProgress={sessionProgress.current} onExit={onExit} />;
}

interface SessionProps extends Props {
  progressKey: string;
  questions: RaceQuestion[];
  reviewBank: RaceQuestion[];
  sessionProgress: Map<string, RallyProgress>;
}

function RallySession({ onExit, course, onCourse, questions, reviewBank, progressKey, sessionProgress }: SessionProps) {
  const [progress, setProgress] = useState<RallyProgress>(() => {
    const cached = sessionProgress.get(progressKey);
    if (cached) return cached;
    try {
      return loadRallyProgress(window.localStorage, progressKey, reviewBank);
    } catch {
      return createRallyProgress();
    }
  });
  const [screen, setScreen] = useState<'home' | 'race' | 'review'>('home');
  const [run, setRun] = useState<RallyRun | null>(null);
  const [reward, setReward] = useState<{ parts: number; newTasks: RallyChallenge['id'][] }>({ parts: 0, newTasks: [] });
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    sessionProgress.set(progressKey, progress);
    try {
      saveRallyProgress(window.localStorage, progress, progressKey);
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }, [progress, progressKey, sessionProgress]);

  const selectVehicle = useCallback((id: string) => {
    setProgress(value => ({ ...value, selectedVehicleId: id }));
  }, []);

  const launch = useCallback((levelId: string) => {
    setReward({ parts: 0, newTasks: [] });
    setRun(createRallyRun(levelId, progress.selectedVehicleId, undefined, questions, progress.upgrades[progress.selectedVehicleId]));
    setScreen('race');
  }, [progress.selectedVehicleId, progress.upgrades, questions]);

  const upgrade = useCallback((kind: RallyUpgradeKind) => {
    setProgress(value => upgradeVehicle(value, value.selectedVehicleId, kind));
  }, []);

  const start = useCallback((levelId: string) => {
    if (canStartRally(progress, levelId)) launch(levelId);
  }, [progress, launch]);

  const record = useCallback((finished: RallyRun) => {
    const current = progressRef.current;
    const rewards = rallyResultRewards(current, finished);
    setReward({ parts: rewards.parts, newTasks: rewards.newTasks });
    setProgress(recordRallyResult(current, finished));
  }, []);

  const mastered = useCallback((id: string) => {
    setProgress(value => completeRallyReview(value, id));
  }, []);

  const home = useCallback(() => {
    setRun(null);
    setScreen('home');
  }, []);

  if (screen === 'review' && progress.pendingReview.length > 0) {
    return <RallyReview questionIds={progress.pendingReview} questionBank={reviewBank} onMastered={mastered} onExit={home} />;
  }

  if (screen === 'race' && run) {
    const index = RALLY_LEVELS.findIndex(level => level.id === run.level.id);
    const nextLevelId = RALLY_LEVELS[index + 1]?.id ?? null;
    return <RallyStage
      key={`${run.seed}-${run.vehicle.id}`}
      run={run}
      nextLevelId={nextLevelId}
      canContinue={progress.pendingReview.length === 0}
      partsEarned={reward.parts}
      newTasks={reward.newTasks}
      onRecord={record}
      onRetry={() => launch(run.level.id)}
      onNext={launch}
      onReview={() => setScreen('review')}
      onHome={home}
      onExit={onExit}
    />;
  }

  return <RallyHome
    course={course}
    onCourse={onCourse}
    questions={questions}
    progress={progress}
    onSelectVehicle={selectVehicle}
    onUpgrade={upgrade}
    onStart={start}
    onReview={() => setScreen('review')}
    onExit={onExit}
  />;
}
