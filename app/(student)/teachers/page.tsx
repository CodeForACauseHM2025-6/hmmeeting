import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { resolveRole } from "@/src/config/roles";
import TeacherSearch from "./teacher-search";
import { ensureDevUsers } from "@/src/server/devSeed";

export default async function TeachersPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser) {
    redirect("/account/setup");
  }

  const resolvedRole = await resolveRole(session.user.email);
  if (resolvedRole !== "STUDENT" && resolvedRole !== "ADMIN") {
    redirect("/dashboard");
  }

  if (process.env.NODE_ENV !== "production") {
    await ensureDevUsers();
  }

  // Only teachers are bookable: the teacher-side dashboard, notifications and
  // accept/decline all key off the TEACHER role, so a request sent to anyone
  // else could never be answered in the app.
  const users = (
    await prisma.user.findMany({ where: { role: "TEACHER" }, include: { teacher: true } })
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));

  const userOptions: { id: string; fullName: string; email: string }[] = [];
  for (const user of users) {
    if (user.email === session.user.email) continue;
    // A teacher without a Teacher row hasn't set availability yet, so they
    // have nothing bookable; skip rather than create rows on a GET.
    if (!user.teacher) continue;
    userOptions.push({ id: user.teacher.id, fullName: user.fullName, email: user.email });
  }

  const heading = "Find a Teacher";
  const subtitle = "Choose a teacher to view availability and request a meeting.";
  const emptyMessage = "No teachers found yet.";

  return (
    <div style={{ padding: "48px 40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{
        fontFamily: 'var(--font-lora, Georgia, serif)',
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '6px',
        color: 'var(--primary)',
        letterSpacing: '-0.02em',
      }}>
        {heading}
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
        {subtitle}
      </p>
      {userOptions.length === 0 ? (
        <div style={{
          padding: "32px 20px",
          textAlign: "center",
          color: "var(--muted)",
          background: "var(--surface-warm)",
          borderRadius: "14px",
          border: "1px solid var(--border-light)",
        }}>
          <p style={{ fontSize: "15px" }}>{emptyMessage}</p>
        </div>
      ) : (
        <TeacherSearch teachers={userOptions} />
      )}
    </div>
  );
}