import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { Role } from "@prisma/client";
import { getRoleLists, resolveRole } from "@/src/config/roles";
import { persistRoleLists } from "@/src/server/rolesFile";
import { ensureDevUsers } from "@/src/server/devSeed";

const ROLE_OPTIONS = ["STUDENT", "TEACHER", "ADMIN"] as const;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const resolvedRole = resolveRole(session.user.email);
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

  if (!email || !ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number])) {
    return;
  }

  const { adminEmails, teacherEmails } = getRoleLists();
  let nextAdmin = [...adminEmails];
  let nextTeacher = [...teacherEmails];

  if (role === "ADMIN") {
    nextAdmin = Array.from(new Set([...nextAdmin, email]));
    nextTeacher = nextTeacher.filter((entry) => entry !== email);
  } else if (role === "TEACHER") {
    nextTeacher = Array.from(new Set([...nextTeacher, email]));
    nextAdmin = nextAdmin.filter((entry) => entry !== email);
  } else {
    nextAdmin = nextAdmin.filter((entry) => entry !== email);
    nextTeacher = nextTeacher.filter((entry) => entry !== email);
  }

  persistRoleLists({ adminEmails: nextAdmin, teacherEmails: nextTeacher });

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

export default async function AdminUsersPage() {
  await requireAdmin();

  if (process.env.NODE_ENV !== "production") {
    await ensureDevUsers();
  }

  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" },
  });

  const usersWithRoles = users.map((user) => ({
    ...user,
    resolvedRole: resolveRole(user.email),
  }));

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "20px", color: "var(--primary)" }}>
        User Directory
      </h1>
      <div
        style={{
          border: "1px solid var(--primary)",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          background: "#fff",
          boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ fontSize: "20px", marginBottom: "12px", color: "var(--primary)" }}>
          Add or update a user role
        </h2>
        <form action={upsertUserRole} style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <input
            name="fullName"
            placeholder="Full name (optional)"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
          <input
            name="email"
            placeholder="Email"
            required
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
          <select
            name="role"
            defaultValue="TEACHER"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
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
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save role
          </button>
        </form>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>Name</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>Email</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>Role</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>Update</th>
          </tr>
        </thead>
        <tbody>
          {usersWithRoles.map((user) => (
            <tr key={user.id}>
              <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{user.fullName}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{user.email}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{user.resolvedRole}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>
                <form action={upsertUserRole} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="hidden" name="email" value={user.email} />
                  <input type="hidden" name="fullName" value={user.fullName} />
                  <select
                    name="role"
                    defaultValue={user.resolvedRole}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
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
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "var(--primary)",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Update
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}