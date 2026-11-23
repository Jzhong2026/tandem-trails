import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { WORKSHOP_GAMES, workshopPuzzle, traceLight } from '../../src/shared/workshop.js';
import type { WorkshopMode, Mirror } from '../../src/shared/workshop.js';

async function solveMirrors(page: Page) {
  const board = await page.locator('.optics-map').evaluate((el) => {
    const cells = [...el.querySelectorAll<HTMLButtonElement>('.map-cell')];
    const n = Math.sqrt(cells.length);
    return {
      kind: 'optics' as const,
      size: n,
      startRow: Math.floor(cells.findIndex((c) => c.querySelector('.beam-source')) / n),
      relays: cells.flatMap((c, i) => (c.dataset.relay ? [i] : [])),
      target: cells.findIndex((c) => c.getAttribute('aria-label') === '接收水晶'),
      mirrors: cells.flatMap((cell, i) =>
        cell.classList.contains('has-mirror') ? [{ cell: i, slash: !!cell.querySelector('.mirror-up') }] : [],
      ),
    };
  });
  let solution: Mirror[] | undefined;
  for (let mask = 0; mask < 2 ** board.mirrors.length; mask++) {
    const mirrors = board.mirrors.map((m, i) => ({ ...m, slash: Boolean(mask & (1 << i)) }));
    if (traceLight({ ...board, mirrors }).lit) {
      solution = mirrors;
      break;
    }
  }
  if (!solution) throw Error('unsolvable mirror board');
  for (const [i, m] of solution.entries()) {
    if (board.mirrors[i].slash === m.slash) continue;
    const cell = page.locator(`[data-cell="${m.cell}"]`);
    await cell.click();
    await expect(cell.locator(m.slash ? '.mirror-up' : '.mirror-down')).toBeVisible();
  }
}
for (const mode of Object.keys(WORKSHOP_GAMES) as WorkshopMode[]) {
  test(`${mode} two devices jointly finish all four stations and replay`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const a = await browser.newContext({ baseURL, viewport: { width: 1280, height: 850 } });
    const b = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
    try {
      const host = await a.newPage(),
        guest = await b.newPage(),
        errors: string[] = [];
      for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));
      await host.goto('/');
      await host.getByRole('button', { name: new RegExp(WORKSHOP_GAMES[mode].name) }).click();
      await host.getByRole('combobox', { name: '上海课程', exact: true }).selectOption('8');
      await host.getByRole('combobox', { name: '学期', exact: true }).selectOption('2');
      await guest.goto(host.url());
      await expect(guest.getByRole('combobox', { name: '上海课程', exact: true })).toHaveValue('8');
      await host.getByRole('button', { name: '我准备好了' }).click();
      await guest.getByRole('button', { name: '我准备好了' }).click();
      await host.getByRole('button', { name: /开始比赛/ }).click();
      for (let round = 0; round < 4; round++) {
        await expect(host.locator('.workshop-mast b')).toHaveText(`${round + 1} / 4`);
        await host.getByRole('button', { name: '给全桌开线索' }).click();
        await expect(guest.locator('.workshop-hint')).toBeVisible();
        if (round === 1) {
          await guest.reload();
          await expect(guest.locator('.workshop-hint')).toBeVisible();
        }
        if (mode === 'optics') await solveMirrors(host);
        else {
          const title = await host.locator('.workshop-mast h1').innerText();
          const prompt = await host.locator('.workshop-log > p').first().innerText();
          const cards = mode === 'chronicle' ? await host.locator('.exhibit').allTextContents() : [];
          const puzzle = Array.from({ length: 120 }, (_, variant) =>
            workshopPuzzle(mode, { grade: 8, term: 2 }, round, variant),
          ).find(
            (p) =>
              p.title === title &&
              p.prompt === prompt &&
              (p.board.kind !== 'chronicle' || p.board.cards.join('|') === cards.join('|')),
          );
          if (!puzzle) throw Error('unknown board ' + prompt);
          if (mode === 'atlas') {
            await host.locator(`[data-cell="${puzzle.answer[0]}"]`).click();
            await expect(guest.locator('.map-cell.marked')).toHaveAttribute(
              'data-cell',
              String(puzzle.answer[0]),
            );
          } else {
            for (const [k, i] of puzzle.answer.entries()) {
              await host.locator('.exhibit').nth(i).click();
              await expect(guest.locator('.museum-case li strong').nth(k)).toHaveText(cards[i]);
            }
          }
        }
        await guest
          .getByRole('button', {
            name: { optics: '检验光路', atlas: '挖掘宝箱', chronicle: '检验时间线' }[mode],
          })
          .click();
        await expect(host.locator('.workshop-message.solved')).toContainText('破解成功');
        await host.getByRole('button', { name: round === 3 ? '完成探索' : '进入下一站' }).click();
      }
      await expect(guest.locator('.workshop-end')).toBeVisible();
      await expect(guest.locator('.workshop-scores')).toContainText('★ 8');
      expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await host.getByRole('button', { name: '再来一局' }).click();
      await expect(guest.locator('.race-lobby')).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });
}

test('choosing junior high in the main hall persists and opens the matching subject shelf and room', async ({
  page,
}) => {
  await page.goto('/');
  const grade = page.getByRole('combobox', { name: '上海课程', exact: true });
  const term = page.getByRole('combobox', { name: '学期', exact: true });
  await grade.selectOption('9');
  await term.selectOption('2');
  await page.reload();
  await expect(grade).toHaveValue('9');
  await expect(term).toHaveValue('2');
  await page.getByText('查看课程目录和配套课时').click();
  await page.getByRole('button', { name: '物理', exact: true }).click();
  await expect(page.locator('.study-picker')).toContainText('沪科技');
  await page.locator('.lesson-reader summary').click();
  await expect(page.locator('.lesson-reader')).toContainText('电磁波');
  await page.getByRole('button', { name: /光镜工坊/ }).click();
  await expect(page.locator('.race-lobby')).toBeVisible();
  await expect(grade).toHaveValue('9');
  await expect(term).toHaveValue('2');
});
