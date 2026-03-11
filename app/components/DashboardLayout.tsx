// app/components/DashboardLayout.tsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ 
  children, 
  requiredRoles 
}: { 
  children: React.ReactNode, 
  requiredRoles?: string[] 
}) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        router.push("/");
        return;
      }

      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          const userRole = userData.role;

          if (requiredRoles && !requiredRoles.includes("Any") && !requiredRoles.includes(userRole)) {
            // Check if they are authorized
            router.push("/"); // Or an unauthorized page
            return;
          }

          setRole(userRole);
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Error fetching role", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, requiredRoles]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // Not logged in or waiting to redirect
  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar role={role} />
      <div className="flex-1 pl-64">
        <main className="mx-auto max-w-7xl p-8">{children}</main>
      </div>
    </div>
  );
}
