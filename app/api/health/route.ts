// Lightweight health-check endpoint for uptime monitors and load balancers.
//
// Deliberately auth-free so external pingers (UptimeRobot, BetterUptime,
// Cloudflare Health Checks, Linode monitoring) can hit it without
// credentials. Returns 200 when the app + DB are reachable, 503 otherwise.
//
// Does NOT leak version numbers, env, or any internal state — just a
// machine-readable status.

import { prisma } from "@/src/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Cheap "is the DB connection alive?" check. AppSettings always has the
  // 'global' row after first boot; finding it confirms the Prisma client
  // is actually serving queries.
  try {
    await prisma.appSettings.findUnique({ where: { id: "global" } });
  } catch {
    return new Response(JSON.stringify({ status: "degraded" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
