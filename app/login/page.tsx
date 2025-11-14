"use client";
// src/app/login/page.tsx
// Login page (using Google OAuth)for the user. 

import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  // Check if the user is already logged in
  // const router = useRouter();
  // const { data: session } = useSession();
  // if (session) {
  //   router.replace("/dashboard");
  // }

  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage: string | null = null;
  if (error === "AccessDenied") {
    errorMessage = "You must sign in with a Horace Mann email.";
  } else if (error) {
    errorMessage = "Something went wrong signing you in. Please try again.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 rounded-xl shadow-md bg-white">
        <h1 className="text-2xl font-semibold mb-4 text-center">Welcome</h1>
        {errorMessage && <p className="text-red-500 mb-4 text-center">{errorMessage}</p>}
        <GoogleLogin
            onSuccess={() => signIn("google", { callbackUrl: "/dashboard" })}
            onError={() => console.error('Login failed')}
            theme="outline"
            size="large"
            text="signin_with"
          />
      </div>
    </div>
  );
}