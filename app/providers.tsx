"use client";

import { SessionProvider } from "next-auth/react";
import { GoogleOAuthProvider } from "@react-oauth/google";

export function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
  }
  console.log(googleClientId);

  return (
    <SessionProvider>
      <GoogleOAuthProvider clientId={googleClientId || ""}>
        {children}
      </GoogleOAuthProvider>
    </SessionProvider>
  );
}

