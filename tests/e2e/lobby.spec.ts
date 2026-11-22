import { expect, test } from '@playwright/test';

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