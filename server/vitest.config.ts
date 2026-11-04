import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './tests/setup/test-env';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    // All integration files share one SQLite file and reset it per test → run files one by one.
    fileParallelism: false,
    env: TEST_ENV,
  },
});
