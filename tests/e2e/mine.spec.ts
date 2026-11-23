import { expect, test } from '@playwright/test';
import { MINE } from '../../src/shared/mine.js';
import type { MineView } from '../../src/shared/mine.js';
import { readyTogether, withCoop } from './co-op.js';

test('both players operate the bridge and lift and leave the mine together', async ({ browser, baseURL }) => {
  test.setTimeout(50_000);
  await withCoop(browser, baseURL, async ({ host, guest, touch, room, invitation }) => {
    await host.getByRole('combobox', { name: '关卡' }).selectOption('mine');
    await expect(guest.getByText('本轮关卡')).toContainText('萤火虫矿洞');
    await readyTogether(host, guest);
    await expect(host.locator('.story-bubble')).toContainText('长老');
    await expect(host.getByRole('heading', { name: '萤火虫矿洞' })).toBeVisible();
    await expect(guest.getByText('断桥接力 · 上层')).toBeVisible();
    await expect(host.getByText('断桥接力 · 下层')).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    function mine() {
      const run = room()?.run;
      return run?.level === 'mine' ? run : undefined;
    }

    async function until(predicate: (state: MineView) => boolean) {
      await expect.poll(() => {
        const state = mine();
        return state ? predicate(state) : false;
      }, { intervals: [30, 45], timeout: 6000 }).toBe(true);
    }

    async function keyUntil(key: string, predicate: (state: MineView) => boolean) {
      await host.keyboard.down(key);
      try {
        await until(predicate);
      } finally {
        await host.keyboard.up(key);
      }
    }

    async function touchUntil(name: string, predicate: (state: MineView) => boolean) {
      const button = guest.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      if (!box) throw new Error(`Mine control is missing: ${name}`);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      try {
        await until(predicate);
      } finally {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }

    const moveRight = host.getByRole('button', { name: '向右走' });
    await host.keyboard.down('d');
    try {
      await expect(moveRight).toHaveAttribute('aria-pressed', 'true');
      await guest.goto('about:blank');
      await expect(host.getByText('队友掉线，等对方回来继续。')).toBeVisible();
      await guest.goto(invitation);
      await expect(moveRight).toBeEnabled();
      await host.keyboard.down('d');
      await expect(moveRight).toHaveAttribute('aria-pressed', 'false');
    } finally {
      await host.keyboard.up('d');
    }

    await touchUntil('向右走', state => state.players.right.x === MINE.bridge.start);
    await expect(guest.getByText('原地等下层队友按住开关')).toBeVisible();
    await keyUntil('d', state => state.players.left.x >= MINE.bridge.switchX);
    await host.keyboard.down('e');
    try {
      await expect(guest.getByText('桥已放下，往右走到对岸')).toBeVisible();
      await touchUntil('向右走', state => state.players.right.x >= MINE.lift.switchX);
    } finally {
      await host.keyboard.up('e');
    }

    await keyUntil('d', state => state.players.left.x === MINE.lift.x);
    await expect(host.getByText('停在升降台，等上层队友升起平台')).toBeVisible();
    await touchUntil('按住操作机关', state => state.liftProgress === 1);
    await touchUntil('向右走', state => state.players.right.x >= MINE.exit);
    await expect(guest.getByText('你已到出口，等队友过来')).toBeVisible();
    await keyUntil('d', state => state.finished);

    await expect(host.getByRole('heading', { name: '一起走出矿洞了！' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: '一起走出矿洞了！' })).toBeVisible();
    await guest.getByRole('button', { name: '再玩一次' }).tap();
    await expect(host.getByRole('option', { name: '萤火虫矿洞 · 已通关' })).toHaveCount(1);
  });
});
