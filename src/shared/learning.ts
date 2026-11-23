import type { RaceQuestion } from './race-questions.js';
export const LEARNING_GAMES = {
  lantern: {
    name: '字谜灯会',
    subject: '语文',
    rule: '读线索、猜词义，选对答案点亮字灯。需要帮助时，给全桌打开第二条线索。',
    icon: '灯',
  },
  orbit: {
    name: '星轨补给站',
    subject: '数学',
    rule: '先算出任务的答案，再选两颗能量球凑出这个数。',
    icon: 'Σ',
  },
  parcel: {
    name: '云端快递',
    subject: '英语',
    rule: '读或听英文订单，把指令的两段中文意思依次装进包裹，给飞艇装货。',
    icon: 'Aa',
  },
} as const;
export type LearningMode = keyof typeof LEARNING_GAMES;
export type MatchMode = 'race' | LearningMode;
export function isLearningMode(mode: unknown): mode is LearningMode {
  return typeof mode === 'string' && Object.hasOwn(LEARNING_GAMES, mode);
}

export interface Challenge {
  prompt: string;
  options: string[];
  hint: string;
  explanation: string;
  solution: number[];
  target?: number;
}

export interface LearningScore {
  seat: number;
  name: string;
  score: number;
  completed: number;
  done: boolean;
  retired: boolean;
}

export interface LearningView {
  round: number;
  total: number;
  prompt: string;
  options: string[];
  hint: string | null;
  helper: string | null;
  verdict: { correct: boolean; explanation: string } | null;
  scores: LearningScore[];
  done: boolean;
}

export type LearningAction =
  | { round: number; type: 'hint' | 'next' }
  | { round: number; type: 'submit'; picks: number[] };

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function makeChallenges(mode: LearningMode, bank: RaceQuestion[], random = Math.random): Challenge[] {
  const subject = { lantern: 'chinese', orbit: 'math', parcel: 'english' }[mode];
  const pool = shuffled(
    bank.filter(
      (q) =>
        q.subject === subject &&
        (mode !== 'orbit' || Number.isFinite(Number(q.options[q.answer]))) &&
        (mode !== 'parcel' || q.parts),
    ),
    random,
  );
  // Vary mathematical skills before drawing another example in the same topic.
  const ordered = mode === 'orbit' ? [...new Map(pool.map((q) => [q.topic, q])).values(), ...pool] : pool;
  const used = new Set<string>();
  const questions = ordered
    .filter((q) => {
      const key = q.parts?.join('') ?? q.prompt;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 6);
  return questions.map((q) => {
    const explanation = q.explain;
    if (mode === 'lantern') {
      const options = shuffled(q.options, random);
      const correct = q.options[q.answer];
      const remaining = shuffled([correct, options.find((item) => item !== correct)!], random);
      return {
        prompt: q.prompt,
        options,
        explanation,
        solution: [options.indexOf(correct)],
        hint: `缩小范围，再比较“${remaining[0]}”和“${remaining[1]}”。`,
      };
    }
    if (mode === 'orbit') {
      const target = Number(q.options[q.answer]);
      const a = Math.max(1, Math.floor(target / 3)),
        b = Number((target - a).toFixed(3));
      const numbers = [a, b, a + 2, a + 4, b + 3];
      const options = shuffled(numbers.map(String), random);
      const first = options.indexOf(String(a));
      const second = options.findIndex((v, i) => i !== first && v === String(b));
      return {
        prompt: q.prompt,
        target,
        options,
        explanation,
        solution: [first, second],
        hint: `先算题目，再凑出答案。可以先选 ${a}。`,
      };
    }
    const groups = [0, 1].map((i) => {
      const answer = q.parts![i];
      const others = [...new Set(pool.map((item) => item.parts![i]).filter((part) => part !== answer))];
      return shuffled([answer, ...shuffled(others, random).slice(0, 3)], random);
    });
    return {
      prompt: q.prompt,
      options: groups.flat(),
      explanation,
      hint: `前半句的意思是“${q.parts![0]}”。`,
      solution: [groups[0].indexOf(q.parts![0]), 4 + groups[1].indexOf(q.parts![1])],
    };
  });
}

export function gradeChallenge(question: Challenge, picks: number[]): boolean {
  if (question.target !== undefined)
    return (
      picks.length === 2 &&
      picks[0] !== picks[1] &&
      Math.abs(Number(question.options[picks[0]]) + Number(question.options[picks[1]]) - question.target) <
        0.00001
    );
  return (
    picks.length === question.solution.length && question.solution.every((value, i) => value === picks[i])
  );
}
