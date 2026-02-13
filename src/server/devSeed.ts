import { prisma } from "@/src/server/db";
import { DEV_USERS, type DevUser } from "@/src/config/devUsers";

type ScheduleEntry = { day: number; period: string };

function uniqueSchedule(entries: ScheduleEntry[]) {
  return Array.from(
    new Map(entries.map((entry) => [`${entry.day}-${entry.period}`, entry])).values()
  );
}

async function seedTeacher(user: DevUser, userId: string) {
  const teacher = await prisma.teacher.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const schedule = uniqueSchedule(user.schedule ?? []);

  await prisma.availability.deleteMany({
    where: { teacherId: teacher.id },
  });

  if (schedule.length > 0) {
    await prisma.availability.createMany({
      data: schedule.map((entry) => ({
        teacherId: teacher.id,
        day: entry.day,
        period: entry.period,
      })),
    });
  }
}

async function seedStudent(user: DevUser, userId: string) {
  const schedule = uniqueSchedule(user.schedule ?? []);

  await prisma.studentAvailability.deleteMany({
    where: { userId },
  });

  if (schedule.length > 0) {
    await prisma.studentAvailability.createMany({
      data: schedule.map((entry) => ({
        userId,
        day: entry.day,
        period: entry.period,
      })),
    });
  }
}

let seeding = false;

export async function ensureDevUsers() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  // Prevent concurrent seeding which causes unique constraint errors
  if (seeding) return;
  seeding = true;

  try {
    for (const devUser of DEV_USERS) {
      const user = await prisma.user.upsert({
        where: { email: devUser.email },
        create: {
          email: devUser.email,
          fullName: devUser.fullName,
          role: devUser.role,
        },
        update: {
          fullName: devUser.fullName,
          role: devUser.role,
        },
      });

      if (devUser.role === "TEACHER") {
        await seedTeacher(devUser, user.id);
      } else {
        await seedStudent(devUser, user.id);
      }
    }
  } catch (error) {
    // Ignore unique constraint errors from concurrent page loads
    console.warn("Dev seed warning (likely concurrent call):", (error as Error).message?.slice(0, 80));
  } finally {
    seeding = false;
  }
}
