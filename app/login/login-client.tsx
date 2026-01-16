"use client";

import { signIn } from "next-auth/react";
import { GoogleLogin } from "@react-oauth/google";
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
        <GoogleLogin
          onSuccess={() => signIn("google", { callbackUrl: "/dashboard" })}
          onError={() => console.error("Login failed")}
          theme="outline"
          size="large"
          text="signin_with"
        />

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
