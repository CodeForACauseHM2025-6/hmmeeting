"use client";

import * as React from "react";

type PeriodKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

type TimeSlot = {
  id: string;
  startMin: number; // minutes since midnight
  endMin: number;
  label: string; // e.g. "9:15 AM - 9:35 AM"
};

type PeriodAvailability = {
  period: PeriodKey;
  slots: TimeSlot[];
};

const COLORS = {
  maroon: "#5b0d1f",
  lightGray: "#e9e9e9",
  midGray: "#d9d9d9",
  text: "#1b1b1b",
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// ---------- Time helpers ----------
function toMinutes(h24: number, m: number) {
  return h24 * 60 + m;
}

function addMinutes(mins: number, delta: number) {
  return mins + delta;
}

function formatTime(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;

  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12raw = h24 % 12;
  const h12 = h12raw === 0 ? 12 : h12raw;

  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

function formatRange(startMin: number, endMin: number) {
  return `${formatTime(startMin)} - ${formatTime(endMin)}`;
}

// ---------- Your schedule (A–H). Break is omitted here because it's not a "period" for selection ----------
const PERIOD_RANGES: Record<PeriodKey, { start: number; end: number }> = {
  A: { start: toMinutes(8, 25), end: toMinutes(9, 10) },
  B: { start: toMinutes(9, 15), end: toMinutes(10, 0) },
  C: { start: toMinutes(10, 20), end: toMinutes(11, 5) },
  D: { start: toMinutes(11, 10), end: toMinutes(11, 55) },
  E: { start: toMinutes(12, 0), end: toMinutes(12, 45) },
  F: { start: toMinutes(12, 50), end: toMinutes(13, 35) },
  G: { start: toMinutes(13, 40), end: toMinutes(14, 25) },
  H: { start: toMinutes(14, 30), end: toMinutes(15, 15) },
};

function buildHalfSlots(period: PeriodKey): TimeSlot[] {
  const { start, end } = PERIOD_RANGES[period];

  // first = 20 min, second = 25 min
  const mid = addMinutes(start, 20);

  // Safety: if anything ever changes and mid exceeds end, clamp.
  const midClamped = Math.min(mid, end);

  const s1: TimeSlot = {
    id: `${period}-1`,
    startMin: start,
    endMin: midClamped,
    label: formatRange(start, midClamped),
  };

  const s2: TimeSlot = {
    id: `${period}-2`,
    startMin: midClamped,
    endMin: end,
    label: formatRange(midClamped, end),
  };

  return [s1, s2];
}

// --- Mock page context (swap with real data later) ---
const MOCK = {
  lastName: "Porres",
  dayLabel: "Day X",
  teacherDisplay: "Mr./Ms. XXX",
  periods: (Object.keys(PERIOD_RANGES) as PeriodKey[]).map(
    (p) =>
      ({
        period: p,
        slots: buildHalfSlots(p),
      }) satisfies PeriodAvailability
  ),
};

// ---------- Simple modal ----------
function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close modal" />
      <div className="relative w-full max-w-xl">{children}</div>
    </div>
  );
}

export default function DavidsTaskPage() {
  const periodKeys = React.useMemo(() => Object.keys(PERIOD_RANGES) as PeriodKey[], []);
  const [selectedPeriod, setSelectedPeriod] = React.useState<PeriodKey>(periodKeys[0] ?? "A");
  const [selectedSlot, setSelectedSlot] = React.useState<TimeSlot | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const periodData = React.useMemo(() => {
    return (
      MOCK.periods.find((p) => p.period === selectedPeriod) ??
      ({ period: selectedPeriod, slots: buildHalfSlots(selectedPeriod) } satisfies PeriodAvailability)
    );
  }, [selectedPeriod]);

  const periodRangeLabel = React.useMemo(() => {
    const r = PERIOD_RANGES[selectedPeriod];
    return formatRange(r.start, r.end);
  }, [selectedPeriod]);

  const headerTitle = `${MOCK.lastName} Available Times - ${MOCK.dayLabel}`;

  return (
    <div className="min-h-screen w-full bg-white p-6" style={{ color: COLORS.text }}>
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            className={classNames("text-sm font-medium", "rounded-md px-2 py-1", "border")}
            style={{ borderColor: COLORS.midGray, color: COLORS.text }}
            onClick={() => window.history.back()}
          >
            &lt; Back
          </button>
          <h1 className="text-lg font-semibold">{headerTitle}</h1>
        </div>

        {/* Card */}
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: COLORS.maroon,
            boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
          }}
        >
          <div className="grid grid-cols-12 gap-3">
            {/* Period selector */}
            <div className="col-span-12 sm:col-span-4">
              <div className="rounded-md border" style={{ borderColor: COLORS.maroon }}>
                {periodKeys.map((p, idx) => {
                  const active = p === selectedPeriod;
                  const r = PERIOD_RANGES[p];
                  const label = `${p} Period (${formatRange(r.start, r.end)})`;

                  return (
                    <button
                      key={p}
                      type="button"
                      className={classNames(
                        "w-full text-left",
                        "px-3 py-2",
                        "text-sm font-semibold",
                        "transition-colors",
                        idx !== 0 && "border-t"
                      )}
                      style={{
                        borderTopColor: COLORS.maroon,
                        background: active ? COLORS.maroon : "#ffffff",
                        color: active ? "#ffffff" : COLORS.text,
                      }}
                      onClick={() => {
                        setSelectedPeriod(p);
                        setSelectedSlot(null);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Optional: show Break info (not selectable) */}
              <div className="mt-2 text-xs" style={{ color: "#5a5a5a" }}>
                Break: 10:00 AM - 10:15 AM
              </div>
            </div>

            {/* Availability list */}
            <div className="col-span-12 sm:col-span-8">
              <p className="mb-2 text-xs leading-4" style={{ color: "#5a5a5a" }}>
                {selectedPeriod} Period ({periodRangeLabel}) — select a time to request a meeting with {MOCK.teacherDisplay}.
              </p>

              <div className="space-y-2">
                {periodData.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className="w-full rounded-md border px-3 py-2 text-left text-sm font-medium"
                    style={{
                      borderColor: COLORS.midGray,
                      background: COLORS.lightGray,
                      color: COLORS.text,
                    }}
                    onClick={() => {
                      setSelectedSlot(slot);
                      setConfirmOpen(true);
                    }}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
        }}
      >
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-3 text-xl font-semibold">Confirm?</h2>

          <p className="mb-6 text-sm">
            {selectedPeriod} Period{selectedSlot ? `: ${selectedSlot.label}` : ""} with {MOCK.teacherDisplay}
          </p>

          <div className="flex items-center justify-start gap-4">
            <button
              type="button"
              className="rounded-md px-6 py-2 text-sm font-semibold text-white"
              style={{ background: COLORS.maroon }}
              onClick={() => {
                // TODO: hook into your scheduling request flow
                setConfirmOpen(false);
              }}
            >
              Yes
            </button>
            <button
              type="button"
              className="rounded-md px-6 py-2 text-sm font-semibold text-white"
              style={{ background: COLORS.maroon }}
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              No
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}