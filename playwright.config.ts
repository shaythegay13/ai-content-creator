import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    actionTimeout: 15000,
  },
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      LOCAL_DEV_MODE: 'true',
      GROQ_API_KEY: '',
      NOTION_API_KEY: '',
      LOCAL_DATA_DIR: `.local/e2e-${Date.now()}`,
    },
  },
});
