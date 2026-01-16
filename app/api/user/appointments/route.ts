// src/app/api/user/appointments/route.ts
// API endpoint to manage appointments.

import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { sendMeetingEmails } from "@/src/server/email";
import { PERIODS, type PeriodValue } from "@/src/config/schedule";
import { resolveRole } from "@/src/config/roles";

type AppointmentPayload = {
  teacherId: string;
  day: number;
  period: PeriodValue;
  studentNote?: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { teacher: true },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const resolvedRole = resolveRole(session.user.email);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc89fe79-f21f-41c4-9836-b19789698f76',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/user/appointments/route.ts:GET',message:'Appointments GET role',data:{resolvedRole},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion

  if (resolvedRole === "TEACHER") {
    let teacherId = user.teacher?.id;
    if (!teacherId) {
      const teacher = await prisma.teacher.create({ data: { userId: user.id } });
      teacherId = teacher.id;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        teacherId,
        OR: [
          { status: { not: "CANCELLED" } },
          { status: "CANCELLED", studentCancelled: true },
        ],
      },
      include: { student: true },
      orderBy: [{ day: "asc" }, { period: "asc" }],
    });

    return Response.json(
      appointments.map((appointment) => ({
        id: appointment.id,
        day: appointment.day,
        period: appointment.period,
        status: appointment.status,
        room: appointment.room,
        studentNote: appointment.studentNote,
        teacherNote: appointment.teacherNote,
        studentName: appointment.student.fullName,
        studentEmail: appointment.student.email,
      }))
    );
  }

  if (resolvedRole === "ADMIN") {
    return Response.json([]);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      studentId: user.id,
      OR: [
        { status: { not: "CANCELLED" } },
        { status: "CANCELLED", studentCancelled: false },
      ],
    },
    include: { teacher: { include: { user: true } } },
    orderBy: [{ day: "asc" }, { period: "asc" }],
  });

  return Response.json(
    appointments.map((appointment) => ({
      id: appointment.id,
      day: appointment.day,
      period: appointment.period,
      status: appointment.status,
      room: appointment.room,
      studentNote: appointment.studentNote,
      teacherNote: appointment.teacherNote,
      studentAcknowledgedAt: appointment.studentAcknowledgedAt,
      teacherName: appointment.teacher.user.fullName,
      teacherEmail: appointment.teacher.user.email,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AppointmentPayload | null;
  const teacherId = payload?.teacherId;
  const day = payload?.day;
  const period = payload?.period;
  const studentNote = typeof payload?.studentNote === "string" ? payload.studentNote.trim() : "";

  if (!teacherId || typeof day !== "number") {
    return new Response("Invalid payload", { status: 400 });
  }

  if (!period || !PERIODS.includes(period)) {
    return new Response("Invalid period", { status: 400 });
  }

  if (day < 1 || day > 10) {
    return new Response("Invalid day", { status: 400 });
  }

  if (!studentNote) {
    return new Response("Reason for meeting is required", { status: 400 });
  }

  const student = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!student) {
    return new Response("Not found", { status: 404 });
  }

  const resolvedRole = resolveRole(session.user.email);
  if (resolvedRole !== "STUDENT") {
    return new Response("Only students can book meetings", { status: 403 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: true },
  });

  if (!teacher) {
    return new Response("Teacher not found", { status: 404 });
  }

  const teacherAppointments = await prisma.appointment.findMany({
    where: { teacherId, day, status: { not: "CANCELLED" } },
  });

  if (teacherAppointments.some((appointment) => appointment.period === period)) {
    return new Response("Teacher already has an appointment at this time", { status: 409 });
  }

  const studentAppointments = await prisma.appointment.findMany({
    where: { studentId: student.id, day, status: { not: "CANCELLED" } },
  });

  if (studentAppointments.some((appointment) => appointment.period === period)) {
    return new Response("You already have an appointment at this time", { status: 409 });
  }

  const created = await prisma.appointment.create({
    data: {
      day,
      period,
      teacherId,
      studentId: student.id,
      status: "PENDING",
      studentNote,
    },
  });

  try {
    await sendMeetingEmails({
      studentName: student.fullName,
      studentEmail: student.email,
      teacherName: teacher.user.fullName,
      teacherEmail: teacher.user.email,
      day,
      period,
    });
  } catch (error) {
    console.error("Failed to send meeting emails:", error);
  }

  return Response.json(created);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  const action = body?.action as string | undefined;
  const teacherNote = typeof body?.note === "string" ? body.note.trim() : "";
  const room = typeof body?.room === "string" ? body.room.trim() : "";

  if (!id || !action) {
    return new Response("Missing id or action", { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { teacher: true },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  });

  if (!appointment) {
    return new Response("Not found", { status: 404 });
  }

  const resolvedRole = resolveRole(session.user.email);
  const resolveTeacherId = async () => {
    let teacherId = user.teacher?.id;
    if (!teacherId) {
      const teacher = await prisma.teacher.create({ data: { userId: user.id } });
      teacherId = teacher.id;
    }
    return teacherId;
  };

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc89fe79-f21f-41c4-9836-b19789698f76',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/user/appointments/route.ts:PATCH',message:'Appointment PATCH request',data:{action,resolvedRole,appointmentStatus:appointment.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion

  if (action === "confirm") {
    if (resolvedRole !== "TEACHER") {
      return new Response("Forbidden", { status: 403 });
    }
    const teacherId = await resolveTeacherId();
    if (appointment.teacherId !== teacherId) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!room) {
      return new Response("Room is required to accept a meeting", { status: 400 });
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CONFIRMED", room, teacherNote: teacherNote || null },
    });
    return Response.json(updated);
  }

  if (action === "decline") {
    if (resolvedRole !== "TEACHER") {
      return new Response("Forbidden", { status: 403 });
    }
    const teacherId = await resolveTeacherId();
    if (appointment.teacherId !== teacherId) {
      return new Response("Forbidden", { status: 403 });
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        teacherNote: teacherNote || null,
        room: null,
        studentCancelled: false,
      },
    });
    return Response.json(updated);
  }

  if (action === "cancel") {
    if (resolvedRole === "STUDENT") {
      if (appointment.studentId !== user.id) {
        return new Response("Forbidden", { status: 403 });
      }
    } else if (resolvedRole === "TEACHER") {
      const teacherId = await resolveTeacherId();
      if (appointment.teacherId !== teacherId) {
        return new Response("Forbidden", { status: 403 });
      }
    } else {
      return new Response("Forbidden", { status: 403 });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        room: null,
        studentCancelled: resolvedRole === "STUDENT",
      },
    });

    return Response.json(updated);
  }

  if (action === "acknowledge") {
    if (appointment.status !== "CANCELLED") {
      return new Response("Only cancelled meetings can be acknowledged", { status: 400 });
    }

    if (resolvedRole === "STUDENT") {
      if (appointment.studentId !== user.id || appointment.studentCancelled) {
        return new Response("Forbidden", { status: 403 });
      }
      const deleted = await prisma.appointment.delete({ where: { id } });
      return Response.json(deleted);
    }

    if (resolvedRole === "TEACHER") {
      const teacherId = await resolveTeacherId();
      if (appointment.teacherId !== teacherId || !appointment.studentCancelled) {
        return new Response("Forbidden", { status: 403 });
      }
      const deleted = await prisma.appointment.delete({ where: { id } });
      return Response.json(deleted);
    }

    return new Response("Forbidden", { status: 403 });
  }

  return new Response("Invalid action", { status: 400 });
}
