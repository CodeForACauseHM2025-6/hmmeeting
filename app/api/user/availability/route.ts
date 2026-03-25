// src/app/api/user/availability/route.ts
// API endpoint to manage teacher availability.

import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { PERIODS, type PeriodValue } from "@/src/config/schedule";
import { resolveRole } from "@/src/config/roles";

type AvailabilityInput = {
  day: number;
  period: PeriodValue;
  recurring?: boolean;
  type?: string;
};

async function getTeacherForSession(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { teacher: true },
  });

  if (!user) {
    return { error: new Response("Not found", { status: 404 }) };
  }

  const resolvedRole = resolveRole(email);
  if (resolvedRole !== "TEACHER") {
    return { error: new Response("Forbidden", { status: 403 }) };
  }

  if (user.role !== resolvedRole) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: resolvedRole },
    });
  }

  if (!user.teacher) {
    const teacher = await prisma.teacher.create({ data: { userId: user.id } });
    return { user, teacher };
  }

  return { user, teacher: user.teacher };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const teacherId = url.searchParams.get("teacherId");

  if (teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      return new Response("Teacher not found", { status: 404 });
    }

    const availability = await prisma.availability.findMany({
      where: { teacherId },
      orderBy: [{ day: "asc" }, { period: "asc" }],
    });

    const activeAppointments = await prisma.appointment.findMany({
      where: {
        teacherId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { day: true, period: true },
    });

    const blockedSet = new Set(
      activeAppointments.map((appointment) => `${appointment.day}-${appointment.period}`)
    );

    // Office hours slots remain visible even when booked (multiple students allowed)
    const filteredAvailability = availability.filter(
      (slot) => slot.type === "OFFICE_HOURS" || !blockedSet.has(`${slot.day}-${slot.period}`)
    );

    return Response.json({
      room: teacher.room ?? null,
      slots: filteredAvailability.map((slot) => ({
        id: slot.id,
        day: slot.day,
        period: slot.period,
        type: slot.type,
      })),
    });
  }

  const { error, teacher } = await getTeacherForSession(session.user.email);
  if (error || !teacher) {
    return error ?? new Response("Not found", { status: 404 });
  }

  const availability = await prisma.availability.findMany({
    where: { teacherId: teacher.id },
    orderBy: [{ day: "asc" }, { period: "asc" }],
  });

  const activeAppointments = await prisma.appointment.findMany({
    where: {
      teacherId: teacher.id,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { day: true, period: true },
  });

  const blockedSet = new Set(
    activeAppointments.map((appointment) => `${appointment.day}-${appointment.period}`)
  );

  // Office hours slots remain visible even when booked
  const filteredAvailability = availability.filter(
    (slot) => slot.type === "OFFICE_HOURS" || !blockedSet.has(`${slot.day}-${slot.period}`)
  );

  return Response.json(filteredAvailability.map((slot) => ({
    id: slot.id,
    day: slot.day,
    period: slot.period,
    type: slot.type,
  })));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AvailabilityInput | null;
  const day = payload?.day;
  const period = payload?.period;
  const recurring = payload?.recurring ?? true;

  if (typeof day !== "number" || day < 1 || day > 10) {
    return new Response("Invalid day", { status: 400 });
  }

  if (!period || !PERIODS.includes(period)) {
    return new Response("Invalid period", { status: 400 });
  }

  const { error, teacher } = await getTeacherForSession(session.user.email);
  if (error || !teacher) {
    return error ?? new Response("Not found", { status: 404 });
  }

  const existing = await prisma.availability.findFirst({
    where: { teacherId: teacher.id, day, period },
  });

  if (existing) {
    return new Response("Availability already exists for that period", { status: 409 });
  }

  const created = await prisma.availability.create({
    data: {
      teacherId: teacher.id,
      day,
      period,
      recurring,
    },
  });

  return Response.json(created);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = payload?.id;

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const availability = await prisma.availability.findUnique({
    where: { id },
    include: { teacher: true },
  });

  if (!availability) {
    return new Response("Not found", { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || availability.teacher.userId !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  await prisma.availability.delete({ where: { id } });

  return Response.json({ success: true });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    slots?: AvailabilityInput[];
  } | null;

  const slots = Array.isArray(payload?.slots) ? payload?.slots : [];

  const { error, teacher } = await getTeacherForSession(session.user.email);
  if (error || !teacher) {
    return error ?? new Response("Not found", { status: 404 });
  }

  const validSlots = slots.filter(
    (slot) =>
      typeof slot.day === "number" &&
      slot.day >= 1 &&
      slot.day <= 10 &&
      PERIODS.includes(slot.period)
  );

  const uniqueSlots = Array.from(
    new Map(
      validSlots.map((slot) => [`${slot.day}-${slot.period}`, slot])
    ).values()
  );

  await prisma.availability.deleteMany({
    where: { teacherId: teacher.id },
  });

  if (uniqueSlots.length > 0) {
    await prisma.availability.createMany({
      data: uniqueSlots.map((slot) => ({
        teacherId: teacher.id,
        day: slot.day,
        period: slot.period,
        recurring: slot.recurring ?? true,
        type: slot.type === "OFFICE_HOURS" ? "OFFICE_HOURS" : "FREE",
      })),
    });
  }

  return Response.json({ success: true });
}