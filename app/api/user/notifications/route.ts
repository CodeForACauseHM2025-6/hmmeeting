import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { resolveRole } from "@/src/config/roles";
import {
  buildDayDateMap,
  formatMeetingDateTime,
  type PeriodValue,
} from "@/src/config/schedule";

type NotificationItem = {
  id: string;
  message: string;
  status: string;
  day: number;
  period: string;
  updatedAt: string;
  meetingDate?: string | null;
  meetingTime?: string | null;
};

const SETTINGS_ID = "global";

async function getScheduleSnapshot() {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return {
    currentWeek: settings.currentWeek === "WEEK1" ? 1 : 2,
    weekSetAt: settings.weekSetAt,
  };
}

function getMeetingInfoForAppointment(
  appointment: { day: number; period: PeriodValue; createdAt: Date },
  scheduleSettings: { currentWeek: 1 | 2; weekSetAt: Date }
) {
  const { dayDates } = buildDayDateMap(scheduleSettings, appointment.createdAt, {
    preferFuture: true,
  });
  const dayDate = dayDates[appointment.day];
  if (!dayDate) return null;
  return formatMeetingDateTime(dayDate, appointment.period, appointment.day);
}

async function autoCompleteAppointments(
  appointments: { id: string; status: string; day: number; period: PeriodValue; createdAt: Date }[],
  scheduleSettings: { currentWeek: 1 | 2; weekSetAt: Date }
) {
  const now = new Date();
  const toComplete = appointments
    .filter((appointment) => appointment.status === "CONFIRMED")
    .filter((appointment) => {
      const meetingInfo = getMeetingInfoForAppointment(appointment, scheduleSettings);
      if (!meetingInfo) return false;
      const { end } = meetingInfo;
      return end.getTime() <= now.getTime();
    })
    .map((appointment) => appointment.id);

  if (toComplete.length === 0) {
    return false;
  }

  await prisma.appointment.updateMany({
    where: { id: { in: toComplete } },
    data: { status: "COMPLETED", completedBy: null },
  });

  return true;
}

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
  const scheduleSettings = await getScheduleSnapshot();

  if (role === "ADMIN") {
    return Response.json([]);
  }

  if (role === "TEACHER") {
    let teacherId = user.teacher?.id;
    if (!teacherId) {
      const teacher = await prisma.teacher.create({ data: { userId: user.id } });
      teacherId = teacher.id;
    }

    let appointments = await prisma.appointment.findMany({
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

    const didAutoComplete = await autoCompleteAppointments(
      appointments.map((appointment) => ({
        id: appointment.id,
        status: appointment.status,
        day: appointment.day,
        period: appointment.period,
        createdAt: appointment.createdAt,
      })),
      scheduleSettings
    );

    if (didAutoComplete) {
      appointments = await prisma.appointment.findMany({
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
    }

    const notifications: NotificationItem[] = appointments.map((appointment) => {
      const meetingInfo = getMeetingInfoForAppointment(
        {
          day: appointment.day,
          period: appointment.period,
          createdAt: appointment.createdAt,
        },
        scheduleSettings
      );
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
        meetingDate: meetingInfo?.dateLabel ?? null,
        meetingTime: meetingInfo?.timeLabel ?? null,
      };
    });

    return Response.json(notifications);
  }

  let appointments = await prisma.appointment.findMany({
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

  const didAutoComplete = await autoCompleteAppointments(
    appointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      day: appointment.day,
      period: appointment.period,
      createdAt: appointment.createdAt,
    })),
    scheduleSettings
  );

  if (didAutoComplete) {
    appointments = await prisma.appointment.findMany({
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
  }

  const notifications: NotificationItem[] = appointments.map((appointment) => {
    const meetingInfo = getMeetingInfoForAppointment(
      {
        day: appointment.day,
        period: appointment.period,
        createdAt: appointment.createdAt,
      },
      scheduleSettings
    );
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
      meetingDate: meetingInfo?.dateLabel ?? null,
      meetingTime: meetingInfo?.timeLabel ?? null,
    };
  });

  return Response.json(notifications);
}
