import { expect, test } from '@playwright/test';
import { LEARNING_GAMES } from '../../src/shared/learning.js';
import type { LearningMode } from '../../src/shared/learning.js';
import { questionsFor } from '../../src/server/curriculum.js';

for (const mode of Object.keys(LEARNING_GAMES) as LearningMode[]) {
  test(`${mode} synchronizes a Shanghai spring course, clues and results between two players`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const a = await browser.newContext({ baseURL });
    const b = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
    try {
      const host = await a.newPage(),
        guest = await b.newPage();
      const problems: string[] = [];
      for (const page of [host, guest]) page.on('pageerror', (e) => problems.push(e.message));
      await host.goto('/');
      await host.getByRole('button', { name: new RegExp(LEARNING_GAMES[mode].name) }).click();
      const term = host.getByRole('combobox', { name: '学期', exact: true });
      await term.selectOption('2');
      await expect(term).toHaveValue('2');
      await guest.goto(host.url());
      await expect(guest.getByRole('combobox', { name: '学期', exact: true })).toHaveValue('2');
      await host.getByRole('button', { name: '我准备好了' }).click();
      await guest.getByRole('button', { name: '我准备好了' }).click();
      await host.getByRole('button', { name: /开始比赛/ }).click();
      await expect(host.locator('.learning-counter')).toBeVisible();
      await host.getByRole('button', { name: '给全桌开线索' }).click();
      await expect(guest.locator('.learning-clue')).toContainText('打开了线索');
      await guest.reload();
      await expect(guest.locator('.learning-clue')).toBeVisible();
      const bank = questionsFor({ grade: 2, term: 2 });
      for (let round = 0; round < 6; round++) {
        const prompt = await host.locator('.learning-console h2').innerText();
        const q = bank.find((item) => item.prompt === prompt)!;
        for (const page of [host, guest]) {
          const pieces = page.locator('.learning-piece');
          if (mode === 'lantern')
            await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
          if (mode === 'parcel') {
            for (const part of q.parts!) await page.getByRole('button', { name: part, exact: true }).click();
            await page.getByRole('button', { name: '发出包裹' }).click();
          }
          if (mode === 'orbit') {
            const values = (await pieces.allTextContents()).map(Number);
            const target = Number(q.options[q.answer]);
            const first = values.findIndex((a, i) =>
              values.some((b, j) => i !== j && Math.abs(a + b - target) < 0.00001),
            );
            const second = values.findIndex(
              (b, j) => j !== first && Math.abs(values[first] + b - target) < 0.00001,
            );
            await pieces.nth(first).click();
            await pieces.nth(second).click();
            await page.getByRole('button', { name: '注入能量' }).click();
          }
          await expect(page.locator('.learning-feedback')).toContainText('答对了');
          await page.getByRole('button', { name: round === 5 ? '完成比赛' : /下一关/ }).click();
        }
      }
      await expect(host.locator('.learning-console')).toContainText('比赛结束');
      await expect(guest.locator('.learning-scores')).toContainText('6 分');
      await host.getByRole('button', { name: '再来一局' }).click();
      await expect(guest.locator('.race-lobby')).toBeVisible();
      expect(problems).toEqual([]);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });
}

test('a child can open a local lesson, try its question and find the official class', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /字谜灯会/ }).click();
  await page.getByRole('combobox', { name: '学期', exact: true }).selectOption('2');
  await page.getByText('查看课程目录和配套课时').click();
  await page.getByRole('button', { name: '数学', exact: true }).click();
  const shelf = page.locator('.study-picker');
  await expect(shelf).toContainText('上海二年级下学期');
  await shelf.getByText(/课前练习室/).click();
  const lesson = shelf.locator('.lesson-reader');
  await expect(lesson.locator('fieldset legend')).not.toBeEmpty();
  await lesson.locator('fieldset button').first().click();
  await expect(lesson.getByRole('status')).toBeVisible();
  await shelf.getByRole('textbox', { name: '搜索课时' }).fill('除法');
  await expect(shelf.locator('a').first()).toHaveAttribute('href', /^https:\/\/basic\.sh\.smartedu\.cn\//);
});
