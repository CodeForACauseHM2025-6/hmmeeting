import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

// X-Forwarded-For is only trusted when TRUST_PROXY=true (set this when
// running behind a controlled reverse proxy like nginx that overwrites the
// header). Otherwise we use the raw connection IP from `request.ip`-equivalent
// fields, which arbitrary clients cannot spoof.
function clientKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      // First entry is the original client; trust because we control the proxy.
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = request.headers.get("x-real-ip");
    if (real) return real;
  }
  // Fallback: any header here is attacker-controlled, so use a fixed key.
  // This makes the per-IP limit effectively a global limit, which is a
  // reasonable default until TRUST_PROXY is configured.
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

export function middleware(request: NextRequest) {
  const ip = clientKey(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    // Global per-IP limit
    if (bumpAndCheck(`g:${ip}`, RATE_LIMIT_MAX)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
    // Stricter limits on sensitive endpoints (per-IP only — session lookup
    // is too expensive to do in middleware on every request).
    for (const { prefix, max } of SENSITIVE_LIMITS) {
      if (path.startsWith(prefix)) {
        if (bumpAndCheck(`s:${prefix}:${ip}`, max)) {
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
