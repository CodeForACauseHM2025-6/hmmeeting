import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { sendMeetingEmails } from "@/src/server/email";
import { resolveRole } from "@/src/config/roles";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { appointmentId } = await request.json();

    if (!appointmentId || typeof appointmentId !== "string") {
      return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });
    }

    const requester = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { teacher: true },
    });

    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        teacher: { include: { user: true } },
        student: true,
      },
    });

    // Use the same response for "not found" and "not yours" so callers can't
    // probe for valid appointment IDs they don't own.
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const role = await resolveRole(session.user.email);
    const isAdmin = role === "ADMIN";
    const isStudent = appointment.studentId === requester.id;
    const isTeacher = !!requester.teacher && appointment.teacherId === requester.teacher.id;

    if (!isAdmin && !isStudent && !isTeacher) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const result = await sendMeetingEmails({
      studentName: appointment.student.fullName,
      studentEmail: appointment.student.email,
      teacherName: appointment.teacher.user.fullName,
      teacherEmail: appointment.teacher.user.email,
      day: appointment.day,
      period: appointment.period,
      emailToken: appointment.emailToken ?? undefined,
      studentNote: appointment.studentNote ?? undefined,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("send-meeting-email failed", { code: (error as Error)?.name });
    return NextResponse.json({ error: "Failed to send emails" }, { status: 500 });
  }
}