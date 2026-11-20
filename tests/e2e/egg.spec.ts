import { expect, test } from '@playwright/test';
import { EGG } from '../../src/shared/egg.js';
import type { EggView } from '../../src/shared/egg.js';
import { readyTogether, withCoop } from './co-op.js';

test('desktop keyboard and phone multitouch trade the lift and deliver the egg after a drop', async ({ browser, baseURL }) => {
  test.setTimeout(50_000);
  await withCoop(browser, baseURL, async ({ host, guest, touch, room }) => {
    await guest.emulateMedia({ reducedMotion: 'reduce' });
    await host.emulateMedia({ reducedMotion: 'no-preference' });
    await host.getByRole('combobox', { name: '关卡' }).selectOption('egg');
    await expect(guest.getByText('本轮关卡')).toContainText('摇摇晃晃送龙蛋');
    await readyTogether(host, guest);
    await expect(host.getByText('双坡运蛋 · 左端')).toBeVisible();
    await expect(guest.getByText('双坡运蛋 · 右端')).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    function egg() {
      const run = room()?.run;
      return run?.level === 'egg' ? run : undefined;
    }

    async function waitFor(predicate: (run: EggView) => boolean) {
      await expect.poll(() => {
        const run = egg();
        return run ? predicate(run) : false;
      }, { intervals: [25, 40], timeout: 7000 }).toBe(true);
    }

    async function move(raise: 'left' | 'right' | null, until: (run: EggView) => boolean) {
      const labels = raise === 'right' ? ['向右走', '按住抬高担架'] : ['向右走'];
      const touchPoints = [];
      for (const [id, name] of labels.entries()) {
        const button = guest.getByRole('button', { name, exact: true });
        const box = await button.boundingBox();
        if (!box) throw new Error(`Missing control ${name}`);
        touchPoints.push({ id, x: box.x + box.width / 2, y: box.y + box.height / 2 });
      }
      if (raise === 'left') await host.keyboard.down('e');
      await host.keyboard.down('d');
      try {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
        await waitFor(until);
      } finally {
        await host.keyboard.up('d');
        if (raise === 'left') await host.keyboard.up('e');
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }

    await move(null, run => run.drops === 1);
    expect(egg()?.x).toBe(EGG.slopes[0].pad);
    await expect(guest.getByText('龙蛋落到软垫上了，从这里重新抬。')).toBeVisible();
    await waitFor(run => run.recoveryMs === 0);
    await move(null, run => run.x >= EGG.slopes[0].from + 9);
    const lift = await guest.getByRole('button', { name: '按住抬高担架' }).boundingBox();
    if (!lift) throw new Error('Missing lift control');
    await host.keyboard.down('e');
    try {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: lift.x + lift.width / 2, y: lift.y + lift.height / 2 }],
      });
      await expect(guest.getByText('你这端较高，松开抬高按钮')).toBeVisible();
      await expect(host.getByText('等队友松开较高的一端')).toBeVisible();
    } finally {
      await host.keyboard.up('e');
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await move('left', run => run.x >= EGG.slopes[0].to && run.raised.left);
    await move(null, run => run.x >= EGG.slopes[1].from - 18);
    await move('right', run => run.x >= EGG.slopes[1].to && run.raised.right);
    await move(null, run => run.finished);

    await expect(host.getByRole('heading', { name: '龙蛋回到巢里了！' })).toBeVisible();
    await expect(guest.getByText(/软垫重试 1 次/)).toBeVisible();
    const lastFrame = await guest.locator('canvas.finish-art').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    const hostArt = host.locator('canvas.finish-art');
    await expect.poll(() => hostArt.evaluate((canvas: HTMLCanvasElement, expected) => canvas.toDataURL() === expected, lastFrame)).toBe(true);
    await guest.getByRole('button', { name: '再玩一次' }).tap();
    await expect(host.getByRole('option', { name: '摇摇晃晃送龙蛋 · 已通关' })).toHaveCount(1);
  });
});
