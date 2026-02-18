import { DEV_USERS } from "./devUsers";

export const ADMIN_EMAILS: string[] = [
    //"principal@horacemann.org",
    //"brighten_sun@horacemann.org",
];

export const TEACHER_EMAILS: string[] = [
    //"teacher@horacemann.org",
    //"brighten_sun@horacemann.org",
];

export type RoleValue = "STUDENT" | "TEACHER" | "ADMIN";

const DEV_ROLE_MAP =
  process.env.NODE_ENV !== "production"
    ? new Map(DEV_USERS.map((user) => [user.email.toLowerCase(), user.role as RoleValue]))
    : null;

export function getRoleLists() {
  return {
    adminEmails: [...ADMIN_EMAILS],
    teacherEmails: [...TEACHER_EMAILS],
  };
}

export function setRoleLists(params: { adminEmails: string[]; teacherEmails: string[] }) {
  ADMIN_EMAILS.length = 0;
  ADMIN_EMAILS.push(...params.adminEmails);

  TEACHER_EMAILS.length = 0;
  TEACHER_EMAILS.push(...params.teacherEmails);
}

export function resolveRole(email: string): RoleValue {
  const normalized = email.trim().toLowerCase();

  if (DEV_ROLE_MAP?.has(normalized)) {
    return DEV_ROLE_MAP.get(normalized)!;
  }

  if (ADMIN_EMAILS.map((value) => value.toLowerCase()).includes(normalized)) {
    return "ADMIN";
  }

  if (TEACHER_EMAILS.map((value) => value.toLowerCase()).includes(normalized)) {
    return "TEACHER";
  }

  return "STUDENT";
}
