import { expect, test } from '@playwright/test';
import { isMineView, MINE, MINE2 } from '../../src/shared/mine.js';
import type { MineView } from '../../src/shared/mine.js';
import { readyTogether, withCoop } from './co-op.js';

test('a family finishes the first mine, advances to the double bridge, and passes the baton both ways', async ({ browser, baseURL }) => {
  test.setTimeout(95_000);
  await withCoop(browser, baseURL, async ({ host, guest, touch, room }) => {
    await host.getByRole('combobox', { name: '关卡' }).selectOption('mine');
    await readyTogether(host, guest);

    function mine() {
      const run = room()?.run;
      return isMineView(run) ? run : undefined;
    }
    async function until(predicate: (state: MineView) => boolean) {
      await expect.poll(() => {
        const state = mine();
        return state ? predicate(state) : false;
      }, { intervals: [30, 45], timeout: 7000 }).toBe(true);
    }
    async function keyUntil(key: string, predicate: (state: MineView) => boolean) {
      await host.keyboard.down(key);
      try {
        await until(predicate);
      } finally {
        await host.keyboard.up(key);
      }
    }
    async function guestBox(name: string) {
      const button = guest.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      if (!box) throw new Error(`Mine control is missing: ${name}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    async function touchUntil(name: string, predicate: (state: MineView) => boolean) {
      const point = await guestBox(name);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      try {
        await until(predicate);
      } finally {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
    async function guestHold(name: string) {
      const point = await guestBox(name);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      return () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }

    // First level: lower opens the bridge, upper runs the lift.
    await touchUntil('向右走', state => state.players.right.x === MINE.bridge.start);
    await keyUntil('d', state => state.players.left.x >= MINE.bridge.switchX);
    await host.keyboard.down('e');
    try {
      await touchUntil('向右走', state => state.players.right.x >= MINE.lift.switchX);
    } finally {
      await host.keyboard.up('e');
    }
    await keyUntil('d', state => state.players.left.x === MINE.lift.x);
    await touchUntil('按住操作机关', state => state.liftProgress === 1);
    await touchUntil('向右走', state => state.players.right.x >= MINE.exit);
    await keyUntil('d', state => state.finished);
    await expect(host.getByRole('heading', { name: '一起走出矿洞了！' })).toBeVisible();

    // Advance to the second level in the same room.
    await guest.getByRole('button', { name: '下一关' }).tap();
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('mine2');
    await expect(guest.getByText('本轮关卡')).toContainText('萤火虫矿洞');
    await readyTogether(host, guest);
    await expect(host.getByText('双桥接力 · 下层')).toBeVisible();
    await expect(guest.getByText('双桥接力 · 上层')).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    // Lower holds the first bridge while upper crosses to the second switch.
    await touchUntil('向右走', state => state.players.right.x === MINE2.bridge1.start);
    await expect(guest.getByText('原地等下层队友按住开关')).toBeVisible();
    await keyUntil('d', state => state.players.left.x >= MINE2.bridge1.switchX);
    await host.keyboard.down('e');
    try {
      await expect(guest.getByText('第一道桥放下了，往右过桥')).toBeVisible();
      await touchUntil('向右走', state => state.players.right.x >= MINE2.bridge2.switchX);
    } finally {
      await host.keyboard.up('e');
    }
    await expect(guest.getByText('按住橙色开关，帮下层队友过第二道桥')).toBeVisible();

    // Now upper holds the second bridge while lower crosses.
    await keyUntil('d', state => state.players.left.x === MINE2.bridge2.start);
    await expect(host.getByText('原地等上层队友按住开关')).toBeVisible();
    const release = await guestHold('按住操作机关');
    try {
      await expect(host.getByText('第二道桥放下了，往右过桥')).toBeVisible();
      await keyUntil('d', state => state.bridge2Crossed);
    } finally {
      await release();
    }
    // Lower collects its firefly, returns to the cart switch; upper rides the cart across the gap.
    await keyUntil('d', state => state.players.left.firefly);
    await host.keyboard.down('e');
    try {
      await keyUntil('a', state => Math.abs(state.players.left.x - MINE2.cart.switchX) <= MINE2.interactRange);
    } finally {
      await host.keyboard.up('e');
    }
    await touchUntil('向右走', state => state.players.right.x === MINE2.cart.from);
    await expect(guest.getByText('站在矿车上，等下层按住蓝色开关')).toBeVisible();
    await host.keyboard.down('e');
    try {
      await expect(host.getByText('按住蓝色开关，送队友过矿车段')).toBeVisible();
      await until(state => state.cartX === MINE2.cart.to);
    } finally {
      await host.keyboard.up('e');
    }
    await touchUntil('向右走', state => state.players.right.x >= MINE2.exit);
    await expect(guest.getByText('你已到出口，等队友过来')).toBeVisible();
    await keyUntil('d', state => state.finished);
    await expect(host.getByRole('heading', { name: '一起走出矿洞了！' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: '一起走出矿洞了！' })).toBeVisible();
    await expect(guest.getByRole('button', { name: '下一关' })).toHaveCount(0);
    await guest.getByRole('button', { name: '再玩一次' }).tap();
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('mine2');
  });
});