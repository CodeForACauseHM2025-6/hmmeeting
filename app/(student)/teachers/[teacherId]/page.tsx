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
  const [showLegend, setShowLegend] = useState(false);
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

  const matchingByDay = useMemo(() => {
    const map = new Map<number, PeriodValue[]>();
    DAYS.forEach((day) => {
      PERIODS.forEach((period) => {
        const key = `${day}-${period}`;
        if (teacherFreeSet.has(key) && studentFreeSet.has(key)) {
          const list = map.get(day) ?? [];
          list.push(period);
          map.set(day, list);
        }
      });
    });

    return Array.from(map.entries()).map(([day, periods]) => ({
      day,
      periods: periods.sort((a, b) => PERIODS.indexOf(a) - PERIODS.indexOf(b)),
    }));
  }, [teacherFreeSet, studentFreeSet]);
  
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
    return <div style={{ padding: "40px 48px", fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "18px", color: "var(--muted)" }}>Loading availability...</div>;
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
    <div style={{ padding: "40px 48px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "34px", fontWeight: 700, color: "var(--primary)", marginBottom: "8px" }}>
        {teacherName}&apos;s Availability
      </h1>
      <div style={{ background: "var(--accent)", height: "3px", width: "60px", borderRadius: "2px", marginBottom: "24px" }} />

      {message && !modalOpen && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "8px", border: "2px solid var(--danger)", background: "#fef2f2", color: "var(--danger)", fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setShowLegend(!showLegend)}
          style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: "14px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          {showLegend ? "Hide legend" : "Show legend"}
        </button>
        {showLegend && (
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "12px", padding: "16px", background: "#fff", borderRadius: "10px", borderLeft: "4px solid var(--primary)", boxShadow: "0 2px 8px rgba(91,13,31,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#1a7a2f", border: "2px solid #1a7a2f" }} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Both free (bookable)</span>
            </div>
            {hasOfficeHours && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#6a1b9a", border: "2px solid #6a1b9a" }} />
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Office hours (bookable)</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#e65100", border: "2px solid #e65100" }} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Teacher free (bookable)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#1565c0", border: "2px solid #1565c0" }} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>You free only</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#f5f2ed", border: "2px solid var(--border)" }} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Neither free</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto", border: "2px solid var(--primary)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(91,13,31,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "14px 12px", background: "var(--primary)", color: "#fff", fontWeight: 700, textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.06em", borderBottom: "2px solid var(--primary)" }}>Period</th>
              {orderedDays.map((day) => (
                <th key={day} style={{ padding: "14px 12px", background: day === todayCycleDay ? "var(--primary-soft)" : "var(--primary)", color: day === todayCycleDay ? "var(--primary)" : "#fff", fontWeight: 700, textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.06em", borderBottom: "2px solid var(--primary)" }}>
                  <div>
                    Day {day}
                    {dayDates[day] && (
                      <div style={{ fontSize: 12 }}>
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
                <td style={{ fontWeight: 700, fontSize: "15px", padding: "12px 14px", color: "var(--primary)", borderBottom: "1px solid #ede4e6", background: "#fff" }}>{period === "BREAK" ? "Break" : period}</td>
                {orderedDays.map((day) => {
                  const key = `${day}-${period}`;
                  const teacherFree = teacherFreeSet.has(key);
                  const studentFree = studentFreeSet.has(key);
                  const isOH = officeHoursSet.has(key);
                  let backgroundColor = "#f5f2ed";
                  let cellBorder = "2px solid var(--primary)";
                  if (isOH) backgroundColor = "#6a1b9a";
                  else if (teacherFree && studentFree) backgroundColor = "#1a7a2f";
                  else if (studentFree) backgroundColor = "#1565c0";
                  else if (teacherFree) backgroundColor = "#e65100";
                  else cellBorder = "2px solid var(--border)";

                  const displayLabel = isOH ? "OH" : period === "BREAK" ? "Break" : period;

                  return (
                    <td key={key} style={{ padding: "8px 10px", backgroundColor: day === todayCycleDay ? "var(--primary-soft)" : "#fff", borderBottom: "1px solid #ede4e6" }}>
                      <button
                        type="button"
                        onClick={() => handleSlotClick(day, period)}
                        style={{
                          width: "100%",
                          padding: "12px 0",
                          borderRadius: "8px",
                          border: cellBorder,
                          backgroundColor,
                          color: backgroundColor === "#f5f2ed" ? "var(--muted)" : "#fff",
                          fontWeight: 700,
                          fontSize: "13px",
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
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "32px",
              maxWidth: "440px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "22px", fontWeight: 700, color: "var(--primary)", marginBottom: "8px" }}>
              {officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) ? "Book Office Hours" : "Request Meeting"}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
              {teacherName} &middot; Day {selectedSlot.day} &middot; {selectedSlot.period === "BREAK" ? "Break" : `Period ${selectedSlot.period}`}
              {dayDates[selectedSlot.day] && (
                <span> &middot; {formatScheduleDate(dayDates[selectedSlot.day])}</span>
              )}
            </p>
            {officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) && teacherRoom && (
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary)", marginBottom: "20px" }}>
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
                <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "8px", border: "2px solid var(--danger)", background: "#fef2f2" }}>
                  {warnings.map((w, i) => (
                    <p key={i} style={{ color: "var(--danger)", fontWeight: 600, fontSize: "13px", margin: 0 }}>
                      <span style={{ color: "var(--danger)", fontWeight: 700 }}>* </span>{w}
                    </p>
                  ))}
                </div>
              );
            })()}

            {!officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "8px" }}>
                  Reason for meeting (required)
                </label>
                <textarea
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder="What would you like to discuss?"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "2px solid var(--border)",
                    fontSize: "15px",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "8px" }}>
                  Note (optional)
                </label>
                <textarea
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder="Anything you want the teacher to know?"
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "2px solid var(--border)",
                    fontSize: "15px",
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

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setModalOpen(false); setMessage(""); }}
                style={{
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "2px solid var(--border)",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBook}
                disabled={booking}
                style={{
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  cursor: booking ? "not-allowed" : "pointer",
                  opacity: booking ? 0.7 : 1,
                }}
              >
                {booking ? "Booking..." : officeHoursSet.has(`${selectedSlot.day}-${selectedSlot.period}`) ? "Book" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
