import { defineConfig } from '@playwright/test';
import base from '../../../playwright.config.js';

export default defineConfig({
  ...base,
  globalSetup: undefined,
  testDir: '.',
  testMatch: 'alstom.spec.js',
  reporter: 'list',
  use: {
    ...base.use,
    storageState: undefined,
  },
});
