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

  const isAdmin = resolvedRole === "ADMIN";

  // Admins see all users; students see only teachers
  const users = (
    isAdmin
      ? await prisma.user.findMany({ include: { teacher: true } })
      : await prisma.user.findMany({ where: { role: "TEACHER" }, include: { teacher: true } })
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));

  // For admins: auto-create Teacher profiles for users who don't have one
  // so the existing booking flow (which uses teacherId) works for everyone
  const userOptions: { id: string; fullName: string; email: string }[] = [];

  for (const user of users) {
    // Skip the admin's own entry
    if (user.email === session.user.email) continue;

    if (user.teacher) {
      userOptions.push({
        id: user.teacher.id,
        fullName: user.fullName,
        email: user.email,
      });
    } else if (isAdmin) {
      // Auto-create a Teacher profile for this user so admin can book them
      const teacher = await prisma.teacher.create({ data: { userId: user.id } });
      userOptions.push({
        id: teacher.id,
        fullName: user.fullName,
        email: user.email,
      });
    }
    // For students: skip users without Teacher profile (already filtered by role=TEACHER)
  }

  const heading = isAdmin ? "Find a User" : "Find a Teacher";
  const subtitle = isAdmin
    ? "Choose a user to view availability and request a meeting."
    : "Choose a teacher to view availability and request a meeting.";
  const emptyMessage = isAdmin ? "No users found yet." : "No teachers found yet.";

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
        <TeacherSearch teachers={userOptions} isAdmin={isAdmin} />
      )}
    </div>
  );
}