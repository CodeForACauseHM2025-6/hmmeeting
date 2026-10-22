import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logSecurityEvent as logSec } from "@/src/server/security-log";

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const isProd = process.env.NODE_ENV === "production";

// Two layers of limits:
//   - per session (signed-in users): the real per-person cap.
//   - per IP: a much looser backstop. The whole school shares a handful of
//     NAT'd public IPs, so per-IP caps sized for one person would lock out
//     everyone on campus Wi-Fi. The backstop still bounds anonymous abuse and
//     anyone rotating junk session cookies to dodge the per-session cap.
const GLOBAL_LIMIT = { perSession: isProd ? 240 : 1000, perIp: isProd ? 3000 : 5000 };

// Stricter caps on sensitive endpoints. Matched by URL prefix; first match
// wins. `null` means "no extra limit beyond the global one".
const SENSITIVE_LIMITS: { prefix: string; perSession: number | null; perIp: number }[] = [
  // Session polling (SessionProvider refetches on focus) is cheap and frequent.
  { prefix: "/api/auth/session", perSession: null, perIp: isProd ? 3000 : 5000 },
  { prefix: "/api/auth/", perSession: null, perIp: isProd ? 300 : 1000 },
  { prefix: "/api/send-meeting-email", perSession: isProd ? 10 : 100, perIp: isProd ? 100 : 500 },
  // Email links are clicked without a session; per-IP only.
  { prefix: "/api/email-action", perSession: null, perIp: isProd ? 120 : 500 },
  { prefix: "/api/user/appointments", perSession: isProd ? 30 : 200, perIp: isProd ? 600 : 2000 },
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

// Resolve the client IP from headers when behind a trusted proxy.
//
// Trust order (only applied when TRUST_PROXY=true):
//   1. X-Real-IP — nginx sets this via `proxy_set_header X-Real-IP
//      $remote_addr;`, which overwrites any inbound copy. Behind Cloudflare,
//      nginx's realip module (real_ip_header CF-Connecting-IP, restricted to
//      Cloudflare ranges) has already turned $remote_addr into the client IP.
//   2. Last entry of X-Forwarded-For — the one the trusted proxy appended.
//      (Earlier entries are attacker-controllable.)
//
// CF-Connecting-IP is deliberately NOT read here: if the origin is ever
// reachable without Cloudflare in front, a client can send any value and get
// a fresh rate-limit bucket per request.
//
// Without TRUST_PROXY, no header is trustworthy, so use a fixed key (per-IP
// limit collapses to a global limit, which is the safe default until a
// reverse proxy is configured correctly).
function clientKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
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

// Per-session key from the Auth.js session cookie (possibly chunked as
// `.0`, `.1`, ...). We don't verify it here — that's too expensive for every
// request — so a forged cookie just gets its own bucket and falls back on the
// per-IP backstop.
function sessionKey(request: NextRequest): string | null {
  for (const name of [
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-authjs.session-token.0",
    "authjs.session-token.0",
  ]) {
    const value = request.cookies.get(name)?.value;
    // The tail of the JWE (auth tag) is unique per token and keeps keys short.
    if (value) return value.slice(-32);
  }
  return null;
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

    const sess = sessionKey(request);
    const rule = SENSITIVE_LIMITS.find(({ prefix }) => path.startsWith(prefix));
    const checks: { key: string; max: number; event: string }[] = [
      { key: `g:ip:${ip}`, max: GLOBAL_LIMIT.perIp, event: "ratelimit.global" },
    ];
    if (sess) {
      checks.push({ key: `g:s:${sess}`, max: GLOBAL_LIMIT.perSession, event: "ratelimit.global" });
    }
    if (rule) {
      checks.push({ key: `s:${rule.prefix}:ip:${ip}`, max: rule.perIp, event: "ratelimit.sensitive" });
      if (sess && rule.perSession !== null) {
        checks.push({ key: `s:${rule.prefix}:s:${sess}`, max: rule.perSession, event: "ratelimit.sensitive" });
      }
    }
    for (const { key, max, event } of checks) {
      if (bumpAndCheck(key, max)) {
        logSec({ event, severity: "warn", ip, detail: rule?.prefix ?? path });
        return new NextResponse("Too Many Requests", { status: 429 });
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
