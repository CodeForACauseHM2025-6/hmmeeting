import { NextResponse } from "next/server";
import { prisma } from "@/src/server/db";
import { sendMeetingEmails } from "@/src/server/email";

export async function POST(request: Request) {
  try {
    const { appointmentId } = await request.json();

    if (!appointmentId) {
      return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        teacher: { include: { user: true } },
        student: true,
      },
    });

    if (!appointment) {
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
    console.error("Error sending emails:", error);
    return NextResponse.json({ error: "Failed to send emails" }, { status: 500 });
  }
}