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

  const resolvedRole = resolveRole(session.user.email);
  if (resolvedRole !== "STUDENT" && resolvedRole !== "ADMIN") {
    redirect("/dashboard");
  }

  if (process.env.NODE_ENV !== "production") {
    await ensureDevUsers();
  }

  const isAdmin = resolvedRole === "ADMIN";

  // Admins see all users; students see only teachers
  const users = isAdmin
    ? await prisma.user.findMany({
        include: { teacher: true },
        orderBy: { fullName: "asc" },
      })
    : await prisma.user.findMany({
        where: { role: "TEACHER" },
        include: { teacher: true },
        orderBy: { fullName: "asc" },
      });

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
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "12px", color: "var(--primary)" }}>
        {heading}
      </h1>
      <p style={{ color: "#555", marginBottom: "24px" }}>
        {subtitle}
      </p>
      {userOptions.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <TeacherSearch teachers={userOptions} isAdmin={isAdmin} />
      )}
    </div>
  );
}