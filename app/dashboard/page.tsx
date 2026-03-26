// src/app/dashboard/page.tsx
// Dashboard page for the user. Differentiate page content based on user role. 

"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PERIODS, type PeriodValue } from "@/src/config/schedule";

type User = {
    id: string;
    email: string;
    fullName: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
  };

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    const { data: session, status } = useSession(); // gets the user's session
    const router = useRouter();

    // Handle unauthenticated redirect
    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    // Fetch user data from API
    useEffect(() => {
        if (status === "authenticated" && session?.user?.email) {
            fetch("/api/user/information")
                .then((res) => {
                    if (res.status === 401 || res.status === 404) {
                        router.push("/account/setup");
                        return null;
                    }
                    return res.json();
                })
                .then((data) => {
                    if (data) {
                        setUser(data);
                    }
                    setLoading(false);
                })
                .catch((error) => {
                    console.error("Error fetching user:", error);
                    setLoading(false);
                });
        }
    }, [status, session, router]);

    // Handle missing user redirect
    useEffect(() => {
        if (!loading && !user) {
            router.push("/account/setup");
        }
    }, [loading, user, router]);

    if (status === "loading" || loading) {
        return <div>Loading...</div>;
    }

    if (status === "unauthenticated" || !user) {
        return <div>Redirecting...</div>;
    }

    const firstName = user.fullName.split(" ")[0];

    switch (user.role) {
        case "ADMIN":
            return <AdminRedirect />;
        case "STUDENT":
            return <StudentDashboard firstName={firstName} />;
        case "TEACHER":
            return <TeacherDashboard firstName={firstName} />;
        default:
            // No role found; redirect handled by useEffect
            return <div>Redirecting to setup...</div>;
    }
}

function AdminRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/users");
    }, [router]);
    return <div>Redirecting...</div>;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

