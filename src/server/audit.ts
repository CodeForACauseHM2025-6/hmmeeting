// Append-only audit log for privileged actions (admin role changes, user
// removals, schedule resets, etc.). Failures here MUST NOT block the
// underlying action from succeeding — but should always be visible in PM2
// logs so a missing audit row is detectable.

import { prisma } from "./db";

type AuditEntry = {
  actorEmail: string;
  action: string;
  targetEmail?: string | null;
  detail?: string | null;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetEmail: entry.targetEmail ?? null,
        // Cap detail length so a buggy caller can't bloat the table.
        detail: entry.detail ? entry.detail.slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("AUDIT WRITE FAILED", {
      action: entry.action,
      actor: entry.actorEmail,
      error: (err as Error)?.name,
    });
  }
}
