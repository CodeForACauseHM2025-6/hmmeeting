// src/app/dashboard/page.tsx
// Dashboard page for the user. Differentiate page content based on user role. 

"use client";

import { useSession } from "next-auth/react";
import { prisma } from "@/src/server/db";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
    id: string;
    email: string;
    fullName: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
  };

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    const { data: session, status } = useSession(); // gets the user's session
    const router = useRouter();

    if (status === "unauthenticated") { // if the user is not logged in, redirect to the login page
        router.replace("/login");
    }

    // Fetch user data from API
  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetch("/api/user/information")
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            router.push("/account/setup");
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setUser(data);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching user:", error);
          setLoading(false);
        });
    }
  }, [status, session, router]);

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!user) {
    router.push("/profilepage");
    return;
    
  }

    switch (user.role) {
        case "STUDENT":
            return StudentDashboard();
        case "TEACHER":
            return TeacherDashboard();
        case "ADMIN":
            return AdminDashboard();
        default: // No role found; ask the user to setup his account. (Add in a setup page)
            router.push("/account/setup");
    }
}

// Student Dashboard. This displays the student's dashboard (ref. "Brighten Example Profile Page - Unael" on the Figma)
function StudentDashboard() {
    return (
        <div>
            <h1>Student Dashboard</h1>
        </div>
    );
}

// TODO: Design this on Fi
function TeacherDashboard() {
    return (
        <div>
            <h1>Teacher Dashboard</h1>
        </div>
    );
}

function AdminDashboard() {
    return (
        <div>
            <h1>Admin Dashboard</h1>
        </div>
    );
}