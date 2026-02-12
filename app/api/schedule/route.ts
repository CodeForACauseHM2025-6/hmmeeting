import { auth } from "@/auth";
import { prisma } from "@/src/server/db";

const SETTINGS_ID = "global";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });

  return Response.json({
    currentWeek: settings.currentWeek === "WEEK1" ? 1 : 2,
    weekSetAt: settings.weekSetAt.toISOString(),
  });
}
