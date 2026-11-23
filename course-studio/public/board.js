import { esc, icon, subjectNames } from './shared.js';
import { numberLine, wordFigures, shapeFigure, gearPair } from './figures.js';
const svgNS = 'http://www.w3.org/2000/svg';
const palettes = {
  chinese: ['#f7ead3', '#8b5b35', '#f0cc9e', '#bd713e'],
  math: ['#e4efe0', '#295b4a', '#bdd9b9', '#c47933'],
  english: ['#eeebf6', '#4d527c', '#d3cfe7', '#92629e'],
};
const circle = (x, y, r, fill) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"/>';
const rect = (x, y, w, h, fill, rx = 6) =>
  '<rect x="' +
  x +
  '" y="' +
  y +
  '" width="' +
  w +
  '" height="' +
  h +
  '" rx="' +
  rx +
  '" fill="' +
  fill +
  '"/>';
const line = (x, y, X, Y, color, w = 2) =>
  '<line x1="' +
  x +
  '" y1="' +
  y +
  '" x2="' +
  X +
  '" y2="' +
  Y +
  '" stroke="' +
  color +
  '" stroke-width="' +
  w +
  '"/>';
const stext = (x, y, t, size, color) =>
  '<text x="' +
  x +
  '" y="' +
  y +
  '" text-anchor="middle" font-size="' +
  size +
  '" fill="' +
  color +
  '">' +
  esc(t) +
  '</text>';
