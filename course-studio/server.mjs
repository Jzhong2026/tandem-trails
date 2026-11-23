import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { root, readCatalog, narrationKey } from './catalog.mjs';
import { sourcePage } from './sources.mjs';

const lessons = readCatalog();
const books = JSON.parse(fs.readFileSync(path.join(root, 'content', 'official.json'), 'utf8'));
const audioIndex = JSON.parse(fs.readFileSync(path.join(root, 'media', 'index.json'), 'utf8'));
for (const l of lessons) {
  const media = audioIndex[l.id];
  if (
    media?.key !== narrationKey(l) ||
    media.durations?.length !== l.scenes.length ||
    !fs.existsSync(path.join(root, 'media', l.id + '.mp3'))
  )
    throw new Error('旁白与课程不匹配 ' + l.id);
}
const dataPath = process.env.COURSE_DB || path.join(root, 'data', 'courses.sqlite');
fs.mkdirSync(path.dirname(dataPath), { recursive: true });
const db = new DatabaseSync(dataPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS lesson(id TEXT PRIMARY KEY, position INTEGER NOT NULL, body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS progress(
    learner TEXT NOT NULL, lesson_id TEXT NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
    seconds REAL NOT NULL DEFAULT 0, watched INTEGER NOT NULL DEFAULT 0, mastered INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL, PRIMARY KEY (learner, lesson_id)
  );`);
const saveLesson = db.prepare(
  'INSERT INTO lesson VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,body=excluded.body WHERE lesson.position<>excluded.position OR lesson.body<>excluded.body',
);
db.exec('BEGIN IMMEDIATE');
try {
  lessons.forEach((l, i) => saveLesson.run(l.id, i, JSON.stringify(l)));
  const currentIds = new Set(lessons.map((l) => l.id));
  const remove = db.prepare('DELETE FROM lesson WHERE id=?');
  for (const { id } of db.prepare('SELECT id FROM lesson').all()) if (!currentIds.has(id)) remove.run(id);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

const summary = db
  .prepare('SELECT body FROM lesson ORDER BY position')
  .all()
  .map(({ body }) => {
    const l = JSON.parse(body);
    const media = audioIndex[l.id];
    return {
      id: l.id,
      grade: l.grade,
      term: l.term,
      subject: l.subject,
      unit: l.unit,
      title: l.title,
      edition: l.edition || '',
      duration: media.durations.reduce((a, b) => a + b, 0),
    };
  });
const summaries = new Map(summary.map((l) => [l.id, l]));
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
function learner(req, res) {
  const cookie = req.headers.cookie?.match(/(?:^|;\s*)course_learner=([0-9a-f-]{36})(?:$|;)/);
  if (cookie) return cookie[1];
  const id = randomUUID();
  res.setHeader('Set-Cookie', `course_learner=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`);
  return id;
}
const getLesson = db.prepare('SELECT body FROM lesson WHERE id=?');
const saveProgress = db.prepare(`INSERT INTO progress VALUES(?,?,?,?,?,?)
  ON CONFLICT(learner,lesson_id) DO UPDATE SET seconds=COALESCE(?,progress.seconds),
  watched=MAX(progress.watched,excluded.watched), mastered=MAX(progress.mastered,excluded.mastered),
  updated_at=excluded.updated_at`);
async function update(req, res, id) {
  if (
    !req.headers['content-type']?.startsWith('application/json') ||
    (req.headers.origin &&
      req.headers.origin !== 'http://' + req.headers.host &&
      req.headers.origin !== 'https://' + req.headers.host)
  ) {
    return json(res, 403, { error: '请求来源无效' });
  }
  let body = '';
  for await (const part of req) {
    body += part;
    if (body.length > 2048) return json(res, 413, { error: '请求过大' });
  }
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return json(res, 400, { error: '请求格式无效' });
  }
  const lesson = JSON.parse(getLesson.get(id).body);
  if (
    !input ||
    typeof input !== 'object' ||
    (input.seconds === undefined && input.choice === undefined) ||
    (input.seconds !== undefined && (!Number.isFinite(input.seconds) || input.seconds < 0)) ||
    (input.choice !== undefined &&
      (!Number.isInteger(input.choice) || input.choice < 0 || input.choice >= lesson.choices.length))
  ) {
    return json(res, 400, { error: '进度或答案无效' });
  }
  const max = summaries.get(id).duration;
  const seconds = input.seconds === undefined ? null : Math.min(max, input.seconds);
  const correct = input.choice === lesson.answer;
  saveProgress.run(
    learner(req, res),
    id,
    seconds ?? 0,
    Number(seconds !== null && seconds >= max - 0.5),
    Number(correct),
    new Date().toISOString(),
    seconds,
  );
  return json(
    res,
    200,
    input.choice === undefined ? { saved: true } : { correct, explanation: lesson.explanation },
  );
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.md': 'text/plain; charset=utf-8',
};
function sendFile(req, res, file) {
  const size = fs.statSync(file).size;
  const headers = {
    'Content-Type': types[path.extname(file)],
    'Content-Length': size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  let start = 0,
    end = size - 1;
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    } else if (match && match[2]) start = Math.max(0, size - Number(match[2]));
    else start = size;
    if (start > end) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + size });
      return res.end();
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    headers['Content-Length'] = end - start + 1;
  }
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
const publicFiles = new Set(fs.readdirSync(path.join(root, 'public')));
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const match = /^\/api\/lessons\/([a-z0-9-]+)(\/progress)?$/.exec(pathname);
    if (req.method === 'POST' && match?.[2] && summaries.has(match[1]))
      return await update(req, res, match[1]);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: '请求方法无效' });
    if (pathname === '/api/catalog') {
      learner(req, res);
      return json(res, 200, summary);
    }
    const book = /^\/api\/official\/(chinese|math|english)\/([2-6])\/([12])$/.exec(pathname);
    if (book)
      return json(
        res,
        200,
        books.find((b) => b.subject === book[1] && b.grade === +book[2] && b.term === +book[3]),
      );
    if (pathname === '/api/progress')
      return json(
        res,
        200,
        db
          .prepare(
            'SELECT lesson_id, seconds, watched, mastered, updated_at FROM progress WHERE learner=? ORDER BY updated_at DESC',
          )
          .all(learner(req, res)),
      );
    if (match && !match[2] && summaries.has(match[1])) {
      const { answer, explanation, ...lesson } = JSON.parse(getLesson.get(match[1]).body);
      return json(res, 200, { ...lesson, ...audioIndex[lesson.id], audio: '/audio/' + lesson.id + '.mp3' });
    }
    const audio = /^\/audio\/([a-z0-9-]+)\.mp3$/.exec(pathname);
    if (audio && summaries.has(audio[1]))
      return sendFile(req, res, path.join(root, 'media', audio[1] + '.mp3'));
    const src = /^\/sources\/(chinese|english|math)$/.exec(pathname);
    if (src) {
      const page = sourcePage(fs.readFileSync(path.join(root, 'content', src[1] + '-sources.md'), 'utf8'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (publicFiles.has(file)) return sendFile(req, res, path.join(root, 'public', file));
    return json(res, 404, { error: '找不到课程或文件' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: '读取课程失败' });
    else res.destroy();
  }
});
const host = process.env.COURSE_HOST || '127.0.0.1';
server.listen(Number(process.env.COURSE_PORT || 4326), host, () =>
  console.log(`沪上动画课堂 http://${host}:${server.address().port} · ${summary.length} 课 · ${dataPath}`),
);
