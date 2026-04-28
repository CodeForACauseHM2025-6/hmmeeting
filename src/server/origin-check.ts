// Defense-in-depth Origin/Referer check for Server Actions.
//
// Next.js's built-in Server Actions CSRF protection has had bypasses (e.g.
// GHSA-mq59-m269-xvcx — null-origin bypass). This helper enforces that the
// inbound request originates from our own host as a second layer.
//
// Call from inside a "use server" action by passing the request headers().

import { headers } from "next/headers";

export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const referer = h.get("referer");
  const host = h.get("host");

  if (!host) {
    throw new Error("Forbidden: missing host header");
  }

  // Compute the set of acceptable origins from APP_URL plus the request host.
  const appUrl = process.env.APP_URL;
  const expected = new Set<string>();
  if (appUrl) {
    try {
      expected.add(new URL(appUrl).origin);
    } catch {
      // ignore malformed APP_URL
    }
  }
  // Also accept the host the request came in on (covers nginx forwarding
  // to localhost:3000 in dev). Trust this only if it matches APP_URL or
  // we're not in production.
  const inferredHttp = `http://${host}`;
  const inferredHttps = `https://${host}`;
  if (process.env.NODE_ENV !== "production") {
    expected.add(inferredHttp);
    expected.add(inferredHttps);
  } else if (expected.size === 0) {
    // Production must have APP_URL set (see boot guard); if it's missing
    // we still need *some* expectation, but fail safely.
    expected.add(inferredHttps);
  }

  const candidate = origin ?? (referer ? new URL(referer).origin : null);
  if (!candidate || !expected.has(candidate)) {
    throw new Error("Forbidden: cross-origin request blocked");
  }
}
