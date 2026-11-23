import { useEffect, useState } from 'react';
import { GRADE_NAMES, SUBJECT_NAMES, courseName } from '../shared/study.js';
import type { StudyCard, StudyCourse, StudyShelf } from '../shared/study.js';
import type { RaceSubject } from '../shared/race-questions.js';

function LessonReader({ cards }: { cards: StudyCard[] }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const card = cards[index];
  if (!card) return null;
  return (
    <details className="lesson-reader">
      <summary>课前练习室 · {cards.length} 节图文微课</summary>
      <label>
        选择一课{' '}
        <select
          value={index}
          onChange={(e) => {
            setIndex(Number(e.target.value));
            setChoice(null);
          }}
        >
          {cards.map((c, i) => (
            <option value={i} key={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <small>{card.unit}</small>
      {card.classUrl && (
        <a href={card.classUrl} target="_blank" rel="noreferrer">
          去上海空中课堂看本课 ↗
        </a>
      )}
      {card.scenes.map((s, i) => (
        <section key={i}>
          <strong>{s.label}</strong>
          <p>{s.say}</p>
          <div>
            {s.items.map((v, j) => (
              <span key={j}>{v}</span>
            ))}
          </div>
        </section>
      ))}
      <fieldset>
        <legend>{card.prompt}</legend>
        {card.options.map((v, i) => (
          <button
            key={i}
            className="rbtn ghost small"
            aria-pressed={choice === i}
            onClick={() => setChoice(i)}
          >
            {v}
          </button>
        ))}
      </fieldset>
      {choice !== null && (
        <p role="status">
          {choice === card.answer ? '答对了！' : '再想想。'} {card.explanation}
        </p>
      )}
    </details>
  );
}

export function StudyPicker({
  course,
  disabled,
  change,
}: {
  course: StudyCourse;
  disabled: boolean;
  change: (course: StudyCourse) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState({ ...course, subject: 'chinese' });
  const subject =
    selection.grade === course.grade && selection.term === course.term ? selection.subject : 'chinese';
  const setSubject = (subject: string) => setSelection({ ...course, subject });
  const [shelf, setShelf] = useState<StudyShelf | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) return;
    const cancel = new AbortController();
    setShelf(null);
    setError(false);
    setQuery('');
    void fetch(`/api/study/${course.grade}/${course.term}/${encodeURIComponent(subject)}`, {
      signal: cancel.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return (await response.json()) as StudyShelf;
      })
      .then((data) => {
        if (!cancel.signal.aborted) setShelf(data);
      })
      .catch(() => {
        if (!cancel.signal.aborted) setError(true);
      });
    return () => cancel.abort();
  }, [open, course.grade, course.term, subject, retry]);
  const subjects = shelf?.subjects ?? Object.keys(SUBJECT_NAMES);
  return (
    <section className="study-picker">
      <h2>比赛知识范围</h2>
      <div className="study-inputs">
        <label>
          上海课程{' '}
          <select
            disabled={disabled}
            value={course.grade}
            onChange={(e) => change({ ...course, grade: Number(e.target.value) })}
          >
            {[
              [2, 3, 4, 5],
              [6, 7, 8, 9],
            ].map((grades, i) => (
              <optgroup key={i} label={i === 0 ? '小学' : '初中'}>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_NAMES[g]}年级
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          学期{' '}
          <select
            disabled={disabled}
            value={course.term}
            onChange={(e) => change({ ...course, term: Number(e.target.value) })}
          >
            <option value={1}>上学期</option>
            <option value={2}>下学期</option>
          </select>
        </label>
      </div>
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>查看课程目录和配套课时</summary>
        {open && (
          <>
            <div className="study-inputs">
              {subjects.map((s) => (
                <button
                  key={s}
                  className="rbtn ghost small"
                  aria-pressed={s === subject}
                  onClick={() => setSubject(s)}
                >
                  {SUBJECT_NAMES[s as RaceSubject] ?? s}
                </button>
              ))}
            </div>
            {error ? (
              <button onClick={() => setRetry((r) => r + 1)}>重新加载课程</button>
            ) : shelf ? (
              <>
                <p>
                  {courseName(course)} · {shelf.edition} · {shelf.lessons.length} 个公开课时 ·{' '}
                  {shelf.exercises} 道游戏练习
                </p>
                <LessonReader key={course.grade + '-' + course.term + subject} cards={shelf.cards} />
                <details>
                  <summary>知识目录 · {shelf.topics.length} 项</summary>
                  <ul className="study-list">
                    {shelf.topics.map((path, i) => (
                      <li key={i}>{path}</li>
                    ))}
                  </ul>
                </details>
                <input
                  aria-label="搜索课时"
                  className="race-input"
                  placeholder="输入课名或关键词"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <ul className="study-list">
                  {shelf.lessons
                    .filter((l) => l.title.toLowerCase().includes(query.trim().toLowerCase()))
                    .map((l) => (
                      <li key={l.url}>
                        <a href={l.url} target="_blank" rel="noreferrer">
                          {l.title} ↗
                        </a>
                      </li>
                    ))}
                </ul>
                {!shelf.lessons.some((l) => l.title.toLowerCase().includes(query.trim().toLowerCase())) && (
                  <p>没有匹配的课时</p>
                )}
              </>
            ) : (
              <p>正在读取课程…</p>
            )}
          </>
        )}
      </details>
    </section>
  );
}
