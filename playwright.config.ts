import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4317',
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: 'npm run build && npm start',
    env: { PORT: '4317', HOST: '127.0.0.1' },
    url: 'http://127.0.0.1:4317/health',
    timeout: 60_000,
  },
});
