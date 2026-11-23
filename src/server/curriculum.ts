import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import type { RaceQuestion, RaceSubject } from '../shared/race-questions.js';
import type { StudyCourse, StudyShelf } from '../shared/study.js';

const db = new DatabaseSync(resolve('data/shanghai.sqlite'), { readOnly: true });
const bank =
  db.prepare(`SELECT id,subject,topic,prompt,options,answer,explain,parts FROM question WHERE grade=?1 AND term=?2
  UNION ALL SELECT id,subject,unit,title || ' · ' || prompt,options,answer,explain,NULL FROM study_card
  WHERE grade=?1 AND term=?2 ORDER BY id`);
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
export function studyShelf(course: StudyCourse, subject: RaceSubject): StudyShelf {
  const args = [course.grade, course.term, subject];
  const edition = db.prepare('SELECT edition FROM book WHERE grade=? AND term=? AND subject=?').get(...args);
  const topics = db
    .prepare('SELECT path FROM topic WHERE grade=? AND term=? AND subject=? ORDER BY rowid')
    .all(...args);
  const lessons = db
    .prepare('SELECT id,title,course FROM lesson WHERE grade=? AND term=? AND subject=? ORDER BY rowid')
    .all(...args);
  const lessonLinks = new Map(lessons.map(row=>[row.id,
    `https://basic.sh.smartedu.cn/airclassroom/airClassroomTaskDetail?courseId=${row.course}&resource=${row.id}`]));
  const cards = db
    .prepare('SELECT * FROM study_card WHERE grade=? AND term=? AND subject=? ORDER BY id')
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
    edition: String(edition?.edition ?? ''),
    topics: topics.map((row) => String(row.path)),
    lessons: lessons.map((row) => ({
      title: String(row.title),
      url: `https://basic.sh.smartedu.cn/airclassroom/airClassroomTaskDetail?courseId=${row.course}&resource=${row.id}`,
    })),
    exercises:
      cards.length +
      Number(
        db.prepare('SELECT count(*) AS n FROM question WHERE grade=? AND term=? AND subject=?').get(...args)
          ?.n,
      ),
  };
}
