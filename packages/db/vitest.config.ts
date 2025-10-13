import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: false,
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
});
