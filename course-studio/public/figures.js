import { esc } from './shared.js';

// Draw only motifs supported by the current scene's words. The audio clock drives
// their translation and reveal, so pausing, seeking and replay remain frame-accurate.
const path = (d, fill, stroke = 'none', w = 2) =>
  '<path d="' +
  d +
  '" fill="' +
  fill +
  '" stroke="' +
  stroke +
  '" stroke-width="' +
  w +
  '" stroke-linecap="round" stroke-linejoin="round"/>';
const circle = (x, y, r, fill) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"/>';
const label = (x, y, s, size = 14) =>
  '<text x="' +
  x +
  '" y="' +
  y +
  '" text-anchor="middle" fill="#355545" font-weight="600" font-size="' +
  size +
  '">' +
  esc(s) +
  '</text>';
const motifs = [
  [
    /蝌蚪|长出后腿|尾巴变短/,
    () =>
      path('M-40 19q21 16 38-2 10-12 15-13l-3-6q-11 0-20 15-7 16-30 6z', '#587e70') +
      circle(19, -4, 14, '#4d7163') +
      circle(25, -8, 3, '#fff9cf') +
      circle(26, -8, 1.5, '#344e43') +
      path('M-48 32q12 4 24 0t22 0', 'none', '#8cb9b2'),
  ],
  [
    /水滴|雨滴|云滴/,
    () =>
      path('M0-31Q-35 5-20 21q19 21 36 2Q32 9 0-31z', '#8bbfcc', '#669ba8') +
      path('M-13 7q-4 13 6 15', 'none', '#d9f1ee', 3),
  ],
  [
    /一朵云|云朵|白云|\bcloudy?\b/i,
    () => path('M-38 13q-10-17 8-23 4-22 25-19 16-1 22 12 23-5 28 13 5 20-17 21h-55z', '#eaf4ef', '#93b3a8'),
  ],
  [
    /小兔|兔子|\brabbits?\b/i,
    () =>
      path('M-18-9q-14-29-5-31 11-2 16 30m3-2q0-32 9-30 10 3 2 32', '#e7d5c1', '#8e8373') +
      circle(-3, 5, 20, '#e7d5c1') +
      circle(13, 16, 17, '#e7d5c1') +
      circle(32, 13, 6, '#f6ebd9') +
      circle(-11, 0, 2, '#4e5046'),
  ],
  [
    /胡萝卜|\bcarrots?\b/i,
    () =>
      path('M-26 26Q-10-18 9-18q12 0 12 11Q20 7-26 26z', '#df9361', '#b9744e') +
      path('M15-17q-1-15 8-16m-3 15q13-12 20-7', 'none', '#71a478', 4),
  ],
  [
    /风筝|\bkite\b/i,
    () =>
      path('M-30 40q30-34 39-26t16-16', 'none', '#8d7060') +
      path('M0-6 20-30 38-9 20 10z', '#d99863', '#765a3b') +
      path('M20-30v40M0-6l38-3', 'none', '#fff2d4'),
  ],
  [
    /纸船|小船|帆船|\bboat\b/i,
    () =>
      path('M-45 12h88L29 26h-60z', '#bf8357', '#645541') +
      path('M0 8v-37l-30 36z', '#f9eabf', '#8e7558') +
      path('M5-25 26 7H5z', '#d9a46d') +
      path('M-55 31q10 6 20 0t20 0t20 0t20 0t20 0', 'none', '#80b4ac'),
  ],
  [
    /小河|溪流|瀑布|江水|\briver\b/i,
    () =>
      path('M-57 14q23-20 51-8t64 0v23q-35 15-61 3t-54 2z', '#91bcb9') +
      path('M-47 18q17-10 33-4m19 6q18 7 35 0', 'none', '#e9f5ea'),
  ],
  [
    /叶子|树叶|落叶|\bleaf\b|\bleaves\b/i,
    () =>
      path('M-30 28Q-32-20 37-30 30 21-30 28z', '#8bb88a', '#508760') +
      path('M-38 36 26-20m-40 35-2-16m17 5 17 0', 'none', '#508760'),
  ],
  [
    /种子|发芽|幼苗|\bseed\b|\bgrow\b/i,
    () =>
      path('M-45 29q48-15 90 0', '#b59064', '#927957') +
      path('M0 24V-14', 'none', '#44805b', 4) +
      path('M0 4q-28 1-31-22Q-6-19 0 4zm1-10q4-25 31-25Q27-6 1-6z', '#8ab785', '#54855f'),
  ],
  [
    /太阳|阳光|\bsun(?:ny|shine)?\b/i,
    () =>
      Array.from(
        { length: 8 },
        (_, i) => '<g transform="rotate(' + i * 45 + ')">' + path('M0-26v-9', 'none', '#d3a250', 3) + '</g>',
      ).join('') + circle(0, 0, 20, '#efba63'),
  ],
  [
    /月亮|月光|\bmoon\b/i,
    () =>
      path('M15-29a31 31 0 1 0 21 42A35 35 0 0 1 15-29z', '#e6bb69', '#c5a35c') +
      circle(38, -16, 2, '#c69f53') +
      circle(-38, -17, 3, '#c69f53'),
  ],
  [
    /下雨|雨滴|大雨|小雨|\brain(?:y|ing)?\b/i,
    () =>
      path('M-37 4q-8-15 9-18 7-22 27-12 13-8 22 6 22-1 22 22z', '#b7cfce', '#81a4a5') +
      [-21, 0, 21].map((n) => path('M' + n + ' 13l-5 12', 'none', '#6fa3b2', 3)).join(''),
  ],
  [
    /开花|花朵|鲜花|\bflowers?\b/i,
    () =>
      path('M0 30V4m0 14q18-12 25-6-6 12-25 6', 'none', '#568665', 3) +
      Array.from(
        { length: 5 },
        (_, i) =>
          '<g transform="translate(0 -9) rotate(' + i * 72 + ')">' + circle(0, -11, 10, '#d69587') + '</g>',
      ).join('') +
      circle(0, -9, 8, '#e9be6d'),
  ],
  [
    /小鸟|飞鸟|\bbirds?\b/i,
    () =>
      path('M-35 4l15-2Q-8-15 6-9q15-25 27-7l-4 13q-4 27-34 17z', '#9bb5b0', '#5c7867') +
      path('M-12 1q8 20 24 1', 'none', '#5c7867') +
      path('m30-13 12 5-12 5z', '#dab36d') +
      circle(23, -12, 2, '#345543'),
  ],
  [
    /铅笔|\bpencils?\b/i,
    () =>
      path('M-37 19 23-32l9 10-60 52-16 5z', '#e3b960', '#856c48') +
      path('m23-32 4-4q3-2 7 3l3 4-5 7z', '#d59d8c') +
      path('m-37 19-7 16 16-5z', '#efdec0', '#856c48'),
  ],
  [
    /书本|图书|\bbooks?\b/i,
    () =>
      path('M-41-22q19-6 41 5 18-10 41-5v45q-23-6-41 3-20-10-41-3z', '#f4e4bc', '#827150') +
      path('M0-16v42m-32-34 21 4m-21 5 20 4m20-9 21-4m-21 13 20-4', 'none', '#ac9c77'),
  ],
  [
    /足球|\bfootball\b|\bsoccer\b/i,
    () =>
      circle(0, 0, 29, '#fffae8') +
      path(
        'm0-12 13 10-5 13H-8l-5-13zM-28-8l9-9 2-7-8 5zm43-14 9 8 5 1-5-9zM-17 23l10 6 6-2-11-8z',
        '#506e5a',
      ),
  ],
];
const colors = {
  red: '#d36b65',
  blue: '#739fc5',
  green: '#83ad83',
  yellow: '#e3bd5c',
  pink: '#d699aa',
  purple: '#ab91bd',
  orange: '#dda36b',
  white: '#fcfcf3',
  black: '#46534e',
  brown: '#a98062',
};
function colorItems(text) {
  const m = text.match(
    /\b(?:(one|two|three|four|five|six)\s+)?(red|blue|green|yellow|pink|purple|orange|white|black|brown)\b(?:\s+(pencils?|books?))?/i,
  );
  if (!m) return '';
  const [, quantity, color, noun] = m.map((v) => v?.toLowerCase());
  const n = quantity ? ['', 'one', 'two', 'three', 'four', 'five', 'six'].indexOf(quantity) : 1,
    ink = colors[color];
  return Array.from({ length: n }, (_, i) => {
    const symbol = noun?.startsWith('pencil')
      ? path('M-18 18 15-26l8 6-33 44-13 8z', ink, '#665e56') +
        path('m-18 18 8 6-13 8z', '#e5ceaa', '#665e56')
      : noun?.startsWith('book')
        ? path('M-20-20h34l6 7v32h-35l-5-6z', ink, '#665e56') + path('M-14-13h34m-34 0v33', 'none', '#fbf8e8')
        : circle(0, 0, 17, ink);
    return '<g transform="translate(' + (360 + (i - (n - 1) / 2) * 47) + ' 333)">' + symbol + '</g>';
  }).join('');
}
export function wordFigures(focus) {
  if (/长出.{0,2}后腿|尾巴变短/.test(focus)) {
    const shortTail = focus.includes('尾巴变短');
    const tail = shortTail ? 'M-13 4q-12 12-22 6 10 14 27 1z' : 'M-12 5q-20 17-47 10 20 20 54-3z';
    const hindLegs = path('M-6 9l-13 5 8 11-17 1m27-19-9 8 10 9-13 3', 'none', '#588357', 4);
    const forelegs = shortTail ? path('M13 8l8 10 11-4m-13-8 11 5 7-4', 'none', '#588357', 3) : '';
    return (
      '<g transform="translate(360 323)"><g data-motion>' +
      path(tail, '#72976b') +
      hindLegs +
      forelegs +
      '<ellipse rx="20" ry="12" fill="#82a879"/>' +
      circle(13, -6, 9, '#82a879') +
      circle(17, -11, 4, '#e8edc6') +
      circle(18, -11, 2, '#264e3d') +
      '</g></g>'
    );
  }
  const colorsDiagram = colorItems(focus);
  if (colorsDiagram) return colorsDiagram;
  const matches = motifs.filter(([rx]) => rx.test(focus)).slice(0, 2);
  if (!matches.length) return '';
  return matches
    .map(
      ([, paint], i) =>
        '<g transform="translate(' +
        (360 + (i - (matches.length - 1) / 2) * 140) +
        ' 327)"><g data-motion>' +
        paint() +
        '</g></g>',
    )
    .join('');
}
export function numberLine(item) {
  const m = item.replace(/\s/g, '').match(/^(\d{1,3})([＋+−-])(\d{1,2})[=＝](\d{1,3})$/);
  if (!m) return '';
  const a = +m[1],
    b = +m[3],
    c = +m[4],
    plus = m[2] === '+' || m[2] === '＋';
  if (!b || (plus ? a + b : a - b) !== c) return '';
  const x = plus ? 221 : 499,
    end = 720 - x,
    sign = plus ? '＋' : '−';
  return (
    path('M185 341h350', 'none', '#8da697', 2) +
    circle(x, 341, 5, '#305d49') +
    circle(end, 341, 5, '#b47c45') +
    '<path data-trace d="M' +
    x +
    ' 336Q360 258 ' +
    end +
    ' 336" pathLength="1" fill="none" stroke="#b47c45" stroke-width="3"/>' +
    path(plus ? 'M489 323l10 13-15-5' : 'M231 323l-10 13 15-5', 'none', '#b47c45') +
    label(x, 368, a, 18) +
    label(end, 368, c, 18) +
    label(360, 291, sign + b, 18)
  );
}

