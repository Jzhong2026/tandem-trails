import { expect, test } from '@playwright/test';
import { readyTogether, withCoop } from './co-op.js';

test('invite, recover and finish the rescue with desktop keyboard and phone touch', async ({ browser, baseURL }) => {
  await withCoop(browser, baseURL, async ({ host, guest, invitation, hold }) => {
    await host.getByRole('combobox', { name: '关卡' }).selectOption('bend');
    await expect(guest.getByText('本轮关卡')).toContainText('浮木弯道');
    await readyTogether(host, guest);
    await expect(host.getByRole('heading', { name: '浮木弯道' })).toBeVisible();
    await expect(guest.getByRole('button', { name: '按住划右桨' })).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    await host.keyboard.down('Space');
    await expect(host.getByRole('button', { name: '按住划左桨' })).toHaveAttribute('aria-pressed', 'true');
    await host.keyboard.up('Space');
    await expect(host.getByRole('button', { name: '按住划左桨' })).toHaveAttribute('aria-pressed', 'false');

    await guest.goto('about:blank');
    await expect(host.getByText('队友掉线，等对方回来继续。')).toBeVisible();
    await guest.goto(invitation);
    await expect(guest.getByRole('button', { name: '按住划右桨' })).toBeEnabled();
    await expect(host.getByRole('button', { name: '按住划左桨' })).toBeEnabled();

    await hold(true, false, run => run.heading >= 0.47);
    await hold(true, true, run => run.y >= 255);
    await hold(false, true, run => run.heading <= 0.07);
    await hold(true, true, run => run.x >= 390);
    await hold(false, true, run => run.heading <= -0.46);
    await hold(true, true, run => run.y <= 151);
    await hold(true, false, run => run.heading >= -0.07);
    await hold(true, true, run => run.x >= 674);
    await hold(true, false, run => run.heading >= 0.5);
    await hold(true, true, run => run.y >= 199);
    await hold(false, true, run => run.heading <= 0.07);
    await hold(true, true, run => run.finished);

    await expect(host.getByRole('heading', { name: '小鸭到家了！' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: '小鸭到家了！' })).toBeVisible();
    await expect(host.getByText(/碰撞 0 次/)).toBeVisible();
    await guest.getByRole('button', { name: '再玩一次' }).tap();
    await expect(host.getByRole('button', { name: '我准备好了' })).toBeVisible();
    await expect(guest.getByRole('button', { name: '我准备好了' })).toBeVisible();
  });
});
