import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 15000,
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost',
  },
})
