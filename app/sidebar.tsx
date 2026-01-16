"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  role: "STUDENT" | "TEACHER" | "ADMIN" | "GUEST";
  isAuthenticated: boolean;
};

type NavItem = {
  label: string;
  href: string;
};

const PRIMARY = "var(--primary)";

export default function Sidebar({ role, isAuthenticated }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = (() => {
    // Don't show navigation items for unauthenticated users
    if (!isAuthenticated || role === "GUEST") {
      return [];
    }

    if (role === "ADMIN") {
      return [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Teachers", href: "/teachers" },
        { label: "Admin Users", href: "/users" },
        { label: "Account Setup", href: "/account/setup" },
      ];
    }

    const base = [{ label: "Dashboard", href: "/dashboard" }];

    if (role === "STUDENT") {
      base.push({ label: "Teachers", href: "/teachers" });
    }

    base.push({ label: "Account Setup", href: "/account/setup" });

    return base;
  })();

  return (
    <aside
      style={{
        width: "220px",
        background: PRIMARY,
        color: "#fff",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minHeight: "100vh",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "0.5px" }}>
        Horace Mann Scheduler
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: "#fff",
                textDecoration: "none",
                padding: "8px 10px",
                borderRadius: "8px",
                background: active ? "rgba(255,255,255,0.2)" : "transparent",
                fontWeight: active ? 600 : 500,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        {!isAuthenticated && (
          <Link href="/login" style={{ color: "#fff", textDecoration: "none" }}>
            Login
          </Link>
        )}
        <div style={{ fontSize: "12px", opacity: 0.85 }}>Horace Mann School</div>
      </div>
    </aside>
  );
}
