// app/manager/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import DashboardLayout from "../components/DashboardLayout";
import Editor from "../components/Editor";
import { FilePlus, Edit3, Link as LinkIcon, Users, Type, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ManagerDashboard() {
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [allowedBrands, setAllowedBrands] = useState<string[]>([]);
  const [availableKeywords, setAvailableKeywords] = useState<any[]>([]);
  const [writers, setWriters] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedWriter, setSelectedWriter] = useState("");
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [referenceLinks, setReferenceLinks] = useState("");
  const [scrapedKeywords, setScrapedKeywords] = useState<{word: string, requiredCount: number}[]>([]);
  const [manualKeyword, setManualKeyword] = useState("");
  const [scraping, setScraping] = useState(false);
  const [minWords, setMinWords] = useState("800");
  const [maxWords, setMaxWords] = useState("1200");
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [notifications, setNotifications] = useState<{id: string, text: string, status: string}[]>([]);
  const [viewingTopic, setViewingTopic] = useState<any | null>(null);

  // Manager Final QA / SEO State
  const [editContent, setEditContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [publishing, setPublishing] = useState(false);

  const handleScrapeKeywords = async () => {
    if (!referenceLinks) {
      alert("Please enter at least one reference URL first.");
      return;
    }
    
    setScraping(true);
    const urls = referenceLinks.split(",").map(url => url.trim()).filter(Boolean);
    let allExtractedKeywords: string[] = [];
    
    try {
      for (const url of urls) {
        // Must ensure URL has protocol for fetch to work
        const fetchUrl = url.startsWith('http') ? url : `https://${url}`;
        
        try {
          const res = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: fetchUrl })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.metaKeywords) {
              // Split comma-separated meta keywords
              const kwArray = data.metaKeywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
              allExtractedKeywords = [...allExtractedKeywords, ...kwArray];
            }
          }
        } catch (e) {
          console.error(`Failed to scrape ${url}`, e);
        }
      }

      // Deduplicate and format into tracking objects
      const uniqueKeywords = Array.from(new Set(allExtractedKeywords)).filter(kw => kw.length > 2); // Ignore tiny words like 'a', 'or'
      
      if (uniqueKeywords.length === 0) {
        alert("No meta keywords could be extracted from the provided URLs.");
      } else {
        const newTrackers = uniqueKeywords.map(word => ({ word, requiredCount: 1 }));
        setScrapedKeywords(prev => {
          // Merge avoiding duplicates that might already exist in state
          const existingWords = prev.map(p => p.word);
          const additive = newTrackers.filter(t => !existingWords.includes(t.word));
          return [...prev, ...additive];
        });
      }
    } catch (error) {
      console.error("Scraping orchestration error:", error);
      alert("An error occurred while fetching keywords.");
    } finally {
      setScraping(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const userQuery = query(
          collection(db, "users"),
          where("email", "==", user.email.toLowerCase())
        );
        const userSnap = await getDocs(userQuery);

        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          const role = userData.role;
          const userBrands = userData.brands || [];
          
          setCurrentUserRole(role);
          setAllowedBrands(userBrands);
          
          if (userBrands.length > 0) {
            setBrand(userBrands[0]);
          }

          // Set up Topics Listener based on Role
          let topicsQuery;
          if (role === "Platform Admin") {
            topicsQuery = query(collection(db, "topics"));
          } else if (role === "Content Manager" && userBrands.length > 0) {
            topicsQuery = query(collection(db, "topics"), where("brand", "in", userBrands));
          } else {
            // Fallback empty query if no brands assigned yet
            topicsQuery = query(collection(db, "topics"), where("brand", "==", "UNASSIGNED")); 
          }

          const unsubTopics = onSnapshot(topicsQuery, (snapshot) => {
            const fetchedTopics = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            // Process Notifications for status changes
            snapshot.docChanges().forEach((change) => {
              if (change.type === "modified") {
                const newData = change.doc.data();
                
                // Set up a simple toast matching logic based on status changes
                setTopics(prevTopics => {
                  const oldData = prevTopics.find(t => t.id === change.doc.id);
                  if (oldData && oldData.status !== newData.status) {
                     const msg = `Topic "${newData.title}" moved to ${newData.status.replace('_', ' ')}`;
                     setNotifications(prev => [{ id: Date.now().toString(), text: msg, status: newData.status }, ...prev].slice(0, 5));
                  }
                  return prevTopics; // actual update happens below
                });
              }
            });

            // Sort client side by date descending
            fetchedTopics.sort((a: any, b: any) => {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            setTopics(fetchedTopics);
            setTopicsLoading(false);
          }, (error) => {
            console.error("Error listening to topics:", error);
            setTopicsLoading(false);
          });
          
          // Cleanup listener on unmount
          return () => unsubTopics();
        }
      }
    });

    const fetchDropdownData = async () => {
      try {
        const kwSnapshot = await getDocs(collection(db, "keywords"));
        setAvailableKeywords(
          kwSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );

        const usersSnapshot = await getDocs(collection(db, "users"));
        const allUsers = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        setWriters(allUsers.filter((u) => u.role === "Content Writer"));
        setLawyers(allUsers.filter((u) => u.role === "Lawyer"));
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchDropdownData();
    return () => unsubscribe();
  }, []);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "topics"), {
        title,
        brand,
        targetKeywords: selectedKeywords,
        scrapedKeywords,
        writerId: selectedWriter,
        lawyerId: selectedLawyer,
        referenceLinks,
        minWords: Number(minWords),
        maxWords: Number(maxWords),
        status: "Drafting",
        createdAt: new Date().toISOString(),
        events: [
          {
            type: "ASSIGNED",
            date: new Date().toISOString(),
            note: "Topic was assigned to Writer."
          }
        ]
      });
      alert("Topic assigned successfully!");
      setTitle("");
      setReferenceLinks("");
      setScrapedKeywords([]);
    } catch (error) {
      console.error("Error creating topic:", error);
      alert("Failed to assign topic.");
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (topicId: string, field: 'writerId' | 'lawyerId', value: string) => {
    try {
      const topicRef = doc(db, "topics", topicId);
      await updateDoc(topicRef, { [field]: value });
    } catch (error) {
      console.error("Error reassigning user:", error);
      alert("Failed to update assignment.");
    }
  };

  const handlePublish = async (id: string, currentEvents: any[]) => {
    setPublishing(true);
    try {
      const topicRef = doc(db, "topics", id);
      await updateDoc(topicRef, {
        content: editContent,
        metaTitle,
        metaDescription,
        metaKeywords,
        status: "Published",
        events: [
          ...(currentEvents || []),
          {
            type: "PUBLISHED",
            date: new Date().toISOString(),
            note: "Content Manager finalized SEO and published to CMS."
          }
        ]
      });
      setViewingTopic(null);
    } catch (error) {
      console.error("Error publishing:", error);
      alert("Failed to publish to CMS.");
    } finally {
      setPublishing(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'Drafting': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Drafting</span>;
      case 'Needs_Revision': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Needs Revision</span>;
      case 'Legal_Review': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Legal Review</span>;
      case 'Legal_Approved': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Approved</span>;
      case 'Published': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">Published</span>;
      default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <DashboardLayout requiredRoles={["Platform Admin", "Content Manager"]}>
      {/* Floating Notifications */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-white border text-sm font-medium border-slate-200 shadow-xl rounded-xl p-4 w-80 translate-x-0 animate-in slide-in-from-right-8 pointer-events-auto flex gap-3 items-start">
            <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
              n.status === 'Needs_Revision' ? 'bg-red-500' :
              n.status === 'Legal_Approved' ? 'bg-emerald-500' : 'bg-blue-500'
            }`} />
            <div className="flex-1">
               <p className="text-slate-800 leading-snug">{n.text}</p>
            </div>
            <button 
              onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Topics Manager
        </h1>
        <p className="mt-2 text-slate-500">
          Create content briefs, assign writers, and manage the publishing pipeline.
        </p>
      </div>

      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm border border-slate-100 relative overflow-hidden mb-8">
        {/* Decorative corner block */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-2xl"></div>
        
        <div className="mb-8 flex items-center gap-3 relative z-10">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-600/20">
            <FilePlus className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Assign New Topic</h2>
        </div>

        <form onSubmit={handleCreateTopic} className="space-y-8 relative z-10">
          {/* Section: Core Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                disabled={currentUserRole === "Content Manager" && allowedBrands.length <= 1}
              >
                {allowedBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
                {currentUserRole === "Platform Admin" && allowedBrands.length === 0 && (
                  <>
                    <option value="Canvas Homes">Canvas Homes</option>
                    <option value="Vault Proptech">Vault Proptech</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">Blog Title</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Edit3 className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-11 px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                  placeholder="The Ultimate Guide to..."
                />
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-slate-100"></div>

          {/* Section: SEO & Assignment */}
          <div className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">Target Keywords (Select multiple)</label>
              <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-48">
                <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 flex justify-between">
                  <span>Available Keywords</span>
                  <span>{selectedKeywords.length} selected</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {availableKeywords.length === 0 && (
                    <div className="text-sm text-slate-500 p-2 text-center">No keywords available.</div>
                  )}
                  {availableKeywords.map((kw) => {
                    const isSelected = selectedKeywords.includes(kw.word);
                    return (
                      <label 
                        key={kw.id} 
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeywords([...selectedKeywords, kw.word]);
                            } else {
                              setSelectedKeywords(selectedKeywords.filter(k => k !== kw.word));
                            }
                          }}
                        />
                        <div className="flex-1 text-sm text-slate-700">
                          <span className={isSelected ? "font-semibold text-blue-900" : ""}>{kw.word}</span>
                        </div>
                        <div className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                          Vol: {kw.volume}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" /> Assign Writer
                </label>
                <select
                  required
                  value={selectedWriter}
                  onChange={(e) => setSelectedWriter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                >
                  <option value="" disabled>Select a writer...</option>
                  {writers.map((w) => (
                    <option key={w.id} value={w.id}>{w.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" /> Assign Lawyer
                </label>
                <select
                  required
                  value={selectedLawyer}
                  onChange={(e) => setSelectedLawyer(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                >
                  <option value="" disabled>Select a lawyer...</option>
                  {lawyers.map((l) => (
                    <option key={l.id} value={l.id}>{l.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-slate-100"></div>

          {/* Section: Guidelines */}
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Type className="h-4 w-4 text-slate-400" /> Min Words
                </label>
                <input
                  type="number"
                  required
                  value={minWords}
                  onChange={(e) => setMinWords(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Type className="h-4 w-4 text-slate-400" /> Max Words
                </label>
                <input
                  type="number"
                  required
                  value={maxWords}
                  onChange={(e) => setMaxWords(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-slate-400" /> Reference URLs (Comma separated)
              </label>
              <div className="flex gap-2">
                <textarea
                  required
                  value={referenceLinks}
                  onChange={(e) => setReferenceLinks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all resize-none"
                  rows={3}
                  placeholder="https://example.com/article1, https://example.com/article2"
                />
                <button
                  type="button"
                  onClick={handleScrapeKeywords}
                  disabled={scraping || !referenceLinks}
                  className="flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-1 border border-slate-200"
                >
                  {scraping ? (
                    <span className="animate-spin text-xl">⏳</span>
                  ) : (
                    <LinkIcon className="h-5 w-5" />
                  )}
                  <span>Fetch Meta</span>
                </button>
              </div>
            </div>

            {/* Scraped Keywords Frequency Adjuster */}
            {(scrapedKeywords.length > 0 || true) && (
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">Tracked Keywords</h3>
                    <span className="text-xs text-blue-600 font-medium">{scrapedKeywords.length} targets active</span>
                  </div>
                  
                  {/* Manual Add Form */}
                  <div className="flex w-full sm:w-auto gap-2">
                    <input
                      type="text"
                      value={manualKeyword}
                      onChange={(e) => setManualKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const word = manualKeyword.trim().toLowerCase();
                          if (word && !scrapedKeywords.find(sk => sk.word === word)) {
                            setScrapedKeywords(prev => [{word, requiredCount: 1}, ...prev]);
                            setManualKeyword("");
                          }
                        }
                      }}
                      placeholder="Add custom keyword..."
                      className="flex-1 sm:w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                    />
                    <button
                      type="button"
                      disabled={!manualKeyword.trim()}
                      onClick={() => {
                        const word = manualKeyword.trim().toLowerCase();
                        if (word && !scrapedKeywords.find(sk => sk.word === word)) {
                          setScrapedKeywords(prev => [{word, requiredCount: 1}, ...prev]);
                          setManualKeyword("");
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
                
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {scrapedKeywords.map((sk, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-sm font-medium text-slate-700 truncate mr-2" title={sk.word}>
                        {sk.word}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-xs text-slate-500">Target:</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={sk.requiredCount}
                          onChange={(e) => {
                            const newArr = [...scrapedKeywords];
                            newArr[index].requiredCount = parseInt(e.target.value) || 1;
                            setScrapedKeywords(newArr);
                          }}
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setScrapedKeywords(scrapedKeywords.filter((_, i) => i !== index));
                          }}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-70"
            >
              {loading ? "Creating..." : "Create & Assign Topic"}
            </button>
          </div>
        </form>
      </div>

    </DashboardLayout>
  );
}
