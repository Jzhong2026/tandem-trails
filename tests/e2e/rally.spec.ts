import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { questionsFor } from '../../src/server/curriculum.js';

const thirdGradeEnglish = questionsFor({ grade: 3, term: 1 }).filter(q => q.subject === 'english');

async function useFastCanvas(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(type: string, ...args: unknown[]) {
        if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
}

async function answerQuiz(page: Page, wrong = false) {
  const prompt = (await page.locator('.rally-quiz-card h2').textContent())?.trim() ?? '';
  const question = thirdGradeEnglish.find(entry => entry.prompt === prompt);
  if (!question) throw new Error(`unknown question: ${prompt}`);
  const options = page.locator('.rally-option');
  const texts = await options.locator('span:last-child').allTextContents();
  const correctIndex = texts.indexOf(question.options[question.answer]);
  expect(correctIndex).toBeGreaterThanOrEqual(0);
  await options.nth(wrong ? (correctIndex + 1) % texts.length : correctIndex).click();
  await expect(page.locator('.rally-feedback')).toBeVisible();
  if (wrong) {
    await expect(page.locator('.rally-feedback')).toContainText('差一点');
    await page.getByRole('button', { name: '我再试一次' }).click();
    await options.nth(correctIndex).click();
    await expect(page.locator('.rally-feedback.good')).toBeVisible();
  }
  await page.locator('.rally-feedback-foot button').click();
  await expect.poll(async () => {
    if (await page.locator('.rally-quiz-card').count() === 0) return true;
    return ((await page.locator('.rally-quiz-card h2').textContent())?.trim() ?? '') !== prompt;
  }).toBe(true);
}

async function driveToNextStop(page: Page) {
  for (let i = 0; i < 90; i++) {
    if (await page.locator('.rally-quiz-card').count()) return;
    if (await page.locator('.rally-result-card').count()) return;
    await page.clock.runFor(400);
    const hazard = await page.locator('.rally-game').evaluate(element => ({
      lane: Number(element.getAttribute('data-current-lane')),
      lanes: (element.getAttribute('data-hazard-lanes') ?? '').split(',').filter(Boolean).map(Number),
      distance: Number(element.getAttribute('data-hazard-distance')),
    }));
    if (hazard.distance < 55 && hazard.lanes.includes(hazard.lane)) {
      const safe = [0, 1, 2].filter(lane => !hazard.lanes.includes(lane)).sort((a, b) => Math.abs(a - hazard.lane) - Math.abs(b - hazard.lane))[0];
      if (safe !== undefined) await page.keyboard.press(safe < hazard.lane ? 'ArrowLeft' : 'ArrowRight');
    }
  }
  throw new Error('did not reach the next learning stop');
}

test('new rally garage switches to Scania and completes a learning stage with review', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await useFastCanvas(page);
  await page.clock.install({ time: new Date('2026-11-24T09:00:00Z') });
  await page.goto('/?rally=2');
  await expect(page.getByRole('heading', { name: '把知识 开向远方' })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择 Scania S 520' })).toBeVisible();
  await page.getByLabel('年级与学期').selectOption('3-1');
  await page.getByRole('button', { name: '英语', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('年级与学期')).toHaveValue('3-1');
  await expect(page.getByRole('button', { name: '英语', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '选择 Scania S 520' }).click();
  await expect(page.locator('.rally-vehicle-title h3')).toHaveText('Scania S 520');
  await page.getByRole('button', { name: /出发，开始闯关/ }).click();
  await expect(page.locator('.rally-game')).toBeVisible();
  await expect(page.locator('canvas[aria-label="晨光校园 三维赛车场景"]')).toBeVisible();
  await expect(page.locator('.rally-chip')).toContainText('兼容模式');
  await page.clock.runFor(3400);
  await expect(page.locator('.rally-countdown')).toHaveCount(0);

  let quizzes = 0;
  for (let stop = 0; stop < 2; stop++) {
    await driveToNextStop(page);
    await expect(page.locator('.rally-quiz-card')).toBeVisible();
    let stopQuestions = 0;
    while (await page.locator('.rally-quiz-card').count()) {
      await expect(page.locator('.rally-subject')).toContainText('英语');
      await answerQuiz(page, quizzes < 2);
      quizzes++;
      stopQuestions++;
      expect(stopQuestions).toBeLessThanOrEqual(4);
    }
    expect(stopQuestions).toBe(4);
  }
  await driveToNextStop(page);
  await expect(page.locator('.rally-result-card')).toBeVisible();
  expect(quizzes).toBe(8);
  await expect(page.locator('.rally-result-card')).toContainText('完成挑战');
  await expect(page.locator('.rally-review-banner')).toContainText('2 道题');
  await expect(page.getByRole('button', { name: '复习后解锁下一站' })).toBeDisabled();

  await page.getByRole('button', { name: '开始错题复盘' }).click();
  await expect(page.locator('.rally-quiz-kicker').first()).toContainText('错题复盘');
  await answerQuiz(page);
  await expect(page.getByLabel('第 2 题，共 2 题')).toBeVisible();
  await answerQuiz(page);
  await expect(page.getByRole('heading', { name: '选择成长赛道' })).toBeVisible();
  await expect(page.locator('.rally-review-banner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /松林弯道/ })).toBeEnabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tandem-trails.rally-progress.3-1.english') ?? '{}'));
  expect(saved.unlockedLevel).toBe(2);
  expect(saved.selectedVehicleId).toBe('scania-s500');
  await page.getByLabel('年级与学期').selectOption('2-2');
  await expect(page.getByRole('button', { name: /松林弯道/ })).toBeDisabled();
  await page.getByLabel('年级与学期').selectOption('3-1');
  await page.getByRole('button', { name: '数学', exact: true }).click();
  await expect(page.getByRole('button', { name: /松林弯道/ })).toBeDisabled();
  await page.getByRole('button', { name: '英语', exact: true }).click();
  await expect(page.getByRole('button', { name: /松林弯道/ })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('mobile garage has no horizontal overflow and touch steering works', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await useFastCanvas(page);
  await page.clock.install({ time: new Date('2026-11-24T09:00:00Z') });
  await page.goto('/?rally=2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: '选择 Volvo FH16' }).click();
  await expect(page.locator('.rally-vehicle-title h3')).toHaveText('Volvo FH16');
  await page.getByRole('button', { name: /出发，开始闯关/ }).click();
  await page.clock.runFor(3400);
  await expect(page.locator('.rally-countdown')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '向左变道' })).toBeVisible();
  await expect(page.getByRole('button', { name: '向右变道' })).toBeVisible();
  await page.getByRole('button', { name: '向左变道' }).tap();
  await expect(page.locator('.rally-game')).toHaveAttribute('data-current-lane', '0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
  await context.close();
});

test('real WebGL garage and MAN truck render without runtime errors', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?rally=2');
  await page.getByRole('button', { name: '选择 MAN TGX' }).click();
  await expect(page.locator('.rally-vehicle-title h3')).toHaveText('MAN TGX');
  await page.screenshot({ path: testInfo.outputPath('rally-garage-webgl.png'), fullPage: true });
  await page.getByRole('button', { name: /出发，开始闯关/ }).click();
  await expect(page.locator('.rally-countdown')).toHaveCount(0, { timeout: 20_000 });
  const size = await page.locator('canvas[aria-label="晨光校园 三维赛车场景"]').evaluate(element => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('rally-driving-webgl.png') });
  expect(errors).toEqual([]);
});

test('home entry tokens resolve and disabled localStorage does not white-screen the garage', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await useFastCanvas(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage disabled'); },
    });
  });
  await page.goto('/');
  const token = await page.locator('.rally-entry').evaluate(element => getComputedStyle(element).getPropertyValue('--rally-accent').trim());
  expect(token).not.toBe('');
  await page.screenshot({ path: testInfo.outputPath('rally-home-entry.png'), fullPage: true });
  await page.getByRole('button', { name: /进入全新知识赛车/ }).click();
  await expect(page.getByRole('heading', { name: '把知识 开向远方' })).toBeVisible();
  await page.getByRole('button', { name: '选择 Scania S 520' }).click();
  await expect(page.locator('.rally-vehicle-title h3')).toHaveText('Scania S 520');
  expect(errors).toEqual([]);
});

