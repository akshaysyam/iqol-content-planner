// app/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  FileText, 
  Settings, 
  LogOut, 
  BarChart3, 
  Briefcase, 
  ShieldCheck, 
  BookOpen,
  FileCheck
} from "lucide-react";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const getNavLinks = () => {
    switch (role) {
      case "Platform Admin":
      case "Content Manager":
        return [
          { name: "Topics", href: "/manager", icon: <FileText className="w-5 h-5" /> },
          { name: "Review", href: "/manager/review", icon: <FileCheck className="w-5 h-5" /> },
          { name: "Keywords", href: "/admin", icon: <BookOpen className="w-5 h-5" /> },
          { name: "Users", href: "/users", icon: <Users className="w-5 h-5" /> },
          { name: "Author View", href: "/writer", icon: <Briefcase className="w-5 h-5" /> },
          { name: "Legal Review", href: "/lawyer", icon: <ShieldCheck className="w-5 h-5" /> },
        ];
      case "Content Writer":
        return [
          { name: "Tasks", href: "/writer", icon: <FileText className="w-5 h-5" /> },
        ];
      case "Lawyer":
        return [
          { name: "Legal Review", href: "/lawyer", icon: <ShieldCheck className="w-5 h-5" /> },
        ];
      default:
        return [];
    }
  };

  const links = getNavLinks();

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-slate-200 shadow-sm fixed top-0 left-0 z-10 transition-all duration-300">
      <div className="p-6 flex items-center justify-between border-b border-slate-100">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            IQOL Content Planner
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
            {role}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className={`${isActive ? "text-blue-600" : "text-slate-400"}`}>
                {link.icon}
              </div>
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
          Logout
        </button>
      </div>
    </div>
  );
}
