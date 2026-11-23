import { expect, test } from '@playwright/test';
import { RACE_QUESTIONS } from '../../src/shared/race-questions.js';

async function canvasPainted(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.race-canvas') as HTMLCanvasElement | null;
    if (!canvas || canvas.width === 0) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const d = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return d[3] > 0;
  });
}

async function answerCurrentQuiz(page: import('@playwright/test').Page, wrong = false) {
  const prompt = (await page.locator('.race-quiz-prompt').textContent())?.trim() ?? '';
  const bank = RACE_QUESTIONS.find(question => question.prompt === prompt);
  if (!bank) throw new Error(`unknown quiz prompt: ${prompt}`);
  const correctText = bank.options[bank.answer];
  const index = await page.evaluate(text => {
    const options = [...document.querySelectorAll('.race-opt')];
    return options.findIndex(option => option.querySelector('span:last-child')?.textContent === text);
  }, correctText);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator('.race-opt').nth(wrong ? (index + 1) % 4 : index).click();
}

test('solo racer creates a room, answers quizzes and reaches the finish', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.getByRole('button', { name: '单人 / 创建比赛' }).click();
  await expect(page.locator('.race-lobby')).toBeVisible();
  await expect(page.locator('.race-invite-top strong')).toHaveText(/^[A-Z2-9]{6}$/);

  for (let i = 0; i < 4; i++) {
    await page.locator('.race-stepper button').nth(1).click();
    await page.waitForTimeout(160);
  }
  await expect(page.locator('.race-stepper strong')).toHaveText('10');

  await page.getByRole('button', { name: '我准备好了' }).click();
  await page.getByRole('button', { name: /开始比赛/ }).click();
  await expect(page.locator('.race-canvas')).toBeVisible();
  await page.waitForTimeout(1600);
  expect(await canvasPainted(page)).toBe(true);
  await expect(page.locator('.race-pcard')).toHaveCount(1);

  const deadline = Date.now() + 150_000;
  let finished = false;
  let quizzesAnswered = 0;
  while (Date.now() < deadline) {
    if (await page.locator('.race-results').count()) { finished = true; break; }
    if (await page.locator('.race-opt:not([disabled])').count() === 4) {
      await answerCurrentQuiz(page);
      quizzesAnswered++;
      await expect(page.locator('.race-quiz-reveal')).toBeVisible();
      await page.locator('.race-quiz-foot .rbtn').click();
      continue;
    }
    await page.waitForTimeout(250);
  }
  expect(finished).toBe(true);
  expect(quizzesAnswered).toBe(16);
  await expect(page.locator('.race-row.gold')).toContainText('你');
  await expect(page.locator('.race-results')).toContainText('到达终点');
  expect(errors).toEqual([]);
});

test('a wrong answer must be reviewed before the next race can start', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.getByRole('button', { name: '单人 / 创建比赛' }).click();
  for (let i = 0; i < 4; i++) {
    await page.locator('.race-stepper button').nth(1).click();
    await page.waitForTimeout(160);
  }
  await page.getByRole('button', { name: '我准备好了' }).click();
  await page.getByRole('button', { name: /开始比赛/ }).click();

  const deadline = Date.now() + 150_000;
  let wrongAnswered = false;
  while (Date.now() < deadline) {
    if (await page.locator('.race-review-gate').count()) break;
    if (await page.locator('.race-opt:not([disabled])').count() === 4) {
      await answerCurrentQuiz(page, !wrongAnswered);
      if (!wrongAnswered) wrongAnswered = true;
      await page.locator('.race-quiz-foot .rbtn').click();
      continue;
    }
    await page.waitForTimeout(250);
  }
  expect(wrongAnswered).toBe(true);
  await expect(page.locator('.race-review-gate')).toContainText('没答对');
  await expect(page.getByRole('button', { name: '再来一局' })).toHaveCount(0);

  await page.getByRole('button', { name: '开始复习错题' }).click();
  await expect(page.locator('.race-review')).toBeVisible();
  await answerCurrentQuiz(page);
  await expect(page.locator('.race-review .race-quiz-reveal')).toBeVisible();
  await page.getByRole('button', { name: /复习完成/ }).click();

  await expect(page.getByRole('button', { name: '再来一局' })).toBeVisible();
  await page.getByRole('button', { name: '再来一局' }).click();
  await expect(page.locator('.race-lobby')).toBeVisible();
  expect(errors).toEqual([]);
});

test('two players join the same room and see each other in the HUD', async ({ browser }) => {
  test.setTimeout(60_000);
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  const errors: string[] = [];
  page1.on('pageerror', error => errors.push(`p1:${error}`));
  page2.on('pageerror', error => errors.push(`p2:${error}`));

  await page1.goto('/');
  await page1.getByRole('button', { name: '单人 / 创建比赛' }).click();
  await expect(page1.locator('.race-invite-top strong')).toBeVisible();
  const code = (await page1.locator('.race-invite-top strong').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await page2.goto(`/?race=${code}`);
  await expect(page2.locator('.race-lobby')).toBeVisible();
  await expect(page1.locator('.race-seats .race-seat:not(.empty)')).toHaveCount(2);
  await expect(page2.locator('.race-seats .race-seat:not(.empty)')).toHaveCount(2);

  await page1.getByRole('button', { name: '我准备好了' }).click();
  await page2.getByRole('button', { name: '我准备好了' }).click();
  await expect(page1.getByRole('button', { name: /开始比赛/ })).toBeEnabled();
  await page1.getByRole('button', { name: /开始比赛/ }).click();

  await expect(page1.locator('.race-pcard')).toHaveCount(2);
  await expect(page2.locator('.race-pcard')).toHaveCount(2);
  await page2.waitForTimeout(1600);
  expect(await canvasPainted(page1)).toBe(true);
  expect(await canvasPainted(page2)).toBe(true);
  await expect(page1.locator('.race-pcard').nth(1)).toContainText('比赛中');

  await page1.getByRole('button', { name: '返回首页' }).click();
  await context1.close();
  await context2.close();
  expect(errors).toEqual([]);
});

test('mobile layout shows touch pads and keeps the HUD readable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.getByRole('button', { name: '单人 / 创建比赛' }).click();
  await page.getByRole('button', { name: '我准备好了' }).click();
  await page.getByRole('button', { name: /开始比赛/ }).click();
  await expect(page.locator('.race-pad.up')).toBeVisible();
  await expect(page.locator('.race-pad.down')).toBeVisible();
  await page.locator('.race-pad.up').tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
  await context.close();
});