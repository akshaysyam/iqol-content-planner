// app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import DashboardLayout from "../components/DashboardLayout";
import { Plus, TrendingUp, Search, Activity, BookOpen, AlertCircle } from "lucide-react";

interface Keyword {
  id: string;
  word: string;
  volume: number;
  difficulty: number;
  intent: string;
  trend: string;
}

export default function AdminDashboard() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [word, setWord] = useState("");
  const [volume, setVolume] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [intent, setIntent] = useState("Informational");
  const [trend, setTrend] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchKeywords = async () => {
    const querySnapshot = await getDocs(collection(db, "keywords"));
    const keywordsData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Keyword[];
    setKeywords(keywordsData);
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "keywords"), {
        word: word,
        volume: Number(volume),
        difficulty: Number(difficulty),
        intent: intent,
        trend: trend,
      });
      setWord("");
      setVolume("");
      setDifficulty("");
      setIntent("Informational");
      setTrend("");
      fetchKeywords();
    } catch (error) {
      console.error("Error adding keyword: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout requiredRoles={["Platform Admin", "Content Manager"]}>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Platform Admin
          </h1>
          <p className="mt-2 text-slate-500">
            Manage global settings, keywords, and user access.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="mr-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Keywords</p>
            <p className="text-2xl font-bold text-slate-900">{keywords.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Add Keyword Form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 lg:col-span-1">
          <div className="mb-6 flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Plus className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Add Keyword</h2>
          </div>
          
          <form onSubmit={handleAddKeyword} className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Keyword</label>
              <input
                type="text"
                required
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                placeholder="e.g. best property in pune"
              />
            </div>

            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block mb-1 text-sm font-medium text-slate-700">Vol / mo</label>
                <input
                  type="number"
                  required
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                  placeholder="5000"
                />
              </div>
              <div className="w-1/2">
                <label className="block mb-1 text-sm font-medium text-slate-700">KD (0-100)</label>
                <input
                  type="number"
                  required
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                  placeholder="45"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">User Intent</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
              >
                <option value="Informational">Informational</option>
                <option value="Navigational">Navigational</option>
                <option value="Commercial">Commercial</option>
                <option value="Transactional">Transactional</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">3-Month Change</label>
              <input
                type="text"
                required
                value={trend}
                onChange={(e) => setTrend(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                placeholder="+12%"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-70"
            >
              {loading ? "Saving..." : "Save Keyword"}
            </button>
          </form>
        </div>

        {/* Right Column: Keyword Table */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Keyword Pool</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600 whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-medium">
                <tr>
                  <th className="px-6 py-4">Keyword</th>
                  <th className="px-6 py-4">Volume</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4">Intent</th>
                  <th className="px-6 py-4">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {keywords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                        <p>No keywords added yet. Start populating the pool.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  keywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {kw.word}
                      </td>
                      <td className="px-6 py-4">{kw.volume.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            kw.difficulty > 70
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : kw.difficulty > 30
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {kw.difficulty}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                          {kw.intent}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex items-center">
                        {kw.trend.startsWith("-") ? (
                          <TrendingUp className="h-4 w-4 mr-1 text-red-500 rotate-180" />
                        ) : (
                          <TrendingUp className="h-4 w-4 mr-1 text-emerald-500" />
                        )}
                        <span className={kw.trend.startsWith("-") ? "text-red-700" : "text-emerald-700"}>
                          {kw.trend}
                        </span>
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
