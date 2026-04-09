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
    <div style={{ position: "fixed", top: "18px", right: "18px", zIndex: 60 }}>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="bell-btn"
          onClick={() => setOpen((prev) => !prev)}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 4px rgba(91,13,31,0.06)",
          }}
          aria-label="Notifications"
        >
          <svg
            width="18"
            height="18"
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
              top: "-2px",
              right: "-2px",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "var(--danger)",
              border: "2px solid var(--surface)",
            }}
          />
        )}
      </div>

      {open && (
        <div
          className="dropdown-enter"
          style={{
            position: "absolute",
            right: 0,
            marginTop: "8px",
            width: "320px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(91,13,31,0.12)",
            padding: "16px",
          }}
        >
          <div style={{
            fontFamily: "var(--font-lora, Georgia, serif)",
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "10px",
            color: "var(--foreground)",
          }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: "14px", padding: "8px 0" }}>No notifications yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="card-hover"
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-light)",
                    background: "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onClick={() => {
                    setDismissedIds((prev) => new Set(prev).add(item.id));
                    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)" }}>{item.message}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                    {item.meetingDate ? (
                      <>
                        {item.meetingDate}
                        {item.meetingTime ? ` \u00b7 ${item.meetingTime}` : ""}
                      </>
                    ) : (
                      <>
                        Day {item.day} &middot; {item.period === "BREAK" ? "Break" : `Period ${item.period}`}
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
