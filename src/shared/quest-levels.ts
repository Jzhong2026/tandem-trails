export const TILE = 36;
export const ROWS = 15;
export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 360;
export const GROUND_ROW = 12;

export const QUEST_THEMES = [
  'meadow', 'hills', 'cave', 'sky', 'desert', 'snow',
  'candy', 'sea', 'night', 'lava', 'rainbow', 'castle',
] as const;
export type QuestTheme = typeof QUEST_THEMES[number];

export interface QuestLevel {
  id: string;
  index: number;
  name: string;
  world: string;
  theme: QuestTheme;
  hint: string;
  width: number;
  grid: string[];
  ice: boolean;
  water: boolean;
  coinTotal: number;
}

class MapBuilder {
  readonly cells: string[][];

  constructor(readonly width: number) {
    this.cells = Array.from({ length: ROWS }, () => Array<string>(width).fill('.'));
  }

  put(col: number, row: number, char: string) {
    if (col >= 0 && col < this.width && row >= 0 && row < ROWS) this.cells[row][col] = char;
    return this;
  }

  line(col: number, row: number, text: string) {
    [...text].forEach((char, offset) => this.put(col + offset, row, char));
    return this;
  }

  box(from: number, to: number, row: number, char = '=') {
    for (let col = from; col <= to; col++) this.put(col, row, char);
    return this;
  }

  column(col: number, fromRow: number, toRow: number, char = '=') {
    for (let row = fromRow; row <= toRow; row++) this.put(col, row, char);
    return this;
  }

  ground(from: number, to: number, top = GROUND_ROW, char = '#') {
    for (let row = top; row < ROWS; row++) this.box(from, to, row, char);
    return this;
  }

  gap(from: number, to: number, top = 0) {
    for (let row = top; row < ROWS; row++) this.box(from, to, row, '.');
    return this;
  }

  coins(from: number, to: number, row: number) {
    return this.box(from, to, row, 'o');
  }

  arc(from: number, to: number, row: number) {
    const span = to - from;
    for (let col = from; col <= to; col++) {
      const t = span === 0 ? 0.5 : (col - from) / span;
      this.put(col, row - Math.round(Math.sin(t * Math.PI) * 2), 'o');
    }
    return this;
  }

  pipe(col: number, topRow: number, plant = false) {
    this.line(col, topRow, plant ? '{}' : '[]');
    for (let row = topRow + 1; row < GROUND_ROW; row++) this.line(col, row, '()');
    return this;
  }

  stair(col: number, steps: number, direction = 1, baseRow = GROUND_ROW - 1) {
    for (let step = 0; step < steps; step++) {
      const c = col + step * direction;
      for (let row = baseRow - step; row <= baseRow; row++) this.put(c, row, '=');
    }
    return this;
  }

  rows() {
    return this.cells.map(row => row.join(''));
  }
}

interface LevelSeed {
  id: string;
  name: string;
  world: string;
  theme: QuestTheme;
  hint: string;
  width: number;
  ice?: boolean;
  water?: boolean;
  build: (m: MapBuilder) => void;
}

const WORLD_ONE = '第一世界 · 晨光草原';
const WORLD_TWO = '第二世界 · 云端奇旅';
const WORLD_THREE = '第三世界 · 秘境巡游';
const WORLD_FOUR = '第四世界 · 菇霸决战';

