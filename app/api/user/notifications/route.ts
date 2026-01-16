import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { resolveRole } from "@/src/config/roles";

type NotificationItem = {
  id: string;
  message: string;
  status: string;
  day: number;
  period: string;
  updatedAt: string;
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

  const role = resolveRole(session.user.email);

  if (role === "ADMIN") {
    return Response.json([]);
  }

  if (role === "TEACHER") {
    let teacherId = user.teacher?.id;
    if (!teacherId) {
      const teacher = await prisma.teacher.create({ data: { userId: user.id } });
      teacherId = teacher.id;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        teacherId,
        OR: [
          { status: { in: ["PENDING", "CONFIRMED", "DECLINED", "COMPLETED"] } },
          { status: "CANCELLED", studentCancelled: true },
        ],
      },
      include: { student: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const notifications: NotificationItem[] = appointments.map((appointment) => {
      let message = `Meeting update with ${appointment.student.fullName}`;
      if (appointment.status === "PENDING") {
        message = `New meeting request from ${appointment.student.fullName}`;
      } else if (appointment.status === "CONFIRMED") {
        message = `Meeting confirmed with ${appointment.student.fullName}`;
      } else if (appointment.status === "DECLINED") {
        message = `Meeting declined with ${appointment.student.fullName}`;
      } else if (appointment.status === "COMPLETED") {
        message = `Meeting completed with ${appointment.student.fullName}`;
      } else if (appointment.status === "CANCELLED") {
        message = `Meeting cancelled with ${appointment.student.fullName}`;
      }

      return {
        id: appointment.id,
        message,
        status: appointment.status,
        day: appointment.day,
        period: appointment.period,
        updatedAt: appointment.updatedAt.toISOString(),
      };
    });

    return Response.json(notifications);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      studentId: user.id,
      OR: [
        { status: { in: ["CONFIRMED", "DECLINED", "COMPLETED"] } },
        { status: "CANCELLED", studentCancelled: false },
      ],
    },
    include: { teacher: { include: { user: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const notifications: NotificationItem[] = appointments.map((appointment) => {
    let message = `Meeting update with ${appointment.teacher.user.fullName}`;
    if (appointment.status === "CONFIRMED") {
      message = `Meeting confirmed with ${appointment.teacher.user.fullName}`;
    } else if (appointment.status === "DECLINED") {
      message = `Meeting declined by ${appointment.teacher.user.fullName}`;
    } else if (appointment.status === "COMPLETED") {
      message = `Meeting completed with ${appointment.teacher.user.fullName}`;
    } else if (appointment.status === "CANCELLED") {
      message = `Meeting cancelled with ${appointment.teacher.user.fullName}`;
    }

    return {
      id: appointment.id,
      message,
      status: appointment.status,
      day: appointment.day,
      period: appointment.period,
      updatedAt: appointment.updatedAt.toISOString(),
    };
  });

  return Response.json(notifications);
}
