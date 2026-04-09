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

export default function Sidebar({ role, isAuthenticated }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = (() => {
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
      className="sidebar-desktop"
      style={{
        width: "260px",
        minWidth: "260px",
        background: "linear-gradient(180deg, #3d0915 0%, #5b0d1f 60%, #4a0e1a 100%)",
        color: "#fff",
        padding: "32px 20px 24px",
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
      }}
    >
      <div>
        <div style={{
          fontFamily: "var(--font-lora, Georgia, serif)",
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}>
          Horace Mann
          <br />
          <span style={{ fontSize: "15px", fontWeight: 500, opacity: 0.8 }}>Meeting Scheduler</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.25)", height: "2px", width: "36px", borderRadius: "1px", marginTop: "12px" }} />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "32px" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              style={{
                color: "#fff",
                textDecoration: "none",
                padding: "11px 14px",
                borderRadius: "8px",
                fontSize: "14px",
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                fontWeight: active ? 600 : 400,
                borderLeft: active ? "3px solid rgba(255,255,255,0.6)" : "3px solid transparent",
                letterSpacing: "0.01em",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {!isAuthenticated && (
          <Link href="/login" style={{ color: "#fff", textDecoration: "none", fontSize: "14px" }}>
            Login
          </Link>
        )}
        <div style={{ fontSize: "12px", opacity: 0.5, marginTop: "8px" }}>Horace Mann School</div>
      </div>
    </aside>
  );
}
