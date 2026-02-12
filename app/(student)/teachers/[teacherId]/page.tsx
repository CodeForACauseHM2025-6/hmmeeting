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

  const teacherFreeSet = useMemo(
    () => new Set(availability.map((slot) => `${slot.day}-${slot.period}`)),
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

  useEffect(() => {
    if (!teacherId) return;

    async function loadAvailability() {
      setLoading(true);
      setMessage("");

      const response = await fetch(`/api/user/availability?teacherId=${teacherId}`);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setMessage("Failed to load availability.");
        setLoading(false);
        return;
      }

      const data = (await response.json()) as AvailabilitySlot[];
      setAvailability(data);

    }

    async function loadStudentSchedule() {
      const response = await fetch("/api/user/information?includeSchedule=true");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data?.role) {
        setUserRole(data.role);
      }
      if (Array.isArray(data?.studentAvailability)) {
        setStudentSchedule(data.studentAvailability);

      }
    }

    async function loadScheduleDates() {
      try {
        const response = await fetch("/api/schedule");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!data?.currentWeek || !data?.weekSetAt) {
          return;
        }
        const { dayDates: nextDates } = buildDayDateMap({
          currentWeek: data.currentWeek,
          weekSetAt: data.weekSetAt,
        });
        setDayDates(nextDates);
      } catch {
        // Ignore schedule date errors so availability still loads.
      }
    }

    Promise.all([loadAvailability(), loadStudentSchedule(), loadScheduleDates()]).finally(() =>
      setLoading(false)
    );
  }, [teacherId, router]);

  const requestMeeting = async (slot: { day: number; period: PeriodValue }) => {
    if (!teacherId) return;
    setMessage("");
    setBooking(true);

    if (!studentNote.trim()) {
      setMessage("Reason for meeting is required.");
      setBooking(false);
      return;
    }

    const response = await fetch("/api/user/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId,
        day: slot.day,
        period: slot.period,
        studentNote: studentNote.trim(),
      }),
    });

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      setMessage(errorText || "Failed to request meeting.");
      setBooking(false);
      return;
    }

    router.push("/dashboard?booking=success");
  };

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading availability...</div>;
  }

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <button
            type="button"
            onClick={() => router.push("/teachers")}
            style={{
              marginBottom: "16px",
              background: "none",
              border: "none",
              color: "var(--primary)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ← Back to teachers
          </button>

          <h1 style={{ fontSize: "28px", marginBottom: "12px", color: "var(--primary)" }}>
            {teacherName}
            {"'"}s Availability
          </h1>
        </div>
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setShowLegend(true)}
          onMouseLeave={() => setShowLegend(false)}
        >
          <button
            type="button"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1px solid var(--primary)",
              background: "#fff",
              color: "var(--primary)",
              fontWeight: 700,
              cursor: "default",
            }}
          >
            ?
          </button>
          {showLegend && (
            <div
              style={{
                position: "absolute",
                top: "36px",
                right: 0,
                background: "#fff",
                border: "1px solid var(--primary)",
                borderRadius: "10px",
                padding: "12px",
                boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
                width: "200px",
                zIndex: 10,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "8px", color: "var(--primary)" }}>
                Color key
              </div>
              {[
                { label: "No match", bg: "#ffffff" },
                { label: "Only student free", bg: "#1e88e5" },
                { label: "Only teacher free", bg: "#f57c00" },
                { label: "Both free", bg: "#2e7d32" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "4px",
                      border: "1px solid var(--primary)",
                      background: item.bg,
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--primary)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {studentSchedule.length === 0 && (
        <p style={{ color: "#666", marginBottom: "12px" }}>
          Add your free periods in account setup to filter availability.
        </p>
      )}
      {userRole && userRole !== "STUDENT" && (
        <p style={{ color: "#666", marginBottom: "12px" }}>
          You can view availability but only students can request meetings.
        </p>
      )}
      {message && <p style={{ color: "#b00020", marginBottom: "12px" }}>{message}</p>}

      {matchingByDay.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ marginBottom: "8px", color: "var(--primary)" }}>
            Matching free periods
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {matchingByDay.map((day) => (
              <li
                key={day.day}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  marginBottom: "8px",
                  background: "#fff",
                }}
              >
                <strong>
                  Day {day.day}
                  {dayDates[day.day] ? ` (${formatScheduleDate(dayDates[day.day])})` : ""}:
                </strong>{" "}
                {day.periods.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--primary)",
          borderRadius: "12px",
          padding: "20px",
          background: "#fff",
          boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Period</th>
                {DAYS.map((day) => (
                  <th key={day} style={{ padding: "8px 12px", color: "var(--primary)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                      <span>Day {day}</span>
                      {dayDates[day] && (
                        <span style={{ fontSize: "12px", color: "#666" }}>
                          {formatScheduleDate(dayDates[day])}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <tr key={period}>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{period}</td>
                  {DAYS.map((day) => {
                    const key = `${day}-${period}`;
                    const teacherFree = teacherFreeSet.has(key);
                    const studentFree = studentFreeSet.has(key);
                    const bothFree = teacherFree && studentFree;
                    const onlyStudent = studentFree && !teacherFree;
                    const onlyTeacher = teacherFree && !studentFree;
                    const noneFree = !teacherFree && !studentFree;

                    let backgroundColor = "#ffffff";
                    let textColor = "var(--primary)";
                    if (bothFree) {
                      backgroundColor = "#2e7d32";
                      textColor = "#fff";
                    } else if (onlyStudent) {
                      backgroundColor = "#1e88e5";
                      textColor = "#fff";
                    } else if (onlyTeacher) {
                      backgroundColor = "#f57c00";
                      textColor = "#fff";
                    } else if (noneFree) {
                      backgroundColor = "#ffffff";
                      textColor = "var(--primary)";
                    }
                    return (
                      <td key={key} style={{ padding: "8px 12px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlot({ day, period });
                            setModalOpen(true);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 0",
                            borderRadius: "8px",
                            border: "1px solid var(--primary)",
                            backgroundColor,
                            color: textColor,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {period}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && selectedSlot && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
            }}
          >
            {(() => {
              const key = `${selectedSlot.day}-${selectedSlot.period}`;
              const teacherFree = teacherFreeSet.has(key);
              const studentFree = studentFreeSet.has(key);
              const bothFree = teacherFree && studentFree;
              const selectedDate = dayDates[selectedSlot.day];
              const meetingInfo = selectedDate
                ? formatMeetingDateTime(selectedDate, selectedSlot.period)
                : null;
              let warning = "";

              if (!bothFree) {
                if (!teacherFree && !studentFree) {
                  warning = `WARNING: You and ${teacherName} are not free this period, please double check before booking.`;
                } else if (!studentFree) {
                  warning = "WARNING: You are not free this period, please double check before booking.";
                } else {
                  warning = `WARNING: ${teacherName} is not free this period, please double check before booking.`;
                }
              }

              return (
                <>
                  <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--primary)" }}>
                    Would you like to request a meeting with {teacherName}, Period {selectedSlot.period} Day {selectedSlot.day}
                  </h2>
                  {meetingInfo && (
                    <div style={{ marginBottom: "8px", color: "#555" }}>
                      {meetingInfo.dateLabel} • {meetingInfo.timeLabel}
                    </div>
                  )}
                  {!bothFree && (
                    <p style={{ color: "#b00020", marginBottom: "12px" }}>{warning}</p>
                  )}
                  {userRole && userRole !== "STUDENT" && (
                    <p style={{ color: "#666", marginBottom: "12px" }}>
                      Only students can book meetings.
                    </p>
                  )}
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Reason for meet / additional notes
                    </label>
                    <textarea
                      value={studentNote}
                      onChange={(event) => setStudentNote(event.target.value)}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        resize: "vertical",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={userRole !== "STUDENT" || booking}
                      onClick={() => requestMeeting(selectedSlot)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor:
                          userRole === "STUDENT" ? "var(--primary)" : "#ccc",
                        color: "#fff",
                        cursor: userRole === "STUDENT" ? "pointer" : "not-allowed",
                      }}
                    >
                      {booking ? "Booking..." : "Confirm"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}