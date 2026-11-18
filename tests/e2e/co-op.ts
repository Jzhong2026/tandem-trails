import { expect } from '@playwright/test';
import type { Browser, CDPSession, Page } from '@playwright/test';
import type { RoomView } from '../../src/shared/protocol.js';
import type { RiverView } from '../../src/shared/river.js';

export async function withCoop(browser: Browser, baseURL: string | undefined, play: (game: Coop) => Promise<void>) {
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
    const touch = await phone.newCDPSession(guest);
    function river() {
      const run = latest?.run;
      return !run || run.level === 'mine' || run.level === 'egg' ? undefined : run;
    }

    async function hold(left: boolean, right: boolean, until: (run: RiverView) => boolean) {
      const button = guest.getByRole('button', { name: '按住划右桨' });
      let box = null;
      if (right) {
        await button.scrollIntoViewIfNeeded();
        box = await button.boundingBox();
        if (!box) throw new Error('Right paddle is not visible');
      }
      if (left) await host.keyboard.down('Space');
      try {
        if (box) {
          const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
          await expect(button).toHaveAttribute('aria-pressed', 'true');
        }
        await expect.poll(() => {
          const run = river();
          return run !== undefined && until(run);
        }, {
          intervals: [20, 35], timeout: 5000,
          message: 'The server should report the expected boat position or progress',
        }).toBe(true);
      } catch (error) {
        throw new Error(`Last boat state: ${JSON.stringify(latest?.run)}`, { cause: error });
      } finally {
        if (left) await host.keyboard.up('Space');
        if (right) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
    await play({ host, guest, touch, invitation, hold, river, room: () => latest });
  } finally {
    await Promise.all([desktop.close(), phone.close()]);
  }
}

interface Coop {
  host: Page;
  guest: Page;
  touch: CDPSession;
  invitation: string;
  hold: (left: boolean, right: boolean, until: (run: RiverView) => boolean) => Promise<void>;
  river: () => RiverView | undefined;
  room: () => RoomView | undefined;
}

export async function readyTogether(host: Page, guest: Page) {
  await host.getByRole('button', { name: '我准备好了' }).click();
  await expect(host.getByRole('button', { name: '取消准备' })).toBeVisible();
  await guest.getByRole('button', { name: '我准备好了' }).tap();
}
