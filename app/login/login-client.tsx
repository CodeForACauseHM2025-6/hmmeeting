"use client";

import { signIn } from "next-auth/react";
import { DEV_USERS } from "@/src/config/devUsers";

type LoginClientProps = {
  error: string | null;
};

export default function LoginClient({ error }: LoginClientProps) {
  const isDev = process.env.NODE_ENV !== "production";
  const devUsers = DEV_USERS;

  let errorMessage: string | null = null;
  if (error === "AccessDenied") {
    errorMessage = "You must sign in with a Horace Mann email.";
  } else if (error) {
    errorMessage = "Something went wrong signing you in. Please try again.";
  }

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background)",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* School identity mark */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{
            fontFamily: "var(--font-lora, Georgia, serif)",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--primary)",
            letterSpacing: "-0.02em",
            marginBottom: "6px",
          }}>
            Horace Mann
          </h1>
          <p style={{
            color: "var(--muted)",
            fontSize: "14px",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}>
            Meeting Scheduler
          </p>
        </div>

        {/* Login card */}
        <div style={{
          background: "var(--surface)",
          borderRadius: "16px",
          padding: "36px 32px",
          boxShadow: "0 1px 3px rgba(91,13,31,0.06), 0 8px 32px rgba(91,13,31,0.08)",
          border: "1px solid var(--border-light)",
        }}>
          {errorMessage && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "12px 16px",
              fontWeight: 600,
              color: "var(--danger)",
              fontSize: "14px",
              marginBottom: "20px",
            }}>
              {errorMessage}
            </div>
          )}
          <button
            className="btn-outline"
            onClick={handleGoogleSignIn}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              backgroundColor: "#fff",
              color: "var(--foreground)",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <g fill="#000" fillRule="evenodd">
                <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"/>
                <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.18-1.79 2.91l2.73 2.07c1.63-1.5 2.74-3.7 2.74-6.48z" fill="#4285F4"/>
                <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"/>
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.73-2.07c-.76.53-1.78.9-3.23.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"/>
              </g>
            </svg>
            Sign in with Google
          </button>

          {isDev && (
            <div style={{ marginTop: "24px" }}>
              <div style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--muted)",
                marginBottom: "10px",
                letterSpacing: "0.03em",
              }}>
                Dev logins
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {devUsers.map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    className="card-hover"
                    onClick={() =>
                      signIn("dev-credentials", {
                        email: user.email,
                        callbackUrl: "/dashboard",
                      })
                    }
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-light)",
                      background: "var(--surface-warm)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{user.fullName}</span>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{user.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
