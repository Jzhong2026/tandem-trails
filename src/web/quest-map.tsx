import { QUEST_LEVELS } from '../shared/quest-levels.js';
import { THEME_SKINS } from './quest-scenery.js';

export interface QuestRecord { stars: number; coins: number; timeMs: number; score: number }
export interface QuestSave { unlocked: number; free: boolean; records: Record<string, QuestRecord> }

export const QUEST_SAVE_KEY = 'tandem-quest-save-v1';

export function loadQuestSave(): QuestSave {
  try {
    const raw = window.localStorage.getItem(QUEST_SAVE_KEY);
    if (!raw) return { unlocked: 0, free: false, records: {} };
    const parsed = JSON.parse(raw) as Partial<QuestSave>;
    return {
      unlocked: Math.max(0, Math.min(QUEST_LEVELS.length - 1, Number(parsed.unlocked) || 0)),
      free: Boolean(parsed.free),
      records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
    };
  } catch {
    return { unlocked: 0, free: false, records: {} };
  }
}

export function saveQuestSave(save: QuestSave) {
  try { window.localStorage.setItem(QUEST_SAVE_KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}

export function StarIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"
      fill={filled ? '#ffc247' : '#ffffff'} stroke={filled ? '#c98a2a' : '#ffffff'} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>;
}

const NODES: readonly (readonly [number, number])[] = [
  [80, 70], [300, 70], [520, 70], [740, 70],
  [740, 180], [520, 180], [300, 180], [80, 180],
  [80, 290], [300, 290], [520, 290], [740, 290],
];
const TRAIL = 'M80 70 L740 70 Q800 70 800 125 Q800 180 740 180 L80 180 Q20 180 20 235 Q20 290 80 290 L740 290';

interface Props {
  save: QuestSave;
  mode: 'solo' | 'coop';
  assist: boolean;
  onMode: (mode: 'solo' | 'coop') => void;
  onAssist: (assist: boolean) => void;
  onFree: (free: boolean) => void;
  onPick: (index: number) => void;
}

export function QuestMap({ save, mode, assist, onMode, onAssist, onFree, onPick }: Props) {
  const totalStars = Object.values(save.records).reduce((sum, record) => sum + record.stars, 0);
  const cleared = Object.keys(save.records).length;
  const nextIndex = Math.min(QUEST_LEVELS.length - 1, save.unlocked);

  return <section className="quest-map">
    <div className="quest-map-head">
      <div>
        <h2>选择关卡</h2>
        <p>已通关 {cleared} / {QUEST_LEVELS.length} · 收集星星 {totalStars} / {QUEST_LEVELS.length * 3}</p>
      </div>
      <button className="qbtn primary" onClick={() => onPick(nextIndex)}>
        {cleared === 0 ? '开始第 1 关' : `继续第 ${nextIndex + 1} 关`}
      </button>
      <div className="quest-modes">
        <button className="quest-mode" aria-pressed={mode === 'solo'} onClick={() => onMode('solo')}>
          <strong>单人闯关</strong><span>5 颗心 · 冲刺击</span>
        </button>
        <button className="quest-mode" aria-pressed={mode === 'coop'} onClick={() => onMode('coop')}>
          <strong>双人同乐</strong><span>前锋 + 后卫 · 更容易</span>
        </button>
        <button className="quest-mode" aria-pressed={assist} onClick={() => onAssist(!assist)}>
          <strong>轻松模式</strong><span>{assist ? '已开启 · 不会失败' : '关闭 · 心会扣完'}</span>
        </button>
        <button className="quest-mode" aria-pressed={save.free} onClick={() => onFree(!save.free)}>
          <strong>自由选关</strong><span>{save.free ? '全部关卡可选' : '按顺序解锁'}</span>
        </button>
      </div>
    </div>

    <div className="quest-trail">
      <svg viewBox="0 0 820 360" role="presentation">
        <defs>
          <linearGradient id="quest-trail-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3f2a5e" /><stop offset="1" stopColor="#1d1029" />
          </linearGradient>
          <linearGradient id="quest-trail-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#35d6a4" /><stop offset="0.5" stopColor="#ffc247" /><stop offset="1" stopColor="#ff5c47" />
          </linearGradient>
        </defs>
        <rect width="820" height="360" fill="url(#quest-trail-bg)" />
        {[0, 1, 2].map(row => <g key={row} opacity="0.5">
          {Array.from({ length: 9 }, (_, i) => {
            const x = 30 + i * 95 + (row % 2) * 40;
            const y = 40 + row * 110;
            return <g key={i}>
              <ellipse cx={x} cy={y} rx="26" ry="13" fill="#ffffff10" />
              <ellipse cx={x + 16} cy={y - 6} rx="18" ry="10" fill="#ffffff0d" />
            </g>;
          })}
        </g>)}
        <path d={TRAIL} fill="none" stroke="#120a1f" strokeWidth="20" strokeLinecap="round" />
        <path d={TRAIL} fill="none" stroke="url(#quest-trail-line)" strokeWidth="7" strokeLinecap="round" strokeDasharray="16 12" opacity="0.6" />
        {QUEST_LEVELS.map((level, index) => {
          const [x, y] = NODES[index];
          const skin = THEME_SKINS[level.theme];
          const unlocked = save.free || index <= save.unlocked;
          const record = save.records[level.id];
          return <g key={level.id}>
            <circle cx={x} cy={y} r="42" fill={skin.cap[0]} opacity={unlocked ? 0.3 : 0.12} />
            <circle cx={x} cy={y} r="34" fill="#120a1f" opacity="0.55" />
            <rect x={x - 52} y={y + 44} width="104" height="22" rx="11" fill="#120a1f" opacity="0.62" />
            <text x={x} y={y + 59} textAnchor="middle" fill={unlocked ? '#fff6e8' : '#9a86b4'} fontSize="14" fontWeight="800">{level.name}</text>
            {record && <text x={x} y={y - 44} textAnchor="middle" fill="#ffc247" fontSize="12" fontWeight="800">{'★'.repeat(record.stars)}</text>}
          </g>;
        })}
      </svg>
      <div className="quest-nodes">
        {QUEST_LEVELS.map((level, index) => {
          const [x, y] = NODES[index];
          const skin = THEME_SKINS[level.theme];
          const record = save.records[level.id];
          const unlocked = save.free || index <= save.unlocked;
          return <button key={level.id} className={`quest-node${index === nextIndex && !record ? ' current' : ''}`}
            style={{ left: `${x / 820 * 100}%`, top: `${y / 360 * 100}%`, background: `radial-gradient(circle at 34% 28%, ${skin.cap[0]}, ${skin.cap[1]})` }}
            disabled={!unlocked} onClick={() => onPick(index)}
            aria-label={`第 ${index + 1} 关 ${level.name}${record ? `，已获得 ${record.stars} 星` : unlocked ? '' : '，尚未解锁'}`}>
            {unlocked ? <>
              <span className="num">{index + 1}</span>
              <span className="mini">{[0, 1, 2].map(i => <StarIcon key={i} filled={Boolean(record && record.stars > i)} size={9} />)}</span>
            </> : <svg className="lock" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="#fff6e8" />
              <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="#fff6e8" strokeWidth="2.2" />
              <circle cx="12" cy="15.6" r="1.7" fill="#3f2a5e" />
            </svg>}
          </button>;
        })}
      </div>
    </div>

    <div className="quest-worlds">
      {[0, 1, 2, 3].map(world => {
        const levels = QUEST_LEVELS.slice(world * 3, world * 3 + 3);
        const done = levels.filter(level => save.records[level.id]).length;
        return <div className="quest-world" key={world}>
          <h3>{levels[0].world}</h3>
          <p>{levels.map(level => level.name).join(' · ')}</p>
          <div className="bar"><i style={{ width: `${done / 3 * 100}%` }} /></div>
        </div>;
      })}
    </div>

    {mode === 'coop' && <div className="quest-roles">
      <div className="quest-role striker">
        <h3><span aria-hidden="true">🔥</span>P1 前锋 · 芽芽</h3>
        <ul>
          <li><b>冲刺击</b>：按 <kbd>F</kbd> 向前突进，撞到的敌人直接清掉</li>
          <li>吃到火花花后，<kbd>F</kbd> 改为发射弹跳火球</li>
          <li>踩敌人头顶连击，分数翻倍</li>
          <li>负责开路、抢金币、打菇霸</li>
        </ul>
      </div>
      <div className="quest-role guardian">
        <h3><span aria-hidden="true">🛡️</span>P2 后卫 · 豆豆</h3>
        <ul>
          <li><b>背盾</b>：身后的敌人撞上来会被弹开并眩晕，不掉心</li>
          <li><b>守护罩</b>：按 <kbd>,</kbd> 展开 2.6 秒护罩，罩内两人都无敌</li>
          <li>被眩晕的敌人碰一下就碎，还有额外分数</li>
          <li>负责断后、救泡泡、给前锋接力跳</li>
        </ul>
      </div>
    </div>}

    {mode === 'coop' && <div className="quest-perks">
      <h3>双人为什么更容易</h3>
      <ul>
        <li>敌人速度降到 <b>82%</b>，菇霸头晕时间更长</li>
        <li>掉进坑里<b>不扣心</b>，直接回到搭档身边；掉队会被自动带上</li>
        <li>心扣光只会变成<b>泡泡</b>，搭档碰一下就复活；两人都变泡泡才重来</li>
        <li>每面存档旗<b>全队 +1 心</b>，旗子旁还多送一颗红心</li>
        <li>两人靠近触发<b>同行光环</b>，金币双倍；踩搭档头顶可以<b>接力超级跳</b></li>
        <li>无敌星会分给搭档一半时间</li>
      </ul>
    </div>}
  </section>;
}