// Student Dashboard. This displays the student's dashboard (ref. "Brighten Example Profile Page - Unael" on the Figma)
function StudentDashboard({ firstName }: { firstName: string }) {
    const [schedule, setSchedule] = useState<{ day: number; period: PeriodValue }[]>([]);
    const [appointments, setAppointments] = useState<
        {
            id: string;
            day: number;
            period: PeriodValue;
            status: string;
            completedBy?: "STUDENT" | "TEACHER" | null;
            meetingDate?: string | null;
            meetingTime?: string | null;
            teacherName: string;
            teacherEmail: string;
            room?: string | null;
            studentNote?: string | null;
            teacherNote?: string | null;
        }[]
    >([]);
    const [showBookingNotice, setShowBookingNotice] = useState(false);
    const [actionMessage, setActionMessage] = useState("");
    const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        fetch("/api/user/information?includeSchedule=true")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.studentAvailability) {
                    setSchedule(data.studentAvailability);
                }
            })
            .catch(() => undefined);

        fetch("/api/user/appointments")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                if (Array.isArray(data)) {
                    setAppointments(data);
                }
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (searchParams.get("booking") === "success") {
            setShowBookingNotice(true);
        }
    }, [searchParams]);

    const cancelAppointment = async (id: string) => {
        setActionMessage("");
        setPendingCancelId(null);

        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "cancel" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to cancel booking.");
            return;
        }

        setAppointments((prev) => prev.filter((item) => item.id !== id));
        setActionMessage("Booking cancelled.");
    };

    const completeAppointment = async (id: string) => {
        setActionMessage("");
        setPendingCancelId(null);

        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "complete" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to complete meeting.");
            return;
        }

        const updated = await response.json();
        setAppointments((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
        );
        setActionMessage("Meeting marked as completed.");
    };

    const acknowledgeAppointment = async (id: string, successMessage: string) => {
        setActionMessage("");
        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "acknowledge" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to acknowledge meeting.");
            return;
        }

        setAppointments((prev) => prev.filter((item) => item.id !== id));
        setActionMessage(successMessage);
    };

    const scheduleByDay = useMemo(() => {
        const map = new Map<number, PeriodValue[]>();
        schedule.forEach((slot) => {
            const periods = map.get(slot.day) ?? [];
            periods.push(slot.period);
            map.set(slot.day, periods);
        });

        return Array.from(map.entries())
            .map(([day, periods]) => ({
                day,
                periods: periods.sort(
                    (a, b) => PERIODS.indexOf(a) - PERIODS.indexOf(b)
                ),
            }))
            .sort((a, b) => a.day - b.day);
    }, [schedule]);

    return (
        <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: "34px", fontWeight: 700, marginBottom: "12px", color: "var(--primary)" }}>
                {getGreeting()}, {firstName}
            </h1>
            <div style={{ background: 'var(--accent)', height: '3px', width: '60px', borderRadius: '2px', marginBottom: '24px' }} />
            <p style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '32px' }}>
                This is your dashboard.
            </p>

            <div
                style={{
                    borderLeft: "4px solid var(--primary)",
                    borderRadius: "10px",
                    padding: "28px",
                    background: "#fff",
                    boxShadow: "0 4px 20px rgba(91,13,31,0.08)",
                }}
            >
                <h2 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: "22px", fontWeight: 700, marginBottom: "16px", color: "var(--primary)" }}>
                    Upcoming meetings
                </h2>
                {showBookingNotice && (
                    <div
                        style={{
                            background: "#e6f7e6",
                            color: "var(--success)",
                            border: "2px solid var(--success)",
                            borderRadius: "10px",
                            padding: "14px 18px",
                            fontWeight: 700,
                            marginBottom: "12px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span>Booking successful.</span>
                        <button
                            type="button"
                            onClick={() => setShowBookingNotice(false)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--success)",
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}
                {actionMessage && (
                    <div style={{ color: "var(--primary)", marginBottom: "12px" }}>{actionMessage}</div>
                )}
                {appointments.length === 0 ? (
                    <p style={{ color: "#666" }}>No upcoming meetings yet.</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {appointments.map((appointment) => (
                            <li
                                key={appointment.id}
                                style={{
                                    border: "2px solid #f0ece6",
                                    borderRadius: "10px",
                                    padding: "16px 20px",
                                    borderLeft: "3px solid var(--accent)",
                                    marginBottom: "10px",
                                }}
                            >
                                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                                    {appointment.status === "CANCELLED" ? (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fef2f2', color: 'var(--danger)', marginRight: '8px' }}>Cancelled</span>
                                    ) : appointment.status === "COMPLETED" ? (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f0fdf4', color: 'var(--success)', marginRight: '8px' }}>Completed</span>
                                    ) : appointment.status === "CONFIRMED" ? (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--accent-soft)', color: 'var(--primary)', marginRight: '8px' }}>Confirmed</span>
                                    ) : (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f5f5f5', color: 'var(--muted)', marginRight: '8px' }}>Pending</span>
                                    )}
                                    Day {appointment.day} • {appointment.period === "BREAK" ? "Break" : `Period ${appointment.period}`}
                                </div>
                                {appointment.meetingDate && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
                                        {appointment.meetingDate}
                                        {appointment.meetingTime ? ` • ${appointment.meetingTime}` : ""}
                                    </div>
                                )}
                                <div style={{ color: "#555", marginTop: "4px" }}>
                                    Teacher: {appointment.teacherName} ({appointment.teacherEmail})
                                </div>
                                    {appointment.room && (
                                        <div style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>
                                            Room: {appointment.room}
                                        </div>
                                    )}
                                {appointment.studentNote && (
                                    <div style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>
                                        Your note: {appointment.studentNote}
                                    </div>
                                )}
                                {appointment.teacherNote && (
                                        <div style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>
                                        Teacher note: {appointment.teacherNote}
                                        </div>
                                    )}
                                {appointment.status === "CANCELLED" ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            acknowledgeAppointment(appointment.id, "Cancelled booking acknowledged.")
                                        }
                                        style={{
                                            marginTop: "8px",
                                            padding: "10px 18px",
                                            borderRadius: "6px",
                                            border: "2px solid var(--primary)",
                                            background: "#fff",
                                            color: "var(--primary)",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: "13px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        Acknowledge
                                    </button>
                                ) : appointment.status === "COMPLETED" ? (
                                    appointment.completedBy !== "STUDENT" ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                acknowledgeAppointment(appointment.id, "Completed meeting acknowledged.")
                                            }
                                            style={{
                                                marginTop: "8px",
                                                padding: "10px 18px",
                                                borderRadius: "6px",
                                                border: "2px solid var(--primary)",
                                                background: "#fff",
                                                color: "var(--primary)",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                            }}
                                        >
                                            Acknowledge
                                        </button>
                                    ) : null
                                ) : pendingCancelId === appointment.id ? (
                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                        <button
                                            type="button"
                                            onClick={() => cancelAppointment(appointment.id)}
                                            style={{
                                                padding: "10px 18px",
                                                borderRadius: "6px",
                                                border: "2px solid var(--danger)",
                                                background: "var(--danger)",
                                                color: "#fff",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                            }}
                                        >
                                            Confirm cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPendingCancelId(null)}
                                            style={{
                                                padding: "10px 18px",
                                                borderRadius: "6px",
                                                border: "2px solid var(--border)",
                                                background: "#fff",
                                                color: "var(--muted)",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                            }}
                                        >
                                            Keep meeting
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                                        {appointment.status === "CONFIRMED" && (
                                            <button
                                                type="button"
                                                onClick={() => completeAppointment(appointment.id)}
                                                style={{
                                                    padding: "10px 18px",
                                                    borderRadius: "6px",
                                                    border: "2px solid var(--primary)",
                                                    background: "var(--primary)",
                                                    color: "#fff",
                                                    cursor: "pointer",
                                                    fontWeight: 700,
                                                    fontSize: "13px",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                Mark as completed
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setPendingCancelId(appointment.id)}
                                            style={{
                                                padding: "10px 18px",
                                                borderRadius: "6px",
                                                border: "2px solid var(--danger)",
                                                background: "#fff",
                                                color: "var(--danger)",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div
                style={{
                    marginTop: "24px",
                    borderLeft: "4px solid var(--primary)",
                    borderRadius: "10px",
                    padding: "28px",
                    background: "#fff",
                    boxShadow: "0 4px 20px rgba(91,13,31,0.08)",
                }}
            >
                <h2 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: "22px", fontWeight: 700, marginBottom: "16px", color: "var(--primary)" }}>
                    Your free periods
                </h2>
                {scheduleByDay.length === 0 ? (
                    <p style={{ color: "var(--muted)" }}>
                        No free periods saved yet. Update your schedule in account setup.
                    </p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {scheduleByDay.map((day) => (
                            <li
                                key={day.day}
                                style={{
                                    border: "2px solid #f0ece6",
                                    borderRadius: "10px",
                                    padding: "14px 20px",
                                    marginBottom: "10px",
                                }}
                            >
                                <strong style={{ fontSize: '16px', fontWeight: 700 }}>Day {day.day}:</strong> {day.periods.map((p) => p === "BREAK" ? "Break" : p).join(", ")}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

        </div>
    );
}

// TODO: Design this on Fi
function TeacherDashboard({ firstName }: { firstName: string }) {
    const [appointments, setAppointments] = useState<
        {
            id: string;
            day: number;
            period: PeriodValue;
            status: string;
            completedBy?: "STUDENT" | "TEACHER" | null;
            meetingDate?: string | null;
            meetingTime?: string | null;
            studentName: string;
            studentEmail: string;
            room?: string | null;
            studentNote?: string | null;
            teacherNote?: string | null;
        }[]
    >([]);
    const [actionMessage, setActionMessage] = useState("");
    const [responses, setResponses] = useState<Record<string, { room: string; note: string }>>({});

    useEffect(() => {
        fetch("/api/user/appointments")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                if (Array.isArray(data)) {
                    setAppointments(data);
                }
            })
            .catch(() => undefined);
    }, []);

    const updateResponse = (id: string, field: "room" | "note", value: string) => {
        setResponses((prev) => ({
            ...prev,
            [id]: {
                room: prev[id]?.room ?? "",
                note: prev[id]?.note ?? "",
                [field]: value,
            },
        }));
    };

    const handleDecision = async (id: string, action: "confirm" | "decline") => {
        const responseState = responses[id] ?? { room: "", note: "" };
        if (action === "confirm" && !responseState.room.trim()) {
            setActionMessage("Room is required to accept a meeting.");
            return;
        }

        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id,
                action,
                room: responseState.room,
                note: responseState.note,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to update booking.");
            return;
        }

        const updated = await response.json();
        if (action === "decline") {
            setAppointments((prev) => prev.filter((item) => item.id !== id));
        } else {
            setAppointments((prev) =>
                prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
            );
        }
        setActionMessage(action === "confirm" ? "Meeting accepted." : "Meeting declined.");
    };

    const completeAppointment = async (id: string) => {
        setActionMessage("");

        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "complete" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to complete meeting.");
            return;
        }

        const updated = await response.json();
        setAppointments((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
        );
        setActionMessage("Meeting marked as completed.");
    };

    const acknowledgeAppointment = async (id: string, successMessage: string) => {
        setActionMessage("");
        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "acknowledge" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to acknowledge meeting.");
            return;
        }

        setAppointments((prev) => prev.filter((item) => item.id !== id));
        setActionMessage(successMessage);
    };

    return (
        <div style={{ padding: "40px" }}>
            <h1 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: "34px", fontWeight: 700, marginBottom: "12px", color: "var(--primary)" }}>
                {getGreeting()}, {firstName}
            </h1>
            <div style={{ background: 'var(--accent)', height: '3px', width: '60px', borderRadius: '2px', marginBottom: '24px' }} />
            <p style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '32px' }}>
                This is your dashboard.
            </p>

            <Link
                href="/account/setup"
                style={{
                    display: "inline-block",
                    padding: "14px 24px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "10px",
                    textDecoration: "none",
                    marginBottom: "24px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 700,
                    fontSize: "15px",
                }}
            >
                Update availability
            </Link>

            <div
                style={{
                    borderLeft: "4px solid var(--primary)",
                    borderRadius: "10px",
                    padding: "28px",
                    background: "#fff",
                    boxShadow: "0 4px 20px rgba(91,13,31,0.08)",
                }}
            >
                <h2 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: "22px", fontWeight: 700, marginBottom: "16px", color: "var(--primary)" }}>
                    Upcoming meetings
                </h2>
                {actionMessage && (
                    <div style={{ color: "var(--primary)", marginBottom: "12px" }}>{actionMessage}</div>
                )}
                {appointments.length === 0 ? (
                    <p style={{ color: "#666" }}>No upcoming meetings yet.</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {appointments.map((appointment) => (
                            <li
                                key={appointment.id}
                                style={{
                                    border: "2px solid #f0ece6",
                                    borderRadius: "10px",
                                    padding: "16px 20px",
                                    borderLeft: "3px solid var(--accent)",
                                    marginBottom: "10px",
                                }}
                            >
                                <div style={{ fontSize: '16px', fontWeight: 700 }}>
                                    {appointment.status === "CANCELLED" ? (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fef2f2', color: 'var(--danger)', marginRight: '8px' }}>Cancelled</span>
                                    ) : appointment.status === "COMPLETED" ? (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f0fdf4', color: 'var(--success)', marginRight: '8px' }}>Completed</span>
                                    ) : appointment.status === "CONFIRMED" ? (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--accent-soft)', color: 'var(--primary)', marginRight: '8px' }}>Confirmed</span>
                                    ) : (
                                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f5f5f5', color: 'var(--muted)', marginRight: '8px' }}>Pending</span>
                                    )}
                                    Day {appointment.day} • {appointment.period === "BREAK" ? "Break" : `Period ${appointment.period}`}
                                </div>
                                {appointment.meetingDate && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
                                        {appointment.meetingDate}
                                        {appointment.meetingTime ? ` • ${appointment.meetingTime}` : ""}
                                    </div>
                                )}
                                <div style={{ color: "#555", marginTop: "4px" }}>
                                    Student: {appointment.studentName} ({appointment.studentEmail})
                                </div>
                                {appointment.room && (
                                    <div style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>
                                        Room: {appointment.room}
                                    </div>
                                )}
                                {appointment.studentNote && (
                                    <div style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>
                                        Student note: {appointment.studentNote}
                                    </div>
                                )}
                                {appointment.teacherNote && (
                                    <div style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>
                                        Your note: {appointment.teacherNote}
                                    </div>
                                )}
                                {appointment.status === "CANCELLED" ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            acknowledgeAppointment(appointment.id, "Cancelled booking acknowledged.")
                                        }
                                        style={{
                                            marginTop: "8px",
                                            padding: "10px 18px",
                                            borderRadius: "6px",
                                            border: "2px solid var(--primary)",
                                            background: "#fff",
                                            color: "var(--primary)",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: "13px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        Acknowledge
                                    </button>
                                ) : appointment.status === "COMPLETED" ? (
                                    appointment.completedBy !== "TEACHER" ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                acknowledgeAppointment(appointment.id, "Completed meeting acknowledged.")
                                            }
                                            style={{
                                                marginTop: "8px",
                                                padding: "10px 18px",
                                                borderRadius: "6px",
                                                border: "2px solid var(--primary)",
                                                background: "#fff",
                                                color: "var(--primary)",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                            }}
                                        >
                                            Acknowledge
                                        </button>
                                    ) : null
                                ) : appointment.status === "CONFIRMED" ? (
                                    <button
                                        type="button"
                                        onClick={() => completeAppointment(appointment.id)}
                                        style={{
                                            marginTop: "8px",
                                            padding: "10px 18px",
                                            borderRadius: "6px",
                                            border: "2px solid var(--primary)",
                                            background: "var(--primary)",
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: "13px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        Mark as completed
                                    </button>
                                ) : null}
                                {appointment.status === "PENDING" && (
                                    <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                                        <input
                                            type="text"
                                            placeholder="Room (required to accept)"
                                            value={responses[appointment.id]?.room ?? ""}
                                            onChange={(event) => updateResponse(appointment.id, "room", event.target.value)}
                                            style={{
                                                padding: "12px 14px",
                                                borderRadius: "8px",
                                                border: "2px solid var(--border)",
                                            }}
                                        />
                                        <textarea
                                            placeholder="Note (optional)"
                                            value={responses[appointment.id]?.note ?? ""}
                                            onChange={(event) => updateResponse(appointment.id, "note", event.target.value)}
                                            rows={3}
                                            style={{
                                                padding: "12px 14px",
                                                borderRadius: "8px",
                                                border: "2px solid var(--border)",
                                                resize: "vertical",
                                            }}
                                        />
                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <button
                                                type="button"
                                                onClick={() => handleDecision(appointment.id, "confirm")}
                                                style={{
                                                    padding: "10px 18px",
                                                    borderRadius: "6px",
                                                    border: "2px solid var(--primary)",
                                                    background: "var(--primary)",
                                                    color: "#fff",
                                                    cursor: "pointer",
                                                    fontWeight: 700,
                                                    fontSize: "13px",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDecision(appointment.id, "decline")}
                                                style={{
                                                    padding: "10px 18px",
                                                    borderRadius: "6px",
                                                    border: "2px solid var(--danger)",
                                                    background: "#fff",
                                                    color: "var(--danger)",
                                                    cursor: "pointer",
                                                    fontWeight: 700,
                                                    fontSize: "13px",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function AdminDashboard({ firstName }: { firstName: string }) {
    return (
        <div style={{ padding: "40px" }}>
            <h1 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: "34px", fontWeight: 700, marginBottom: "12px", color: "var(--primary)" }}>
                {getGreeting()}, {firstName}
            </h1>
            <div style={{ background: 'var(--accent)', height: '3px', width: '60px', borderRadius: '2px', marginBottom: '24px' }} />
            <p style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '32px' }}>This is your dashboard.</p>
            <Link
                href="/users"
                style={{
                    display: "inline-block",
                    padding: "14px 24px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "10px",
                    textDecoration: "none",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 700,
                    fontSize: "15px",
                }}
            >
                Manage users
            </Link>
        </div>
    );
}