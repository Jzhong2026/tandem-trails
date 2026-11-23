import { expect, test } from '@playwright/test';
import { withCoop } from './co-op.js';

test('an invalid room code explains itself while join stays disabled', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: '房间码' });
  const join = page.getByRole('button', { name: '加入房间' });
  const hint = page.locator('#room-code-hint');
  await expect(join).toBeDisabled();
  await expect(hint).toHaveCount(0);

  await input.fill('ABC0DE');
  await expect(join).toBeDisabled();
  await expect(hint).toHaveText('房间码不含 0，请核对后重新输入。');
  await expect(input).toHaveAttribute('aria-invalid', 'true');

  await input.fill('AB');
  await expect(hint).toHaveText('房间码需要 6 位，请补全后再加入。');

  await input.fill('ABCDEF');
  await expect(hint).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(join).toBeEnabled();
});

test('seats pick their own buddy and both devices see the same look', async ({ browser, baseURL }) => {
  await withCoop(browser, baseURL, async ({ host, guest }) => {
    await expect(host.locator('.buddy-card')).toHaveCount(2);
    await expect(host.locator('.mission-card')).toContainText('鸭妈妈');
    await expect(guest.locator('.buddy-card.left strong')).toHaveText('芽芽');

    await host.getByRole('button', { name: '小熊', exact: true }).click();
    await expect(guest.locator('.buddy-card.left strong')).toHaveText('熊墩墩');
    await expect(guest.locator('.buddy-card.left .buddy-role')).toContainText('家长 · 大');

    await host.getByRole('button', { name: '孩子 · 小' }).click();
    await expect(guest.locator('.buddy-card.left .buddy-role')).toContainText('孩子 · 小');

    const name = host.getByLabel('名字');
    await name.fill('大宝');
    await name.press('Enter');
    await expect(guest.locator('.buddy-card.left strong')).toHaveText('大宝');

    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});