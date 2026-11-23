// What an admin password must be. Used by the password change endpoint and by the scripts that set
// the owner's password (prisma/seed.ts, scripts/reset-admin-password.ts).
export const MIN_ADMIN_PASSWORD_LENGTH = 10;

// Example values from .env.example and the docs: anyone who reads the repository knows them.
const PUBLIC_EXAMPLE_PASSWORDS = new Set(['ChangeMe123!', 'MyNewPass123!']);

// Why the password is not acceptable, or null when it is.
export function adminPasswordProblem(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `it must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long`;
  }
  if (PUBLIC_EXAMPLE_PASSWORDS.has(password)) return 'it is the example password from the repository';
  return null;
}
