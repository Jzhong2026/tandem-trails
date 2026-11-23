import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import type { RaceQuestion, RaceSubject } from '../shared/race-questions.js';
import type { StudyCourse, StudyShelf } from '../shared/study.js';

const db = new DatabaseSync(resolve('data/shanghai.sqlite'), { readOnly: true });
const bank =
  db.prepare(`SELECT id,subject,topic,prompt,options,answer,explain,parts FROM question WHERE grade=?1 AND term=?2
  UNION ALL SELECT id,subject,unit,title || ' · ' || prompt,options,answer,explain,NULL FROM study_card
  WHERE grade=?1 AND term=?2 AND grade<=6 AND subject IN ('chinese','math','english') ORDER BY id`);
export function questionsFor(course: StudyCourse): RaceQuestion[] {
  return bank.all({ '1': course.grade, '2': course.term }).map((row) => ({
    id: String(row.id),
    subject: row.subject as RaceSubject,
    topic: String(row.topic),
    prompt: String(row.prompt),
    options: JSON.parse(String(row.options)),
    answer: Number(row.answer),
    explain: String(row.explain),
    parts: row.parts ? JSON.parse(String(row.parts)) : undefined,
  }));
}
export function courseSubjects(course: StudyCourse): string[] {
  const items = db
    .prepare('SELECT DISTINCT subject FROM book WHERE grade=? AND term IN (?,0)')
    .all(course.grade, course.term);
  const subjects = items.map((row) => String(row.subject));
  return [
    'chinese',
    'math',
    'english',
    ...subjects.filter((s) => !['chinese', 'math', 'english'].includes(s)),
  ];
}
export function studyShelf(course: StudyCourse, subject: string): StudyShelf {
  const args = [course.grade, course.term, subject];
  const editions = db
    .prepare('SELECT DISTINCT edition FROM book WHERE grade=? AND term IN (?,0) AND subject=?')
    .all(...args);
  const topics = db
    .prepare('SELECT edition,path FROM topic WHERE grade=? AND term IN (?,0) AND subject=? ORDER BY rowid')
    .all(...args);
  const lessons = db
    .prepare(
      'SELECT id,title,course,edition FROM lesson WHERE grade=? AND term IN (?,0) AND subject=? GROUP BY id,course ORDER BY min(rowid)',
    )
    .all(...args);
  const lessonLinks = new Map(
    lessons.map((row) => [
      row.id,
      `https://basic.sh.smartedu.cn/airclassroom/airClassroomTaskDetail?courseId=${row.course}&resource=${row.id}`,
    ]),
  );
  const cards = db
    .prepare('SELECT * FROM study_card WHERE grade=? AND term IN (?,0) AND subject=? ORDER BY id')
    .all(...args)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      classUrl: lessonLinks.get(row.resource),
      unit: String(row.unit),
      scenes: JSON.parse(String(row.scenes)),
      prompt: String(row.prompt),
      options: JSON.parse(String(row.options)),
      answer: Number(row.answer),
      explanation: String(row.explain),
    }));
  return {
    cards,
    subjects: courseSubjects(course),
    edition: editions.map((row) => row.edition).join('、'),
    topics: topics.map((row) => (editions.length > 1 ? row.edition + ' · ' : '') + String(row.path)),
    lessons: lessons.map((row) => ({
      title: (editions.length > 1 ? row.edition + ' · ' : '') + String(row.title),
      url: `https://basic.sh.smartedu.cn/airclassroom/airClassroomTaskDetail?courseId=${row.course}&resource=${row.id}`,
    })),
    exercises:
      (course.grade <= 6 || !['chinese', 'math', 'english'].includes(subject) ? cards.length : 0) +
      Number(
        db.prepare('SELECT count(*) AS n FROM question WHERE grade=? AND term=? AND subject=?').get(...args)
          ?.n,
      ),
  };
}
