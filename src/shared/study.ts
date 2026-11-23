export interface StudyCourse {
  grade: number;
  term: number;
}
export const DEFAULT_COURSE: StudyCourse = { grade: 2, term: 1 };
export const GRADE_NAMES = ['', '', '二', '三', '四', '五', '六'];
export const SUBJECT_NAMES = { chinese: '语文', math: '数学', english: '英语' } as const;
export function validCourse(value: unknown): value is StudyCourse {
  if (!value || typeof value !== 'object') return false;
  const { grade, term } = value as StudyCourse;
  return Number.isInteger(grade) && grade >= 2 && grade <= 6 && (term === 1 || term === 2);
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
  cards: StudyCard[];
  edition: string;
  topics: string[];
  lessons: { title: string; url: string }[];
  exercises: number;
}