test('legacy review is preserved when switching courses and returning to the default', async ({ page }) => {
  await useFastCanvas(page);
  await page.addInitScript(() => localStorage.setItem('tandem-trails.rally-progress', JSON.stringify({
    unlockedLevel: 2, selectedVehicleId: 'volvo-fh16', pendingReview: ['c08'],
  })));
  await page.goto('/?rally=2');
  await expect(page.getByRole('button', { name: '去复习错题' })).toBeVisible();
  await page.getByLabel('年级与学期').selectOption('2-2');
  await expect(page.getByRole('button', { name: '去复习错题' })).toHaveCount(0);
  await page.getByLabel('年级与学期').selectOption('2-1');
  await page.getByRole('button', { name: '去复习错题' }).click();
  await expect(page.getByRole('heading', { name: '曹冲称象的办法是什么？' })).toBeVisible();
  await page.getByRole('button', { name: /赶象上船/ }).click();
  await page.getByRole('button', { name: '完成复习' }).click();
  await expect(page.getByRole('button', { name: /松林弯道/ })).toBeEnabled();
});

test('race lobby shares the chosen semester and subject with joining players', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '上海课程', exact: true }).selectOption('3');
  await page.getByRole('combobox', { name: '学期', exact: true }).selectOption('2');
  await page.getByLabel('比赛学科').selectOption('math');
  await page.getByRole('button', { name: '单人 / 创建比赛' }).click();
  const guest = await browser.newPage();
  try {
    await guest.goto(await page.getByLabel('邀请链接').inputValue());
    await expect(guest.getByRole('combobox', { name: '上海课程', exact: true })).toHaveValue('3');
    await expect(guest.getByRole('combobox', { name: '学期', exact: true })).toHaveValue('2');
    await expect(guest.getByLabel('比赛学科')).toBeDisabled();
    await expect(guest.getByLabel('比赛学科')).toHaveValue('math');
    await page.getByLabel('比赛学科').selectOption('english');
    await expect(guest.getByLabel('比赛学科')).toHaveValue('english');
  } finally {
    await guest.close();
  }
});
