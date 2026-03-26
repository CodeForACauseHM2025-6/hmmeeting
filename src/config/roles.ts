import { DEV_USERS } from "./devUsers";
import { prisma } from "@/src/server/db";

export type RoleValue = "STUDENT" | "TEACHER" | "ADMIN";

const DEV_ROLE_MAP =
  process.env.NODE_ENV !== "production"
    ? new Map(DEV_USERS.map((user) => [user.email.toLowerCase(), user.role as RoleValue]))
    : null;

/**
 * Resolve a user's role.
 *
 * Priority:
 * 1. Dev credentials (dev mode only)
 * 2. INITIAL_ADMIN_EMAIL env var (bootstrap the first admin)
 * 3. Database User.role column (source of truth)
 * 4. Default: STUDENT
 */
export async function resolveRole(email: string): Promise<RoleValue> {
  const normalized = email.trim().toLowerCase();

  // Dev mode: use hardcoded dev user roles
  if (DEV_ROLE_MAP?.has(normalized)) {
    return DEV_ROLE_MAP.get(normalized)!;
  }

  // Bootstrap: env var for the initial admin (before any DB records exist)
  const initialAdmin = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (initialAdmin && normalized === initialAdmin) {
    return "ADMIN";
  }

  // Database is the source of truth
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { role: true },
  });

  if (user?.role) {
    return user.role as RoleValue;
  }

  return "STUDENT";
}
