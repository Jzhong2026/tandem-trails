import type { StudyCourse } from './study.js';

export const WORKSHOP_GAMES = {
  optics: {
    name: '光镜工坊',
    subject: '科学与几何',
    rule: '旋转镜片，让光束经过转角照亮水晶。每个人都能改变全桌的光路。',
  },
  atlas: {
    name: '罗盘寻宝',
    subject: '数学与地理',
    rule: '读懂探险日志，用方向、格数或坐标找出岛上埋藏宝箱的位置。',
  },
  chronicle: {
    name: '时序博物馆',
    subject: '语文、英语与综合',
    rule: '把打乱的展品排成一条证据充分的时间线，全桌一起策展。',
  },
} as const;
export type WorkshopMode = keyof typeof WORKSHOP_GAMES;
export function isWorkshopMode(mode: unknown): mode is WorkshopMode {
  return typeof mode === 'string' && Object.hasOwn(WORKSHOP_GAMES, mode);
}
export const WORKSHOP_ROUNDS = 4;
export type Point = { x: number; y: number };
export type Mirror = { cell: number; slash: boolean };
export type Board =
  | { kind: 'optics'; size: number; startRow: number; target: number; relays: number[]; mirrors: Mirror[] }
  | { kind: 'atlas'; size: number; axisMin: number; landmark: number }
  | { kind: 'chronicle'; cards: string[] };
export interface Puzzle {
  board: Board;
  title: string;
  prompt: string;
  hint: string;
  explanation: string;
  answer: number[];
}
export interface WorkshopPlayer {
  seat: number;
  name: string;
  points: number;
  retired: boolean;
}
export interface WorkshopView {
  board: Board;
  title: string;
  prompt: string;
  hint: string | null;
  message: string;
  round: number;
  revision: number;
  selection: number[];
  solved: boolean;
  finished: boolean;
  players: WorkshopPlayer[];
}
export interface WorkshopAction {
  round: number;
  revision: number;
  type: 'select' | 'move' | 'undo' | 'clear' | 'test' | 'hint' | 'next';
  index?: number;
  destination?: number;
}

export function traceLight(board: Extract<Board, { kind: 'optics' }>) {
  const directions = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const path: Point[] = [{ x: -0.5, y: board.startRow }];
  const seen = new Set<number>();
  const charged = new Set<number>();
  let x = -1,
    y = board.startRow,
    dir = 0;
  while (true) {
    x += directions[dir][0];
    y += directions[dir][1];
    if (x < 0 || y < 0 || x >= board.size || y >= board.size) {
      path.push({ x: x - directions[dir][0] * 0.5, y: y - directions[dir][1] * 0.5 });
      return { path, lit: false };
    }
    path.push({ x, y });
    const cell = y * board.size + x;
    if (board.relays.includes(cell)) charged.add(cell);
    if (cell === board.target) return { path, lit: charged.size === board.relays.length };
    const key = cell * 4 + dir;
    if (seen.has(key)) return { path, lit: false };
    seen.add(key);
    const mirror = board.mirrors.find((m) => m.cell === cell);
    if (mirror) dir ^= mirror.slash ? 3 : 1;
  }
}

function optics(course: StudyCourse, round: number, variant: number): Puzzle {
  const simple = course.grade < 4 && round < 2;
  const size = simple ? 5 : course.grade >= 7 ? 7 : 6;
  const flip = (variant + round) % 2 === 0;
  const row = (y: number) => (flip ? size - 1 - y : y);
  const start = row(size - 2),
    bend = row(1),
    finish = simple ? bend : row(Math.floor(size / 2));
  const col = 1 + ((round + variant) % (size - 4));
  const turn = (x: number, y: number, slash: boolean) => ({ cell: y * size + x, slash });
  const mirrors = [turn(col, start, bend < start), turn(col, bend, bend < start)];
  if (!simple) mirrors.push(turn(size - 2, bend, finish < bend), turn(size - 2, finish, finish < bend));
  const solution = mirrors.map((m) => Number(m.slash));
  // Each new puzzle starts unsolved. Preserve a solvable beam route for every orientation.
  const scrambled = mirrors.map((m, i) => ({
    ...m,
    slash: i === 0 || (i + round) % 3 === 0 ? !m.slash : m.slash,
  }));
  if (course.grade >= 7) scrambled.push(turn(size - 1, row(0), true));
  const relays = round >= 2 ? [Math.floor((start + bend) / 2) * size + col] : [];
  return {
    board: {
      kind: 'optics',
      size,
      startRow: start,
      target: finish * size + size - 1,
      relays,
      mirrors: scrambled,
    },
    title: simple ? '点亮第一束光' : '穿过反射长廊',
    prompt: relays.length
      ? '让光束先穿过金色光环，再送到水晶。转动镜片后检验整条光路。'
      : '点镜片切换方向，把左边射入的光送到金色水晶，再检验光路。',
    hint: '从光源一面一面看。水平向右的光遇到「／」会向上，遇到「＼」会向下。',
    explanation:
      course.grade >= 7
        ? '镜面处的入射角与反射角相等，两个角都相对法线测量。45° 的镜片能让水平光线转过直角。'
        : '光会沿直线前进。改变镜片方向，就能让反射光向上或向下。',
    answer: solution,
  };
}

