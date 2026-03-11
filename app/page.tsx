// app/page.tsx
"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock, ArrowRight, Activity } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("User authenticated, but no role assigned in database.");
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userRole = userData.role;

      switch (userRole) {
        case "Platform Admin":
          router.push("/admin");
          break;
        case "Content Manager":
          router.push("/manager");
          break;
        case "Content Writer":
          router.push("/writer");
          break;
        case "Lawyer":
          router.push("/lawyer");
          break;
        default:
          setError("Unknown user role.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left side - Login Form */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Activity className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">IQOL Content Planner</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Please sign in to access your secure dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                <ShieldCheck className="h-4 w-4" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border-slate-200 pl-10 px-4 py-3 text-sm focus:border-blue-600 focus:ring-blue-600 border bg-white shadow-sm outline-none transition-all placeholder:text-slate-400"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border-slate-200 pl-10 px-4 py-3 text-sm focus:border-blue-600 focus:ring-blue-600 border bg-white shadow-sm outline-none transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? "Authenticating..." : "Sign In"}
              {!loading && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:items-center relative bg-slate-900 overflow-hidden">
        {/* Abstract decorative background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-slate-900 to-indigo-900/50 z-0"></div>
        <div className="absolute top-0 right-0 -m-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -m-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl"></div>
        
        <div className="relative z-10 p-12 text-center">
          <h3 className="mb-4 text-3xl font-bold text-white tracking-tight">
            Streamlined Content Workflows
          </h3>
          <p className="mx-auto max-w-md text-slate-300">
            A secure gateway for writers, managers, and legal reviewers to collaborate seamlessly and publish compliant content faster.
          </p>
        </div>
        
        {/* Placeholder UI overlapping graphic */}
        <div className="relative z-10 w-[120%] h-64 mt-12 transform rotate-[-3deg] rounded-tl-xl rounded-tr-xl bg-slate-800/80 backdrop-blur-sm border-t border-l border-r border-slate-700 shadow-2xl overflow-hidden flex flex-col pt-4">
          <div className="flex items-center gap-2 px-6 pb-4 border-b border-slate-700/50">
            <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
            <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
            <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="flex-1 p-6 flex gap-4">
             <div className="w-1/4 h-full rounded bg-slate-700/50"></div>
             <div className="flex-1 flex flex-col gap-3">
               <div className="h-8 w-3/4 rounded bg-slate-700/50"></div>
               <div className="h-4 w-full rounded bg-slate-700/30 line-clamp-3"></div>
               <div className="h-4 w-5/6 rounded bg-slate-700/30"></div>
               <div className="mt-auto h-10 w-32 rounded bg-blue-600/80"></div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
