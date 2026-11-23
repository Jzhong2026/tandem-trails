import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = path.dirname(fileURLToPath(import.meta.url));
export const subjects = { chinese: '语文', math: '数学', english: '英语' };
const nonempty = (text) => typeof text === 'string' && text.trim().length > 0;

export function readCatalog() {
  const all = [];
  const ids = new Set();
  for (const subject of Object.keys(subjects)) {
    const lessons = JSON.parse(
      fs.readFileSync(path.join(root, 'content', subject + '.json'), 'utf8').replace(/^\uFEFF/, ''),
    );
    for (const lesson of lessons) {
      const { id, grade, term, title, unit, scenes, question, choices, answer, explanation } = lesson;
      if (
        !/^[a-z0-9-]+$/.test(id) ||
        ids.has(id) ||
        !Number.isInteger(grade) ||
        grade < 2 ||
        grade > 6 ||
        ![1, 2].includes(term) ||
        ![title, unit, question, explanation].every(nonempty) ||
        !Array.isArray(scenes) ||
        scenes.length < 2 ||
        scenes.some(
          (s) =>
            ![s.label, s.say].every(nonempty) ||
            !Array.isArray(s.items) ||
            !s.items.length ||
            !s.items.every(nonempty),
        ) ||
        !Array.isArray(choices) ||
        choices.length < 2 ||
        !choices.every(nonempty) ||
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= choices.length
      ) {
        throw new Error('课程格式错误或标识重复 ' + id);
      }
      ids.add(id);
      all.push({ ...lesson, subject });
    }
    for (let grade = 2; grade <= 6; grade++)
      for (const term of [1, 2]) {
        if (!lessons.some((l) => l.grade === grade && l.term === term))
          throw new Error(`缺少课程 ${subject} ${grade}/${term}`);
      }
  }
  return all;
}

export function narrationKey(lesson) {
  return createHash('sha256')
    .update(lesson.scenes.map((s) => s.say).join('\n'))
    .digest('hex')
    .slice(0, 16);
}
