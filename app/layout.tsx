import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/auth";
import Sidebar from "./sidebar";
import { resolveRole } from "@/src/config/roles";
import NotificationsBell from "./notifications-bell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Meeting Scheduler",
  description: "Schedule meetings with teachers at Horace Mann",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  let role: "STUDENT" | "TEACHER" | "ADMIN" | "GUEST" = "GUEST";

  if (session?.user?.email) {
    role = resolveRole(session.user.email);
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} antialiased`}
      >
        <Providers>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              minHeight: "100vh",
              background: "var(--background)",
            }}
          >
            <Sidebar role={role} isAuthenticated={Boolean(session?.user?.email)} />
            <main style={{ flex: 1, minHeight: "100vh", background: "var(--surface)", padding: "32px 40px" }}>
              <NotificationsBell />
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
