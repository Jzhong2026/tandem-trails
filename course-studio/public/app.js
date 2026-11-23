import { api, esc, icon, subjectNames, gradeName, termName, time, safeOfficial } from './shared.js';
import { openPlayer } from './player.js';

const app = document.querySelector('#app');
let catalog = [],
  progress = [],
  release = () => {},
  version = 0;
const state = { grade: 2, subject: 'chinese', term: 1, mode: 'local', query: '', edition: '' };
const bookCache = new Map();
const button = (v, text, current, prop) =>
  '<button data-' +
  prop +
  '="' +
  esc(v) +
  '" aria-pressed="' +
  (v === current) +
  '">' +
  esc(text) +
  '</button>';
const shownTitle = (l) => gradeName(l.grade) + ' · ' + subjectNames[l.subject] + ' · ' + termName(l.term);
const byId = (id) => catalog.find((l) => l.id === id);
const terms = () => [1, 2].map((t) => button(t, termName(t), state.term, 'term')).join('');
const getBook = () =>
  catalog.filter((l) => l.grade === state.grade && l.term === state.term && l.subject === state.subject);
const saved = (id) => progress.find((p) => p.lesson_id === id);
function lessonLink(l, history = false) {
  const p = saved(l.id);
  const status = p?.watched ? '已看完' : p?.seconds > 0 ? '学至 ' + time(p.seconds) : '';
  return (
    '<a class="lesson-link" href="#lesson/' +
    l.id +
    '"><span class="playicon" aria-hidden="true">▶</span><span>' +
    esc(l.title) +
    (history ? '<br><small class="muted">' + shownTitle(l) + '</small>' : '') +
    '</span><span class="end">' +
    (status ? status + ' · ' : '') +
    time(l.duration) +
    '</span></a>'
  );
}
function shelf() {
  const { grade, subject } = state;
  const list = getBook();
  const parts = Object.keys(subjectNames)
    .map(
      (s, i) =>
        '<button class="subject ' +
        ['cn', 'ma', 'en'][i] +
        '" data-subject="' +
        s +
        '" aria-pressed="' +
        (s === subject) +
        '">' +
        icon(s) +
        '<div><strong>' +
        subjectNames[s] +
        '</strong><span>' +
        catalog.filter((l) => l.grade === grade && l.subject === s && l.term === state.term).length +
        ' 节动画课</span></div></button>',
    )
    .join('');
  const editions = [...new Set(list.map((l) => l.edition))].filter(Boolean);
  if (!editions.includes(state.edition)) state.edition = editions[0] || '';
  app.innerHTML =
    '<section class="hero"><div class="hero-copy"><small>上海 · 五四学制</small><h1>沪上动画课堂</h1><p>二至六年级的语文、数学与英语动画课</p></div><img src="/shanghai.svg" alt="黄浦江上的帆船与上海城市剪影"></section>' +
    '<section class="bookshelf"><div class="sectionhead"><h2>我的课程书架</h2><div class="gradebar" aria-label="年级">' +
    [2, 3, 4, 5, 6].map((n) => button(n, gradeName(n), grade, 'grade')).join('') +
    '</div></div><div class="subject-grid">' +
    parts +
    '</div></section>' +
    '<section class="library-panel"><div class="rowbetween"><h2>' +
    gradeName(grade) +
    subjectNames[subject] +
    ' <small class="muted">' +
    (grade === 6 ? '初中预备' : '小学') +
    '</small></h2><div class="termbar" aria-label="学期">' +
    terms() +
    '</div></div>' +
    '<div class="filters"><div class="modebar">' +
    button('local', '原创动画课', state.mode, 'mode') +
    button('official', '上海空中课堂', state.mode, 'mode') +
    '</div>' +
    (editions.length > 1 && state.mode === 'local'
      ? '<label>教材 <select id="edition">' +
        editions
          .map((e) => '<option ' + (e === state.edition ? 'selected' : '') + '>' + esc(e) + '</option>')
          .join('') +
        '</select></label>'
      : '') +
    '<input type="search" id="search" aria-label="搜索本册课程" placeholder="搜索本册课题" value="' +
    esc(state.query) +
    '"></div><div id="results"></div>' +
    '<div class="source-foot hint"><a target="_blank" rel="noopener" href="/sources/' +
    subject +
    '">查看本学科教材依据与覆盖说明</a></div></section>';
  app.querySelector('#search').oninput = (e) => {
    state.query = e.target.value;
    results();
  };
  const picker = app.querySelector('#edition');
  if (picker)
    picker.onchange = () => {
      state.edition = picker.value;
      results();
    };
  for (const prop of ['grade', 'subject', 'term', 'mode']) {
    app.querySelectorAll('[data-' + prop + ']').forEach(
      (b) =>
        (b.onclick = () => {
          state[prop] = ['grade', 'term'].includes(prop) ? Number(b.dataset[prop]) : b.dataset[prop];
          state.query = '';
          state.edition = '';
          shelf();
        }),
    );
  }
  results();
}
async function results() {
  const target = document.querySelector('#results');
  if (!target) return;
  const q = state.query.trim().toLowerCase(),
    { subject, grade, term } = state;
  if (state.mode === 'official') {
    const key = [subject, grade, term].join('/');
    try {
      if (!bookCache.has(key)) bookCache.set(key, await api('/api/official/' + key));
      if (!target.isConnected || state.mode !== 'official' || q !== state.query.trim().toLowerCase()) return;
      const book = bookCache.get(key),
        lessons = book.lessons.filter((l) => l.name.toLowerCase().includes(q));
      target.innerHTML =
        '<p class="browse-count">' +
        esc(book.edition) + ' · ' +
        lessons.length +
        ' 个官方课时 · 在上海智慧教育平台播放</p><div class="resources">' +
        lessons
          .map(
            (l) =>
              '<a class="resource-row" target="_blank" rel="noopener" href="' +
              esc(safeOfficial(l.url)) +
              '">' +
              esc(l.name) +
              '<span class="end">官方课堂 ↗</span></a>',
          )
          .join('') +
        '</div>';
    } catch {
      if (target.isConnected) target.textContent = '官方目录读取失败，请重新选择本册。';
    }
    return;
  }
  const list = getBook().filter(
    (l) =>
      (!state.edition || !l.edition || l.edition === state.edition) &&
      (l.unit + ' ' + l.title).toLowerCase().includes(q),
  );
  const units = new Map();
  for (const l of list) {
    if (!units.has(l.unit)) units.set(l.unit, []);
    units.get(l.unit).push(l);
  }
  target.innerHTML =
    '<p class="browse-count">' +
    esc(state.edition ? state.edition + ' · ' : '') +
    units.size +
    ' 个单元或专题 · ' +
    list.length +
    ' 节动画课</p>' +
    ([...units]
      .map(
        ([u, ls], i) =>
          '<details class="unit" ' +
          (i === 0 || q ? 'open' : '') +
          '><summary>' +
          esc(u) +
          '<small>' +
          ls.length +
          ' 课</small></summary>' +
          ls.map((l) => lessonLink(l)).join('') +
          '</details>',
      )
      .join('') || '<p class="empty">没有找到这门课，试试其他课题名称。</p>');
}
function history() {
  app.innerHTML =
    '<h1 class="history-title">我的学习</h1><p class="subtitle">这台浏览器的观看记录与练习进度</p><section class="panel history-list">' +
    (progress.length
      ? progress
          .map((p) => {
            const l = byId(p.lesson_id);
            return l
              ? lessonLink(l, true) + (p.mastered ? '<small class="muted">课后练习已答对</small>' : '')
              : '';
          })
          .join('')
      : '<p class="empty">学完第一段动画后，可以在这里继续观看。</p><a class="text-link" href="#library">去课程书架</a>') +
    '</section>';
}
async function route() {
  const seq = ++version;
  const closing = release();
  release = () => {};
  const id = location.hash.startsWith('#lesson/') ? location.hash.slice(8) : '';
  const isHistory = location.hash === '#history';
  document.querySelector('#library-nav').classList.toggle('active', !isHistory);
  document.querySelector('#history-nav').classList.toggle('active', isHistory);
  try {
    await closing;
    const records = await api('/api/progress');
    if (seq !== version) return;
    progress = records;
    if (id) {
      const l = byId(id);
      if (!l) throw Error('找不到这节课');
      Object.assign(state, { grade: l.grade, subject: l.subject, term: l.term, edition: l.edition });
      const lesson = await api('/api/lessons/' + encodeURIComponent(id));
      if (seq !== version) return;
      release = openPlayer(
        app,
        lesson,
        getBook().filter((x) => x.edition === l.edition),
        saved(id),
      );
      document.title = l.title + ' · 沪上动画课堂';
    } else {
      document.title = (isHistory ? '我的学习' : '课程书架') + ' · 沪上动画课堂';
      if (isHistory) history();
      else shelf();
    }
    window.scrollTo(0, 0);
  } catch (e) {
    if (seq === version)
      app.innerHTML = '<p class="error">' + esc(e.message) + '</p><a href="#library">返回课程书架</a>';
  }
}
try {
  catalog = await api('/api/catalog');
  window.addEventListener('hashchange', route);
  await route();
} catch {
  app.textContent = '课程服务暂时无法连接，请刷新页面重试。';
}
