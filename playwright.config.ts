import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'android-galaxy-s24',
      use: {
        browserName: 'chromium',
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'iphone-15',
      use: {
        browserName: 'webkit',
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    },
  ],
});
