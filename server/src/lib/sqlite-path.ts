import path from 'node:path';

// SQLite relative paths resolve differently for the Prisma CLI (relative to schema.prisma)
// vs the running app (relative to process.cwd()), which can silently create two DB files.
// Pin the file to an absolute path under the given prisma/ dir so every entry point agrees.
export function pinSqliteUrl(prismaDir: string): void {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) return; // non-sqlite → leave untouched
  const raw = url.slice('file:'.length);
  if (path.isAbsolute(raw)) return; // already absolute → nothing to do
  const abs = path.resolve(prismaDir, path.basename(raw));
  process.env.DATABASE_URL = `file:${abs}`;
}
