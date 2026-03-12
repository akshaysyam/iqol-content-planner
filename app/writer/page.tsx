// app/writer/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, where, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import DashboardLayout from "../components/DashboardLayout";
import Editor from "../components/Editor";
import { FileText, Clock, AlertCircle, CheckCircle2, ChevronRight, List as ListIcon, Link as LinkIcon, RefreshCw, XCircle, Layers, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function WriterDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [content, setContent] = useState("");
  const [faqs, setFaqs] = useState<{question: string, answer: string, isSaved?: boolean}[]>([]);
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRevisionNote, setShowRevisionNote] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Validation results
  const [validationResult, setValidationResult] = useState<any>(null);

  useEffect(() => {
    let unsubTopics: any = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        // Find user ID corresponding to auth email
        // To avoid an extra query, we can just use another snapshot or keep it simple.
        // We need the UID. For simplicity, we'll run a onSnapshot on users too, or just a quick fetch.
        import("firebase/firestore").then(({ getDocs }) => {
          const userQuery = query(collection(db, "users"), where("email", "==", user.email!.toLowerCase()));
          getDocs(userQuery).then(userSnap => {
            if (!userSnap.empty) {
              const uid = userSnap.docs[0].id;
              setUserId(uid);
              
              const q = query(
                collection(db, "topics"),
                where("writerId", "==", uid)
              );
              
              setLoading(true);
              unsubTopics = onSnapshot(q, (snapshot) => {
                const tasksData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sort by lastUpdated or createdAt
                tasksData.sort((a: any, b: any) => {
                  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                });
                setTasks(tasksData);
                
                // Keep selectedTask in sync with new data
                setTasks(prevTasks => {
                  // This is a bit tricky inside the listener, better to sync via a useEffect depending on `tasks`
                  return tasksData;
                });
                
                setLoading(false);
              }, (error) => {
                console.error("Error fetching tasks:", error);
                setLoading(false);
              });

            }
          });
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubTopics) unsubTopics();
    };
  }, []);

  // Effect to sync selectedTask when tasks update (e.g., rejection note arrives)
  useEffect(() => {
    if (tasks.length > 0) {
      if (!selectedTask) {
         handleSelectTask(tasks[0]);
      } else {
         // Update the selected task references with fresh data
         const freshTask = tasks.find(t => t.id === selectedTask.id);
         if (freshTask && JSON.stringify(freshTask) !== JSON.stringify(selectedTask)) {
             setSelectedTask(freshTask);
         }
      }
    } else if (tasks.length === 0 && selectedTask) {
      setSelectedTask(null);
    }
  }, [tasks]);

  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    
    // Format keywords for initial content
    let kwDisplay = "";
    if (Array.isArray(task.targetKeywords)) {
      kwDisplay = task.targetKeywords.join(", ");
    } else {
      kwDisplay = task.targetKeyword || "your assigned keyword";
    }
    
    setContent(task.content || `<p>Start writing your post answering to the target keywords: <strong>${kwDisplay}</strong>...</p>`);
    setFaqs(task.faqs || []);
    setValidationResult(null); // Reset validation
    setShowRevisionNote(task.status === "Needs_Revision"); // Show briefly or toggle off? Let's default to false to save space always.
    setShowRevisionNote(false); 
    setRevisionComment("");
    setIsSubmittingRevision(false);
    setShowErrorModal(false);
  };

  const handleSaveDraft = async () => {
    if (!selectedTask) return;
    try {
      const taskRef = doc(db, "topics", selectedTask.id);
      await updateDoc(taskRef, { content, faqs, lastUpdated: new Date().toISOString() });
      alert("Draft saved!");
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  };

  const handleSubmitForReview = async () => {
    if (!selectedTask) return;
    
    // If it's a revision, intercept the original submit and open the modal instead
    if (selectedTask.status === "Needs_Revision" && !isSubmittingRevision) {
      setIsSubmittingRevision(true);
      return;
    }
    
    if (selectedTask.status === "Needs_Revision" && !revisionComment.trim()) {
      alert("Please add a comment explaining what changes you made before submitting.");
      return;
    }
    
    setValidating(true);
    
    try {
      // 1. Save latest content first
      const taskRef = doc(db, "topics", selectedTask.id);
      await updateDoc(taskRef, { content, faqs, lastUpdated: new Date().toISOString() });

      // 2. Call Validation API (Mocking for now before API setup)
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          minWords: selectedTask.minWords,
          maxWords: selectedTask.maxWords,
          targetKeywords: selectedTask.targetKeywords || [selectedTask.targetKeyword].filter(Boolean),
          scrapedKeywords: selectedTask.scrapedKeywords || [],
        }),
      });

      const result = await res.json();
      setValidationResult(result);

      if (result.passed) {
        // Build new event history
        const newEvent = {
          type: "SUBMITTED",
          date: new Date().toISOString(),
          note: selectedTask.status === "Needs_Revision" 
            ? `Writer submitted revised content. Change Notes: "${revisionComment}"`
            : "Writer submitted content for review."
        };
        const updatedEvents = [...(selectedTask.events || []), newEvent];

        // Move to Lawyer
        await updateDoc(taskRef, { 
          status: "Legal_Review",
          events: updatedEvents
        });
        alert("Success! Content passed all checks and was sent to Legal.");
        setIsSubmittingRevision(false);
        setRevisionComment("");
        // We do not remove from list anymore, the listener handles it and keeps it read-only
      } else {
        // Validation failed - we don't alert here anymore, we let the UI banner render the specific errors
        console.log("Validation failed with errors:", result.errors);
      }

    } catch (error) {
      console.error("Error submitting:", error);
      alert("Validation engine encountered an error.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <DashboardLayout requiredRoles={["Content Writer", "Platform Admin", "Content Manager"]}>
      <div className="flex h-[calc(100vh-8rem)] gap-6">
        
        {/* Left Sidebar: Task List */}
        <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ListIcon className="h-5 w-5 text-slate-500" />
              Your Tasks
            </h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
              {tasks.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center py-10 text-slate-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 mb-3" />
                <p>You're all caught up!</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div 
                  key={task.id} 
                  onClick={() => handleSelectTask(task)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    selectedTask?.id === task.id 
                      ? "border-blue-500 bg-blue-50/50 shadow-sm" 
                      : "border-slate-100 bg-white hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      task.status === 'Needs_Revision' ? 'bg-red-100 text-red-700' :
                      task.status === 'Legal_Review' ? 'bg-blue-100 text-blue-700' :
                      task.status === 'Legal_Approved' || task.status === 'Published' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.createdAt && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(task.createdAt))} ago
                      </span>
                    )}
                  </div>
                  <h3 className={`font-medium line-clamp-2 ${selectedTask?.id === task.id ? "text-blue-900" : "text-slate-800"}`}>
                    {task.title}
                  </h3>
                  
                  {task.status === 'Needs_Revision' && task.rejectionNote && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 line-clamp-2" title={task.rejectionNote}>
                      <strong>Note:</strong> {task.rejectionNote}
                    </div>
                  )}

                  {/* Timeline History */}
                  {selectedTask?.id === task.id && task.events && task.events.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-2">History</p>
                      <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                         {task.events.map((evt: any, i: number) => {
                           const isRejected = evt.type === 'REJECTED';
                           const match = isRejected ? evt.note.match(/"([^"]+)"/) : null;
                           const genericNote = isRejected ? "Lawyer requested revisions." : evt.note;
                           const specificReason = match ? match[1] : null;

                           return (
                             <div key={i} className="relative flex items-start gap-3 text-xs">
                               <div className={`mt-0.5 relative z-10 w-2.5 h-2.5 rounded-full shrink-0 border-2 border-white shadow-sm ${
                                 evt.type === 'ASSIGNED' ? 'bg-blue-400' :
                                 evt.type === 'SUBMITTED' ? 'bg-amber-400' :
                                 evt.type === 'REJECTED' ? 'bg-red-500' :
                                 evt.type === 'APPROVED' ? 'bg-emerald-500' : 'bg-slate-400'
                               }`}></div>
                               <div className="flex-1 pb-3">
                                 <div className="flex justify-between items-baseline mb-0.5">
                                   <span className="font-semibold text-slate-700">{evt.type}</span>
                                   <span className="text-[10px] text-slate-400">
                                     {formatDistanceToNow(new Date(evt.date))} ago
                                   </span>
                                 </div>
                                 <p className="font-medium text-slate-700 leading-snug">{genericNote}</p>
                                 
                                 {/* Specific Rejection block (The "i" icon pattern) */}
                                 {isRejected && specificReason && (
                                   <div className="mt-2 bg-red-50/50 border border-red-100 rounded p-2 flex items-start gap-1.5 relative z-10">
                                     <div className="bg-red-100 text-red-600 rounded-full w-3.5 h-3.5 flex items-center justify-center shrink-0 mt-0.5">
                                       <span className="text-[9px] font-bold italic font-serif">i</span>
                                     </div>
                                     <p className="text-[11px] font-medium text-red-800 whitespace-pre-wrap leading-relaxed">{specificReason}</p>
                                   </div>
                                 )}
                               </div>
                             </div>
                           );
                         })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {task.brand}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Content: Editor & Guidelines */}
        <div className="flex-1 flex flex-col h-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {selectedTask ? (
            <>
              {/* Header Info - Made more compact */}
              <div className="p-4 md:p-6 border-b border-slate-100 bg-white flex flex-col items-start gap-4 flex-shrink-0">
                <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight flex-1">{selectedTask.title}</h1>
                  
                  <div className="flex gap-2 items-center flex-wrap shrink-0">
                    {selectedTask.status === 'Needs_Revision' && selectedTask.rejectionNote && (
                      <button 
                        onClick={() => setShowRevisionNote(!showRevisionNote)}
                        className="flex items-center justify-center gap-1.5 px-3 h-9 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200 whitespace-nowrap"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" /> 
                        {showRevisionNote ? "Hide Notes" : "Revisions"}
                      </button>
                    )}
                    {['Drafting', 'Needs_Revision'].includes(selectedTask.status) ? (
                      <>
                        <button 
                          onClick={handleSaveDraft}
                          className="px-4 h-9 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                        >
                          Save Draft
                        </button>
                        <button 
                          onClick={handleSubmitForReview}
                          disabled={validating}
                          className="flex items-center justify-center gap-2 px-4 h-9 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-70 whitespace-nowrap"
                        >
                          {validating ? <RefreshCw className="h-4 w-4 animate-spin shrink-0" /> : "Submit & QA"}
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center px-4 h-9 text-sm font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap">
                        Read Only: {selectedTask.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 w-full text-sm">
                  <div className="flex items-center flex-wrap gap-2 text-slate-600 mb-3">
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-xs font-medium border border-slate-200">
                      <Layers className="h-3 w-3 text-slate-500" /> {selectedTask.brand}
                    </span>
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-xs font-medium border border-slate-200">
                      <span className="text-slate-500">Words:</span> <strong className="text-slate-800">{selectedTask.minWords} - {selectedTask.maxWords}</strong>
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium tracking-wide uppercase mr-2 text-[10px]">Target Keywords:</span> 
                    <strong className="text-slate-800 leading-relaxed font-medium">
                      {Array.isArray(selectedTask.targetKeywords) 
                        ? selectedTask.targetKeywords.join(', ')
                        : selectedTask.targetKeyword}
                    </strong>
                  </div>
                  
                  {/* Scraped Keywords Requirement List */}
                  {selectedTask.scrapedKeywords && selectedTask.scrapedKeywords.length > 0 && (
                    <div className="mt-2 max-h-24 overflow-y-auto pr-2 pb-1 custom-scrollbar">
                      <div className="flex flex-wrap gap-1.5">
                         {selectedTask.scrapedKeywords.map((sk: any, i: number) => (
                           <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                             <span className="text-emerald-500 opacity-70">{sk.requiredCount}x</span> <strong className="font-semibold">{sk.word}</strong>
                           </span>
                         ))}
                      </div>
                    </div>
                   )}
                </div>
              </div>

              {/* Dedicated Revision Notes Section */}
              {selectedTask.status === "Needs_Revision" && selectedTask.rejectionNote && showRevisionNote && (
                <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-100 rounded-lg shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-red-900 mb-1 flex items-center gap-2">
                        {selectedTask.rejectionNote.includes("Content Manager") ? "Content Manager Revisions Required" : "Legal Revisions Required"}
                      </h3>
                      <div className="bg-white/80 rounded-lg p-3 border border-red-100 font-medium text-slate-800 whitespace-pre-wrap shadow-inner text-sm max-h-[150px] overflow-y-auto">
                        {selectedTask.rejectionNote.includes("Content Manager") ? (
                          <>
                            <span className="text-xs text-slate-500 mb-2 block uppercase tracking-wider font-bold">SEO/Manager Feedback:</span>
                            {selectedTask.rejectionNote.match(/"([^"]+)"/) ? selectedTask.rejectionNote.match(/"([^"]+)"/)[1] : selectedTask.rejectionNote}
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-slate-500 mb-2 block uppercase tracking-wider font-bold">Lawyer Feedback:</span>
                            {selectedTask.rejectionNote.match(/"([^"]+)"/) ? selectedTask.rejectionNote.match(/"([^"]+)"/)[1] : selectedTask.rejectionNote}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact Validation Results Banner */}
              {validationResult && (
                <div className={`px-4 py-2 border-b flex items-center justify-between text-sm ${
                  validationResult.passed ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                }`}>
                  <div className={`flex items-center gap-2 font-semibold ${validationResult.passed ? "text-emerald-800" : "text-red-800"}`}>
                    {validationResult.passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {validationResult.passed ? "Validation Passed" : `Validation Failed: ${validationResult.errors?.length || 0} Errors`}
                  </div>
                  <button 
                    onClick={() => setShowErrorModal(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-colors ${
                      validationResult.passed 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    View Details & Metrics
                  </button>
                </div>
              )}

              {/* Actionable Editor Area */}
              <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
                <div className="p-0 relative bg-slate-50 flex flex-col min-h-[500px] w-full overflow-hidden shrink-0">
                  <Editor 
                    content={content} 
                    onChange={setContent} 
                    editable={['Drafting', 'Needs_Revision'].includes(selectedTask.status)} 
                  />
                </div>

                {/* Q&A Section */}
                <div className="p-6 bg-slate-100 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Q&A Section (Optional)</h3>
                    {['Drafting', 'Needs_Revision'].includes(selectedTask.status) && (
                      <button
                        onClick={() => setFaqs([...faqs, { question: "", answer: "<p>Start writing your answer...</p>" }])}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors flex items-center gap-1"
                      >
                        + Add Question
                      </button>
                    )}
                  </div>
                  
                  {faqs.length === 0 ? (
                    <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-sm text-slate-500">No Q&A items added yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {faqs.map((faq, index) => (
                        <div key={index} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center group">
                            <span className="text-xs font-bold text-slate-500 uppercase">
                              Q&A #{index + 1} {faq.isSaved && <span className="ml-2 text-emerald-600 px-2 py-0.5 bg-emerald-100 rounded text-[10px]">Saved</span>}
                            </span>
                            <div className="flex gap-2">
                              {faq.isSaved && ['Drafting', 'Needs_Revision'].includes(selectedTask.status) && (
                                <button
                                  onClick={() => setFaqs(faqs.map((f, i) => i === index ? { ...f, isSaved: false } : f))}
                                  className="text-blue-600 hover:text-blue-800 p-1 text-xs font-semibold px-2 hover:bg-blue-50 rounded"
                                >
                                  Edit
                                </button>
                              )}
                              {['Drafting', 'Needs_Revision'].includes(selectedTask.status) && (
                                <button
                                  onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}
                                  className="text-red-500 hover:text-red-700 p-1 opacity-50 group-hover:opacity-100 transition-opacity"
                                  title="Remove this question"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {faq.isSaved ? (
                            <div className="p-4 bg-white">
                              <h4 className="font-bold text-slate-800 text-sm">{faq.question || "Untitled Question"}</h4>
                            </div>
                          ) : (
                            <div className="p-4 space-y-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Question</label>
                                <input
                                  type="text"
                                  value={faq.question}
                                  onChange={(e) => {
                                    const newFaqs = [...faqs];
                                    newFaqs[index].question = e.target.value;
                                    setFaqs(newFaqs);
                                  }}
                                  disabled={!['Drafting', 'Needs_Revision'].includes(selectedTask.status)}
                                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
                                  placeholder="e.g. What is the process for property registration in Bangalore?"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Answer (Rich Text)</label>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                  <Editor
                                    content={faq.answer}
                                    onChange={(newAnswer) => {
                                      const newFaqs = [...faqs];
                                      newFaqs[index].answer = newAnswer;
                                      setFaqs(newFaqs);
                                    }}
                                    editable={['Drafting', 'Needs_Revision'].includes(selectedTask.status)}
                                    minHeightClass="min-h-[120px]"
                                  />
                                </div>
                              </div>
                              <div className="pt-2 flex justify-end">
                                <button
                                  onClick={() => setFaqs(faqs.map((f, i) => i === index ? { ...f, isSaved: true } : f))}
                                  disabled={!faq.question.trim()}
                                  className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                >
                                  Save Q&A
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reference Links Footer */}
              {selectedTask.referenceLinks && (
                <div className="p-3 border-t border-slate-200 bg-white text-[11px] shrink-0">
                  <span className="font-bold text-slate-500 uppercase tracking-wider mr-2">Research Links:</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {selectedTask.referenceLinks.split(',').map((link: string, i: number) => {
                      const l = link.trim();
                      if(!l) return null;
                      return (
                        <a key={i} href={l} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center truncate max-w-[300px]" title={l}>
                          <LinkIcon className="h-3 w-3 mr-1 shrink-0" /> {l.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileText className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-lg">Select a task from the sidebar to start writing.</p>
            </div>
          )}
        </div>

      </div>

      {/* Revision Submission Modal */}
      {isSubmittingRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col pt-6 transform transition-all">
            <div className="px-6 mb-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                Submit Revised Content
              </h2>
              <p className="text-sm text-slate-500">
                Before sending this back for review, please leave a brief note explaining what changes you made so the reviewers know what to look for.
              </p>
            </div>
            
            <div className="px-6 pb-6">
              <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">Your Revision Notes <span className="text-red-500">*</span></label>
              <textarea 
                className="w-full text-sm rounded-lg border border-slate-200 px-4 py-3 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow resize-none"
                placeholder="e.g., Added the missing 'bangalore' keywords, rewrote the intro to lower AI score, removed the false claim in paragraph 3..."
                rows={4}
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                autoFocus
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsSubmittingRevision(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForReview}
                disabled={validating || !revisionComment.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {validating ? (
                  <><RefreshCw className="h-4 w-4 animate-spin shrink-0" /> Running QA...</>
                ) : (
                  'Run QA & Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Details Modal */}
      {showErrorModal && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col transform transition-all max-h-[80vh]">
            <div className={`p-5 border-b border-slate-100 flex items-center justify-between ${validationResult.passed ? "bg-emerald-50" : "bg-red-50"}`}>
              <h2 className={`text-lg font-bold flex items-center gap-2 ${validationResult.passed ? "text-emerald-900" : "text-red-900"}`}>
                {validationResult.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
                Validation Details
              </h2>
              <button 
                onClick={() => setShowErrorModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50">
              {/* Metrics Box */}
              <div className="grid grid-cols-3 gap-4 text-xs mb-6">
                <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col items-center">
                  <span className="block text-slate-500 mb-1 font-semibold tracking-wide uppercase text-[10px]">Word Count</span>
                  <span className={`text-xl font-bold ${validationResult.errors?.some((e:string) => e.includes('Words')) ? 'text-red-600' : 'text-slate-800'}`}>
                    {validationResult.metrics?.wordCount || 0}
                  </span>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col items-center">
                  <span className="block text-slate-500 mb-1 font-semibold tracking-wide uppercase text-[10px]">Keyword Uses</span>
                  <span className={`text-xl font-bold text-slate-800`}>
                    {validationResult.metrics?.totalKeywordCount || 0}
                  </span>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col items-center">
                  <span className="block text-slate-500 mb-1 font-semibold tracking-wide uppercase text-[10px]">AI Score</span>
                  <span className={`text-xl font-bold ${validationResult.metrics?.aiScore > 30 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {validationResult.metrics?.aiScore || 0}% AI
                  </span>
                </div>
              </div>

              {!validationResult.passed && validationResult.errors && validationResult.errors.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">Errors to Fix ({validationResult.errors.length})</h3>
                  <ul className="space-y-2">
                    {validationResult.errors.map((err: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span className="text-sm font-medium text-slate-700">{err}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
