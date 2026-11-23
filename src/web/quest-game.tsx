import { useCallback, useEffect, useRef, useState } from 'react';
import { QUEST_LEVELS } from '../shared/quest-levels.js';
import { DEFAULT_APPEARANCE } from '../shared/buddy.js';
import type { Appearance, BuddyLooks } from '../shared/buddy.js';
import type { Seat } from '../shared/protocol.js';
import { loadBuddyPreference, saveBuddyPreference } from './buddy-save.js';
import { QuestAudio } from './quest-audio.js';
import { loadQuestSave, QuestMap, saveQuestSave } from './quest-map.js';
import type { QuestRecord, QuestSave } from './quest-map.js';
import { QuestStage } from './quest-stage.js';
import './quest.css';

interface Props {
  onExit: () => void;
  initialMode?: 'solo' | 'coop';
}

export function QuestGame({ onExit, initialMode = 'solo' }: Props) {
  const audioRef = useRef<QuestAudio | null>(null);
  if (!audioRef.current) audioRef.current = new QuestAudio();
  const audio = audioRef.current;

  const [save, setSave] = useState<QuestSave>(() => loadQuestSave());
  const [mode, setMode] = useState<'solo' | 'coop'>(initialMode);
  const [assist, setAssist] = useState(false);
  const [muted, setMuted] = useState(false);
  const [screen, setScreen] = useState<'map' | 'play'>('map');
  const [levelIndex, setLevelIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [looks, setLooks] = useState<BuddyLooks>(() => ({
    left: loadBuddyPreference('left') ?? DEFAULT_APPEARANCE.left,
    right: loadBuddyPreference('right') ?? DEFAULT_APPEARANCE.right,
  }));

  const changeLooks = (seat: Seat, next: Appearance) => {
    saveBuddyPreference(seat, next);
    setLooks(current => ({ ...current, [seat]: next }));
  };

  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => { saveQuestSave(save); }, [save]);

  const toggleMute = () => {
    audio.unlock();
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
  };

  const pick = (index: number) => {
    audio.unlock();
    setLevelIndex(index);
    setRunKey(key => key + 1);
    setScreen('play');
  };

  const complete = useCallback((index: number, stars: number, record: QuestRecord) => {
    setSave(current => {
      const previous = current.records[QUEST_LEVELS[index].id];
      const best: QuestRecord = previous
        ? {
          stars: Math.max(previous.stars, stars),
          coins: Math.max(previous.coins, record.coins),
          timeMs: Math.min(previous.timeMs, record.timeMs),
          score: Math.max(previous.score, record.score),
        }
        : record;
      return {
        ...current,
        unlocked: Math.max(current.unlocked, Math.min(QUEST_LEVELS.length - 1, index + 1)),
        records: { ...current.records, [QUEST_LEVELS[index].id]: best },
      };
    });
  }, []);

  const retry = useCallback(() => {
    audio.unlock();
    setRunKey(key => key + 1);
  }, [audio]);

  const exitToMap = useCallback(() => {
    audio.stopMusic();
    setScreen('map');
  }, [audio]);

  const next = useCallback(() => {
    audio.unlock();
    setLevelIndex(index => Math.min(QUEST_LEVELS.length - 1, index + 1));
    setRunKey(key => key + 1);
  }, [audio]);

  const changeMode = (value: 'solo' | 'coop') => {
    setMode(value);
    audio.unlock();
  };

  return <div className="quest">
    <div className="quest-shell">
      <div className="quest-top">
        <span className="quest-logo"><span className="quest-sprout" aria-hidden="true" />星芽<b>大冒险</b></span>
        <span className={`quest-chip ${mode}`}>{mode === 'coop' ? '双人同乐 · 前锋 + 后卫' : '单人闯关'}</span>
        {assist && <span className="quest-chip assist">轻松模式</span>}
        <span className="quest-top-spacer" />
        <button className="qbtn ghost small icon" onClick={toggleMute}
          aria-pressed={muted} aria-label={muted ? '打开声音' : '关闭全部声音'} title={muted ? '打开声音' : '关闭全部声音'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <span className="quest-chip">{muted ? '静音' : '音乐与音效开'}</span>
        {screen === 'play' && <button className="qbtn ghost small" onClick={exitToMap}>选关地图</button>}
        <button className="qbtn ghost small" onClick={onExit}>返回首页</button>
      </div>
      {screen === 'map'
        ? <QuestMap save={save} mode={mode} assist={assist} looks={looks} onLooks={changeLooks} onMode={changeMode}
          onAssist={setAssist} onFree={free => setSave(current => ({ ...current, free }))} onPick={pick} />
        : <QuestStage levelIndex={levelIndex} coop={mode === 'coop'} assist={assist} audio={audio} looks={looks}
          runKey={runKey} record={save.records[QUEST_LEVELS[levelIndex].id]}
          onComplete={complete} onExit={exitToMap} onNext={next} onRetry={retry} />}
    </div>
  </div>;
}