"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  DAYS,
  PERIODS,
  buildDayDateMap,
  formatMeetingDateTime,
  formatScheduleDate,
  type PeriodValue,
} from "@/src/config/schedule";

type AvailabilitySlot = {
  id: string;
  day: number;
  period: PeriodValue;
  type?: string;
};

type StudentFreePeriod = {
  day: number;
  period: PeriodValue;
};

export default function TeacherAvailabilityPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teacherId = params?.teacherId as string | undefined;
  const teacherName = searchParams.get("name") ?? "Teacher";

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [studentSchedule, setStudentSchedule] = useState<StudentFreePeriod[]>([]);
  const [userRole, setUserRole] = useState<"STUDENT" | "TEACHER" | "ADMIN" | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [dayDates, setDayDates] = useState<Record<number, Date>>({});
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; period: PeriodValue } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [studentNote, setStudentNote] = useState("");
  const [teacherRoom, setTeacherRoom] = useState<string | null>(null);

  const teacherFreeSet = useMemo(
    () => new Set(availability.map((slot) => `${slot.day}-${slot.period}`)),
    [availability]
  );

  const officeHoursSet = useMemo(
    () =>
      new Set(
        availability
          .filter((slot) => slot.type === "OFFICE_HOURS")
          .map((slot) => `${slot.day}-${slot.period}`)
      ),
    [availability]
  );

  const studentFreeSet = useMemo(
    () => new Set(studentSchedule.map((slot) => `${slot.day}-${slot.period}`)),
    [studentSchedule]
  );

  const { orderedDays, todayCycleDay } = useMemo(() => {
    if (!dayDates || Object.keys(dayDates).length === 0) return { orderedDays: DAYS, todayCycleDay: null };

    const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const easternToday = new Date(now);

    const todayEntry = Object.entries(dayDates).find(([_, date]) => {
      const easternDate = new Date(new Date(date).toLocaleString("en-US", { timeZone: "America/New_York" }));
      return (
        easternToday.getFullYear() === easternDate.getFullYear() &&
        easternToday.getMonth() === easternDate.getMonth() &&
        easternToday.getDate() === easternDate.getDate()
      );
    });

    const todayCycleDay = todayEntry ? Number(todayEntry[0]) : null;
    const idx = todayCycleDay !== null ? DAYS.indexOf(todayCycleDay) : -1;
    const orderedDays = idx === -1 ? DAYS : [...DAYS.slice(idx), ...DAYS.slice(0, idx)];

    return { orderedDays, todayCycleDay };
  }, [dayDates]);

  useEffect(() => {
    if (!teacherId) return;

    async function loadAvailability() {
      setLoading(true);
      try {
        const response = await fetch(`/api/user/availability?teacherId=${teacherId}`);
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          setMessage(errorText || `Failed to load availability (${response.status}).`);
          setLoading(false);
          return;
        }
        const data = await response.json();
        setAvailability(data.slots ?? data);
        if (data.room) setTeacherRoom(data.room);
      } catch {
        setMessage("Failed to load availability. Please try again.");
        setLoading(false);
      }
    }

    async function loadStudentSchedule() {
      const response = await fetch("/api/user/information?includeSchedule=true");
      if (!response.ok) return;
      const data = await response.json();
      if (data?.role) setUserRole(data.role);
      if (Array.isArray(data?.studentAvailability)) {
        setStudentSchedule(data.studentAvailability);
      }
    }

    async function loadScheduleDates() {
      const response = await fetch("/api/schedule");
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.currentWeek || !data?.weekSetAt) return;
      const { dayDates: nextDates } = buildDayDateMap(data);
      setDayDates(nextDates);
    }

    Promise.all([
      loadAvailability(),
      loadStudentSchedule(),
      loadScheduleDates(),
    ]).finally(() => setLoading(false));
  }, [teacherId, router]);

  if (loading) {
    return (
      <div style={{ padding: "48px 40px", maxWidth: "900px", margin: "0 auto" }}>
        <div className="skeleton" style={{ height: "36px", width: "280px", marginBottom: "8px" }} />
        <div className="skeleton" style={{ height: "14px", width: "180px", marginBottom: "32px" }} />
        <div style={{
          background: "var(--surface-warm)",
          borderRadius: "14px",
          padding: "28px",
        }}>
          <div className="skeleton" style={{ height: "300px", width: "100%" }} />
        </div>
      </div>
    );
  }

  const hasOfficeHours = officeHoursSet.size > 0;

  const handleSlotClick = (day: number, period: PeriodValue) => {
    setSelectedSlot({ day, period });
    setStudentNote("");
    setMessage("");
    setModalOpen(true);
  };

  const handleBook = async () => {
    if (!selectedSlot || !teacherId) return;

    const isOH = officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`);
    if (!isOH && !studentNote.trim()) {
      setMessage("Please provide a reason for the meeting.");
      return;
    }

    setBooking(true);
    setMessage("");

    try {
      const response = await fetch("/api/user/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          day: selectedSlot.day,
          period: selectedSlot.period,
          studentNote: studentNote.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessage(errorText || "Failed to book meeting.");
        setBooking(false);
        return;
      }

      setModalOpen(false);
      setSelectedSlot(null);
      setStudentNote("");
      router.push("/dashboard?booking=success");
    } catch {
      setMessage("Something went wrong. Please try again.");
      setBooking(false);
    }
  };

  return (
    <div style={{ padding: "48px 40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{
        fontFamily: "var(--font-lora, Georgia, serif)",
        fontSize: "32px",
        fontWeight: 700,
        color: "var(--primary)",
        marginBottom: "6px",
        letterSpacing: "-0.02em",
      }}>
        {teacherName}&apos;s availability
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}>
        Tap a slot to book a meeting.
      </p>

      {message && !modalOpen && (
        <div style={{
          marginBottom: "16px",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "var(--danger)",
          fontWeight: 600,
          fontSize: "14px",
        }}>
          {message}
        </div>
      )}

      {/* Legend — always visible */}
      <div style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "20px",
        padding: "14px 18px",
        background: "var(--surface-warm)",
        borderRadius: "10px",
        border: "1px solid var(--border-light)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--slot-match)" }} />
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Both free</span>
        </div>
        {hasOfficeHours && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--slot-oh)" }} />
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Office hours</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--slot-teacher)" }} />
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Teacher free</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--slot-student)" }} />
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>You free</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--surface-warm)", border: "1px solid var(--border)" }} />
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Neither</span>
        </div>
      </div>

      {/* Schedule grid */}
      <div style={{
        overflowX: "auto",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(91,13,31,0.04), 0 4px 20px rgba(91,13,31,0.06)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{
                textAlign: "left",
                padding: "10px 10px",
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "12px",
                letterSpacing: "0.04em",
              }}>
                Period
              </th>
              {orderedDays.map((day) => (
                <th key={day} style={{
                  padding: "10px 8px",
                  background: day === todayCycleDay ? "var(--primary-light)" : "var(--primary)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "12px",
                  letterSpacing: "0.04em",
                }}>
                  <div>
                    Day {day}
                    {dayDates[day] && (
                      <div style={{ fontSize: "11px", fontWeight: 400, opacity: 0.8, marginTop: "2px" }}>
                        {formatScheduleDate(dayDates[day])}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <td style={{
                  fontWeight: 600,
                  fontSize: "13px",
                  padding: "6px 10px",
                  color: "var(--primary)",
                  borderBottom: "1px solid var(--border-light)",
                  background: "var(--surface)",
                }}>
                  {period === "BREAK" ? "Break" : period}
                </td>
                {orderedDays.map((day) => {
                  const key = `${day}-${period}`;
                  const teacherFree = teacherFreeSet.has(key);
                  const studentFree = studentFreeSet.has(key);
                  const isOH = officeHoursSet.has(key);
                  let backgroundColor = "var(--surface-warm)";
                  let borderColor = "var(--border)";
                  if (isOH) { backgroundColor = "var(--slot-oh)"; borderColor = "var(--slot-oh)"; }
                  else if (teacherFree && studentFree) { backgroundColor = "var(--slot-match)"; borderColor = "var(--slot-match)"; }
                  else if (studentFree) { backgroundColor = "var(--slot-student)"; borderColor = "var(--slot-student)"; }
                  else if (teacherFree) { backgroundColor = "var(--slot-teacher)"; borderColor = "var(--slot-teacher)"; }

                  const isColored = backgroundColor !== "var(--surface-warm)";
                  const displayLabel = isOH ? "OH" : period === "BREAK" ? "Break" : period;

                  return (
                    <td key={key} style={{
                      padding: "3px 4px",
                      backgroundColor: day === todayCycleDay ? "var(--primary-soft)" : "var(--surface)",
                      borderBottom: "1px solid var(--border-light)",
                    }}>
                      <button
                        type="button"
                        className="slot-btn"
                        onClick={() => handleSlotClick(day, period)}
                        style={{
                          width: "100%",
                          padding: "6px 0",
                          borderRadius: "6px",
                          border: `2px solid ${borderColor}`,
                          backgroundColor,
                          color: isColored ? "#fff" : "var(--muted)",
                          fontWeight: 600,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {displayLabel}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Booking Modal */}
      {modalOpen && selectedSlot && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => { setModalOpen(false); setMessage(""); }}
        >
          <div
            className="modal-panel"
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "440px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontFamily: "var(--font-lora, Georgia, serif)",
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--primary)",
              marginBottom: "8px",
            }}>
              {officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) ? "Book office hours" : "Request meeting"}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
              {teacherName} &middot; Day {selectedSlot.day} &middot; {selectedSlot.period === "BREAK" ? "Break" : `Period ${selectedSlot.period}`}
              {dayDates[selectedSlot.day] && (
                <span> &middot; {formatScheduleDate(dayDates[selectedSlot.day])}</span>
              )}
            </p>
            {officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) && teacherRoom && (
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--primary)", marginBottom: "20px" }}>
                Room: {teacherRoom}
              </p>
            )}

            {/* Scheduling conflict warnings (exempt for BREAK period) */}
            {selectedSlot.period !== "BREAK" && (() => {
              const slotKey = `${selectedSlot.day}-${selectedSlot.period}`;
              const tFree = teacherFreeSet.has(slotKey);
              const sFree = studentFreeSet.has(slotKey);
              const warnings: string[] = [];
              if (!tFree && !sFree) warnings.push("Neither you nor the teacher is marked as free for this period.");
              else if (!tFree) warnings.push("The teacher is not marked as free for this period.");
              else if (!sFree) warnings.push("You are not marked as free for this period.");
              if (warnings.length === 0) return null;
              return (
                <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2" }}>
                  {warnings.map((w, i) => (
                    <p key={i} style={{ color: "var(--danger)", fontWeight: 600, fontSize: "13px", margin: 0 }}>
                      {w}
                    </p>
                  ))}
                </div>
              );
            })()}

            {!officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "12px", letterSpacing: "0.03em", color: "var(--muted)", marginBottom: "8px" }}>
                  Reason for meeting (required)
                </label>
                <textarea
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder="What would you like to discuss?"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "14px",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "12px", letterSpacing: "0.03em", color: "var(--muted)", marginBottom: "8px" }}>
                  Note (optional)
                </label>
                <textarea
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder="Anything you want the teacher to know?"
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "14px",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {message && (
              <div style={{ marginBottom: "12px", color: "var(--danger)", fontWeight: 600, fontSize: "14px" }}>
                {message}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => { setModalOpen(false); setMessage(""); }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  color: "var(--foreground)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill"
                onClick={handleBook}
                disabled={booking}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: booking ? "not-allowed" : "pointer",
                  opacity: booking ? 0.7 : 1,
                }}
              >
                {booking ? "Booking..." : officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) ? "Book" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
