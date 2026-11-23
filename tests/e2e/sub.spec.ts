import { expect, test } from '@playwright/test';
import { isSubView, SUB } from '../../src/shared/sub.js';
import type { SubView } from '../../src/shared/sub.js';
import { readyTogether, withCoop } from './co-op.js';

test('a family pilots the submarine on two axes, recovers from a reef bump, and delivers the seahorse', async ({ browser, baseURL }) => {
  test.setTimeout(95_000);
  await withCoop(browser, baseURL, async ({ host, guest, touch, room }) => {
    await host.getByRole('combobox', { name: '关卡' }).selectOption('sub');
    await expect(guest.getByText('本轮关卡')).toContainText('泡泡潜艇');
    await readyTogether(host, guest);
    await expect(host.getByText('珊瑚浅滩 · 升降驾驶员')).toBeVisible();
    await expect(guest.getByText('珊瑚浅滩 · 前进驾驶员')).toBeVisible();
    await expect(host.getByRole('button', { name: '上浮', exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: '下潜', exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: '前进', exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: '后退', exact: true })).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    function sub() {
      const run = room()?.run;
      return isSubView(run) ? run : undefined;
    }
    async function until(predicate: (state: SubView) => boolean) {
      await expect.poll(() => {
        const state = sub();
        return state ? predicate(state) : false;
      }, { intervals: [30, 45], timeout: 8000 }).toBe(true);
    }
    async function guestBox(name: string) {
      const button = guest.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      if (!box) throw new Error(`Submarine control is missing: ${name}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    async function keyUntil(key: string, predicate: (state: SubView) => boolean) {
      await host.keyboard.down(key);
      try {
        await until(predicate);
      } finally {
        await host.keyboard.up(key);
      }
    }
    async function touchUntil(name: string, predicate: (state: SubView) => boolean) {
      const point = await guestBox(name);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      try {
        await until(predicate);
      } finally {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
    async function bothUntil(key: string, name: string, predicate: (state: SubView) => boolean) {
      const point = await guestBox(name);
      await host.keyboard.down(key);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      try {
        await until(predicate);
      } finally {
        await host.keyboard.up(key);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }

    // Cruise straight into the hanging reef to see the soft recovery at the last buoy.
    await touchUntil('前进', state => state.collisions === 1);
    await until(state => state.x === SUB.buoys[0].x && state.y === SUB.buoys[0].y);
    await until(state => state.recoveryMs === 0);

    // The depth pilot dives under the hanging reef while the thrust pilot cruises.
    await bothUntil('d', '前进', state => state.y >= 280);
    await touchUntil('前进', state => state.bubbles[0]);
    await expect(host.getByText('上浮绕过第二道礁石，收集高处的气泡')).toBeVisible();

    // Rise over the standing reef while thrusting against the current, and collect the high bubble.
    await bothUntil('a', '前进', state => state.y <= 140);
    await touchUntil('前进', state => state.bubbles[1]);

    // Settle into the middle of the stone gap, wait for the tentacle gate, then pick up the seahorse.
    await keyUntil('d', state => state.y >= 180 && state.y <= 200);
    await touchUntil('前进', state => state.x >= 700);
    await until(state => state.elapsedMs % SUB.tentacle.periodMs < 200);
    await touchUntil('前进', state => state.rescued);
    await expect(host.getByText('小海马已上艇，开向珊瑚站')).toBeVisible();
    await touchUntil('前进', state => state.finished);

    await expect(host.getByRole('heading', { name: '小海马到珊瑚站了！' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: '小海马到珊瑚站了！' })).toBeVisible();
    await expect(host.getByText(/碰撞 1 次 · 气泡 2 \/ 2/)).toBeVisible();
    await expect(guest.getByRole('button', { name: '下一关' })).toHaveCount(0);
    await guest.getByRole('button', { name: '再玩一次' }).tap();
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('sub');
    await expect(host.getByRole('button', { name: '我准备好了' })).toBeVisible();
  });
});