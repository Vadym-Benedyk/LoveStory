/**
 * Reset (or create) the admin account's password.
 *
 * Usage:
 *   npm run admin:reset -- <email> <newPassword>
 *   # or, using the values already in .env (OWNER_EMAIL / OWNER_PASSWORD):
 *   npm run admin:reset
 *
 * Examples:
 *   npm run admin:reset -- owner@example.com "<a long password of your own>"
 */
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { adminPasswordProblem } from '../src/lib/password-policy.js';

async function main() {
  const [, , argEmail, argPassword] = process.argv;
  const email = argEmail ?? process.env.OWNER_EMAIL ?? 'owner@example.com';
  const password = argPassword ?? process.env.OWNER_PASSWORD;

  if (!password) {
    // eslint-disable-next-line no-console
    console.error(
      'No password provided. Pass one as an argument or set OWNER_PASSWORD in server/.env.\n' +
        'Usage: npm run admin:reset -- <email> <newPassword>',
    );
    process.exit(1);
  }
  const problem = adminPasswordProblem(password);
  if (problem) {
    // eslint-disable-next-line no-console
    console.error(`This password cannot be used: ${problem}.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: { email, passwordHash, name: 'Owner', role: 'OWNER' },
  });

  // eslint-disable-next-line no-console
  console.log(`✓ Password reset for ${user.email} (role: ${user.role}).`);
  console.log('  You can now log in at /admin/login with the new password.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
