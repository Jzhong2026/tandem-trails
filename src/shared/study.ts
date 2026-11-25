import type { RaceQuestion, RaceSubject } from './race-questions.js';

export type CourseSubject = RaceSubject | 'mixed';
export interface StudyCourse {
  grade: number;
  term: number;
  subject?: CourseSubject;
}
export const DEFAULT_COURSE: StudyCourse = { grade: 2, term: 1 };
export const GRADE_NAMES = ['', '', '二', '三', '四', '五', '六', '七', '八', '九'];
export const SUBJECT_NAMES = { chinese: '语文', math: '数学', english: '英语' } as const;
export const COURSE_SUBJECTS = { mixed: '综合', ...SUBJECT_NAMES };
export function sameCourse(a: StudyCourse, b: StudyCourse) {
  return a.grade === b.grade && a.term === b.term && (a.subject ?? 'mixed') === (b.subject ?? 'mixed');
}
export function subjectQuestions(bank: RaceQuestion[], subject: CourseSubject = 'mixed') {
  return subject === 'mixed' ? bank : bank.filter(q => q.subject === subject);
}
export function validCourse(value: unknown): value is StudyCourse {
  if (!value || typeof value !== 'object') return false;
  const { grade, term, subject } = value as StudyCourse;
  return Number.isInteger(grade) && grade >= 2 && grade < GRADE_NAMES.length && (term === 1 || term === 2)
    && (subject === undefined || (typeof subject === 'string' && Object.hasOwn(COURSE_SUBJECTS, subject)));
}
export function courseName(course: StudyCourse) {
  return `上海${GRADE_NAMES[course.grade]}年级${course.term === 1 ? '上' : '下'}学期`;
}
export interface StudyCard {
  id: string;
  title: string;
  unit: string;
  classUrl?: string;
  scenes: { label: string; say: string; items: string[] }[];
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}
export interface StudyShelf {
  subjects: string[];
  cards: StudyCard[];
  edition: string;
  topics: string[];
  lessons: { title: string; url: string }[];
  exercises: number;
}
