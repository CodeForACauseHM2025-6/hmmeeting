import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { Role } from "@prisma/client";
import { resolveRole } from "@/src/config/roles";
import { getEffectiveWeek } from "@/src/config/schedule";
import { ensureDevUsers } from "@/src/server/devSeed";
import UserSearchTable from "./user-search-table";

const ROLE_OPTIONS = ["STUDENT", "TEACHER", "ADMIN"] as const;
const SETTINGS_ID = "global";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const resolvedRole = await resolveRole(session.user.email);
  if (resolvedRole !== "ADMIN") {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/account/setup");
  }

  return user;
}

async function upsertUserRole(formData: FormData) {
  "use server";

  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();
  const fullNameInput = String(formData.get("fullName") ?? "").trim();

  if (!email || !fullNameInput || !ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number])) {
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const fullName = fullNameInput || existing?.fullName || email;
  const roleValue = role as Role;

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, fullName, role: roleValue },
    update: { fullName, role: roleValue },
  });

  if (role === "TEACHER") {
    await prisma.teacher.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  revalidatePath("/users");
}

async function removeUser(formData: FormData) {
  "use server";

  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { teacher: true },
  });
  if (!user) return;

  // Delete related records
  if (user.teacher) {
    await prisma.appointment.deleteMany({ where: { teacherId: user.teacher.id } });
    await prisma.availability.deleteMany({ where: { teacherId: user.teacher.id } });
    await prisma.teacher.delete({ where: { id: user.teacher.id } });
  }
  await prisma.appointment.deleteMany({ where: { studentId: user.id } });
  await prisma.studentAvailability.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  revalidatePath("/users");
}

async function clearAllSchedules() {
  "use server";

  await requireAdmin();

  await prisma.availability.deleteMany({});
  await prisma.studentAvailability.deleteMany({});
  await prisma.appointment.updateMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] } },
    data: { status: "CANCELLED", emailToken: null },
  });

  revalidatePath("/users");
}

async function updateScheduleWeek(formData: FormData) {
  "use server";
  await requireAdmin();

  const weekValue = String(formData.get("week") ?? "");
  if (weekValue !== "1" && weekValue !== "2") return;

  // Snap to the most recent Monday
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  const anchorMonday = new Date(now);
  anchorMonday.setDate(now.getDate() - daysToMonday);
  anchorMonday.setHours(12, 0, 0, 0); // noon to avoid timezone edge cases

  const currentWeek = weekValue === "1" ? "WEEK1" : "WEEK2";
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, currentWeek, weekSetAt: anchorMonday },
    update: { currentWeek, weekSetAt: anchorMonday },
  });

  revalidatePath("/users");
}

export default async function AdminUsersPage() {
  await requireAdmin();

  if (process.env.NODE_ENV !== "production") {
    await ensureDevUsers();
  }

  const users = (await prisma.user.findMany()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  const scheduleSettings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  const currentWeekValue = scheduleSettings.currentWeek === "WEEK1" ? 1 : 2;
  const effectiveWeek = getEffectiveWeek({
    currentWeek: currentWeekValue,
    weekSetAt: scheduleSettings.weekSetAt,
  });

  const usersWithRoles = users.map((user) => ({
    ...user,
    resolvedRole: user.role,
  }));

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: '34px', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>
        User Directory
      </h1>
      <div style={{ background: 'var(--accent)', height: '3px', width: '60px', borderRadius: '2px', marginBottom: '32px' }} />
      <div
        style={{
          border: 'none',
          borderLeft: '4px solid var(--primary)',
          borderRadius: '10px',
          padding: '28px',
          marginBottom: '28px',
          background: '#fff',
          boxShadow: '0 4px 20px rgba(91,13,31,0.08)',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>
          Add or update a user role
        </h2>
        <form action={upsertUserRole} style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <input
            name="fullName"
            placeholder="Full name"
            required
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '2px solid var(--border)',
              fontSize: '15px',
            }}
          />
          <input
            name="email"
            placeholder="Email"
            required
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '2px solid var(--border)',
              fontSize: '15px',
            }}
          />
          <select
            name="role"
            defaultValue="TEACHER"
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '2px solid var(--border)',
              fontSize: '15px',
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              padding: '14px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            Save role
          </button>
        </form>
      </div>

      <div
        style={{
          border: 'none',
          borderLeft: '4px solid var(--primary)',
          borderRadius: '10px',
          padding: '28px',
          marginBottom: '28px',
          background: '#fff',
          boxShadow: '0 4px 20px rgba(91,13,31,0.08)',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>
          Schedule week
        </h2>
        <div style={{ color: "#555", marginBottom: "12px" }}>
          <div>
            Current week setting: <strong>Week {currentWeekValue}</strong>
          </div>
          <div>
            Effective week today: <strong>Week {effectiveWeek}</strong>
          </div>
          <div>
            Last set: {scheduleSettings.weekSetAt.toLocaleString()}
          </div>
        </div>
        <form action={updateScheduleWeek} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Set current week</label>
          <select
            name="week"
            defaultValue={String(currentWeekValue)}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '2px solid var(--border)',
              fontSize: '15px',
            }}
          >
            <option value="1">Week 1</option>
            <option value="2">Week 2</option>
          </select>
          <button
            type="submit"
            style={{
              padding: '14px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            Save week
          </button>
        </form>
      </div>

      <UserSearchTable
        users={usersWithRoles}
        roleOptions={ROLE_OPTIONS}
        upsertAction={upsertUserRole}
        removeAction={removeUser}
        clearAllAction={clearAllSchedules}
      />
    </div>
  );
}