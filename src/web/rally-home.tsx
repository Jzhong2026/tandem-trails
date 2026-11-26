import { useMemo, useState } from 'react';
import {
  RALLY_LEVELS, RALLY_VEHICLES, UPGRADE_COSTS, applyVehicleUpgrades, canStartRally, levelById, vehicleById,
} from '../shared/knowledge-rally.js';
import type { RallyProgress, RallyUpgradeKind } from '../shared/knowledge-rally.js';
import type { CourseSubject, StudyCourse } from '../shared/study.js';
import type { RaceQuestion } from '../shared/race-questions.js';
import { COURSE_SUBJECTS, GRADE_NAMES } from '../shared/study.js';
import { RallyVehiclePreview } from './rally-preview.js';

interface Props {
  course: StudyCourse;
  onCourse: (course: StudyCourse) => void;
  questions: RaceQuestion[];
  progress: RallyProgress;
  onSelectVehicle: (id: string) => void;
  onUpgrade: (kind: RallyUpgradeKind) => void;
  onStart: (levelId: string) => void;
  onReview: () => void;
  onExit: () => void;
}

export function RallyHome({ progress, course, onCourse, questions, onSelectVehicle, onUpgrade, onStart, onReview, onExit }: Props) {
  const [levelId, setLevelId] = useState(() => RALLY_LEVELS[Math.min(progress.unlockedLevel - 1, RALLY_LEVELS.length - 1)].id);
  const level = levelById(levelId);
  const upgrades = progress.upgrades[progress.selectedVehicleId];
  const baseVehicle = vehicleById(progress.selectedVehicleId);
  const vehicle = applyVehicleUpgrades(baseVehicle, upgrades);
  const completedTasks = new Set(progress.completedTasks[level.id] ?? []);
  const totalStars = useMemo(() => Object.values(progress.stars).reduce((sum, stars) => sum + stars, 0), [progress.stars]);
  const mastered = questions.filter(q => progress.masteredQuestions[q.id] > 0).length;
  const selectedSubject = course.subject ?? 'mixed';
  const courseLabel = `${GRADE_NAMES[course.grade]}年级${course.term === 1 ? '上' : '下'}学期 · ${COURSE_SUBJECTS[selectedSubject]}`;
  const canStart = canStartRally(progress, levelId);

  return <div className="rally-app">
    <div className="rally-wrap">
      <header className="rally-topbar">
        <div className="rally-brand"><span className="rally-brand-mark">R</span><div>知识赛车 <small>RALLY TO LEARN</small></div></div>
        <div className="rally-top-actions">
          <span className="rally-chip accent">全新单人闯关版</span>
          <button className="rally-btn ghost small" onClick={onExit}>返回项目首页</button>
        </div>
      </header>

      <div className="rally-home-content">
        <section className="rally-hero">
          <div className="rally-hero-copy">
            <div className="rally-eyebrow">Drive smart · Learn fast</div>
            <h1>把知识<span>开向远方</span></h1>
            <p>驾驶你的拉力赛车穿越六段真实赛道。每一次正确答题都在积攒氮气，每一次看懂解析都让你变得更强——不是答错就出局，而是学会再出发。</p>
            <div className="rally-hero-facts">
              <span className="rally-chip">6 段成长赛道</span>
              <span className="rally-chip">5 款可选 3D 车辆</span>
              <span className="rally-chip">二至九年级 · 语数英</span>
              <span className="rally-chip">答错可解析重试</span>
            </div>
          </div>
          <div className="rally-hero-stamp"><b>{questions.length}</b><span>道可练习的题目<br />{courseLabel}</span></div>
        </section>

        <section className="rally-course-picker rally-panel" aria-labelledby="rally-course-title">
          <h2 id="rally-course-title">选择课程</h2>
          <label>年级与学期
            <select value={`${course.grade}-${course.term}`} onChange={event => {
              const [grade, term] = event.target.value.split('-').map(Number);
              onCourse({ ...course, grade, term });
            }}>
              {GRADE_NAMES.map((name, grade) => name && [1, 2].map(term =>
                <option key={`${grade}-${term}`} value={`${grade}-${term}`}>{name}年级{term === 1 ? '上' : '下'}学期</option>,
              ))}
            </select>
          </label>
          <div role="group" aria-label="学科" className="rally-subject-options">
            {Object.entries(COURSE_SUBJECTS).map(([subject, name]) => <button key={subject}
              className="rally-btn" aria-pressed={subject === selectedSubject}
              onClick={() => onCourse({ ...course, subject: subject as CourseSubject })}>{name}</button>)}
          </div>
        </section>

        <section className="rally-summary" aria-label="学习进度">
          <div className="rally-stat"><div className="rally-stat-icon">★</div><div><span>已收集星星</span><strong>{totalStars} / 18</strong></div></div>
          <div className="rally-stat"><div className="rally-stat-icon">✓</div><div><span>掌握题目</span><strong>{mastered} / {questions.length}</strong></div></div>
          <div className="rally-stat"><div className="rally-stat-icon">⚑</div><div><span>已解锁赛道</span><strong>{progress.unlockedLevel} / {RALLY_LEVELS.length}</strong></div></div>
          <div className="rally-stat"><div className="rally-stat-icon">↗</div><div><span>学习总积分</span><strong>{progress.totalScore.toLocaleString('zh-CN')}</strong></div></div>
        </section>

        {progress.pendingReview.length > 0 && <div className="rally-review-banner" role="status">
          还有 <b>{progress.pendingReview.length}</b> 道第一次没答对的题。先花一分钟复盘，就能继续挑战下一站。
          <button className="rally-btn small" style={{ marginLeft: 12 }} onClick={onReview}>去复习错题</button>
        </div>}

        <div className="rally-dashboard">
          <section className="rally-panel" aria-labelledby="rally-level-title">
            <div className="rally-panel-head">
              <div><h2 id="rally-level-title">选择成长赛道</h2><p>完成当前赛道即可解锁下一站，最高可收集 18 颗星。</p></div>
              <span className="rally-chip mint">循序渐进</span>
            </div>
            <div className="rally-levels">
              {RALLY_LEVELS.map((entry, index) => {
                const locked = index >= progress.unlockedLevel;
                const stars = progress.stars[entry.id] ?? 0;
                return <button
                  key={entry.id}
                  className={`rally-level${entry.id === levelId ? ' active' : ''}${locked ? ' locked' : ''}`}
                  disabled={locked}
                  aria-pressed={entry.id === levelId}
                  onClick={() => setLevelId(entry.id)}
                >
                  <span className="rally-level-num">{locked ? '⌑' : String(index + 1).padStart(2, '0')}</span>
                  <span className="rally-level-copy"><strong>{entry.name}</strong><span>{locked ? `完成第 ${index} 站后解锁` : entry.description}</span></span>
                  <span className="rally-level-side">
                    <span className="rally-stars" aria-label={`${stars} 颗星`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span>
                    <span className="rally-difficulty" aria-label={`难度 ${entry.difficulty}`}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < entry.difficulty ? 'on' : ''} />)}</span>
                  </span>
                </button>;
              })}
            </div>
            <div className="rally-level-challenges" aria-label={`${level.name}挑战任务`}>
              <div className="rally-challenge-head"><strong>本关挑战</strong><span>首次完成奖励改装点</span></div>
              {level.challenges.map((challenge) => <div key={challenge.id} className={`rally-challenge${completedTasks.has(challenge.id) ? ' done' : ''}`}>
                <i>{completedTasks.has(challenge.id) ? '✓' : '○'}</i>
                <span><b>{challenge.label}</b><small>{challenge.description}</small></span>
                <em>+{challenge.reward}</em>
              </div>)}
            </div>
          </section>

          <section className="rally-panel rally-garage" id="rally-garage" aria-labelledby="rally-garage-title">
            <div className="rally-panel-head">
              <div><h2 id="rally-garage-title">我的车库</h2><p>五款车都已开放，选一辆顺手的去比赛。</p></div>
              <div className="rally-garage-badges"><span className="rally-chip mint">改装点 {progress.parts}</span><span className="rally-chip accent">3D 实时预览</span></div>
            </div>
            <div className="rally-vehicle-preview">
              <RallyVehiclePreview vehicle={baseVehicle} />
              <div className="rally-vehicle-preview-label"><b>{vehicle.make}</b><span className="rally-chip">{vehicle.kind === 'truck' ? '重型卡车' : vehicle.kind === 'sport' ? '高性能跑车' : '拉力赛车'}</span></div>
              <span className="rally-vehicle-preview-note">实时车辆模型 · 选择即切换</span>
            </div>
            <div className="rally-vehicle-title"><div><h3>{vehicle.name}</h3><p>{vehicle.tagline}</p></div><span className="rally-chip mint">{vehicle.maxIntegrity} 格耐久</span></div>
            <div className="rally-vehicle-stats">
              <div className="rally-stat-row"><span>最高速度</span><div className="rally-meter"><i style={{ width: `${vehicle.speedFactor * 78}%` }} /></div><b>{Math.round(vehicle.speedFactor * 100)}</b></div>
              <div className="rally-stat-row"><span>操控稳定</span><div className="rally-meter"><i style={{ width: `${vehicle.grip * 78}%` }} /></div><b>{Math.round(vehicle.grip * 100)}</b></div>
              <div className="rally-stat-row"><span>氮气强度</span><div className="rally-meter"><i style={{ width: `${vehicle.boostFactor * 78}%` }} /></div><b>{Math.round(vehicle.boostFactor * 100)}</b></div>
            </div>
            <div className="rally-upgrade-head"><strong>车辆改装</strong><span>升级会在下一局生效</span></div>
            <div className="rally-upgrades">
              {([
                { kind: 'engine', label: '引擎', detail: '最高速度 +5%' },
                { kind: 'tires', label: '轮胎', detail: '操控稳定 +10%' },
                { kind: 'nitro', label: '氮气', detail: '加速强度 +10%' },
              ] as const).map((item) => {
                const levelValue = upgrades[item.kind];
                const maxed = levelValue >= 3;
                const cost = maxed ? 0 : UPGRADE_COSTS[levelValue];
                return <button key={item.kind} className="rally-upgrade" disabled={maxed || progress.parts < cost} onClick={() => onUpgrade(item.kind)} aria-label={`升级${item.label}，当前 ${levelValue} 级，${maxed ? '已满级' : `需要 ${cost} 改装点`}`}>
                  <span><b>{item.label}</b><small>{item.detail}</small></span>
                  <span className="rally-upgrade-level" aria-label={`${levelValue} 级`}>{[0, 1, 2].map((value) => <i key={value} className={value < levelValue ? 'on' : ''} />)}</span>
                  <em>{maxed ? '已满级' : `${cost} 点`}</em>
                </button>;
              })}
            </div>
            <div className="rally-vehicle-options" aria-label="选择车辆">
              {RALLY_VEHICLES.map(entry => <button
                key={entry.id}
                className="rally-vehicle-option"
                aria-pressed={entry.id === vehicle.id}
                aria-label={`选择 ${entry.name}`}
                onClick={() => onSelectVehicle(entry.id)}
              ><b>{entry.kind === 'truck' ? ' truck' : entry.kind === 'sport' ? ' sport' : ' rally'}</b><span>{entry.name}</span></button>)}
            </div>
            <div className="rally-start-row">
              <div><b>{courseLabel}</b>{level.name} · {level.checkpoints.length} 个知识补给站</div>
              <button className="rally-btn primary" disabled={!canStart} onClick={() => onStart(levelId)}>{progress.pendingReview.length ? '先完成错题复习' : '出发，开始闯关'} <span aria-hidden="true">→</span></button>
            </div>
          </section>
        </div>

        <section className="rally-learning-strip" aria-label="学习机制">
          <div className="rally-learning-card"><b>01</b><div><strong>答对积攒氮气</strong><p>连续首次答对会提高连击，让加速更有成就感。</p></div></div>
          <div className="rally-learning-card"><b>02</b><div><strong>答错也能继续</strong><p>先读解析再重试，不扣耐久，不做惩罚性淘汰。</p></div></div>
          <div className="rally-learning-card"><b>03</b><div><strong>错题真正掌握</strong><p>第一次答错的题会进入复盘，完成后才解锁下一站。</p></div></div>
        </section>
      </div>
    </div>
  </div>;
}