function atlas(course: StudyCourse, round: number, variant: number): Puzzle {
  const size = course.grade >= 7 ? 7 : 5,
    min = course.grade >= 7 ? -3 : 1;
  const fromX = (round + variant) % size,
    fromY = (round * 2 + variant) % size;
  let toX = (fromX + 1 + (round % 2)) % size,
    toY = (fromY + 1 + (variant % 2)) % size;
  const coord = (x: number, y: number) => `(${x + min}, ${y + min})`;
  let prompt: string, hint: string, explanation: string;
  if (course.grade >= 7 && round % 2 === 0) {
    const vertical = round === 0;
    const lx = vertical && fromX + min === 0 ? fromX + 1 : fromX;
    const ly = !vertical && fromY + min === 0 ? fromY + 1 : fromY;
    toX = vertical ? -(lx + min) - min : lx;
    toY = vertical ? ly : -(ly + min) - min;
    prompt = `灯塔位于 ${coord(lx, ly)}。宝箱与它关于 ${vertical ? 'y' : 'x'} 轴对称。`;
    hint = vertical ? '关于 y 轴对称，纵坐标保持不变。' : '关于 x 轴对称，横坐标保持不变。';
    explanation = `${hint} 另一个坐标变号，宝箱位于 ${coord(toX, toY)}。`;
    return {
      board: { kind: 'atlas', size, axisMin: min, landmark: (size - 1 - ly) * size + lx },
      title: '镜像海岛',
      prompt,
      hint,
      explanation,
      answer: [(size - 1 - toY) * size + toX],
    };
  }
  if (course.grade >= 8 && round === 3) {
    const x = toX + min,
      y = toY + min,
      b = y - 2 * x;
    prompt = `宝箱横坐标为 ${x}，位于直线 y = 2x ${b < 0 ? '−' : '+'} ${Math.abs(b)} 上。找到这个点。`;
    hint = '先将给出的横坐标代入函数求纵坐标，再按照先横后纵的顺序找点。';
    explanation = `代入 x=${x}，得到 y=${y}，所以宝箱在 ${coord(toX, toY)}。`;
    return {
      board: { kind: 'atlas', size, axisMin: min, landmark: (size - 1 - fromY) * size + fromX },
      title: '函数航线',
      prompt,
      hint,
      explanation,
      answer: [(size - 1 - toY) * size + toX],
    };
  }
  const dx = toX - fromX,
    dy = toY - fromY;
  const from = course.grade < 4 ? `第 ${fromX + 1} 列、第 ${fromY + 1} 行` : coord(fromX, fromY);
  const goal = course.grade < 4 ? `第 ${toX + 1} 列、第 ${toY + 1} 行` : coord(toX, toY);
  prompt = `从${from}的灯塔出发，向${dx > 0 ? '东' : '西'} ${Math.abs(dx)} 格，再向${dy > 0 ? '北' : '南'} ${Math.abs(dy)} 格。`;
  hint = '先横着走到正确的一列，再竖着走。地图上方是北，右方是东。';
  explanation = `从灯塔先改变列，再改变行。最后落在${goal}。`;
  return {
    board: { kind: 'atlas', size, axisMin: min, landmark: (size - 1 - fromY) * size + fromX },
    title: '群岛航海图',
    prompt,
    hint,
    explanation,
    answer: [(size - 1 - toY) * size + toX],
  };
}

