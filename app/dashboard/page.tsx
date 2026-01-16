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

    switch (user.role) {
        case "STUDENT":
            return <StudentDashboard />;
        case "TEACHER":
            return <TeacherDashboard />;
        case "ADMIN":
            return <AdminDashboard />;
        default:
            // No role found; redirect handled by useEffect
            return <div>Redirecting to setup...</div>;
    }
}

// Student Dashboard. This displays the student's dashboard (ref. "Brighten Example Profile Page - Unael" on the Figma)
function StudentDashboard() {
    const [schedule, setSchedule] = useState<{ day: number; period: PeriodValue }[]>([]);
    const [appointments, setAppointments] = useState<
        {
            id: string;
            day: number;
            period: PeriodValue;
            status: string;
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

    const acknowledgeCancelled = async (id: string) => {
        setActionMessage("");
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cc89fe79-f21f-41c4-9836-b19789698f76',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:acknowledgeCancelled',message:'Student acknowledge clicked',data:{hasId:Boolean(id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "acknowledge" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to acknowledge booking.");
            return;
        }

        setAppointments((prev) => prev.filter((item) => item.id !== id));
        setActionMessage("Cancelled booking acknowledged.");
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
            <h1 style={{ fontSize: "28px", marginBottom: "12px", color: "var(--primary)" }}>
                Student Dashboard
            </h1>
            <p style={{ marginBottom: "20px", color: "#555" }}>
                Review your free periods and request meetings with teachers.
            </p>

            <div
                style={{
                    border: "1px solid var(--primary)",
                    borderRadius: "12px",
                    padding: "20px",
                    background: "#fff",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
                }}
            >
                <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--primary)" }}>
                    Upcoming meetings
                </h2>
                {showBookingNotice && (
                    <div
                        style={{
                            background: "#e6f7e6",
                            color: "#1b5e20",
                            padding: "8px 12px",
                            borderRadius: "8px",
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
                                color: "#1b5e20",
                                cursor: "pointer",
                                fontWeight: 600,
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
                                    border: "1px solid #e0e0e0",
                                    borderRadius: "10px",
                                    padding: "12px 16px",
                                    marginBottom: "10px",
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>
                                    {appointment.status === "CANCELLED" ? "CANCELLED: " : ""}
                                    Day {appointment.day} • Period {appointment.period}
                                </div>
                                <div style={{ color: "#555" }}>
                                    Teacher: {appointment.teacherName} ({appointment.teacherEmail})
                                </div>
                                    <div style={{ color: "#777", fontSize: "13px" }}>
                                        Status: {appointment.status}
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
                                        onClick={() => acknowledgeCancelled(appointment.id)}
                                        style={{
                                            marginTop: "8px",
                                            padding: "6px 10px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--primary)",
                                            background: "#fff",
                                            color: "var(--primary)",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Acknowledge
                                    </button>
                                ) : pendingCancelId === appointment.id ? (
                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                        <button
                                            type="button"
                                            onClick={() => cancelAppointment(appointment.id)}
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: "6px",
                                                border: "1px solid #d32f2f",
                                                background: "#d32f2f",
                                                color: "#fff",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Confirm cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPendingCancelId(null)}
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: "6px",
                                                border: "1px solid #ccc",
                                                background: "#fff",
                                                color: "#555",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Keep meeting
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setPendingCancelId(appointment.id)}
                                        style={{
                                            marginTop: "8px",
                                            padding: "6px 10px",
                                            borderRadius: "6px",
                                            border: "1px solid #d32f2f",
                                            background: "#fff",
                                            color: "#d32f2f",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div
                style={{
                    marginTop: "24px",
                    border: "1px solid var(--primary)",
                    borderRadius: "12px",
                    padding: "20px",
                    background: "#fff",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
                }}
            >
                <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--primary)" }}>
                    Your free periods
                </h2>
                {scheduleByDay.length === 0 ? (
                    <p style={{ color: "#666" }}>
                        No free periods saved yet. Update your schedule in account setup.
                    </p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {scheduleByDay.map((day) => (
                            <li
                                key={day.day}
                                style={{
                                    border: "1px solid #e0e0e0",
                                    borderRadius: "10px",
                                    padding: "12px 16px",
                                    marginBottom: "10px",
                                }}
                            >
                                <strong>Day {day.day}:</strong> {day.periods.join(", ")}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

        </div>
    );
}

// TODO: Design this on Fi
function TeacherDashboard() {
    const [appointments, setAppointments] = useState<
        {
            id: string;
            day: number;
            period: PeriodValue;
            status: string;
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

    const acknowledgeCancelled = async (id: string) => {
        setActionMessage("");
        const response = await fetch("/api/user/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "acknowledge" }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            setActionMessage(errorText || "Failed to acknowledge booking.");
            return;
        }

        setAppointments((prev) => prev.filter((item) => item.id !== id));
        setActionMessage("Cancelled booking acknowledged.");
    };

    return (
        <div style={{ padding: "40px" }}>
            <h1 style={{ fontSize: "28px", marginBottom: "12px", color: "var(--primary)" }}>
                Teacher Dashboard
            </h1>
            <p style={{ marginBottom: "20px", color: "#555" }}>
                Set your available periods in account setup and review upcoming meetings here.
            </p>

            <Link
                href="/account/setup"
                style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "8px",
                    textDecoration: "none",
                    marginBottom: "24px",
                }}
            >
                Update availability
            </Link>

            <div
                style={{
                    border: "1px solid var(--primary)",
                    borderRadius: "12px",
                    padding: "20px",
                    background: "#fff",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
                }}
            >
                <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--primary)" }}>
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
                                    border: "1px solid #e0e0e0",
                                    borderRadius: "10px",
                                    padding: "12px 16px",
                                    marginBottom: "10px",
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>
                                    {appointment.status === "CANCELLED" ? "CANCELLED: " : ""}
                                    Day {appointment.day} • Period {appointment.period}
                                </div>
                                <div style={{ color: "#555" }}>
                                    Student: {appointment.studentName} ({appointment.studentEmail})
                                </div>
                                <div style={{ color: "#777", fontSize: "13px" }}>
                                    Status: {appointment.status}
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
                                {appointment.status === "CANCELLED" && (
                                    <button
                                        type="button"
                                        onClick={() => acknowledgeCancelled(appointment.id)}
                                        style={{
                                            marginTop: "8px",
                                            padding: "6px 10px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--primary)",
                                            background: "#fff",
                                            color: "var(--primary)",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Acknowledge
                                    </button>
                                )}
                                {appointment.status === "PENDING" && (
                                    <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                                        <input
                                            type="text"
                                            placeholder="Room (required to accept)"
                                            value={responses[appointment.id]?.room ?? ""}
                                            onChange={(event) => updateResponse(appointment.id, "room", event.target.value)}
                                            style={{
                                                padding: "8px 10px",
                                                borderRadius: "6px",
                                                border: "1px solid #ccc",
                                            }}
                                        />
                                        <textarea
                                            placeholder="Note (optional)"
                                            value={responses[appointment.id]?.note ?? ""}
                                            onChange={(event) => updateResponse(appointment.id, "note", event.target.value)}
                                            rows={3}
                                            style={{
                                                padding: "8px 10px",
                                                borderRadius: "6px",
                                                border: "1px solid #ccc",
                                                resize: "vertical",
                                            }}
                                        />
                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <button
                                                type="button"
                                                onClick={() => handleDecision(appointment.id, "confirm")}
                                                style={{
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    border: "none",
                                                    background: "var(--primary)",
                                                    color: "#fff",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDecision(appointment.id, "decline")}
                                                style={{
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    border: "1px solid #d32f2f",
                                                    background: "#fff",
                                                    color: "#d32f2f",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
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

function AdminDashboard() {
    return (
        <div style={{ padding: "40px" }}>
            <h1 style={{ fontSize: "28px", marginBottom: "12px", color: "var(--primary)" }}>
                Admin Dashboard
            </h1>
            <p style={{ marginBottom: "20px" }}>Review users and roles.</p>
            <Link
                href="/users"
                style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "6px",
                    textDecoration: "none",
                }}
            >
                Manage users
            </Link>
        </div>
    );
}