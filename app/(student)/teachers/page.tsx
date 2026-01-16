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

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    include: { teacher: true },
    orderBy: { fullName: "asc" },
  });

  const teacherOptions = teachers
    .filter((teacher) => teacher.teacher)
    .map((teacher) => ({
      id: teacher.teacher!.id,
      fullName: teacher.fullName,
      email: teacher.email,
    }));

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "12px", color: "var(--primary)" }}>
        Find a Teacher
      </h1>
      <p style={{ color: "#555", marginBottom: "24px" }}>
        Choose a teacher to view availability and request a meeting.
      </p>
      {teacherOptions.length === 0 ? (
        <p>No teachers found yet.</p>
      ) : (
        <TeacherSearch teachers={teacherOptions} />
      )}
    </div>
  );
}