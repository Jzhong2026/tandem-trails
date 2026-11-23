import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, readCatalog, narrationKey, subjects } from './catalog.mjs';

const all = readCatalog();
const media = path.join(root, 'media');
const index = JSON.parse(fs.readFileSync(path.join(media, 'index.json')));
const official = JSON.parse(fs.readFileSync(path.join(root, 'content', 'official.json')));
const seenBooks = new Set();
let officialCount = 0,
  seconds = 0,
  scenes = 0;
for (const book of official) {
  const key = [book.subject, book.grade, book.term].join('/');
  assert.ok(
    !seenBooks.has(key) &&
      all.some((l) => l.subject === book.subject && l.grade === book.grade && l.term === book.term),
    key,
  );
  seenBooks.add(key);
  assert.ok(
    book.lessons.length &&
      book.lessons.every(
        (l) =>
          !!l.name &&
          /^https:\/\/basic\.sh\.smartedu\.cn\/airclassroom\/airClassroomTaskDetail\?courseId=\d+&resource=\d+$/.test(
            l.url,
          ),
      ),
    key,
  );
  officialCount += book.lessons.length;
}
assert.equal(seenBooks.size, 30);
assert.deepEqual(Object.keys(index).sort(), all.map((l) => l.id).sort());
assert.deepEqual(
  fs
    .readdirSync(media)
    .filter((f) => f.endsWith('.mp3'))
    .sort(),
  all.map((l) => l.id + '.mp3').sort(),
);
for (const l of all) {
  const m = index[l.id];
  assert.equal(m.key, narrationKey(l), l.id + ' narration changed');
  assert.equal(m.durations.length, l.scenes.length, l.id);
  assert.equal(m.captions.length, l.scenes.length, l.id);
  assert.equal(new Set(l.choices).size, l.choices.length, l.id + ' duplicate choices');
  const bytes = fs.readFileSync(path.join(media, l.id + '.mp3'));
  let expected = 0;
  for (const [i, duration] of m.durations.entries()) {
    assert.ok(duration > 0 && Number.isFinite(duration), l.id);
    const cues = m.captions[i];
    assert.ok(
      cues.length &&
        cues.every(
          ([t, text], j) =>
            Number.isFinite(t) && t >= 0 && t < duration && text && (!j || t >= cues[j - 1][0]),
        ),
      l.id + ' subtitle timing',
    );
    expected += Math.round(duration * 6000);
    seconds += duration;
    scenes++;
  }
  assert.equal(bytes.length, expected, l.id + ' MP3/timeline mismatch');
  assert.equal(bytes.length % 144, 0);
  for (let i = 0; i < bytes.length; i += 144) {
    assert.ok(
      bytes[i] === 255 && bytes[i + 1] === 243 && bytes[i + 2] === 100,
      l.id + ' invalid MPEG frame at ' + i,
    );
  }
}
for (const [subject, label] of Object.entries(subjects)) {
  const counts = [];
  for (let grade = 2; grade <= 6; grade++) {
    counts.push(
      [1, 2]
        .map(
          (term) => all.filter((l) => l.grade === grade && l.term === term && l.subject === subject).length,
        )
        .join('/'),
    );
  }
  assert.ok(fs.statSync(path.join(root, 'content', subject + '-sources.md')).size > 100);
  console.log(label + '（二至六年级，上/下册） ' + counts.join('　'));
}
console.log(
  `通过 · ${seenBooks.size} 册 · ${all.length} 课 · ${scenes} 幕 · ${(seconds / 3600).toFixed(2)} 小时旁白 · ${officialCount} 个官方课时入口`,
);
