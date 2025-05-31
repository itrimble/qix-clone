import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // For DOM-related testing
    setupFiles: './vitest.setup.ts', // Optional: if we need global setup
  },
});
