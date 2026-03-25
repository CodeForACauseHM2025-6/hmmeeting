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
        { label: "Users", href: "/teachers" },
        { label: "User Directory", href: "/users" },
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
        width: "260px",
        background: "linear-gradient(180deg, #3d0915 0%, #5b0d1f 100%)",
        color: "#fff",
        padding: "28px 20px",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "22px", fontWeight: 700, letterSpacing: "0.5px" }}>
          Horace Mann Scheduler
        </div>
        <div style={{ background: "var(--accent)", height: "3px", width: "40px", borderRadius: "2px", marginTop: "8px" }} />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "28px" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: "#fff",
                textDecoration: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                fontSize: "15px",
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                fontWeight: active ? 700 : 500,
                borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
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
        <div style={{ fontSize: "13px", opacity: 0.85, paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.15)" }}>Horace Mann School</div>
      </div>
    </aside>
  );
}
