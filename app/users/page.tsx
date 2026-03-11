// app/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import DashboardLayout from "../components/DashboardLayout";
import { Users as UsersIcon, Plus, ShieldCheck, Mail, Lock, CheckCircle2, User, MoreVertical, Trash2, Key, UserX, UserCheck } from "lucide-react";

// The firebase config used to spin up a secondary app
const firebaseConfig = {
  apiKey: "AIzaSyCWJBQht7zbvSFm_m5vBvy_1oiuxILnUGw",
  authDomain: "content-quality-tracker.firebaseapp.com",
  projectId: "content-quality-tracker",
  storageBucket: "content-quality-tracker.firebasestorage.app",
  messagingSenderId: "391313409574",
  appId: "1:391313409574:web:867d0ac3bacd8cf32b08e7",
};

export default function Users() {
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [allowedBrands, setAllowedBrands] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assignedRole, setAssignedRole] = useState("Content Writer");
  const [brand, setBrand] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const userQuery = query(collection(db, "users"), where("email", "==", user.email.toLowerCase()));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          setCurrentUserRole(userData.role);
          setAllowedBrands(userData.brands || []);
          if (userData.brands && userData.brands.length > 0) {
            setBrand(userData.brands[0]);
          }
          fetchUsers();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      // 1. Initialize secondary Firebase app (So current user doesn't get logged out)
      const apps = getApps();
      const secondaryApp = apps.find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = userCredential.user.uid;

      // 3. Immediately sign out of secondary app
      await signOut(secondaryAuth);

      // 4. Save User Profile to Firestore using the primary app connection
      // For content writers/lawyers, limit the brand to the manager's brand if applicable. 
      // Platform Admins usually don't need a specific brand to function globally.
      const brandsArray = brand ? [brand] : [];

      await addDoc(collection(db, "users"), {
        name: name.trim(),
        email: email.toLowerCase(),
        role: assignedRole,
        brands: brandsArray,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      alert("User created and assigned successfully!");
      setName("");
      setEmail("");
      setPassword("");
      setAssignedRole("Content Writer");
      fetchUsers();
    } catch (err: any) {
      console.error("Error creating user:", err);
      setError(err.message || "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (userEmail: string) => {
    try {
      if (confirm(`Send a password reset email to ${userEmail}?`)) {
        await sendPasswordResetEmail(auth, userEmail);
        alert(`Password reset email sent to ${userEmail}`);
      }
    } catch (err: any) {
      console.error("Error sending reset email:", err);
      alert(err.message || "Failed to send reset email.");
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean, userEmail: string) => {
    try {
      const newStatus = !currentStatus;
      const confirmMessage = newStatus 
        ? `Enable account for ${userEmail}?` 
        : `Disable account for ${userEmail}? They will no longer be able to log in.`;
      
      if (confirm(confirmMessage)) {
        await updateDoc(doc(db, "users", userId), { isActive: newStatus });
        fetchUsers();
      }
    } catch (err: any) {
      console.error("Error updating user status:", err);
      alert("Failed to update user status.");
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      if (confirm(`WARNING: Are you sure you want to permanently delete the profile for ${userEmail}? This action cannot be undone.`)) {
        await deleteDoc(doc(db, "users", userId));
        fetchUsers();
      }
    } catch (err: any) {
      console.error("Error deleting user:", err);
      alert("Failed to delete user directory profile.");
    }
  };

  // Determine what roles the current user can create
  const assignableRoles = currentUserRole === "Platform Admin" 
    ? ["Platform Admin", "Content Manager", "Content Writer", "Lawyer"]
    : ["Content Writer", "Lawyer"];

  return (
    <DashboardLayout requiredRoles={["Platform Admin", "Content Manager"]}>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            User Management
          </h1>
          <p className="mt-2 text-slate-500">
            Create new team members and assign role-based access.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Create User Form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 lg:col-span-1 h-fit">
          <div className="mb-6 flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Plus className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Create New User</h2>
          </div>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Full Name</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                  placeholder="writer@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Temporary Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <div className="h-px bg-slate-100 my-4"></div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-slate-400" /> Access Role
              </label>
              <select
                value={assignedRole}
                onChange={(e) => setAssignedRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {assignedRole !== "Platform Admin" && (
              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Brand Assignment</label>
                <select
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                >
                  <option value="" disabled>Select brand...</option>
                  {(currentUserRole === "Platform Admin" ? ["Canvas Homes", "Vault Proptech"] : allowedBrands).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-70"
            >
              {creating ? "Provisioning User..." : "Create User"}
            </button>
          </form>
        </div>

        {/* Right Column: User Directory */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-slate-500" /> User Directory
            </h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
              {users.length} Total
            </span>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600 whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Account Holder</th>
                  <th className="px-6 py-4">System Role</th>
                  <th className="px-6 py-4">Assigned Brands</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                   <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading directory...</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{u.name || "Unknown"}</span>
                          <span className="text-xs text-slate-500">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            u.role === "Platform Admin"
                              ? "bg-purple-50 text-purple-700 ring-purple-500/20"
                              : u.role === "Content Manager"
                              ? "bg-blue-50 text-blue-700 ring-blue-500/20"
                              : "bg-slate-50 text-slate-700 ring-slate-500/20"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {u.brands && u.brands.length > 0 ? (
                          <div className="flex gap-1">
                            {u.brands.map((b: string) => (
                              <span key={b} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Global</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.isActive !== false ? (
                          <span className="inline-flex items-center text-emerald-600 gap-1 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-md ring-1 ring-inset ring-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-500 gap-1 text-xs font-medium bg-slate-100 px-2 py-1 rounded-md ring-1 ring-inset ring-slate-500/20">
                            <UserX className="h-3.5 w-3.5" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* Actions Placeholder */}
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleResetPassword(u.email)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(u.id, u.isActive !== false, u.email)}
                            className={`p-1.5 rounded-lg transition-colors ${u.isActive !== false ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            title={u.isActive !== false ? "Disable User" : "Enable User"}
                          >
                            {u.isActive !== false ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
