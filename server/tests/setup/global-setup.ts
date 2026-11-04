// Creates a fresh SQLite test database from prisma/schema.prisma once per test run.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TEST_DB_FILE, TEST_ENV } from './test-env';

export default function setup() {
  fs.mkdirSync(path.dirname(TEST_DB_FILE), { recursive: true });
  for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(TEST_DB_FILE + suffix, { force: true });

  execFileSync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
    cwd: path.resolve(__dirname, '../..'),
    // TEST_ENV last: its DATABASE_URL must win over anything inherited from the shell.
    env: { ...process.env, ...TEST_ENV },
    stdio: 'pipe',
  });
}
