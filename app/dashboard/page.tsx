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
        return <DashboardSkeleton />;
    }

    if (status === "unauthenticated" || !user) {
        return <DashboardSkeleton />;
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
            return <DashboardSkeleton />;
    }
}

function DashboardSkeleton() {
    return (
        <div style={{ padding: "48px 40px", maxWidth: "960px", margin: "0 auto" }}>
            <div className="skeleton" style={{ height: "40px", width: "280px", marginBottom: "12px" }} />
            <div className="skeleton" style={{ height: "16px", width: "180px", marginBottom: "36px" }} />
            <div style={{
                background: "var(--surface-warm)",
                borderRadius: "14px",
                padding: "28px",
                marginBottom: "20px",
            }}>
                <div className="skeleton" style={{ height: "22px", width: "200px", marginBottom: "20px" }} />
                <div className="skeleton" style={{ height: "72px", width: "100%", marginBottom: "10px" }} />
                <div className="skeleton" style={{ height: "72px", width: "100%" }} />
            </div>
            <div style={{
                background: "var(--surface-warm)",
                borderRadius: "14px",
                padding: "28px",
            }}>
                <div className="skeleton" style={{ height: "22px", width: "180px", marginBottom: "20px" }} />
                <div className="skeleton" style={{ height: "52px", width: "100%" }} />
            </div>
        </div>
    );
}

function AdminRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/users");
    }, [router]);
    return <DashboardSkeleton />;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; color: string; label: string }> = {
        CANCELLED: { bg: "#fef2f2", color: "var(--danger)", label: "Cancelled" },
        COMPLETED: { bg: "#f0fdf4", color: "var(--success)", label: "Completed" },
        CONFIRMED: { bg: "var(--accent-soft)", color: "var(--primary)", label: "Confirmed" },
        PENDING: { bg: "var(--surface-warm)", color: "var(--muted)", label: "Pending" },
    };
    const c = config[status] ?? config.PENDING;
    return (
        <span style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: c.bg,
            color: c.color,
            marginRight: "8px",
        }}>
            {c.label}
        </span>
    );
}

