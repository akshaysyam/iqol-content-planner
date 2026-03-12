// app/manager/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import DashboardLayout from "../../components/DashboardLayout";
import Editor from "../../components/Editor";
import { FilePlus, Edit3, Link as LinkIcon, Users, Type, Clock, List as ListIcon, Trash2 } from "lucide-react";
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
  const [editFaqs, setEditFaqs] = useState<{question: string, answer: string}[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Manager Rejection State
  const [managerRejecting, setManagerRejecting] = useState(false);
  const [managerRejectionNote, setManagerRejectionNote] = useState("");
  const [isRejectingState, setIsRejectingState] = useState(false);

  // Validation Metrics State
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);

  // Automatically validate content upon selecting a topic that has content
  useEffect(() => {
    if (viewingTopic && viewingTopic.content) {
      const runValidationObj = async () => {
        setMetricsLoading(true);
        try {
           const res = await fetch("/api/validate", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               content: viewingTopic.content,
               minWords: viewingTopic.minWords,
               maxWords: viewingTopic.maxWords,
               targetKeywords: viewingTopic.targetKeywords || [viewingTopic.targetKeyword].filter(Boolean),
               scrapedKeywords: viewingTopic.scrapedKeywords || [],
             }),
           });
           const result = await res.json();
           setValidationData(result);
        } catch (error) {
           console.error("Failed to check quality metrics:", error);
        } finally {
           setMetricsLoading(false);
        }
      };
      runValidationObj();
    } else {
      setValidationData(null);
    }
  }, [viewingTopic]);

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
        faqs: editFaqs,
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

  const handleManagerReject = async (id: string, currentEvents: any[]) => {
    if (!managerRejectionNote.trim()) {
      alert("Please provide a reason for the rejection.");
      return;
    }
    setManagerRejecting(true);
    try {
      const topicRef = doc(db, "topics", id);
      await updateDoc(topicRef, {
        status: "Needs_Revision",
        events: [
          ...(currentEvents || []),
          {
            type: "REJECTED",
            date: new Date().toISOString(),
            note: `Content Manager requested revisions during final SEO Review: "${managerRejectionNote}"`,
          }
        ]
      });
      setViewingTopic(null);
      setManagerRejectionNote("");
      setIsRejectingState(false);
    } catch (error) {
      console.error("Error rejecting:", error);
      alert("Failed to reject topic.");
    } finally {
      setManagerRejecting(false);
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
          Pipeline Review
        </h1>
        <p className="mt-2 text-slate-500">
          Review and publish legally approved content.
        </p>
      </div>

      {/* Pipeline Analytics Table */}
      <div className="mx-auto max-w-6xl mt-4 mb-16">
        <h2 className="text-xl font-bold text-slate-900 mb-4 px-2">Content Pipeline & Reassignment</h2>
        
        {/* Analytics Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-2">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col">
            <span className="text-sm font-medium text-slate-500">Total Active Topics</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{topics.length}</div>
          </div>
          <div className="bg-red-50/50 rounded-xl p-4 shadow-sm border border-red-100 flex flex-col">
            <span className="text-sm font-medium text-red-700">Needs Revision (Rejected)</span>
            <div className="text-2xl font-bold text-red-900 mt-1">{topics.filter(t => t.status === "Needs_Revision").length}</div>
          </div>
          <div className="bg-blue-50/50 rounded-xl p-4 shadow-sm border border-blue-100 flex flex-col">
            <span className="text-sm font-medium text-blue-700">Awaiting Legal Review</span>
            <div className="text-2xl font-bold text-blue-900 mt-1">{topics.filter(t => t.status === "Legal_Review").length}</div>
          </div>
          <div className="bg-emerald-50/50 rounded-xl p-4 shadow-sm border border-emerald-100 flex flex-col">
            <span className="text-sm font-medium text-emerald-700">Approved for Publishing</span>
            <div className="text-2xl font-bold text-emerald-900 mt-1">{topics.filter(t => t.status === "Legal_Approved").length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {topicsLoading ? (
            <div className="p-8 text-center text-slate-500">Loading pipeline data...</div>
          ) : topics.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No active topics found in your pipeline.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Topic Title</th>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Writer</th>
                    <th className="px-6 py-4">Lawyer</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topics.map((topic) => (
                    <tr key={topic.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 max-w-xs truncate" title={topic.title}>
                        {topic.title}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs">{topic.brand}</span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={topic.status} />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors w-40 text-sm"
                          value={topic.writerId}
                          onChange={(e) => handleReassign(topic.id, 'writerId', e.target.value)}
                        >
                          <option value="" disabled>Unassigned</option>
                          {writers.map(w => (
                            <option key={w.id} value={w.id}>{w.email.split('@')[0]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors w-40 text-sm"
                          value={topic.lawyerId}
                          onChange={(e) => handleReassign(topic.id, 'lawyerId', e.target.value)}
                        >
                          <option value="" disabled>Unassigned</option>
                          {lawyers.map(l => (
                            <option key={l.id} value={l.id}>{l.email.split('@')[0]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setViewingTopic(topic);
                            setEditContent(topic.content || "");
                            setEditFaqs(topic.faqs || []);
                            setMetaTitle(topic.metaTitle || "");
                            setMetaDescription(topic.metaDescription || "");
                            
                            // Initialize metaKeywords from saved scrapedKeywords if available and text is empty
                            if (topic.metaKeywords) {
                              setMetaKeywords(topic.metaKeywords);
                            } else if (topic.scrapedKeywords && Array.isArray(topic.scrapedKeywords)) {
                              setMetaKeywords(topic.scrapedKeywords.map((k: any) => k.word).join(", "));
                            } else {
                              setMetaKeywords("");
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Viewing Modal */}
      {viewingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 truncate pr-4">{viewingTopic.title}</h2>
              <button 
                onClick={() => setViewingTopic(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Main Content Area */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex gap-3">
                  <StatusBadge status={viewingTopic.status} />
                  <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {viewingTopic.brand}
                  </span>
                </div>

                <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    {viewingTopic.status === 'Legal_Approved' ? 'Content Manager SEO Review & Edit:' : 'Current Content Draft:'}
                  </h3>
                </div>

                {/* Quality Metrics Cards */}
                {(metricsLoading || validationData) && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col items-start shadow-sm">
                       <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><Type className="w-3 h-3" /> Word Count</span>
                       {metricsLoading ? <span className="text-sm font-medium text-slate-400">Loading...</span> : (
                         <span className={`text-lg font-bold ${validationData?.metrics?.wordCount >= viewingTopic.minWords && validationData?.metrics?.wordCount <= viewingTopic.maxWords ? 'text-emerald-700' : 'text-amber-600'}`}>
                           {validationData?.metrics?.wordCount} <span className="text-xs font-normal text-slate-500">/ {viewingTopic.maxWords}</span>
                         </span>
                       )}
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col items-start shadow-sm">
                       <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Keyword Match</span>
                       {metricsLoading ? <span className="text-sm font-medium text-slate-400">Loading...</span> : (
                         <span className="text-lg font-bold text-blue-700">
                           {validationData?.metrics?.totalKeywordCount} <span className="text-xs font-normal text-slate-500">instances</span>
                         </span>
                       )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col items-start shadow-sm">
                       <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1"><Edit3 className="w-3 h-3" /> AI Likelihood</span>
                       {metricsLoading ? <span className="text-sm font-medium text-slate-400">Loading...</span> : (
                         <span className={`text-lg font-bold ${validationData?.metrics?.aiScore > 40 ? 'text-red-600' : 'text-emerald-700'}`}>
                           {validationData?.metrics?.aiScore}% <span className="text-xs font-normal text-slate-500">{validationData?.metrics?.aiScore > 40 ? '(Too High)' : '(Human)'}</span>
                         </span>
                       )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col items-start shadow-sm justify-center">
                       {metricsLoading ? <span className="text-sm font-medium text-slate-400">Analyzing...</span> : (
                         validationData?.passed ? (
                           <span className="w-full text-center text-xs font-bold text-emerald-700 bg-emerald-100 py-1.5 rounded uppercase tracking-wider">All Rules Passed</span>
                         ) : (
                           <span className="w-full text-center text-xs font-bold text-red-700 bg-red-100 py-1.5 rounded uppercase tracking-wider">{validationData?.errors?.length || 0} Rule Violations</span>
                         )
                       )}
                    </div>
                  </div>
                )}

                {/* Detailed Keyword Breakdown */}
                {validationData?.metrics?.keywordDetails && 
                  (validationData.metrics.keywordDetails.target.length > 0 || validationData.metrics.keywordDetails.scraped.length > 0) && (
                  <div className="mb-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Detailed Keyword Analysis</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[...validationData.metrics.keywordDetails.target, ...validationData.metrics.keywordDetails.scraped].map((kw: any, idx: number) => {
                         const isPassing = kw.count >= kw.required;
                         return (
                           <div key={idx} className="flex justify-between items-center px-4 py-2.5 text-sm hover:bg-slate-50/50 transition-colors">
                              <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{kw.word}</span>
                              <div className="flex items-center gap-3">
                                <div className="text-xs text-slate-500">
                                  Required: <span className="font-semibold text-slate-700">{kw.required}</span>
                                </div>
                                <div className={`text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${isPassing ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  Actual: {kw.count}
                                </div>
                              </div>
                           </div>
                         );
                      })}
                    </div>
                  </div>
                )}

                {validationData?.errors && validationData.errors.length > 0 && (
                   <div className="mb-4 bg-red-50/50 border border-red-100 rounded-lg p-3 space-y-1">
                      <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-2">Requirement Violations</h4>
                      {validationData.errors.map((err: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-red-700 font-medium">
                          <span className="mt-0.5">•</span>
                          <p>{err}</p>
                        </div>
                      ))}
                   </div>
                )}
                
                {viewingTopic.status === 'Legal_Approved' ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm h-[400px] bg-white">
                      <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                         <h4 className="text-sm font-bold text-slate-700">Main Content Editor</h4>
                      </div>
                      <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-0 bg-slate-50">
                        <Editor 
                          content={editContent} 
                          onChange={setEditContent} 
                          editable={true} 
                        />
                      </div>
                    </div>
                    
                    {/* Editable Q&A Section */}
                    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <ListIcon className="h-4 w-4 text-slate-500" />
                          Q&A Section
                        </h4>
                        <button
                          onClick={() => setEditFaqs([...editFaqs, { question: "", answer: "<p>Start writing an answer...</p>" }])}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                        >
                          + Add Question
                        </button>
                      </div>
                      
                      {editFaqs.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500 italic bg-slate-50/50">
                          No Q&A items added.
                        </div>
                      ) : (
                        <div className="p-6 space-y-6">
                          {editFaqs.map((faq, index) => (
                            <div key={index} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                              <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                                <span className="text-xs font-bold text-slate-500 uppercase">Q&A #{index + 1}</span>
                                <button 
                                  onClick={() => setEditFaqs(editFaqs.filter((_, i) => i !== index))}
                                  className="text-red-500 hover:text-red-700 p-1 text-xs font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="p-4 space-y-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-700 mb-1">Question</label>
                                  <input
                                    type="text"
                                    value={faq.question}
                                    onChange={(e) => {
                                      const newFaqs = [...editFaqs];
                                      newFaqs[index].question = e.target.value;
                                      setEditFaqs(newFaqs);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-700 mb-1">Answer (Rich Text)</label>
                                  <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[150px]">
                                    <Editor
                                      content={faq.answer}
                                      onChange={(newAnswer) => {
                                        const newFaqs = [...editFaqs];
                                        newFaqs[index].answer = newAnswer;
                                        setEditFaqs(newFaqs);
                                      }}
                                      editable={true}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {viewingTopic.content ? (
                      <div 
                        className="prose prose-sm max-w-none prose-slate bg-slate-50 border border-slate-200 p-6 rounded-xl prose-p:leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: viewingTopic.content }} 
                      />
                    ) : (
                      <div className="p-6 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                        No content has been written for this topic yet.
                      </div>
                    )}

                    {viewingTopic.faqs && viewingTopic.faqs.length > 0 && (
                      <div className="mt-8 border-t border-slate-200 pt-6">
                        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                          <ListIcon className="h-4 w-4 text-slate-400" /> Q&A Section
                        </h4>
                        <div className="space-y-4">
                          {viewingTopic.faqs.map((faq: any, index: number) => (
                            <div key={index} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                              <h5 className="font-bold text-slate-900 text-base mb-3 pb-2 border-b border-slate-100 flex gap-2">
                                <span className="text-blue-600">Q:</span> {faq.question}
                              </h5>
                              <div className="prose prose-sm max-w-none">
                                <div dangerouslySetInnerHTML={{ __html: faq.answer }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SEO Meta Editor Fields for Legal Approved items */}
              {viewingTopic.status === 'Legal_Approved' && (
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 mt-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                    Final SEO Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Meta Title</label>
                      <input 
                        type="text" 
                        value={metaTitle} 
                        onChange={e => setMetaTitle(e.target.value)} 
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-shadow" 
                        placeholder="Optimized SEO Title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
                      <textarea 
                        value={metaDescription} 
                        onChange={e => setMetaDescription(e.target.value)} 
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none transition-shadow" 
                        rows={3}
                        placeholder="Summary for search engines..."
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Meta Keywords (Comma separated)</label>
                      <input 
                        type="text" 
                        value={metaKeywords} 
                        onChange={e => setMetaKeywords(e.target.value)} 
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-shadow" 
                        placeholder="law, terms, conditions"
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>

              {/* Event Timeline History - Right Sidebar */}
              {viewingTopic.events && viewingTopic.events.length > 0 && (
                <div className="w-1/3 min-w-[300px] max-w-[400px] border-l border-slate-100 bg-slate-50 p-6 overflow-y-auto shrink-0 shadow-inner hidden md:block">
                  <h3 className="text-xs font-bold text-slate-900 mb-6 uppercase tracking-wide flex items-center gap-2 sticky top-0 bg-slate-50 py-1 z-20">
                    <Clock className="h-4 w-4 text-slate-400" /> Review History
                  </h3>
                  <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[11px] md:before:mx-[11px] before:-translate-x-px md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                     {viewingTopic.events.map((evt: any, i: number) => {
                       const isRejected = evt.type === 'REJECTED';
                       
                       let genericNote = evt.note;
                       let specificReason = null;
                       
                       if (isRejected) {
                         const match = evt.note.match(/"([^"]+)"/);
                         specificReason = match ? match[1] : null;
                         if (evt.note.includes("Content Manager")) {
                           genericNote = "Content Manager requested revisions.";
                         } else {
                           genericNote = "Lawyer requested revisions.";
                         }
                       }

                       return (
                         <div key={i} className="relative flex items-start gap-4">
                           <div className={`mt-0.5 relative z-10 w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-4 border-slate-50 shadow-sm ${
                             evt.type === 'ASSIGNED' ? 'bg-blue-400' :
                             evt.type === 'SUBMITTED' ? 'bg-amber-400' :
                             evt.type === 'REJECTED' ? 'bg-red-500' :
                             evt.type === 'APPROVED' ? 'bg-emerald-500' :
                             evt.type === 'PUBLISHED' ? 'bg-purple-500' : 'bg-slate-400'
                           }`}>
                             <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                           </div>
                           <div className="flex-1 pb-3">
                             <div className="flex flex-col gap-0.5 mb-1">
                                <span className="text-xs font-bold text-slate-700">{evt.type}</span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {formatDistanceToNow(new Date(evt.date))} ago
                                </span>
                             </div>
                             <p className="text-xs text-slate-600 relative z-10 whitespace-pre-wrap">{genericNote}</p>
                             
                             {/* Specific Rejection block */}
                             {isRejected && specificReason && (
                               <div className="mt-2 bg-red-50/50 border border-red-100 rounded-md p-2.5 flex items-start gap-2 relative z-10 shadow-inner">
                                 <div className="bg-red-100 text-red-600 rounded-full w-4 h-4 flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-red-200">
                                   <span className="text-[10px] font-bold italic font-serif">i</span>
                                 </div>
                                 <p className="text-xs font-medium text-red-800 whitespace-pre-wrap leading-relaxed">{specificReason}</p>
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            {viewingTopic.status === 'Legal_Approved' && (
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col gap-3 rounded-b-2xl">
                {isRejectingState ? (
                  <div className="w-full bg-red-50/50 border border-red-100 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                    <label className="block text-sm font-bold text-red-800 mb-2">Provide Rejection Reason for Writer:</label>
                    <textarea 
                      value={managerRejectionNote}
                      onChange={(e) => setManagerRejectionNote(e.target.value)}
                      placeholder="e.g., Target keywords still missing, metadata logic incorrect..."
                      className="w-full rounded-lg border border-red-200 px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none bg-white shadow-sm mb-3"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => {
                          setIsRejectingState(false);
                          setManagerRejectionNote("");
                        }}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleManagerReject(viewingTopic.id, viewingTopic.events)}
                        disabled={managerRejecting || !managerRejectionNote.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {managerRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center w-full">
                    <button
                      onClick={() => setIsRejectingState(true)}
                      className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                    >
                      Reject to Writer
                    </button>

                    <button
                      onClick={() => handlePublish(viewingTopic.id, viewingTopic.events)}
                      disabled={publishing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all disabled:opacity-70 flex items-center gap-2"
                    >
                      {publishing ? 'Publishing...' : 'Save & Publish to CMS'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
