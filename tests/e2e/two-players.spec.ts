import { expect, test } from '@playwright/test';
import type { RoomView } from '../../src/shared/protocol.js';
import type { RiverView } from '../../src/shared/river.js';

test('invite, recover and finish the rescue with desktop keyboard and phone touch', async ({ browser, baseURL }) => {
  const desktop = await browser.newContext({ baseURL, viewport: { width: 1350, height: 930 } });
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const host = await desktop.newPage();
    const guest = await phone.newPage();
    let latest: RoomView | undefined;
    host.on('websocket', ws => {
      ws.on('framereceived', ({ payload }) => {
        if (typeof payload !== 'string' || !payload.startsWith('42[')) return;
        const [event, view] = JSON.parse(payload.slice(2));
        if (event === 'room:view') latest = view;
      });
    });
    await host.goto('/');
    await host.getByRole('button', { name: '创建房间' }).click();
    const invite = host.getByRole('textbox', { name: '邀请链接' });
    await expect(invite).toHaveValue(/\?room=[A-Z0-9]{6}$/);
    const invitation = await invite.inputValue();
    await guest.goto(invitation);
    await guest.getByRole('button', { name: '加入房间' }).tap();
    await host.getByRole('button', { name: '我准备好了' }).click();
    await expect(host.getByRole('button', { name: '取消准备' })).toBeVisible();
    await guest.getByRole('button', { name: '我准备好了' }).tap();
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

    const rightButton = guest.getByRole('button', { name: '按住划右桨' });
    const touch = await phone.newCDPSession(guest);
    const button = await rightButton.boundingBox();
    if (!button) throw new Error('Right paddle is not visible');
    const touchPoint = { x: button.x + button.width / 2, y: button.y + button.height / 2 };
    async function hold(left: boolean, right: boolean, until: (run: RiverView) => boolean) {
      if (left) await host.keyboard.down('Space');
      if (right) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
        await expect(rightButton).toHaveAttribute('aria-pressed', 'true');
      }
      try {
        await expect.poll(() => latest?.run && until(latest.run), {
          intervals: [25, 35], timeout: 5000,
        }).toBe(true);
      } finally {
        if (left) await host.keyboard.up('Space');
        if (right) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
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
  } finally {
    await Promise.all([desktop.close(), phone.close()]);
  }
});
