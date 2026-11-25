import assert from 'node:assert/strict';
import test from 'node:test';
import { CASES } from '../server/cases.js';
import { DetectiveGame } from '../server/game-engine.js';
import type { CaseDefinition, Role } from '../shared/types.js';

const fixture: CaseDefinition = {
  id: 'fixture',
  title: '测试案件',
  subtitle: '用于验证游戏规则',
  subject: '综合',
  duration: '5 分钟',
  cover: '/images/case-broadcast.png',
  brief: '两个人交换线索，找出真相。',
  concepts: ['时间顺序', '证据推理'],
  roles: {
    investigator: { name: '调查员', description: '查看现场与证人线索' },
    analyst: { name: '分析员', description: '查看地图与档案线索' },
  },
  clues: [
    { id: 'i-1', role: 'investigator', title: '广播稿', text: '广播在午休后响起。', kind: 'document' },
    { id: 'i-2', role: 'investigator', title: '证人', text: '小宇听见二楼有回声。', kind: 'witness' },
    { id: 'a-1', role: 'analyst', title: '课表', text: '二楼下午第一节课是音乐课。', kind: 'record' },
    { id: 'a-2', role: 'analyst', title: '地图', text: '广播室在二楼东侧。', kind: 'map' },
  ],
  steps: [
    {
      id: 'step-1',
      prompt: '广播最可能在哪个时间段？',
      options: ['早上', '午后', '放学后'],
      answer: 1,
      explanation: '广播稿说明它在午休后响起。',
      concept: '时间顺序',
      remedy: {
        prompt: '“午休后”和哪个时间最接近？',
        options: ['早上', '午后'],
        answer: 1,
        explanation: '午休结束就进入午后。',
        concept: '时间顺序',
      },
    },
  ],
  final: {
    prompt: '声音来自哪里？',
    options: ['二楼广播室', '一楼图书馆', '操场'],
    answer: 0,
    explanation: '地图和证人线索都指向二楼广播室。',
    requiredEvidence: ['i-2', 'a-2'],
    concept: '证据推理',
    remedy: {
      prompt: '哪两条线索能支持“二楼”这个判断？',
      options: ['证人提到二楼；地图标出广播室在二楼', '课表提到音乐课；广播稿提到午后'],
      answer: 0,
      explanation: '证人线索提供位置，地图线索确认具体房间。',
      concept: '证据推理',
    },
  },
};

function shareEveryClue(game: DetectiveGame) {
  for (const role of ['investigator', 'analyst'] as Role[]) {
    for (const clue of fixture.clues.filter((item) => item.role === role)) {
      assert.equal(game.revealClue(role, clue.id), true);
      assert.equal(game.shareClue(role, clue.id), true);
    }
  }
}

test('a role view only exposes its own clues and never exposes answers', () => {
  const game = new DetectiveGame(fixture);
  const view = game.view('investigator');

  assert.deepEqual(view.clues.map((clue) => clue.id), ['i-1', 'i-2']);
  assert.equal('answer' in view, false);
  assert.equal('remedy' in view, false);
  assert.equal(view.clues[0]?.text, undefined);
});

test('a clue must be revealed by its owner before it can be shared', () => {
  const game = new DetectiveGame(fixture);

  assert.equal(game.shareClue('investigator', 'i-1'), false);
  assert.equal(game.revealClue('investigator', 'i-1'), true);
  assert.equal(game.shareClue('analyst', 'i-1'), false);
  assert.equal(game.shareClue('investigator', 'i-1'), true);
  assert.deepEqual(game.view('analyst').sharedEvidence.map((clue) => clue.id), ['i-1']);
});

test('sharing every clue opens deduction and a wrong answer creates a repair task', () => {
  const game = new DetectiveGame(fixture);
  shareEveryClue(game);

  assert.equal(game.view('investigator').phase, 'deduce');
  assert.equal(game.answerStep('investigator', 0), true);
  assert.equal(game.view('investigator').phase, 'repair');
  assert.equal(game.view('investigator').stepIndex, 0);
  assert.equal(game.view('investigator').repair?.prompt, '“午休后”和哪个时间最接近？');
});

