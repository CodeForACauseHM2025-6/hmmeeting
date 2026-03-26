// src/app/api/user/information/route.ts
// API endpoint to get the user's information. 

import { auth } from "@/auth";
import { prisma } from "@/src/server/db";
import { resolveRole, type RoleValue } from "@/src/config/roles";
import { DAYS, PERIODS, type PeriodValue } from "@/src/config/schedule";

function nameFromEmail(email: string): string {
    const local = email.split("@")[0] ?? "";
    return local
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

type FreePeriodInput = {
    day: number;
    period: PeriodValue;
    type?: string;
};

export async function GET(request: Request) {
    const session = await auth(); // Gets the user's session 

    if (!session?.user?.email) {
        return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const includeSchedule = url.searchParams.get("includeSchedule") === "true";

    const resolvedRole = resolveRole(session.user.email);

    let user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: includeSchedule
            ? { studentAvailability: true, teacher: { include: { availability: true } } }
            : undefined,
    });

    if (!user) {
        return new Response("Not found", { status: 404 });
    }

    if (user.role !== resolvedRole) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { role: resolvedRole },
            include: includeSchedule
                ? { studentAvailability: true, teacher: { include: { availability: true } } }
                : undefined,
        });
    }

    if (resolvedRole === "TEACHER") {
        await prisma.teacher.upsert({
            where: { userId: user.id },
            create: { userId: user.id },
            update: {},
        });
    }

    return Response.json(user);
}

export async function POST(request: Request) {
    const session = await auth();

    if (!session?.user?.email) {
        return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const fullName = (body?.fullName?.trim()) || nameFromEmail(session.user.email);
    const freePeriods = Array.isArray(body?.freePeriods) ? (body?.freePeriods as FreePeriodInput[]) : [];
    const room = typeof body?.room === "string" ? body.room.trim() : undefined;
    const resolvedRole: RoleValue = resolveRole(session.user.email);

    const role: RoleValue = resolvedRole;

    const user = await prisma.user.upsert({
        where: { email: session.user.email },
        create: {
            email: session.user.email,
            fullName,
            role,
        },
        update: {
            fullName,
            role,
        },
    });

    let teacherId: string | null = null;

    if (role === "TEACHER") {
        const teacherUpdate: { room?: string } = {};
        if (room !== undefined) {
            teacherUpdate.room = room || null;
        }
        const teacher = await prisma.teacher.upsert({
            where: { userId: user.id },
            create: { userId: user.id, ...(room !== undefined ? { room: room || null } : {}) },
            update: teacherUpdate,
        });
        teacherId = teacher.id;
    }

    if (role === "STUDENT" || role === "ADMIN") {
        const validFreePeriods = freePeriods.filter(
            (period) =>
                typeof period.day === "number" &&
                period.day >= 1 &&
                period.day <= 10 &&
                PERIODS.includes(period.period)
        );

        const uniqueFreePeriods = Array.from(
            new Map(
                validFreePeriods.map((period) => [`${period.day}-${period.period}`, period])
            ).values()
        );

        await prisma.studentAvailability.deleteMany({
            where: { userId: user.id },
        });

        if (uniqueFreePeriods.length > 0) {
            await prisma.studentAvailability.createMany({
                data: uniqueFreePeriods.map((period) => ({
                    userId: user.id,
                    day: period.day,
                    period: period.period,
                })),
            });
        }
    }

    if (role === "TEACHER" && teacherId) {
        const validAvailability = freePeriods.filter(
            (period) =>
                typeof period.day === "number" &&
                period.day >= 1 &&
                period.day <= 10 &&
                PERIODS.includes(period.period)
        );

        const uniqueAvailability = Array.from(
            new Map(
                validAvailability.map((period) => [`${period.day}-${period.period}`, period])
            ).values()
        );

        await prisma.availability.deleteMany({
            where: { teacherId },
        });

        if (uniqueAvailability.length > 0) {
            await prisma.availability.createMany({
                data: uniqueAvailability.map((period) => ({
                    teacherId,
                    day: period.day,
                    period: period.period,
                    type: period.type === "OFFICE_HOURS" ? "OFFICE_HOURS" : "FREE",
                })),
            });
        }
    }

    return Response.json(user);
}