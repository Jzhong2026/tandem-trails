import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function startSolo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '调查消失的校园广播' }).click();
  await expect(page.getByRole('heading', { name: '消失的校园广播' })).toBeVisible();
}

async function shareAllClues(page: Page) {
  const groups = [
    { role: 'investigator', switchName: '切换到分析员', ids: ['broadcast-i-1', 'broadcast-i-2'] },
    { role: 'analyst', switchName: '切换到分析员', ids: ['broadcast-a-1', 'broadcast-a-2'] },
  ];
  for (const group of groups) {
    if (group.role === 'analyst') await page.getByRole('button', { name: group.switchName }).click();
    for (const id of group.ids) {
      const card = page.locator(`[data-clue-id="${id}"]`);
      await card.getByRole('button', { name: '翻开线索' }).click();
      await card.getByRole('button', { name: '分享到证据板' }).click();
    }
  }
  await page.getByRole('button', { name: '切换到调查员' }).click();
}

async function shareRoleClues(page: Page, prefix: string) {
  for (const suffix of ['1', '2']) {
    const id = `${prefix}-${suffix}`;
    const card = page.locator(`[data-clue-id="${id}"]`);
    await card.getByRole('button', { name: '翻开线索' }).click();
    await card.getByRole('button', { name: '分享到证据板' }).click();
  }
}

test('homepage presents both play modes and three cases', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '知识侦探社' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始单人探案' })).toBeVisible();
  await expect(page.getByRole('button', { name: '创建双人房间' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '消失的校园广播' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '罗盘失物案' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '被调换的展览' })).toBeVisible();
});

test('solo player can solve a case with shared evidence', async ({ page }) => {
  await startSolo(page);
  await shareAllClues(page);

  await expect(page.getByText('“after lunch”说明广播最可能在什么时候？')).toBeVisible();
  await page.getByRole('button', { name: '午后', exact: true }).click();
  await expect(page.getByText('英文单词 “meet” 在这句广播里是什么意思？')).toBeVisible();
  await page.getByRole('button', { name: '集合', exact: true }).click();
  await expect(page.getByText('阅读社真正应该在哪里集合？')).toBeVisible();
  await page.getByRole('button', { name: '二楼 204 阅读角', exact: true }).click();
  await page.getByRole('checkbox', { name: '证人小宇' }).check();
  await page.getByRole('checkbox', { name: '校园地图' }).check();
  await page.getByRole('button', { name: '提交指认' }).click();

  await expect(page.getByRole('heading', { name: '案件破解' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '案件破解' })).toBeFocused();
  await expect(page.getByText('关键词理解')).toBeVisible();
  await expect(page.getByText('证据推理')).toBeVisible();
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page.getByText('已破解', { exact: true })).toBeVisible();
});

test('a wrong answer creates a repair task instead of ending the case', async ({ page }) => {
  await startSolo(page);
  await shareAllClues(page);

  await page.getByRole('button', { name: '早上到校时', exact: true }).click();
  await expect(page.getByText('迷雾出现了，但线索还在。')).toBeVisible();
  await expect(page.getByText('“午饭后”离哪个时间最近？')).toBeVisible();
  await page.getByRole('button', { name: '午后', exact: true }).click();
  await expect(page.getByText('“after lunch”说明广播最可能在什么时候？')).toBeVisible();
});

test('two browser pages can complete a duo case without seeing each other’s private clues', async ({ page, context }) => {
  const guest = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: '创建双人房间' }).click();
  await expect(page.getByRole('heading', { name: '等待搭档' })).toBeVisible();
  const code = (await page.getByTestId('room-code').textContent())!.trim();

  await guest.goto('/');
  await guest.getByRole('button', { name: '加入房间' }).click();
  await guest.getByLabel('房间码').fill(code);
  await guest.getByRole('button', { name: '加入调查' }).click();
  await expect(guest.getByRole('heading', { name: '等待搭档' })).toBeVisible();

  await page.getByRole('button', { name: '我准备好了' }).click();
  await guest.getByRole('button', { name: '我准备好了' }).click();
  await page.getByRole('button', { name: '开始调查' }).click();

  await expect(page.getByText('你的身份：调查员')).toBeVisible();
  await expect(guest.getByText('你的身份：分析员')).toBeVisible();
  await expect(page.locator('[data-clue-id="broadcast-a-1"]')).toHaveCount(0);
  await expect(guest.locator('[data-clue-id="broadcast-i-1"]')).toHaveCount(0);

  await shareRoleClues(page, 'broadcast-i');
  await shareRoleClues(guest, 'broadcast-a');
  await expect(page.getByText('“after lunch”说明广播最可能在什么时候？')).toBeVisible();
  await expect(guest.getByText('“after lunch”说明广播最可能在什么时候？')).toBeVisible();
  await page.getByRole('button', { name: '午后', exact: true }).click();
  await page.getByRole('button', { name: '集合', exact: true }).click();
  await page.getByRole('button', { name: '二楼 204 阅读角', exact: true }).click();
  await page.getByRole('checkbox', { name: '证人小宇' }).check();
  await page.getByRole('checkbox', { name: '校园地图' }).check();
  await page.getByRole('button', { name: '提交指认' }).click();

  await expect(page.getByRole('heading', { name: '案件破解' })).toBeVisible();
  await expect(guest.getByRole('heading', { name: '案件破解' })).toBeVisible();
});

test('refreshing a solo case resumes the same room and revealed clues', async ({ page }) => {
  await startSolo(page);
  const firstClue = page.locator('[data-clue-id="broadcast-i-1"]');
  await firstClue.getByRole('button', { name: '翻开线索' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '消失的校园广播' })).toBeVisible();
  await expect(page.locator('[data-clue-id="broadcast-i-1"]').getByText('Good afternoon, Grade 2.')).toBeVisible();
});

test('an invite link opens the join dialog with the room code prefilled', async ({ page }) => {
  await page.goto('/?room=K7M2Q9');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('房间码')).toHaveValue('K7M2Q9');
  await expect(page.getByLabel('房间码')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '加入房间' })).toBeFocused();
});

test('join errors are announced inside the dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '加入房间' }).click();
  await page.getByLabel('房间码').fill('ZZZZZZ');
  await page.getByRole('button', { name: '加入调查' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('没有找到这个房间');
});

test('mobile gameplay has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSolo(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.locator('[data-clue-id="broadcast-i-1"]').getByRole('button', { name: '翻开线索' }).click();
  await expect(page.locator('[data-clue-id="broadcast-i-1"]').getByText('Good afternoon, Grade 2.')).toBeVisible();
});

test('mobile homepage has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '知识侦探社' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
