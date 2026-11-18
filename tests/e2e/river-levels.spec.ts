import { expect, test } from '@playwright/test';
import { FOG_FLAGS, FOG_GATE } from '../../src/shared/river-levels.js';
import { readyTogether, withCoop } from './co-op.js';

test('a family can learn to paddle and advance to the next level in the same room', async ({ browser, baseURL }) => {
  await withCoop(browser, baseURL, async ({ host, guest, hold }) => {
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('practice');
    await readyTogether(host, guest);
    await expect(host.getByRole('heading', { name: '练桨池' })).toBeVisible();
    await expect(guest.getByText('单独试一次你的右桨')).toBeVisible();
    await hold(true, false, run => Boolean(run.practice?.[0]));
    await expect(host.getByText('等队友单独试桨')).toBeVisible();
    await hold(false, true, run => Boolean(run.practice?.[1]));
    await expect(guest.getByText(/两支桨都试过了/)).toBeVisible();
    await hold(true, true, run => run.finished);
    await expect(guest.getByRole('heading', { name: '练桨完成！' })).toBeVisible();
    await guest.getByRole('button', { name: '下一关' }).tap();
    await expect(host.getByRole('combobox', { name: '关卡' })).toHaveValue('bend');
    await expect(host.getByRole('option', { name: '练桨池 · 已通关' })).toHaveCount(1);
    await expect(guest.getByText('本轮关卡')).toContainText('浮木弯道');
  });
});

test('two private clues lead to a successful fog rescue on desktop and phone', async ({ browser, baseURL }) => {
  test.setTimeout(45_000);
  await withCoop(browser, baseURL, async ({ host, guest, hold, room }) => {
    await host.getByRole('combobox', { name: '关卡' }).selectOption('fog');
    await expect(guest.getByText('本轮关卡')).toContainText('雾里找码头');
    await readyTogether(host, guest);
    await expect(host.getByRole('heading', { name: '你的救援信号' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: '你的浅滩地图' })).toBeVisible();
    await expect(host.getByText('等队友分享另一条线索')).toBeVisible();
    await expect(guest.getByText('等队友分享另一条线索')).toBeVisible();
    await host.getByRole('button', { name: '告诉队友', exact: true }).click();
    await expect(guest.getByText(/队友线索.*旗/)).toBeVisible();
    await expect(host.getByText('等队友分享另一条线索')).toBeVisible();
    await guest.getByRole('button', { name: '告诉队友', exact: true }).tap();
    await expect(host.getByText(/队友线索.*水路/)).toBeVisible();
    await expect(guest.getByText(/两条线索已齐/)).toBeVisible();
    const { flag, channel } = room()!.clues!;
    if (!flag || !channel) throw new Error('Both clues should be shared before the crossing');
    expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    // Choose a heading from the received view and use only the real controls to steer.
    async function aim(heading: number) {
      const current = room()!.run!.heading;
      if (Math.abs(current - heading) < 0.09) return;
      const left = current < heading;
      await hold(left, !left, run => left ? run.heading >= heading - 0.04 : run.heading <= heading + 0.04);
    }
    const lane = FOG_GATE.lanes[channel];
    const upper = channel === 'upper';
    await aim(upper ? -0.57 : 0.57);
    await hold(true, true, run => upper ? run.y <= lane : run.y >= lane);
    for (const waypoint of [315, 405, 525]) {
      const position = room()!.run!;
      await aim(Math.atan2(lane - position.y, waypoint - position.x));
      await hold(true, true, run => run.x >= waypoint);
    }
    expect(room()!.run!.pastFog).toBe(true);

    const flagPoint = FOG_FLAGS[flag];
    const current = room()!.run!;
    await aim(Math.max(-0.74, Math.min(0.74, Math.atan2(flagPoint.y - current.y, flagPoint.x - current.x))));
    await hold(true, true, run => run.rescued || run.x >= flagPoint.x + 12);
    if (!room()!.run!.rescued) {
      await aim(room()!.run!.y > flagPoint.y ? -0.68 : 0.68);
      await hold(true, true, run => run.rescued);
    }
    await expect(host.getByText('小鸭已上船，划向码头')).toBeVisible();

    const rescued = room()!.run!;
    await aim(Math.max(-0.73, Math.min(0.73, Math.atan2(200 - rescued.y, 881 - rescued.x))));
    await hold(true, true, run => run.finished || run.x >= 895);
    if (!room()!.run!.finished) {
      await aim(room()!.run!.y > 200 ? -0.67 : 0.67);
      await hold(true, true, run => run.finished);
    }
    await expect(guest.getByRole('heading', { name: '小鸭到家了！' })).toBeVisible();
    await expect(host.getByRole('heading', { name: '小鸭到家了！' })).toBeVisible();
  });
});
