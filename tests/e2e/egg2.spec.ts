import { expect, test } from '@playwright/test';
import { EGG, EGG2, eggWindward, isEggView } from '../../src/shared/egg.js';
import type { EggView } from '../../src/shared/egg.js';
import { readyTogether, withCoop } from './co-op.js';

test('a family advances to the gust walkway, braces through the wind together, and recovers from a drop', async ({ browser, baseURL }) => {
  test.setTimeout(95_000);
  await withCoop(browser, baseURL, async ({ host, guest, touch, room }) => {
    await guest.emulateMedia({ reducedMotion: 'reduce' });
    await host.getByRole('combobox', { name: '关卡' }).selectOption('egg');
    await readyTogether(host, guest);

    function egg() {
      const run = room()?.run;
      return isEggView(run) ? run : undefined;
    }
    async function waitFor(predicate: (run: EggView) => boolean) {
      await expect.poll(() => {
        const run = egg();
        return run ? predicate(run) : false;
      }, { intervals: [25, 40], timeout: 8000 }).toBe(true);
    }
    async function guestBox(name: string) {
      const button = guest.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      if (!box) throw new Error(`Missing control ${name}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    async function move(raise: 'left' | 'right' | 'both' | null, until: (run: EggView) => boolean) {
      const labels = raise === 'right' || raise === 'both' ? ['向右走', '按住抬高担架'] : ['向右走'];
      const touchPoints = [];
      for (const [id, name] of labels.entries()) {
        const point = await guestBox(name);
        touchPoints.push({ id, ...point });
      }
      if (raise === 'left' || raise === 'both') await host.keyboard.down('e');
      await host.keyboard.down('d');
      try {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
        await waitFor(until);
      } finally {
        await host.keyboard.up('d');
        if (raise === 'left' || raise === 'both') await host.keyboard.up('e');
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
    async function gustCross(windIndex: number, until: (run: EggView) => boolean) {
      const wind = EGG2.winds[windIndex];
      await waitFor(run => run.elapsedMs % wind.gustPeriodMs! < 150);
      const windward = eggWindward(wind, egg()!.elapsedMs);
      await move(windward, until);
    }

    // First level: trade the lift on each slope, then advance.
    await move(null, run => run.x >= EGG.slopes[0].from - 18);
    await move('left', run => run.x >= EGG.slopes[0].to);
    await move(null, run => run.x >= EGG.slopes[1].from - 18);
    await move('right', run => run.x >= EGG.slopes[1].to);
    await move(null, run => run.finished);
    await expect(host.getByRole('heading', { name: '龙蛋回到巢里了！' })).toBeVisible();
    await guest.getByRole('button', { name: '下一关' }).tap();
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('egg2');
    await readyTogether(host, guest);
    await expect(host.getByText('风口栈道 · 左端')).toBeVisible();
    await expect(guest.getByText('风口栈道 · 右端')).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    // Up slope still needs the low end raised.
    await move(null, run => run.x >= EGG2.slopes[0].from - 12);
    await move('left', run => run.x >= EGG2.slopes[0].to);

    // Walking into the gust unbraced is unsafe; stopping shows the windward prompt.
    await move(null, run => run.x >= EGG2.winds[0].from + 3);
    await expect(host.getByText(/风从(左|右)边来/)).toBeVisible();
    await expect(guest.getByText(/风从(左|右)边来/)).toBeVisible();
    await move(null, run => run.drops === 1);
    expect(egg()?.x).toBe(EGG2.winds[0].pad);
    await expect(guest.getByText('龙蛋落到软垫上了，从这里重新抬。')).toBeVisible();
    await waitFor(run => run.recoveryMs === 0);

    // The windward end lifts while the other rests; trade turns as the gust flips.
    await gustCross(0, run => run.x >= EGG2.winds[0].to);

    // Down slope, ice, then the second gust gap, then the nest.
    await move(null, run => run.x >= EGG2.slopes[1].from - 12);
    await move('right', run => run.x >= EGG2.slopes[1].to);
    await move(null, run => run.x >= EGG2.winds[1].from - 8);
    await gustCross(1, run => run.x >= EGG2.winds[1].to);
    await move(null, run => run.finished);

    await expect(host.getByRole('heading', { name: '龙蛋回到巢里了！' })).toBeVisible();
    await expect(guest.getByText(/软垫重试 1 次/)).toBeVisible();
    await expect(guest.getByRole('button', { name: '下一关' })).toHaveCount(0);
    await guest.getByRole('button', { name: '再玩一次' }).tap();
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('egg2');
  });
});