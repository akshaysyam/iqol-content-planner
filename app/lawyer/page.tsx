// app/lawyer/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import DashboardLayout from "../components/DashboardLayout";
import { FileWarning, CheckCircle2, XCircle, Clock, Search, Layers, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
// We can use the same TipTap editor component in readOnly mode, or just render HTML.
// Using dangerouslySetInnerHTML is fine for read-only if we trust the source (which is from our own rich text editor).

export default function LawyerDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  
  // Rejection State
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  // Approval State
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [approveReason, setApproveReason] = useState("");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const userQuery = query(collection(db, "users"), where("email", "==", user.email.toLowerCase()));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const uid = userSnap.docs[0].id;
          setUserId(uid);
          fetchReviewTasks(uid);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchReviewTasks = (uid: string) => {
    setLoading(true);
    const q = query(
      collection(db, "topics"),
      where("lawyerId", "==", uid)
    );
    
    return onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tasksData.sort((a: any, b: any) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setTasks(tasksData);
      
      // Keep selectedTask in sync
      if (tasksData.length > 0) {
        setTasks(prevTasks => {
          return tasksData; // For trigger purposes
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (tasks.length > 0) {
      if (!selectedTask) {
         setSelectedTask(tasks[0]);
      } else {
         const freshTask = tasks.find(t => t.id === selectedTask.id);
         if (freshTask && JSON.stringify(freshTask) !== JSON.stringify(selectedTask)) {
             setSelectedTask(freshTask);
         }
      }
    } else if (tasks.length === 0 && selectedTask) {
      setSelectedTask(null);
    }
  }, [tasks]);

  const handleApprove = async () => {
    if (!selectedTask) return;
    try {
      const taskRef = doc(db, "topics", selectedTask.id);
      
      const newEvent = {
        type: "APPROVED",
        date: new Date().toISOString(),
        note: approveReason.trim() ? `Lawyer approved content: "${approveReason.trim()}"` : "Lawyer approved content for publishing."
      };
      const updatedEvents = [...(selectedTask.events || []), newEvent];

      await updateDoc(taskRef, { 
        status: "Legal_Approved",
        approvedAt: new Date().toISOString(),
        events: updatedEvents
      });
      alert("Content Approved for Publishing!");
      setShowApproveForm(false);
      setApproveReason("");
      
      // We no longer manually update the list; the onSnapshot listener handles it.
    } catch (error) {
      console.error("Error approving:", error);
      alert("Failed to approve task.");
    }
  };

  const handleReject = async () => {
    if (!selectedTask || !rejectReason.trim()) return;
    try {
      const taskRef = doc(db, "topics", selectedTask.id);
      
      const newEvent = {
        type: "REJECTED",
        date: new Date().toISOString(),
        note: `Lawyer requested revisions: "${rejectReason}"`
      };
      const updatedEvents = [...(selectedTask.events || []), newEvent];

      // 1. Update task status back to Needs_Revision and store rejection note
      await updateDoc(taskRef, { 
        status: "Needs_Revision",
        rejectionNote: rejectReason,
        events: updatedEvents
      });

      // 2. Add revision note
      await addDoc(collection(db, "revisionNotes"), {
        taskId: selectedTask.id,
        authorId: userId,
        authorRole: "Lawyer",
        comment: rejectReason,
        createdAt: new Date().toISOString()
      });

      alert("Task sent back to Writer for revision.");
      setShowRejectForm(false);
      setRejectReason("");
      
      // We no longer manually update the list; the onSnapshot listener handles it.
    } catch (error) {
      console.error("Error rejecting:", error);
      alert("Failed to send revision notes.");
    }
  };

  return (
    <DashboardLayout requiredRoles={["Lawyer", "Platform Admin", "Content Manager"]}>
      <div className="flex h-[calc(100vh-8rem)] gap-6">
        
        {/* Left Sidebar: Pending Reviews */}
        <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-500" />
              Pending Review
            </h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">
              {tasks.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center py-10 text-slate-500">Loading queue...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10 text-slate-500 flex flex-col items-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
                <p>No content pending review.</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div 
                  key={task.id} 
                  onClick={() => {
                    setSelectedTask(task);
                    setShowRejectForm(false);
                    setShowApproveForm(false);
                  }}
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
                    {task.lastUpdated && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(task.lastUpdated))}
                      </span>
                    )}
                  </div>
                  <h3 className={`font-medium line-clamp-2 ${selectedTask?.id === task.id ? "text-blue-900" : "text-slate-800"}`}>
                    {task.title}
                  </h3>

                  {/* Timeline History */}
                  {selectedTask?.id === task.id && task.events && task.events.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-2">History</p>
                      <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                        {task.events.map((evt: any, i: number) => (
                           <div key={i} className="relative flex items-start gap-3 text-xs">
                             <div className={`mt-0.5 relative z-10 w-2.5 h-2.5 rounded-full shrink-0 border-2 border-white shadow-sm ${
                               evt.type === 'ASSIGNED' ? 'bg-blue-400' :
                               evt.type === 'SUBMITTED' ? 'bg-amber-400' :
                               evt.type === 'REJECTED' ? 'bg-red-500' :
                               evt.type === 'APPROVED' ? 'bg-emerald-500' : 'bg-slate-400'
                             }`}></div>
                             <div className="flex-1">
                               <p className="font-medium text-slate-700">{evt.note}</p>
                               <span className="text-[10px] text-slate-400 font-medium">
                                  {formatDistanceToNow(new Date(evt.date))} ago
                               </span>
                             </div>
                           </div>
                        ))}
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

        {/* Right Content: Read Only Viewer */}
        <div className="flex-1 flex flex-col h-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
          {selectedTask ? (
            <>
              {/* Header Actions */}
              <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-start">
                <div className="max-w-[70%]">
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">{selectedTask.title}</h1>
                  <span className="flex items-center w-fit gap-1 bg-slate-100 px-2 py-1 rounded-md text-sm text-slate-600">
                    <Layers className="h-4 w-4" /> Brand: <strong className="text-slate-800">{selectedTask.brand}</strong>
                  </span>
                </div>
                <div className="flex gap-2">
                  {selectedTask.status === 'Legal_Review' ? (
                    <>
                      <button 
                        onClick={() => { setShowRejectForm(!showRejectForm); setShowApproveForm(false); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="h-4 w-4" /> Reject & Return
                      </button>
                      <button 
                        onClick={() => { setShowApproveForm(!showApproveForm); setShowRejectForm(false); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve Content
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center px-4 py-2 text-sm font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-lg">
                      Read Only: {selectedTask.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Reject Form Modal Overlay */}
              {showRejectForm && (
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-10 flex items-center justify-center p-6">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <FileWarning className="shrink-0 text-red-500" /> Revision Notes
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Explain why this content cannot be approved. It will be sent back to the writer's dashboard.
                    </p>
                    <textarea 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g., The claim in paragraph 2 needs a disclaimer..."
                      className="w-full h-32 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none mb-4"
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setShowRejectForm(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleReject}
                        className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                      >
                        Send Revision Note
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Approve Form Modal Overlay */}
              {showApproveForm && (
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-10 flex items-center justify-center p-6">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="shrink-0 text-emerald-500" /> Approval Notes (Optional)
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Add an optional comment before sending this to the Content Manager for final SEO review.
                    </p>
                    <textarea 
                      value={approveReason}
                      onChange={(e) => setApproveReason(e.target.value)}
                      placeholder="e.g., Looks great, approved for publishing."
                      className="w-full h-32 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none resize-none mb-4"
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setShowApproveForm(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleApprove}
                        className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                      >
                        Confirm Approval
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Viewer */}
              <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
                <div className="max-w-3xl mx-auto bg-white p-10 rounded-xl shadow-sm border border-slate-100">
                  <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: selectedTask.content || "<p className='text-slate-400'>No content provided.</p>" }} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <ShieldCheck className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-lg">Select a task on the left to review it.</p>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