test('a repair answer returns to the same deduction without advancing the case', () => {
  const game = new DetectiveGame(fixture);
  shareEveryClue(game);
  game.answerStep('investigator', 0);

  assert.equal(game.answerRepair('analyst', 0), true);
  assert.equal(game.view('analyst').phase, 'repair');
  assert.equal(game.view('analyst').feedback?.includes('再试'), true);
  assert.equal(game.answerRepair('analyst', 1), true);
  assert.equal(game.view('analyst').phase, 'deduce');
  assert.equal(game.view('analyst').stepIndex, 0);
  assert.equal(game.view('analyst').feedback, '午休结束就进入午后。');
});

test('a correct deduction advances to final accusation after the last step', () => {
  const game = new DetectiveGame(fixture);
  shareEveryClue(game);

  assert.equal(game.answerStep('analyst', 1), true);
  assert.equal(game.view('analyst').phase, 'accuse');
  assert.deepEqual(game.view('analyst').masteredConcepts, ['时间顺序']);
});

test('final accusation requires the right answer and two supporting clues', () => {
  const game = new DetectiveGame(fixture);
  shareEveryClue(game);
  game.answerStep('investigator', 1);

  assert.equal(game.accuse('investigator', 0, ['i-2', 'a-2']), true);
  assert.equal(game.view('investigator').phase, 'solved');
  assert.deepEqual(game.view('investigator').masteredConcepts, ['时间顺序', '证据推理']);
  assert.equal(game.view('investigator').finalExplanation, fixture.final.explanation);
});

test('unsupported final evidence creates a repair task and then returns to accusation', () => {
  const game = new DetectiveGame(fixture);
  shareEveryClue(game);
  game.answerStep('investigator', 1);

  assert.equal(game.accuse('investigator', 0, ['i-2']), true);
  assert.equal(game.view('investigator').phase, 'repair');
  assert.equal(game.view('investigator').repair?.source, 'final');
  assert.equal(game.answerRepair('investigator', 0), true);
  assert.equal(game.view('investigator').phase, 'accuse');
});

test('a wrong final accusation creates a repair task and then returns to accusation', () => {
  const game = new DetectiveGame(fixture);
  shareEveryClue(game);
  game.answerStep('investigator', 1);

  assert.equal(game.accuse('investigator', 1, ['i-2', 'a-2']), true);
  assert.equal(game.view('investigator').phase, 'repair');
  assert.equal(game.answerRepair('investigator', 0), true);
  assert.equal(game.view('investigator').phase, 'accuse');
});

test('all shipped cases have valid answers, remedies, and cross-role final evidence', () => {
  assert.equal(CASES.length, 3);
  for (const item of CASES) {
    const clueIds = new Set(item.clues.map((clue) => clue.id));
    assert.ok(item.clues.filter((clue) => clue.role === 'investigator').length >= 2);
    assert.ok(item.clues.filter((clue) => clue.role === 'analyst').length >= 2);
    assert.ok(item.steps.length >= 2);
    for (const step of item.steps) {
      assert.ok(step.answer >= 0 && step.answer < step.options.length);
      assert.ok(step.remedy.answer >= 0 && step.remedy.answer < step.remedy.options.length);
    }
    assert.equal(item.final.requiredEvidence.length, 2);
    assert.notEqual(item.final.requiredEvidence[0], item.final.requiredEvidence[1]);
    for (const id of item.final.requiredEvidence) assert.ok(clueIds.has(id));
    const roles = item.final.requiredEvidence.map((id) => item.clues.find((clue) => clue.id === id)?.role);
    assert.notEqual(roles[0], roles[1]);
  }
});