function chineseNumber(s) {
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const digits = '零一二三四五六七八九';
  if (s === '两') return 2;
  if (s.length === 1 && digits.includes(s)) return digits.indexOf(s);
  const m = s.match(/^([一二三四五六七八九]?)十([一二三四五六七八九]?)$/);
  return m ? (m[1] ? digits.indexOf(m[1]) : 1) * 10 + (m[2] ? digits.indexOf(m[2]) : 0) : NaN;
}
export function shapeFigure(text) {
  const clock = text.match(/([零一二三四五六七八九十两\d]+)时([零一二三四五六七八九十\d]+)(?:分|[，。]|$)/);
  if (clock) {
    const hours = chineseNumber(clock[1]),
      minutes = chineseNumber(clock[2]);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const hand = (degrees, radius, color, width) => {
        const angle = (degrees * Math.PI) / 180;
        return path(
          `M360 328l${radius * Math.sin(angle)} ${-radius * Math.cos(angle)}`,
          'none',
          color,
          width,
        );
      };
      const ticks = Array.from(
        { length: 12 },
        (_, i) => `<g transform="rotate(${30 * i} 360 328)">${path('M360 298v3', 'none', '#456a57', 2)}</g>`,
      ).join('');
      return (
        circle(360, 328, 33, '#fcf5d7') +
        ticks +
        hand(((hours % 12) + minutes / 60) * 30, 17, '#39674d', 4) +
        hand(minutes * 6, 25, '#bd773d', 3) +
        circle(360, 328, 3, '#476852') +
        label(425, 335, hours + ':' + String(minutes).padStart(2, '0'), 18)
      );
    }
  }
  const match = text.match(/([0-9零一二三四五六七八九十两]+)分之([0-9零一二三四五六七八九十两]+)/);
  if (match) {
    const d = chineseNumber(match[1]),
      n = chineseNumber(match[2]);
    if (d >= 2 && d <= 16 && n >= 0 && n <= d) {
      return (
        Array.from(
          { length: d },
          (_, i) =>
            '<rect x="' +
            (243 + (i * 234) / d) +
            '" y="313" width="' +
            (234 / d - 2) +
            '" height="23" fill="' +
            (i < n ? '#c98b50' : '#c5d9c3') +
            '"/>',
        ).join('') + label(360, 363, n + ' / ' + d, 18)
      );
    }
  }
  const angle = text.match(/(\d+(?:\.\d+)?)\s*[°度]/);
  if (angle && +angle[1] > 0 && +angle[1] <= 180 && /角|°/.test(text)) {
    const deg = +angle[1],
      a = (deg * Math.PI) / 180;
    const x = 347 + 67 * Math.cos(a),
      y = 351 - 67 * Math.sin(a);
    return (
      path('M417 351H347L' + x + ' ' + y, 'none', '#467861', 3) +
      path(
        'M370 351A23 23 0 0 0 ' + (347 + 23 * Math.cos(a)) + ' ' + (351 - 23 * Math.sin(a)),
        'none',
        '#bd7f43',
      ) +
      label(430, 336, deg + '°', 17)
    );
  }
  const shape = text.match(/平行四边形|长方形|正方形|直角三角形|等边三角形|三角形|梯形|圆柱|直径|半径/);
  if (!shape) return '';
  const name = shape[0],
    ink = '#507e64',
    paper = '#c4dcc2';
  const outlines = {
    平行四边形: 'M297 350l28-54h99l-28 54z',
    长方形: 'M299 350v-54h122v54z',
    正方形: 'M332 350v-56h56v56z',
    梯形: 'M298 350l29-52h63l31 52z',
    三角形: 'M303 350l48-57 66 57z',
    直角三角形: 'M312 350v-58l99 58z',
    等边三角形: 'M328 350l32-55.43 32 55.43z',
  };
  if (outlines[name]) return path(outlines[name], paper, ink, 3) + label(360, 373, name);
  if (name === '圆柱')
    return (
      path('M327 306v37a33 10 0 0 0 66 0v-37', paper, ink) +
      '<ellipse cx="360" cy="306" rx="33" ry="10" fill="#dce8cc" stroke="' +
      ink +
      '" stroke-width="2"/>' +
      label(360, 373, name)
    );
  return (
    circle(360, 323, 29, paper) +
    circle(360, 323, 3, ink) +
    path('M' + (name === '直径' ? 331 : 360) + ' 323h' + (name === '直径' ? 58 : 29), 'none', '#ad7140', 3) +
    label(360, 373, name)
  );
}

export function gearPair() {
  function gear(cx, radius, teeth, color, turns) {
    const points = [];
    for (let i = 0; i < teeth * 4; i++) {
      const angle = (2 * Math.PI * i) / (teeth * 4);
      const r = radius + (i % 4 === 1 || i % 4 === 2 ? 2 : -2);
      points.push(`${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`);
    }
    return `<g transform="translate(${cx} 326)"><g data-turns="${turns}"><polygon points="${points.join(' ')}" fill="${color}"/>
      ${circle(0, 0, 5, '#fff9e2')}${path('M0 -8V-' + (radius - 7), 'none', '#fff9e2', 3)}</g></g>`;
  }
  return (
    gear(330, 19, 12, '#c38c54', 1) +
    gear(387, 38, 24, '#52816b', -0.5) +
    label(330, 381, '12 齿') +
    label(393, 381, '24 齿')
  );
}
