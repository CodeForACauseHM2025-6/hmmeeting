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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--primary-soft)" }}>
      <div
        className="p-6 rounded-xl shadow-md bg-white"
        style={{ border: "1px solid var(--primary)", minWidth: "320px" }}
      >
        <h1 className="text-2xl font-semibold mb-4 text-center" style={{ color: "var(--primary)" }}>
          Welcome
        </h1>
        {errorMessage && <p className="text-red-500 mb-4 text-center">{errorMessage}</p>}
        <button
          onClick={handleGoogleSignIn}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #dadce0",
            backgroundColor: "#fff",
            color: "#3c4043",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)",
            transition: "box-shadow 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.boxShadow = "0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)";
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
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px", color: "var(--primary)" }}>
              Dev logins
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {devUsers.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() =>
                    signIn("dev-credentials", {
                      email: user.email,
                      callbackUrl: "/dashboard",
                    })
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {user.fullName}
                  <div style={{ fontSize: "12px", color: "#666" }}>{user.email}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
