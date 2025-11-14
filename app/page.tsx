// src/app/page.tsx
// This will be a redirect page. www.url.com will either redirect to the login page or the the dashboard page. 
// If the user is logged in, redirect to the dashboard page.
// If not, redirect to login page.

import { auth } from "@/auth"; // NextAuth's server helper
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  redirect("/dashboard");
}