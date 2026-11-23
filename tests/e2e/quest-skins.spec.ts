import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('the star sprout map lets each player pick a buddy and the run uses it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.getByRole('button', { name: '双人同乐' }).click();
  const cards = page.locator('.quest-buddies .buddy-card');
  await expect(cards).toHaveCount(2);
  const first = cards.first();
  await first.getByRole('button', { name: '小熊', exact: true }).click();
  await expect(first.locator('strong')).toHaveText('熊墩墩');
  await expect(page.locator('.quest-role.striker h3')).toContainText('熊墩墩');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.locator('.quest-map-head .qbtn.primary').click();
  await expect(page.locator('.quest-story')).toBeVisible();
  await expect(page.locator('.quest-pad.p1 h4')).toContainText('熊墩墩');
  await expect(page.locator('.quest-pad.p2 h4')).toContainText('豆豆');
  expect(errors).toEqual([]);
});