import { prisma } from "@/src/server/db";
import { DEV_USERS, type DevUser } from "@/src/config/devUsers";
import { DAYS } from "@/src/config/schedule";
import type { Period } from "@prisma/client";

type ScheduleEntry = { day: number; period: Period };

function withBreakDefaults(entries: ScheduleEntry[]): ScheduleEntry[] {
  const result = [...entries];
  // Add BREAK as free for all days if not already present
  for (const day of DAYS) {
    if (!result.some((e) => e.day === day && e.period === "BREAK")) {
      result.push({ day, period: "BREAK" });
    }
  }
  return Array.from(
    new Map(result.map((entry) => [`${entry.day}-${entry.period}`, entry])).values()
  );
}

async function seedTeacher(user: DevUser, userId: string) {
  const teacher = await prisma.teacher.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const schedule = withBreakDefaults(user.schedule ?? []);

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
  const schedule = withBreakDefaults(user.schedule ?? []);

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
      const existing = await prisma.user.findUnique({
        where: { email: devUser.email },
      });

      const user = await prisma.user.upsert({
        where: { email: devUser.email },
        create: {
          email: devUser.email,
          fullName: devUser.fullName,
          role: devUser.role,
        },
        update: {
          role: devUser.role,
        },
      });

      // Only seed schedules for newly created users — don't overwrite manual changes
      if (!existing) {
        if (devUser.role === "TEACHER") {
          await seedTeacher(devUser, user.id);
        } else {
          await seedStudent(devUser, user.id);
        }
      } else if (devUser.role === "TEACHER") {
        // Ensure teacher record exists even for existing users
        await prisma.teacher.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {},
        });
      }
    }
  } catch (error) {
    // Ignore unique constraint errors from concurrent page loads
    console.warn("Dev seed warning (likely concurrent call):", (error as Error).message?.slice(0, 80));
  } finally {
    seeding = false;
  }
}