interface Exhibit {
  title: string;
  cards: string[];
  hint: string;
  explanation: string;
}
const young: Exhibit[] = [
  {
    title: '一粒种子的记录',
    cards: ['把种子放进湿土', '看见幼根伸出', '嫩芽钻出地面', '长出第一对真叶'],
    hint: '观察顺序从播种开始，地下的变化在前。',
    explanation: '先播种，随后发芽生根，芽出土后继续生长。',
  },
  {
    title: '校园一天',
    cards: ['早上七时出发', '上午九时做操', '中午十二时午餐', '下午三时放学'],
    hint: '上午在中午之前，下午在中午之后。',
    explanation: '按一天里的实际时刻比较，下午三时是 15 时。',
  },
  {
    title: '借书故事',
    cards: ['走进图书馆', '从书架选中一本书', '带着选好的书去办借阅', '带着借好的书离开'],
    hint: '后一句需要前一句创造的条件。',
    explanation: '选择、办理、带走按事件之间的因果关系先后发生。',
  },
  {
    title: 'My morning',
    cards: [
      'I wake up.',
      'After waking up, I get dressed.',
      'Then I put on my shoes.',
      'Finally, I leave home.',
    ],
    hint: 'After、Then、Finally 给出了先后线索。',
    explanation: '先醒来，穿好衣服后穿鞋，最后出门。',
  },
  {
    title: '算式旅行',
    cards: ['2 × 3', '12 − 3', '3 × 4', '9 + 8'],
    hint: '先分别算出四个结果，再从小到大排列。',
    explanation: '四个结果依次为 6、9、12、17。',
  },
  {
    title: '一年四季',
    cards: ['三月春游', '六月赏荷', '九月赏桂', '十二月踏冬'],
    hint: '按同一年的月份前后排列。',
    explanation: '同一年中，3 月、6 月、9 月、12 月依次到来。',
  },
];
const senior: Exhibit[] = [
  {
    title: '实数刻度',
    cards: ['−√9', '−½', '0.25', '√4'],
    hint: '先把根式化简。所有负数都在零的左边。',
    explanation: '−3 < −0.5 < 0.25 < 2。',
  },
  {
    title: '证据的旅程',
    cards: [
      '提出待检验的问题',
      '设计能区分不同解释的对照',
      '执行方案并如实记录现象',
      '根据所得数据评价原来的解释',
    ],
    hint: '数据要在设计方案并观察以后才能获得。',
    explanation: '提出问题、设计、记录和评价是这一轮探究的顺序；新结果还可以引出下一轮问题。',
  },
  {
    title: '小说里的那封信',
    cards: [
      '她先在旧书中发现一封信',
      '读完信后，她决定去寻找落款的人',
      '按信上地址，她敲开了一扇门',
      '见面之后，她终于明白了那句嘱托',
    ],
    hint: '抓住“读完”“按信上地址”和“见面之后”。',
    explanation: '情节由发现线索、作出决定、付诸行动和理解意义四步组成。',
  },
  {
    title: 'The school exhibition',
    cards: [
      'First, our class chose a theme.',
      'Once the theme was chosen, we collected objects.',
      'After collecting them, we wrote the labels.',
      'Finally, we opened the exhibition.',
    ],
    hint: 'Look for First, Once, After and Finally.',
    explanation: '先定主题，才收集展品、写说明，最后开展。',
  },
  {
    title: '比例尺档案',
    cards: [
      '图上 1 cm 代表实际 1 m',
      '图上 1 cm 代表实际 10 m',
      '图上 1 cm 代表实际 100 m',
      '图上 1 cm 代表实际 1 km',
    ],
    hint: '按同样图上长度代表的实际距离从小到大排。',
    explanation: '统一换成米，分别是 1、10、100、1000 米。',
  },
  {
    title: '凸多边形展架',
    cards: ['三个内角的和', '四个内角的和', '五个内角的和', '六个内角的和'],
    hint: '按三角形、四边形、五边形、六边形的内角和从小到大排。',
    explanation: '凸 n 边形内角和为 (n−2)×180°，四个总量依次为 180°、360°、540°、720°。',
  },
];
function chronicle(course: StudyCourse, round: number, variant: number): Puzzle {
  const set =
    course.grade >= 7 ? senior : course.grade < 4 ? young : [...young.slice(2), senior[1], senior[2]];
  const q = set[(round + variant + course.term - 1) % set.length];
  const orders = [
    [2, 0, 3, 1],
    [1, 3, 0, 2],
    [3, 1, 2, 0],
    [2, 3, 1, 0],
  ];
  const order = orders[(round + variant) % orders.length],
    cards = order.map((i) => q.cards[i]);
  return {
    title: q.title,
    board: { kind: 'chronicle', cards },
    prompt:
      q.title.includes('算式') ||
      q.title === '实数刻度' ||
      q.title.includes('比例尺') ||
      q.title.includes('多边形')
        ? '计算或比较四件展品表示的量，按从小到大布展。'
        : '从最早的一步开始，依次选择四件展品。',
    hint: q.hint,
    explanation: q.explanation,
    answer: q.cards.map((c) => cards.indexOf(c)),
  };
}
export function workshopPuzzle(
  mode: WorkshopMode,
  course: StudyCourse,
  round: number,
  variant: number,
): Puzzle {
  return { optics, atlas, chronicle }[mode](course, round, variant);
}
