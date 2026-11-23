import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { StudyPicker } from './study-picker.js';
import type { StudyCourse } from '../shared/study.js';
import { TOURNAMENTS } from '../shared/learning.js';
import type { TournamentMode } from '../shared/learning.js';
import './race.css';
import './learning.css';
import './workshop.css';
const RacePreview = lazy(() => import('./race-preview.js'));

export function RaceHome({
  onPlay,
  course,
  change,
}: {
  course: StudyCourse;
  change: (course: StudyCourse) => void;
  onPlay: (action: 'create' | 'join' | TournamentMode) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const preview = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (preview.current) observer.observe(preview.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="race">
      <section className="race-home">
        <div className="race-home-copy">
          <h1>
            知识
            <br />
            <em>赛车</em>
          </h1>
          <p className="lede">
            选一辆喜欢的重卡，穿过数字门，在服务区答题加油。和同学各开一台设备，一起跑完四站。
          </p>
          <div className="race-home-actions">
            <button className="rbtn primary" onClick={() => onPlay('create')}>
              单人 / 创建比赛
            </button>
            <button className="rbtn cyan" onClick={() => onPlay('join')}>
              加入比赛
            </button>
          </div>
          <div className="race-home-facts">
            <span className="race-chip">最多 4 人联机</span>
            <span className="race-chip">3 条主题赛道</span>
            <span className="race-chip">上海二至九年级 · 语数英</span>
            <span className="race-chip">错题再挑战</span>
            <span className="race-chip">键盘 / 触屏都能玩</span>
          </div>
        </div>
        <figure className="race-home-preview" ref={preview}>
          {visible && playing ? (
            <Suspense fallback={<div className="race-preview-cover" />}>
              <RacePreview />
            </Suspense>
          ) : (
            <button
              className="race-preview-cover"
              aria-label="播放三维赛道预览"
              onClick={() => setPlaying(true)}
            >
              <span>▶ 预览赛道</span>
            </button>
          )}
          <figcaption>
            <strong>阳光校园线</strong>
            <span>答对加油 · 油尽淘汰 · 先到终点获胜</span>
          </figcaption>
        </figure>
      </section>
      <div className="race-panel home-study">
        <StudyPicker course={course} disabled={false} change={change} />
      </div>
      <section className="learning-home" aria-label="多人学习赛">
        {(Object.keys(TOURNAMENTS) as TournamentMode[]).map((id) => {
          const info = TOURNAMENTS[id];
          return (
            <button key={id} className={`learning-entry ${id}`} onClick={() => onPlay(id)}>
              <small>{info.subject} · 1–4 人</small>
              <strong>{info.name}</strong>
              <span>{info.rule}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