function box(x, y, w, h, text, size, ink, align = 'center') {
  return (
    '<foreignObject x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    w +
    '" height="' +
    h +
    '"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:' +
    (align === 'left' ? 'flex-start' : 'center') +
    ';height:100%;font-size:' +
    size +
    'px;font-weight:650;line-height:1.13;overflow-wrap:anywhere;text-align:' +
    align +
    ';color:' +
    ink +
    '">' +
    esc(text) +
    '</div></foreignObject>'
  );
}
function mathFigure(item, ink, accent) {
  const s = item.replace(/\s+/g, '');
  const f = s.match(/(?:^|[^\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/);
  if (f && +f[2] > 1 && +f[2] <= 12 && +f[1] <= +f[2]) {
    const d = +f[2],
      n = +f[1],
      w = 244 / d;
    return (
      Array.from({ length: d }, (_, i) =>
        rect(238 + i * w, 306, w - 2, 28, i < n ? accent : '#d6dfd3', 2),
      ).join('') + stext(360, 363, '平均分成 ' + d + ' 份，取 ' + n + ' 份', 16, ink)
    );
  }
  const expr = s.match(/^(\d{1,2})[×x](\d{1,2})(?:[＝=]|$)/);
  if (expr && +expr[1] >= 1 && +expr[1] <= 6 && +expr[2] >= 1 && +expr[2] <= 10) {
    const rows = +expr[1],
      cols = +expr[2],
      gap = Math.min(14, 53 / rows);
    return (
      Array.from({ length: rows * cols }, (_, k) =>
        circle(
          360 + ((k % cols) - (cols - 1) / 2) * 17,
          299 + (Math.floor(k / cols) + 0.5) * gap,
          Math.min(6, gap * 0.4),
          accent,
        ),
      ).join('') + stext(360, 369, rows + ' 行，每行 ' + cols + ' 个', 15, ink)
    );
  }
  const val = s.match(/^(\d{1,2})[本颗支个张元只朵]$/);
  if (val) {
    const n = +val[1],
      t = Math.floor(n / 10),
      u = n % 10;
    return (
      Array.from({ length: t }, (_, i) => rect(204 + i * 13, 305, 9, 40, ink, 2)).join('') +
      Array.from({ length: u }, (_, i) =>
        rect(386 + (i % 5) * 14, 311 + Math.floor(i / 5) * 16, 11, 11, accent, 2),
      ).join('') +
      stext(274, 365, t + ' 个十', 15, ink) +
      stext(417, 365, u + ' 个一', 15, ink)
    );
  }
  return numberLine(item);
}
function itemTimeline(items, cues, duration) {
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const points = Array(items.length + 1).fill(null);
  points[0] = 0;
  points[items.length] = 1;
  let previous = 0,
    previousIndex = 0;
  for (let i = 1; i < items.length; i++) {
    const needle = norm(items[i]);
    if (!needle) continue;
    for (let j = 0; j < cues.length; j++) {
      const [time, text] = cues[j],
        sentence = norm(text),
        index = sentence.indexOf(needle);
      if (index < 0) continue;
      const next = cues[j + 1]?.[0] ?? duration;
      const at = (time + ((next - time) * index) / sentence.length) / duration;
      if (at > previous + 0.045 * (i - previousIndex) && at < 1 - 0.045 * (items.length - i)) {
        points[i] = at;
        previous = at;
        previousIndex = i;
        break;
      }
    }
  }
  for (let left = 0; left < items.length; ) {
    let right = left + 1;
    while (points[right] === null) right++;
    for (let i = left + 1; i < right; i++)
      points[i] = points[left] + ((points[right] - points[left]) * (i - left)) / (right - left);
    left = right;
  }
  return points;
}
export function createBoard(host, lesson) {
  const [paper, ink, tint, accent] = palettes[lesson.subject];
  let lastScene = -1,
    marks = [],
    lastItem = -1,
    figure,
    sweep,
    pen,
    timeline = [];
  function setup(sceneIndex) {
    const scene = lesson.scenes[sceneIndex],
      n = scene.items.length;
    timeline = itemTimeline(scene.items, lesson.captions?.[sceneIndex] || [], lesson.durations[sceneIndex]);
    // Stack long phrases vertically so English sentences remain readable on a phone.
    const wide = n >= 3 && scene.items.some((i) => i.length > 15);
    const vertical = wide || n > 4;
    const cells = scene.items
      .map((text, i) => {
        const cw = vertical ? 606 : Math.min(287, 606 / n - 10),
          ch = vertical ? Math.min(60, 190 / n) : 100;
        const x = vertical ? 57 : 360 + (i - (n - 1) / 2) * (cw + 10) - cw / 2,
          y = vertical ? 100 + i * (ch + 3) : 160;
        const short = text.length <= 8;
        const size = vertical
          ? text.length > 50
            ? 16
            : 21
          : short
            ? 31
            : text.length > 36
              ? 16
              : text.length > 18
                ? 19
                : 24;
        let shape = rect(x, y + 3, cw, ch, '#163a2618', 14) + rect(x, y, cw, ch, '#fffdf6', 14);
        if (lesson.subject === 'english' && !vertical)
          shape += '<path d="M' + (x + 18) + ' ' + (y + ch - 2) + 'l2 13 17-13" fill="#fffdf6"/>';
        shape += box(x + 9, y + 3, cw - 18, ch - 6, text, size, ink);
        return '<g data-mark="' + i + '">' + shape + '</g>';
      })
      .join('');
    host.innerHTML =
      '<svg role="img" aria-label="' +
      esc(scene.label + '。' + scene.items.join('，')) +
      '" viewBox="0 0 720 405" xmlns="' +
      svgNS +
      '"><defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">' +
      circle(2, 2, 1, ink + '18') +
      '</pattern></defs>' +
      rect(0, 0, 720, 405, paper, 0) +
      rect(0, 0, 720, 405, 'url(#dots)', 0) +
      '<path d="M0 352q160-36 317 7t403-12v58H0z" fill="' +
      tint +
      '" opacity=".65"/>' +
      '<g transform="translate(30 24) scale(.74)">' +
      icon(lesson.subject).replace('<svg ', '<svg width="60" height="60" ') +
      '</g>' +
      box(82, 18, 455, 46, scene.label, 25, ink, 'left') +
      stext(
        631,
        51,
        subjectNames[lesson.subject] + ' · ' + (sceneIndex + 1) + '/' + lesson.scenes.length,
        16,
        ink,
      ) +
      line(37, 78, 683, 78, ink + '51') +
      (!vertical ? line(63, 209, 657, 209, ink + '40', 3) : '') +
      cells +
      '<g data-figure></g><path data-sweep stroke="' +
      accent +
      '" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<g data-pen><path d="M-2 0l4 2L19-19l-5-4z" fill="' +
      accent +
      '"/><path d="m-2 0 4 2-5 3z" fill="' +
      ink +
      '"/></g></svg>';
    marks = [...host.querySelectorAll('[data-mark]')].map((g, i) => ({
      g,
      box: {
        x: vertical
          ? 57
          : 360 + (i - (n - 1) / 2) * (Math.min(287, 606 / n - 10) + 10) - Math.min(287, 606 / n - 10) / 2,
        y: vertical ? 100 + i * (Math.min(60, 190 / n) + 3) : 160,
        w: vertical ? 606 : Math.min(287, 606 / n - 10),
        h: vertical ? Math.min(60, 190 / n) : 100,
      },
    }));
    figure = host.querySelector('[data-figure]');
    sweep = host.querySelector('[data-sweep]');
    pen = host.querySelector('[data-pen]');
    lastItem = -1;
  }
  return function draw(sceneIndex, ratio) {
    if (sceneIndex !== lastScene) {
      setup(sceneIndex);
      lastScene = sceneIndex;
    }
    const t = Math.max(0, Math.min(0.99999, ratio));
    const active = timeline.findLastIndex((point) => point <= t);
    const local = (t - timeline[active]) / (timeline[active + 1] - timeline[active]);
    marks.forEach(({ g }, i) => {
      const visible = i <= active;
      const reveal = i === 0 ? 1 : i === active ? Math.min(1, local * 6 + 0.12) : 1;
      g.setAttribute('opacity', visible ? reveal : 0.17);
      g.setAttribute('transform', 'translate(0 ' + (visible ? (1 - reveal) * 12 : 8) + ')');
    });
    const b = marks[active].box;
    const x = b.x + 10,
      y = b.y + b.h - 4,
      w = b.w - 20;
    const p = Math.min(1, local * 2 + 0.025);
    sweep.setAttribute('d', 'M' + x + ' ' + y + 'q' + w * p * 0.5 + ' 3 ' + w * p + ' 0');
    pen.setAttribute('transform', 'translate(' + (x + w * p) + ' ' + y + ')');
    if (lastItem !== active) {
      const scene = lesson.scenes[sceneIndex],
        item = scene.items[active];
      const diagram = lesson.subject === 'math' ? mathFigure(item, ink, accent) || shapeFigure(item) : '';
      figure.innerHTML =
        (lesson.subject === 'math' && lesson.title === '旋转的齿轮' ? gearPair() : '') ||
        diagram ||
        wordFigures(item) ||
        (lesson.subject === 'math' ? shapeFigure(scene.say) : '') ||
        wordFigures(scene.say);
      lastItem = active;
    }
    for (const shape of figure.querySelectorAll('[data-motion]')) {
      shape.setAttribute(
        'transform',
        'translate(' + Math.sin(ratio * 4) * 5 + ' ' + Math.sin(ratio * 9) * 2 + ')',
      );
    }
    const trace = figure.querySelector('[data-trace]');
    if (trace) trace.setAttribute('stroke-dasharray', Math.min(1, local * 2 + 0.03) + ' 1');
    for (const gear of figure.querySelectorAll('[data-turns]')) {
      gear.setAttribute('transform', `rotate(${360 * gear.dataset.turns * t})`);
    }
  };
}
