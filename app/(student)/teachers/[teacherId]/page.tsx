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
      setAvailability(await response.json());
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

  return (
    <div style={{ padding: "40px 48px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "14px 12px", background: "var(--primary)", color: "#fff", fontWeight: 700, textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.06em" }}>Period</th>
              {orderedDays.map((day) => (
                <th key={day} style={{ padding: "14px 12px", background: day === todayCycleDay ? "#f5efd6" : "var(--primary)", color: day === todayCycleDay ? "var(--primary)" : "#fff", fontWeight: 700, textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.06em" }}>
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
                <td style={{ fontWeight: 700, fontSize: "15px", padding: "12px 14px", color: "var(--primary)" }}>{period}</td>
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

                  return (
                    <td key={key} style={{ padding: "8px 10px", backgroundColor: day === todayCycleDay ? "#f5efd6" : "transparent" }}>
                      <button
                        style={{
                          width: "100%",
                          padding: "12px 0",
                          borderRadius: "8px",
                          border: cellBorder,
                          backgroundColor,
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
                        {isOH ? "OH" : period}
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
  );
}
