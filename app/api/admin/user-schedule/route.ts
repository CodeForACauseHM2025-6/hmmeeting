import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { resolveRole } from "@/src/config/roles";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resolvedRole = await resolveRole(session.user.email);
  if (resolvedRole !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teacher: { include: { availability: true } },
      studentAvailability: true,
    },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const userRole = await resolveRole(user.email);

  // Build schedule: array of { day, period, type }
  let schedule: { day: number; period: string; type: string }[] = [];

  if (userRole === "TEACHER" && user.teacher) {
    schedule = user.teacher.availability.map((slot) => ({
      day: slot.day,
      period: slot.period,
      type: slot.type ?? "FREE",
    }));
  } else if (user.studentAvailability.length > 0) {
    schedule = user.studentAvailability.map((slot) => ({
      day: slot.day,
      period: slot.period,
      type: "FREE",
    }));
  }

  return Response.json({
    fullName: user.fullName,
    email: user.email,
    role: userRole,
    schedule,
  });
}
