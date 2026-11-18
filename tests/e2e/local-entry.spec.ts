import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

test('opening the source HTML from disk shows the playable address without module errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(pathToFileURL(resolve('index.html')).href);

  await expect(page.getByRole('link', { name: '打开 Tandem Trails' })).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('link', { name: '打开 Tandem Trails' })).toHaveAttribute('href', 'http://localhost:3000/');
  expect(errors).toEqual([]);
});
