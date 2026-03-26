"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NotificationItem = {
  id: string;
  message: string;
  status: string;
  day: number;
  period: string;
  updatedAt: string;
  meetingDate?: string | null;
  meetingTime?: string | null;
};

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  const loadNotifications = async () => {
    const response = await fetch("/api/user/notifications");
    if (response.status === 401) {
      setVisible(false);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as NotificationItem[];
    setNotifications(data.filter((item) => !dismissedIds.has(item.id)));
    setVisible(true);
  };

  useEffect(() => {
    loadNotifications();
  }, [pathname]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  if (!visible) {
    return null;
  }

  return (
    <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 60 }}>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "2px solid var(--primary)",
            background: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(91,13,31,0.1)",
          }}
          aria-label="Notifications"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 22a2.5 2.5 0 0 0 2.4-1.8h-4.8A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
              fill="var(--primary)"
            />
          </svg>
        </button>
        {notifications.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#d32f2f",
              border: "2px solid #fff",
            }}
          />
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            marginTop: "10px",
            width: "320px",
            background: "#fff",
            border: "2px solid var(--primary)",
            borderRadius: "14px",
            boxShadow: "0 12px 40px rgba(91,13,31,0.15)",
            padding: "16px",
          }}
        >
          <div style={{ fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--primary)" }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ color: "#666" }}>No notifications yet.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {notifications.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border:
                      hoveredId === item.id
                        ? "2px solid var(--primary)"
                        : "2px solid #f0ece6",
                    marginBottom: "8px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    setDismissedIds((prev) => new Set(prev).add(item.id));
                    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.message}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                    {item.meetingDate ? (
                      <>
                        {item.meetingDate}
                        {item.meetingTime ? ` • ${item.meetingTime}` : ""}
                      </>
                    ) : (
                      <>
                        Day {item.day} • {item.period === "BREAK" ? "Break" : `Period ${item.period}`}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
