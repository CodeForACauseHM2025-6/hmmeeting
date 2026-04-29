// Structured security-event logger. Writes single-line JSON to stdout so
// PM2 (and any log aggregator like Loki/Grafana Cloud / Datadog) can grep
// and chart it. Keep it lightweight — this code path runs on every
// authentication attempt and authorization decision.
//
// Field conventions (so log queries are stable):
//   - event:   short kebab-case identifier (auth.signin.deny, authz.deny,
//              ratelimit.hit, audit.write, payload.suspect)
//   - severity: "info" | "warn" | "error"
//   - actor:   email if known, "anon" if not
//   - ip:      client ip if known
//   - detail:  free-form short string (capped to 200 chars)
//
// Never log studentNote / teacherNote / fullName / appointment IDs that
// belong to other users — use only metadata that's safe in plaintext.

type Severity = "info" | "warn" | "error";

type SecurityEvent = {
  event: string;
  severity?: Severity;
  actor?: string | null;
  ip?: string | null;
  detail?: string | null;
};

export function logSecurityEvent(e: SecurityEvent): void {
  const line = {
    ts: new Date().toISOString(),
    kind: "sec",
    severity: e.severity ?? "info",
    event: e.event,
    actor: e.actor ?? "anon",
    ip: e.ip ?? null,
    detail: e.detail ? String(e.detail).slice(0, 200) : null,
  };
  // One line, JSON, to stdout (PM2 captures it).
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
