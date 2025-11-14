"use client";
// src/app/login/page.tsx
// Login page (using Google OAuth)for the user. 

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {

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
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-4 py-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}