const SEEDS: LevelSeed[] = [
  {
    id: 'meadow', name: '绿野第一步', world: WORLD_ONE, theme: 'meadow', width: 150,
    hint: '跳到栗栗头上就能把它踩扁。长按跳跃键跳得更高，轻点只是小跳。',
    build: m => {
      m.ground(0, 33).ground(37, 72).ground(76, 149);
      m.put(3, 11, '@');
      m.coins(9, 11, 10);
      m.box(13, 15, 8, '-');
      m.coins(13, 15, 7);
      m.line(18, 9, '?B!B?');
      m.pipe(24, 10);
      m.arc(23, 26, 8);
      m.put(29, 11, 'g');
      m.arc(33, 37, 9);
      m.box(44, 45, 11).box(46, 47, 10);
      m.coins(44, 47, 8);
      m.put(54, 11, 'k');
      m.pipe(60, 10);
      m.coins(60, 61, 8);
      m.put(68, 11, 'c');
      m.box(73, 75, 10, '-');
      m.put(82, 7, 'f');
      m.line(86, 9, 'BB?BB');
      m.put(94, 11, 'g').put(98, 11, 'g');
      m.put(104, 11, '^');
      m.coins(105, 108, 5);
      m.box(110, 114, 6);
      m.put(112, 5, 'H');
      m.box(118, 119, 8).box(121, 122, 10);
      m.coins(126, 129, 10);
      m.put(134, 11, 'g');
      m.put(140, 11, 'X');
    },
  },
  {
    id: 'hills', name: '蘑菇丘陵', world: WORLD_ONE, theme: 'hills', width: 166,
    hint: '水管里的咬咬花会缩回去，等它低头再跳过去。',
    build: m => {
      m.ground(0, 30).ground(34, 60).ground(64, 98).ground(102, 165);
      m.ground(18, 26, 10);
      m.put(3, 11, '@');
      m.coins(7, 9, 10);
      m.put(14, 11, 'g').put(23, 9, 'g');
      m.arc(30, 34, 9);
      m.pipe(40, 10, true);
      m.line(46, 9, '?B!B');
      m.pipe(52, 9);
      m.coins(52, 53, 7);
      m.arc(60, 64, 9);
      m.put(66, 11, 'k');
      m.pipe(70, 10, true);
      m.put(78, 11, 'k');
      m.put(84, 6, 'f');
      m.pipe(88, 9);
      m.coins(88, 89, 7);
      m.put(94, 11, 'c');
      m.arc(98, 102, 9);
      m.put(105, 11, '^');
      m.coins(106, 110, 4);
      m.box(112, 116, 7, '-').box(120, 124, 5, '-');
      m.put(122, 4, '*');
      m.put(128, 11, 'g').put(133, 11, 'g');
      m.line(137, 9, 'B+B');
      m.coins(143, 147, 10);
      m.put(150, 11, 'k');
      m.put(157, 11, 'X');
    },
  },
  {
    id: 'cave', name: '金币洞窟', world: WORLD_ONE, theme: 'cave', width: 162,
    hint: '刺球不能踩，跳过去就好。移动石台会带你越过宽沟。',
    build: m => {
      m.box(0, 161, 0, '#').box(0, 161, 1, '#');
      m.ground(0, 40).ground(46, 90).ground(95, 161);
      m.put(3, 11, '@');
      m.coins(8, 12, 10);
      m.column(16, 2, 4).column(30, 2, 3).column(58, 2, 5).column(104, 2, 4).column(140, 2, 3);
      m.line(20, 9, '?BB?');
      m.put(26, 11, 'g');
      m.put(34, 11, 's');
      m.coins(36, 39, 8);
      m.put(42, 10, 'M');
      m.arc(41, 45, 8);
      m.coins(50, 54, 10);
      m.put(57, 6, 'f');
      m.line(62, 9, 'B!B');
      m.put(68, 11, 's');
      m.box(72, 76, 8, '-');
      m.coins(72, 76, 7);
      m.put(80, 11, 'c');
      m.put(84, 11, 'g');
      m.put(92, 9, 'V');
      m.arc(90, 95, 7);
      m.put(100, 5, 'f');
      m.coins(104, 110, 10);
      m.line(114, 9, '?B+B?');
      m.put(120, 11, 's');
      m.put(126, 11, 'g');
      m.box(130, 134, 8);
      m.put(132, 7, 'H');
      m.coins(138, 144, 10);
      m.put(146, 11, 'k');
      m.put(153, 11, 'X');
    },
  },
  {
    id: 'sky', name: '云端阶梯', world: WORLD_TWO, theme: 'sky', width: 172,
    hint: '云台可以从下面穿上去。掉下去只会回到最近的旗子。',
    build: m => {
      m.ground(0, 10, 12, '=');
      m.put(3, 11, '@');
      m.coins(6, 8, 10);
      m.box(14, 20, 11, '-');
      m.put(17, 10, 'g');
      m.put(19, 10, 'c');
      m.box(24, 30, 10, '-');
      m.arc(21, 24, 9);
      m.put(34, 10, 'M');
      m.box(40, 46, 9, '-');
      m.put(43, 8, 'k');
      m.put(45, 8, 'c');
      m.coins(41, 45, 7);
      m.box(50, 56, 11, '-');
      m.put(54, 10, 'c');
      m.put(52, 7, 'f');
      m.box(60, 64, 9, '-');
      m.box(68, 72, 8, '-');
      m.coins(69, 71, 7);
      m.box(76, 82, 6, '-');
      m.coins(77, 81, 5);
      m.put(79, 5, 'H');
      m.box(86, 92, 9, '-');
      m.put(89, 8, 'g');
      m.box(96, 102, 11, '-');
      m.put(99, 10, '^');
      m.coins(100, 104, 4);
      m.box(106, 112, 5, '-');
      m.put(109, 4, '*');
      m.put(116, 6, 'M');
      m.box(122, 128, 8, '-');
      m.put(125, 7, 'k');
      m.box(132, 138, 10, '-');
      m.arc(129, 132, 9);
      m.box(142, 150, 11, '-');
      m.put(146, 10, 'g');
      m.coins(143, 149, 9);
      m.ground(154, 171, 12, '=');
      m.put(166, 11, 'X');
    },
  },
  {
    id: 'desert', name: '流沙遗迹', world: WORLD_TWO, theme: 'desert', width: 168,
    hint: '裂纹石板站久了会塌，别停太久，一路小跑过去。',
    build: m => {
      m.ground(0, 26).ground(32, 58).ground(64, 96).ground(102, 167);
      m.put(3, 11, '@');
      m.coins(8, 11, 10);
      m.stair(14, 3);
      m.put(20, 11, 's');
      m.arc(26, 32, 9);
      m.box(28, 30, 10, 'T');
      m.line(36, 9, '?B!B');
      m.put(42, 11, 'g');
      m.stair(46, 4);
      m.coins(47, 50, 6);
      m.put(54, 6, 'f');
      m.arc(58, 64, 9);
      m.box(60, 62, 10, 'T');
      m.put(68, 11, 'c');
      m.put(74, 11, 's');
      m.box(78, 82, 8);
      m.coins(78, 82, 7);
      m.put(86, 11, 'k');
      m.put(90, 5, 'f');
      m.arc(96, 102, 9);
      m.box(98, 100, 10, 'T');
      m.put(106, 11, '^');
      m.coins(107, 111, 4);
      m.box(114, 120, 6, '-');
      m.put(117, 5, 'H');
      m.put(126, 11, 'g').put(131, 11, 'g');
      m.line(120, 9, 'B?B+B');
      m.stair(138, 3, 1);
      m.coins(148, 152, 10);
      m.put(158, 11, 'X');
    },
  },
  {
    id: 'snow', name: '霜糖滑道', world: WORLD_TWO, theme: 'snow', width: 168, ice: true,
    hint: '冰面有点滑，提前松手就能慢慢停下。企鹅壳可以踢走。',
    build: m => {
      m.ground(0, 34).ground(38, 70).ground(74, 110).ground(114, 167);
      m.put(3, 11, '@');
      m.coins(9, 13, 10);
      m.put(18, 11, 'k');
      m.box(24, 28, 9);
      m.coins(24, 28, 8);
      m.arc(34, 38, 9);
      m.put(44, 11, 'g');
      m.put(50, 6, 'f');
      m.line(54, 9, '?B!B');
      m.put(62, 11, 'k');
      m.arc(70, 74, 9);
      m.put(78, 11, 'c');
      m.box(82, 86, 8, '-');
      m.coins(82, 86, 7);
      m.put(90, 11, 's');
      m.put(96, 11, '^');
      m.coins(97, 101, 4);
      m.box(104, 108, 5);
      m.put(106, 4, '*');
      m.arc(110, 114, 9);
      m.put(120, 11, 'g').put(126, 11, 'k');
      m.box(130, 134, 9, '-');
      m.put(132, 8, 'H');
      m.put(140, 6, 'f');
      m.coins(142, 148, 10);
      m.line(150, 9, 'B+B');
      m.put(158, 11, 'X');
    },
  },
  {
    id: 'candy', name: '糖果传送带', world: WORLD_THREE, theme: 'candy', width: 174,
    hint: '传送带会推着你走，顺着它跑更省力。弹簧能把你弹得很高。',
    build: m => {
      m.ground(0, 24).ground(28, 62).ground(66, 104).ground(108, 173);
      m.put(3, 11, '@');
      m.coins(7, 10, 10);
      m.box(12, 22, 12, '>');
      m.put(18, 11, 'g');
      m.arc(24, 28, 9);
      m.box(30, 40, 12, '>');
      m.coins(32, 38, 9);
      m.put(44, 11, '^');
      m.coins(45, 49, 4);
      m.box(52, 58, 6, '-');
      m.put(55, 5, 'H');
      m.put(60, 8, 'f');
      m.arc(62, 66, 9);
      m.box(68, 78, 12, '<');
      m.put(72, 11, 'k');
      m.coins(70, 76, 9);
      m.put(82, 11, 'c');
      m.put(86, 11, '^');
      m.box(88, 94, 5, '-');
      m.coins(89, 93, 4);
      m.put(91, 4, '*');
      m.put(98, 11, 'g');
      m.arc(104, 108, 9);
      m.box(110, 120, 12, '>');
      m.put(116, 10, 'M');
      m.coins(112, 118, 8);
      m.put(126, 11, 's');
      m.line(130, 9, '?B!B+B');
      m.put(138, 11, '^');
      m.coins(139, 143, 3);
      m.box(146, 152, 5, '-');
      m.put(149, 4, '1');
      m.put(156, 11, 'k');
      m.coins(158, 162, 10);
      m.put(166, 11, 'X');
    },
  },
  {
    id: 'sea', name: '泡泡浅海', world: WORLD_THREE, theme: 'sea', width: 164, water: true,
    hint: '在水里按跳跃就是划水，可以一直往上游。碰到水母会掉一颗心。',
    build: m => {
      m.ground(0, 163, 13);
      m.box(0, 163, 0, '#');
      m.put(3, 10, '@');
      m.coins(8, 12, 9);
      m.column(16, 9, 12).column(17, 10, 12);
      m.put(22, 7, 'f');
      m.coins(24, 28, 6);
      m.column(32, 8, 12);
      m.put(38, 10, 'g');
      m.arc(40, 46, 7);
      m.column(50, 9, 12).column(51, 11, 12);
      m.put(56, 5, 'f');
      m.coins(58, 62, 4);
      m.put(66, 10, 'c');
      m.column(70, 7, 12);
      m.put(76, 9, 'g');
      m.coins(78, 84, 8);
      m.put(88, 6, 'f');
      m.column(92, 10, 12).column(93, 11, 12);
      m.coins(96, 100, 5);
      m.put(104, 9, 'k');
      m.column(110, 8, 12);
      m.put(114, 4, 'H');
      m.coins(116, 122, 6);
      m.put(126, 7, 'f');
      m.column(132, 9, 12);
      m.put(138, 10, 'g');
      m.coins(140, 146, 9);
      m.put(150, 6, '*');
      m.put(157, 11, 'X');
    },
  },
  {
    id: 'night', name: '萤火夜林', world: WORLD_THREE, theme: 'night', width: 172,
    hint: '幽灵台会一亮一暗，亮着的时候才踩得上去，节奏很慢不用急。',
    build: m => {
      m.ground(0, 22).ground(30, 52).ground(60, 88).ground(96, 124).ground(132, 171);
      m.put(3, 11, '@');
      m.coins(8, 12, 10);
      m.put(12, 11, 'c');
      m.put(16, 11, 'g');
      m.box(24, 26, 10, '%');
      m.box(24, 28, 13, '-');
      m.arc(22, 30, 9);
      m.put(36, 11, 'k');
      m.put(42, 6, 'f');
      m.line(44, 9, '?B!B');
      m.box(54, 56, 10, '%');
      m.box(57, 59, 8, '%');
      m.box(54, 58, 13, '-');
      m.coins(54, 59, 7);
      m.put(64, 11, 'c');
      m.put(70, 11, 's');
      m.put(76, 5, 'f');
      m.box(80, 84, 8, '-');
      m.put(82, 7, 'H');
      m.box(90, 92, 10, '%');
      m.box(93, 95, 8, '%');
      m.box(90, 94, 13, '-');
      m.arc(88, 96, 6);
      m.put(102, 11, 'g').put(108, 11, 'g');
      m.put(112, 11, '^');
      m.coins(113, 117, 4);
      m.box(120, 124, 5, '-');
      m.put(122, 4, '*');
      m.box(126, 128, 10, '%');
      m.box(129, 131, 8, '%');
      m.box(126, 130, 13, '-');
      m.coins(126, 131, 7);
      m.put(138, 11, 'k');
      m.put(144, 6, 'f');
      m.line(148, 9, 'B?B+B');
      m.coins(154, 160, 10);
      m.put(164, 11, 'X');
    },
  },
  {
    id: 'lava', name: '熔岩要塞', world: WORLD_FOUR, theme: 'lava', width: 174,
    hint: '岩浆很烫，碰到会掉一颗心；踩上石台再跳。蹦蹦只会原地跳，看准节奏走过去。',
    build: m => {
      m.ground(0, 20).ground(26, 44).ground(50, 72).ground(78, 100).ground(106, 173);
      m.box(21, 25, 13, 'L').box(21, 25, 14, 'L');
      m.box(45, 49, 13, 'L').box(45, 49, 14, 'L');
      m.box(73, 77, 13, 'L').box(73, 77, 14, 'L');
      m.box(101, 105, 13, 'L').box(101, 105, 14, 'L');
      m.put(3, 11, '@');
      m.coins(7, 10, 10);
      m.put(14, 11, 'h');
      m.put(23, 9, 'M');
      m.arc(21, 26, 8);
      m.put(32, 11, 's');
      m.line(36, 9, '?B!B');
      m.put(47, 8, 'V');
      m.coins(46, 49, 6);
      m.put(56, 11, 'h');
      m.box(60, 64, 8);
      m.coins(60, 64, 7);
      m.put(68, 11, 'c');
      m.put(75, 9, 'M');
      m.arc(73, 78, 8);
      m.put(84, 11, 'k');
      m.put(90, 5, 'f');
      m.box(94, 98, 8, '-');
      m.put(96, 7, 'H');
      m.put(103, 8, 'V');
      m.coins(102, 105, 6);
      m.put(112, 11, 'h');
      m.put(118, 11, '^');
      m.coins(119, 123, 4);
      m.box(126, 132, 6, '-');
      m.put(129, 5, '*');
      m.put(138, 11, 's').put(144, 11, 'g');
      m.line(148, 9, 'B?B+B');
      m.coins(154, 160, 10);
      m.put(166, 11, 'X');
    },
  },
  {
    id: 'rainbow', name: '彩虹天桥', world: WORLD_FOUR, theme: 'rainbow', width: 182,
    hint: '一路弹簧连跳，收集星星就无敌啦，撞到谁都不怕。',
    build: m => {
      m.ground(0, 16).ground(21, 40).ground(45, 66).ground(71, 92).ground(97, 120).ground(125, 181);
      m.put(3, 11, '@');
      m.coins(6, 10, 10);
      m.put(15, 11, '^');
      m.arc(17, 21, 6);
      m.put(26, 11, 'g');
      m.box(30, 34, 8, '-');
      m.coins(30, 34, 7);
      m.put(39, 11, '^');
      m.arc(41, 45, 6);
      m.put(50, 11, 'k');
      m.put(56, 5, 'f');
      m.box(58, 62, 7, '-');
      m.put(60, 6, '*');
      m.put(65, 11, '^');
      m.arc(67, 71, 5);
      m.put(76, 11, 'c');
      m.put(82, 11, 's');
      m.box(84, 88, 8, '-');
      m.coins(84, 88, 7);
      m.put(91, 11, '^');
      m.arc(93, 97, 5);
      m.put(102, 11, 'g').put(108, 11, 'h');
      m.box(110, 114, 8, '-');
      m.put(112, 7, 'H');
      m.put(119, 11, '^');
      m.arc(121, 125, 5);
      m.put(132, 11, 'k');
      m.put(140, 6, 'f');
      m.line(144, 9, '?B!B+B');
      m.box(150, 156, 8, '-');
      m.put(153, 7, '1');
      m.coins(160, 166, 10);
      m.put(170, 11, 'g');
      m.put(176, 11, 'X');
    },
  },
  {
    id: 'castle', name: '菇霸城堡', world: WORLD_FOUR, theme: 'castle', width: 128,
    hint: '菇霸落地后会头晕，这时跳到它头上！三次就能打败它。',
    build: m => {
      m.box(0, 127, 0, '#').box(0, 127, 1, '#');
      m.ground(0, 127);
      m.put(3, 11, '@');
      m.coins(8, 12, 10);
      m.put(16, 11, 'h');
      m.gap(20, 24, 12);
      m.box(20, 24, 13, 'L').box(20, 24, 14, 'L');
      m.put(22, 9, 'M');
      m.put(30, 11, 's');
      m.line(34, 9, '?B!B');
      m.gap(40, 44, 12);
      m.box(40, 44, 13, 'L').box(40, 44, 14, 'L');
      m.put(42, 8, 'V');
      m.put(50, 11, 'c');
      m.put(54, 11, 'H');
      m.coins(56, 60, 10);
      m.put(70, 11, 'g');
      m.box(66, 68, 9);
      m.coins(66, 68, 8);
      m.put(84, 10, 'G');
      m.box(100, 102, 9);
      m.put(101, 8, '1');
      m.column(108, 2, 11, 'D');
      m.box(112, 116, 8);
      m.put(122, 11, 'X');
    },
  },
];

function buildLevel(seed: LevelSeed, index: number): QuestLevel {
  const builder = new MapBuilder(seed.width);
  seed.build(builder);
  const grid = builder.rows();
  const coinTotal = grid.reduce((sum, row) => sum + [...row].filter(char => char === 'o').length, 0);
  return {
    id: seed.id,
    index,
    name: seed.name,
    world: seed.world,
    theme: seed.theme,
    hint: seed.hint.trim(),
    width: seed.width,
    grid,
    ice: seed.ice ?? false,
    water: seed.water ?? false,
    coinTotal,
  };
}

export const QUEST_LEVELS: QuestLevel[] = SEEDS.map(buildLevel);
export const QUEST_LEVEL_IDS = QUEST_LEVELS.map(level => level.id);
export type QuestLevelId = typeof QUEST_LEVEL_IDS[number];

export function questLevel(index: number): QuestLevel {
  return QUEST_LEVELS[Math.max(0, Math.min(QUEST_LEVELS.length - 1, index))];
}

export function findQuestLevel(id: string): QuestLevel | undefined {
  return QUEST_LEVELS.find(level => level.id === id);
}