// Student Dashboard
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
        <div style={{ padding: "48px 40px", maxWidth: "960px", margin: "0 auto" }}>
            {/* Greeting */}
            <h1 style={{
                fontFamily: "var(--font-lora, Georgia, serif)",
                fontSize: "36px",
                fontWeight: 700,
                color: "var(--primary)",
                marginBottom: "4px",
                letterSpacing: "-0.02em",
            }}>
                {getGreeting()}, {firstName}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "36px" }}>
                Here&apos;s what&apos;s on your schedule.
            </p>

            {/* Upcoming meetings — elevated card */}
            <div style={{
                borderRadius: "14px",
                padding: "28px",
                background: "var(--surface)",
                boxShadow: "0 1px 3px rgba(91,13,31,0.04), 0 4px 20px rgba(91,13,31,0.06)",
                border: "1px solid var(--border-light)",
            }}>
                <h2 style={{
                    fontFamily: "var(--font-lora, Georgia, serif)",
                    fontSize: "20px",
                    fontWeight: 600,
                    marginBottom: "20px",
                    color: "var(--foreground)",
                }}>
                    Upcoming meetings
                </h2>
                {showBookingNotice && (
                    <div style={{
                        background: "#f0fdf4",
                        color: "var(--success)",
                        border: "1px solid #bbf7d0",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        fontWeight: 600,
                        fontSize: "14px",
                        marginBottom: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
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
                                fontSize: "18px",
                                lineHeight: 1,
                            }}
                        >
                            &times;
                        </button>
                    </div>
                )}
                {actionMessage && (
                    <div style={{ color: "var(--primary)", fontSize: "14px", fontWeight: 500, marginBottom: "12px" }}>{actionMessage}</div>
                )}
                {appointments.length === 0 ? (
                    <div style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: "var(--muted)",
                        background: "var(--surface-warm)",
                        borderRadius: "10px",
                    }}>
                        <p style={{ fontSize: "15px", marginBottom: "8px" }}>No upcoming meetings yet.</p>
                        <Link href="/teachers" style={{
                            color: "var(--primary)",
                            fontWeight: 600,
                            fontSize: "14px",
                            textDecoration: "none",
                        }}>
                            Find a teacher to book a meeting
                        </Link>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {appointments.map((appointment) => (
                            <div
                                key={appointment.id}
                                style={{
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "10px",
                                    padding: "16px 20px",
                                    background: "var(--surface)",
                                    transition: "border-color 0.15s ease",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                    <StatusBadge status={appointment.status} />
                                    <span style={{ fontSize: "15px", fontWeight: 600 }}>
                                        Day {appointment.day} &middot; {appointment.period === "BREAK" ? "Break" : `Period ${appointment.period}`}
                                    </span>
                                </div>
                                {appointment.meetingDate && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "4px" }}>
                                        {appointment.meetingDate}
                                        {appointment.meetingTime ? ` \u00b7 ${appointment.meetingTime}` : ""}
                                    </div>
                                )}
                                <div style={{ color: "var(--foreground)", fontSize: "14px", marginBottom: "2px" }}>
                                    {appointment.teacherName}
                                    <span style={{ color: "var(--muted)", fontSize: "13px" }}> ({appointment.teacherEmail})</span>
                                </div>
                                {appointment.room && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px" }}>
                                        Room {appointment.room}
                                    </div>
                                )}
                                {appointment.studentNote && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
                                        Your note: {appointment.studentNote}
                                    </div>
                                )}
                                {appointment.teacherNote && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
                                        Teacher note: {appointment.teacherNote}
                                    </div>
                                )}
                                {/* Action buttons */}
                                {appointment.status === "CANCELLED" ? (
                                    <button
                                        type="button"
                                        className="btn-outline"
                                        onClick={() => acknowledgeAppointment(appointment.id, "Cancelled booking acknowledged.")}
                                        style={{
                                            marginTop: "10px",
                                            padding: "8px 16px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            background: "var(--surface)",
                                            color: "var(--foreground)",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                            fontSize: "13px",
                                        }}
                                    >
                                        Acknowledge
                                    </button>
                                ) : appointment.status === "COMPLETED" ? (
                                    appointment.completedBy !== "STUDENT" ? (
                                        <button
                                            type="button"
                                            className="btn-outline"
                                            onClick={() => acknowledgeAppointment(appointment.id, "Completed meeting acknowledged.")}
                                            style={{
                                                marginTop: "10px",
                                                padding: "8px 16px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--border)",
                                                background: "var(--surface)",
                                                color: "var(--foreground)",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                            }}
                                        >
                                            Acknowledge
                                        </button>
                                    ) : null
                                ) : pendingCancelId === appointment.id ? (
                                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                                        <button
                                            type="button"
                                            className="btn-fill"
                                            onClick={() => cancelAppointment(appointment.id)}
                                            style={{
                                                padding: "8px 16px",
                                                borderRadius: "6px",
                                                border: "none",
                                                background: "var(--danger)",
                                                color: "#fff",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                            }}
                                        >
                                            Confirm cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-outline"
                                            onClick={() => setPendingCancelId(null)}
                                            style={{
                                                padding: "8px 16px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--border)",
                                                background: "var(--surface)",
                                                color: "var(--muted)",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                            }}
                                        >
                                            Keep meeting
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                                        {appointment.status === "CONFIRMED" && (
                                            <button
                                                type="button"
                                                className="btn-fill"
                                                onClick={() => completeAppointment(appointment.id)}
                                                style={{
                                                    padding: "8px 16px",
                                                    borderRadius: "6px",
                                                    border: "none",
                                                    background: "var(--primary)",
                                                    color: "#fff",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Mark as completed
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn-danger-outline"
                                            onClick={() => setPendingCancelId(appointment.id)}
                                            style={{
                                                padding: "8px 16px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--danger)",
                                                background: "var(--surface)",
                                                color: "var(--danger)",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Free periods — inset/flat card for variety */}
            <div style={{
                marginTop: "20px",
                borderRadius: "14px",
                padding: "24px 28px",
                background: "var(--surface-warm)",
                border: "1px solid var(--border-light)",
            }}>
                <h2 style={{
                    fontFamily: "var(--font-lora, Georgia, serif)",
                    fontSize: "18px",
                    fontWeight: 600,
                    marginBottom: "16px",
                    color: "var(--foreground)",
                }}>
                    Your free periods
                </h2>
                {scheduleByDay.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: "14px" }}>
                        No free periods saved yet.{" "}
                        <Link href="/account/setup" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                            Update your schedule
                        </Link>
                    </p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {scheduleByDay.map((day) => (
                            <div
                                key={day.day}
                                style={{
                                    background: "var(--surface)",
                                    borderRadius: "8px",
                                    padding: "12px 16px",
                                    border: "1px solid var(--border-light)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                <span style={{
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    color: "var(--primary)",
                                    minWidth: "48px",
                                }}>
                                    Day {day.day}
                                </span>
                                <span style={{ color: "var(--muted)", fontSize: "14px" }}>
                                    {day.periods.map((p) => p === "BREAK" ? "Break" : p).join(", ")}
                                </span>
                            </div>
                        ))}
                    </div>
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
        <div style={{ padding: "48px 40px", maxWidth: "960px", margin: "0 auto" }}>
            <h1 style={{
                fontFamily: "var(--font-lora, Georgia, serif)",
                fontSize: "36px",
                fontWeight: 700,
                color: "var(--primary)",
                marginBottom: "4px",
                letterSpacing: "-0.02em",
            }}>
                {getGreeting()}, {firstName}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "28px" }}>
                Manage your meeting requests and availability.
            </p>

            <Link
                href="/account/setup"
                className="btn-fill"
                style={{
                    display: "inline-block",
                    padding: "12px 20px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "8px",
                    textDecoration: "none",
                    marginBottom: "28px",
                    fontWeight: 600,
                    fontSize: "14px",
                }}
            >
                Update availability
            </Link>

            {/* Meetings card */}
            <div style={{
                borderRadius: "14px",
                padding: "28px",
                background: "var(--surface)",
                boxShadow: "0 1px 3px rgba(91,13,31,0.04), 0 4px 20px rgba(91,13,31,0.06)",
                border: "1px solid var(--border-light)",
            }}>
                <h2 style={{
                    fontFamily: "var(--font-lora, Georgia, serif)",
                    fontSize: "20px",
                    fontWeight: 600,
                    marginBottom: "20px",
                    color: "var(--foreground)",
                }}>
                    Upcoming meetings
                </h2>
                {actionMessage && (
                    <div style={{ color: "var(--primary)", fontSize: "14px", fontWeight: 500, marginBottom: "12px" }}>{actionMessage}</div>
                )}
                {appointments.length === 0 ? (
                    <div style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: "var(--muted)",
                        background: "var(--surface-warm)",
                        borderRadius: "10px",
                    }}>
                        <p style={{ fontSize: "15px" }}>No upcoming meetings yet.</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {appointments.map((appointment) => (
                            <div
                                key={appointment.id}
                                style={{
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "10px",
                                    padding: "16px 20px",
                                    background: "var(--surface)",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                    <StatusBadge status={appointment.status} />
                                    <span style={{ fontSize: "15px", fontWeight: 600 }}>
                                        Day {appointment.day} &middot; {appointment.period === "BREAK" ? "Break" : `Period ${appointment.period}`}
                                    </span>
                                </div>
                                {appointment.meetingDate && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "4px" }}>
                                        {appointment.meetingDate}
                                        {appointment.meetingTime ? ` \u00b7 ${appointment.meetingTime}` : ""}
                                    </div>
                                )}
                                <div style={{ color: "var(--foreground)", fontSize: "14px", marginBottom: "2px" }}>
                                    {appointment.studentName}
                                    <span style={{ color: "var(--muted)", fontSize: "13px" }}> ({appointment.studentEmail})</span>
                                </div>
                                {appointment.room && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px" }}>
                                        Room {appointment.room}
                                    </div>
                                )}
                                {appointment.studentNote && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
                                        Student note: {appointment.studentNote}
                                    </div>
                                )}
                                {appointment.teacherNote && (
                                    <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
                                        Your note: {appointment.teacherNote}
                                    </div>
                                )}
                                {/* Action buttons by status */}
                                {appointment.status === "CANCELLED" ? (
                                    <button
                                        type="button"
                                        className="btn-outline"
                                        onClick={() => acknowledgeAppointment(appointment.id, "Cancelled booking acknowledged.")}
                                        style={{
                                            marginTop: "10px",
                                            padding: "8px 16px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            background: "var(--surface)",
                                            color: "var(--foreground)",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                            fontSize: "13px",
                                        }}
                                    >
                                        Acknowledge
                                    </button>
                                ) : appointment.status === "COMPLETED" ? (
                                    appointment.completedBy !== "TEACHER" ? (
                                        <button
                                            type="button"
                                            className="btn-outline"
                                            onClick={() => acknowledgeAppointment(appointment.id, "Completed meeting acknowledged.")}
                                            style={{
                                                marginTop: "10px",
                                                padding: "8px 16px",
                                                borderRadius: "6px",
                                                border: "1px solid var(--border)",
                                                background: "var(--surface)",
                                                color: "var(--foreground)",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                            }}
                                        >
                                            Acknowledge
                                        </button>
                                    ) : null
                                ) : appointment.status === "CONFIRMED" ? (
                                    <button
                                        type="button"
                                        className="btn-fill"
                                        onClick={() => completeAppointment(appointment.id)}
                                        style={{
                                            marginTop: "10px",
                                            padding: "8px 16px",
                                            borderRadius: "6px",
                                            border: "none",
                                            background: "var(--primary)",
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontWeight: 600,
                                            fontSize: "13px",
                                        }}
                                    >
                                        Mark as completed
                                    </button>
                                ) : null}
                                {/* Pending: show accept/decline with room input */}
                                {appointment.status === "PENDING" && (
                                    <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                                        <input
                                            type="text"
                                            placeholder="Room (required to accept)"
                                            value={responses[appointment.id]?.room ?? ""}
                                            onChange={(event) => updateResponse(appointment.id, "room", event.target.value)}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: "8px",
                                                border: "1px solid var(--border)",
                                                fontSize: "14px",
                                            }}
                                        />
                                        <textarea
                                            placeholder="Note (optional)"
                                            value={responses[appointment.id]?.note ?? ""}
                                            onChange={(event) => updateResponse(appointment.id, "note", event.target.value)}
                                            rows={2}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: "8px",
                                                border: "1px solid var(--border)",
                                                resize: "vertical",
                                                fontSize: "14px",
                                            }}
                                        />
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                type="button"
                                                className="btn-fill"
                                                onClick={() => handleDecision(appointment.id, "confirm")}
                                                style={{
                                                    padding: "8px 16px",
                                                    borderRadius: "6px",
                                                    border: "none",
                                                    background: "var(--primary)",
                                                    color: "#fff",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-danger-outline"
                                                onClick={() => handleDecision(appointment.id, "decline")}
                                                style={{
                                                    padding: "8px 16px",
                                                    borderRadius: "6px",
                                                    border: "1px solid var(--danger)",
                                                    background: "var(--surface)",
                                                    color: "var(--danger)",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function AdminDashboard({ firstName }: { firstName: string }) {
    return (
        <div style={{ padding: "48px 40px" }}>
            <h1 style={{
                fontFamily: "var(--font-lora, Georgia, serif)",
                fontSize: "36px",
                fontWeight: 700,
                color: "var(--primary)",
                marginBottom: "4px",
                letterSpacing: "-0.02em",
            }}>
                {getGreeting()}, {firstName}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "28px" }}>Admin dashboard</p>
            <Link
                href="/users"
                className="btn-fill"
                style={{
                    display: "inline-block",
                    padding: "12px 20px",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                }}
            >
                Manage users
            </Link>
        </div>
    );
}
