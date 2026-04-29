import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logSecurityEvent as logSec } from "@/src/server/security-log";

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const isProd = process.env.NODE_ENV === "production";

// Per-IP global cap on /api/* (catch-all).
const RATE_LIMIT_MAX = isProd ? 120 : 500;

// Stricter caps on sensitive endpoints (state-changing or expensive).
// Matched by URL prefix; first match wins.
const SENSITIVE_LIMITS: { prefix: string; max: number }[] = [
  { prefix: "/api/auth/", max: isProd ? 20 : 200 },
  { prefix: "/api/send-meeting-email", max: isProd ? 10 : 100 },
  { prefix: "/api/email-action", max: isProd ? 30 : 200 },
  { prefix: "/api/user/appointments", max: isProd ? 30 : 200 },
];

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function bumpAndCheck(key: string, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

// Resolve the rate-limit key from headers when behind a trusted proxy.
//
// Trust order (only applied when TRUST_PROXY=true):
//   1. CF-Connecting-IP — Cloudflare always sets this to the real client
//      and strips/replaces any inbound copy. Most reliable when behind CF.
//   2. X-Real-IP — nginx sets this via `proxy_set_header X-Real-IP
//      $remote_addr;`, which replaces inbound headers. Reliable when
//      nginx is the immediate hop.
//   3. Last entry of X-Forwarded-For — the one the trusted proxy
//      appended. (First entry is attacker-controllable since nginx
//      APPENDS rather than replaces XFF.)
//
// Without TRUST_PROXY, no header is trustworthy, so use a fixed key (per-IP
// limit collapses to a global limit, which is the safe default until a
// reverse proxy is configured correctly).
function clientKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    const cf = request.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last;
    }
  }
  return "unknown";
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(k);
    }
  }
}, 5 * 60 * 1000);

// 64 KiB ceiling on any API body. Real payloads are tiny (a 1000-char note
// plus some metadata is well under 2 KB) — anything bigger is either a bug
// or an abuse attempt.
const MAX_BODY_BYTES = 64 * 1024;

export function middleware(request: NextRequest) {
  const ip = clientKey(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    // Reject oversized bodies up front so a route handler never sees them.
    const len = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      logSec({ event: "payload.too-large", severity: "warn", ip, detail: `${path} cl=${len}` });
      return new NextResponse("Payload too large", { status: 413 });
    }

    // Global per-IP limit
    if (bumpAndCheck(`g:${ip}`, RATE_LIMIT_MAX)) {
      logSec({ event: "ratelimit.global", severity: "warn", ip, detail: path });
      return new NextResponse("Too Many Requests", { status: 429 });
    }
    // Stricter limits on sensitive endpoints (per-IP only — session lookup
    // is too expensive to do in middleware on every request).
    for (const { prefix, max } of SENSITIVE_LIMITS) {
      if (path.startsWith(prefix)) {
        if (bumpAndCheck(`s:${prefix}:${ip}`, max)) {
          logSec({ event: "ratelimit.sensitive", severity: "warn", ip, detail: prefix });
          return new NextResponse("Too Many Requests", { status: 429 });
        }
        break;
      }
    }
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  // X-XSS-Protection is deprecated; modern guidance is "0" (disabled) since
  // the legacy auditor in old browsers can introduce universal-XSS.
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  // Baseline CSP — start in report-only so we can verify nothing breaks
  // before flipping to enforcing. Inline styles are used pervasively
  // (style={{...}}), so style-src needs 'unsafe-inline'. No inline scripts.
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
