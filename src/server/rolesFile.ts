import fs from "fs";
import path from "path";
import { setRoleLists } from "@/src/config/roles";

type RoleLists = {
  adminEmails: string[];
  teacherEmails: string[];
};

const ROLES_PATH = path.join(process.cwd(), "src/config/roles.ts");

function normalizeEmails(emails: string[]) {
  return Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0)
    )
  );
}

export function persistRoleLists(lists: RoleLists) {
  const adminEmails = normalizeEmails(lists.adminEmails);
  const teacherEmails = normalizeEmails(lists.teacherEmails).filter(
    (email) => !adminEmails.includes(email)
  );

  setRoleLists({ adminEmails, teacherEmails });

  const fileContents = `import { DEV_USERS } from "./devUsers";

export const ADMIN_EMAILS: string[] = ${JSON.stringify(
    adminEmails,
    null,
    2
  )};

export const TEACHER_EMAILS: string[] = ${JSON.stringify(teacherEmails, null, 2)};

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
`;

  fs.writeFileSync(ROLES_PATH, fileContents, "utf8");

  return { adminEmails, teacherEmails };
}
