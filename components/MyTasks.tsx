import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CustomUser, TaskRole, Project, Revision, ChatMessage, TaskReport } from '../types/types'; // مسیر types خود را چک کنید
import { apiClient } from '../lib/api';
import { gregorianToJalaliString, gregorianToJalaliDateTime, timeOnly } from '../utils/jalali'; // مسیر api خود را چک کنید
import {
  ArrowLeft, CheckCircle, MessageSquare, Briefcase, Clock,
  Check, Send, Sun, Moon, AlertTriangle, Trash2,
  AlertOctagon, Sparkles, FileText, Compass, Hourglass, Gauge,
  Paperclip, Image, File, X, Download
} from 'lucide-react';

interface MyTasksProps {
  users?: CustomUser[];
  projects: Project[];
  revisions: Revision[];
  taskRoles: TaskRole[];
  tasks: any[];
  chatMessages: ChatMessage[];
  onExit: () => void;
  onAddChatMessage: (taskId: string, userId: string, text: string, file?: File | null) => void;
  onGlobalProgressUpdate: (revisionId: string, taskId: string, progress: number) => void;
  isLightMode?: boolean;
  onToggleTheme?: () => void;
  currentUser?: CustomUser | null;
}

// === Helper برای نمایش زیباتر زمان ===
const formatDecimalTime = (decimalHours: number) => {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `0h`;
};

export default function MyTasks({
                                  users = [],
                                  projects,
                                  revisions,
                                  taskRoles,
                                  tasks,
                                  chatMessages,
                                  onExit,
                                  onAddChatMessage,
                                  onGlobalProgressUpdate,
                                  isLightMode,
                                  onToggleTheme,
                                  currentUser
                                }: MyTasksProps) {

  const userId = currentUser?.id || users[0]?.id || '';
  const [selectedTaskObj, setSelectedTaskObj] = useState<any>(null);

  // Dashboard states
  const [activeTab, setActiveTab] = useState<'report' | 'chat' | 'history'>('report');
  const [taskQuery, setTaskQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all'); // استیت جدید برای فیلتر نقش

  // Structured Report Form States
  const [reportStatus, setReportStatus] = useState<'on-track' | 'at-risk' | 'blocked' | 'completed'>('on-track');
  const [reportProgress, setReportProgress] = useState<number>(0);

  // تغییر به دو استیت جداگانه برای ساعت و دقیقه
  const [timeSpentHours, setTimeSpentHours] = useState<number>(4);
  const [timeSpentMinutes, setTimeSpentMinutes] = useState<number>(0);

  const [blockersText, setBlockersText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatFilePreview, setChatFilePreview] = useState<string | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // API Data States
  const [reports, setReports] = useState<TaskReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // === Helper Function ===
  const mapBackendToReport = (data: any): TaskReport => ({
    id: data.id,
    taskId: data.task,
    userId: data.user,
    timestamp: data.timestamp,
    status: data.status,
    timeSpentHours: parseFloat(data.time_spent_hours),
    progressPercent: data.progress_percent,
    blockers: data.blockers,
    notes: data.notes,
    isApproved: data.is_approved,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
  });

  // === Fetch Task Reports from API ===
  useEffect(() => {
    if (!selectedTaskObj) return;

    setIsLoadingReports(true);
    apiClient.get(`/planning/task-reports/?task_id=${selectedTaskObj.task.id}`)
        .then(res => {
          const mappedReports = res.data.results ? res.data.results.map(mapBackendToReport) : res.data.map(mapBackendToReport);
          setReports(mappedReports);

          if (mappedReports.length > 0) {
            const sorted = [...mappedReports].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setReportProgress(sorted[0].progressPercent);
            setReportStatus(sorted[0].status);
            setBlockersText(sorted[0].blockers || '');
          } else {
            setReportProgress(selectedTaskObj.task.progress || 0);
            setReportStatus(selectedTaskObj.task.progress === 100 ? 'completed' : 'on-track');
            setBlockersText('');
          }
          setNotesText('');
          setFormSuccess(false);
        })
        .catch(err => console.error("Error fetching reports:", err))
        .finally(() => setIsLoadingReports(false));
  }, [selectedTaskObj?.task?.id]);

  // === 1. Retrieve & Deduplicate Assigned Tasks ===
  const userTasks = useMemo(() => {
    if (!userId || !taskRoles || !tasks) return [];

    const roles = taskRoles.filter(tr => String(tr.userId) === String(userId));
    const uniqueTasksMap = new Map();

    for (const role of roles) {
      if (uniqueTasksMap.has(role.taskId)) {
        uniqueTasksMap.get(role.taskId).roles.push(role);
        continue;
      }

      const taskItem = tasks.find((t) => String(t.id) === String(role.taskId));
      if (taskItem) {
        const rev = revisions.find(r => String(r.id) === String(role.revisionId));
        const proj = projects.find(p => String(p.id) === String(rev?.projectId));

        uniqueTasksMap.set(role.taskId, {
          roles: [role],
          task: taskItem,
          proj,
          rev,
        });
      }
    }
    return Array.from(uniqueTasksMap.values());
  }, [userId, taskRoles, revisions, projects, tasks]);

  // === 2. Extract Unique Roles for Filter Dropdown ===
  const availableRoles = useMemo(() => {
    if (!taskRoles || !userId) return [];
    const roleSet = new Set<string>();
    const userRoles = taskRoles.filter(tr => String(tr.userId) === String(userId));

    userRoles.forEach(r => {
      // پیدا کردن عنوان نقش بر اساس ساختار بک‌اند شما
      const roleName = (r as any).role || (r as any).name || (r as any).roleName || (r as any).title;
      if (roleName) roleSet.add(roleName);
    });

    return Array.from(roleSet);
  }, [taskRoles, userId]);

  // === 3. Filter Tasks ===
  const filteredTasks = useMemo(() => {
    let filtered = userTasks;

    // اعمال فیلتر بر اساس نقش انتخاب شده در Dropdown
    if (selectedRoleFilter !== 'all') {
      filtered = filtered.filter(t =>
          t.roles.some((r: any) =>
              (r.role || r.name || r.roleName || r.title) === selectedRoleFilter
          )
      );
    }

    // اعمال فیلتر متنی
    if (taskQuery.trim()) {
      const q = taskQuery.toLowerCase();
      filtered = filtered.filter(t =>
          t.task.name.toLowerCase().includes(q) ||
          (t.task.code && t.task.code.toLowerCase().includes(q)) ||
          (t.proj && t.proj.name.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [userTasks, taskQuery, selectedRoleFilter]);

  // === 4. Compute Metrics ===
  const metrics = useMemo(() => {
    // آمارها بر اساس تسک‌های فیلتر شده محاسبه می‌شوند
    const total = filteredTasks.length;
    if (total === 0) return { total: 0, completed: 0, blocked: 0, avgProgress: 0 };

    const completed = filteredTasks.filter(t => t.task.progress === 100).length;
    const blocked = 0;
    const sumProgress = filteredTasks.reduce((acc, curr) => acc + (curr.task.progress || 0), 0);
    const avgProgress = Math.round(sumProgress / total);

    return { total, completed, blocked, avgProgress };
  }, [filteredTasks]);

  // === Handlers ===
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskObj) return;

    // محاسبه زمان کل به صورت اعشاری (مثلا 4 ساعت و 30 دقیقه می‌شود 4.5)
    const totalDecimalHours = Number(timeSpentHours) + (Number(timeSpentMinutes) / 60);
    const actualStatus = reportProgress === 100 ? 'completed' : reportStatus;

    const payload = {
      task: selectedTaskObj.task.id,
      status: actualStatus,
      progress_percent: reportProgress,
      time_spent_hours: totalDecimalHours,
      blockers: (actualStatus === 'blocked' || actualStatus === 'at-risk') ? blockersText.trim() : '',
      notes: notesText.trim() || 'Logged status progress update.',
    };

    try {
      const res = await apiClient.post('/planning/task-reports/', payload);
      const newReport = mapBackendToReport(res.data);
      setReports(prev => [newReport, ...prev]);

      onGlobalProgressUpdate(selectedTaskObj.rev.id, selectedTaskObj.task.id, reportProgress);

      const statusEmoji = {
        'on-track': '🟢 [ON-TRACK]',
        'at-risk': '🟡 [AT-RISK]',
        'blocked': '🔴 [CRITICAL BLOCKER]',
        'completed': '🔵 [COMPLETED]'
      }[actualStatus];

      // پیام اطلاع رسانی چت با نمایش دقیق ساعت و دقیقه
      const timeSpentStr = `${timeSpentHours}h ${timeSpentMinutes > 0 ? `${timeSpentMinutes}m` : ''}`.trim();
      const reportMessage = `📢 **FORMAL TASK REPORT SUBMITTED**\nStatus: **${statusEmoji}**\nProgress Level: **${reportProgress}%**\nLogged Work Duration: **${timeSpentStr}**\nProgress Notes: "${newReport.notes}"\n${newReport.blockers ? `⚠️ Filed Blockers: "${newReport.blockers}"` : ''}`;

      onAddChatMessage(selectedTaskObj.task.id, userId, reportMessage);

      setFormSuccess(true);
      setTimeout(() => {
        setFormSuccess(false);
        setActiveTab('history');
      }, 1200);
    } catch (error) {
      console.error("خطا در ثبت:", error);
      alert("خطا در ارتباط با سرور جهت ثبت گزارش.");
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await apiClient.delete(`/planning/task-reports/${reportId}/`);
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  return (
      <div className="h-full flex flex-col font-sans" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

        {/* --- MAIN CONTAINER --- */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

          {/* --- LEFT COLUMN: SIDEBAR --- */}
          <div className="w-full md:w-[350px] lg:w-[380px] shrink-0 border-r border-white/10  flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/5 space-y-4" style={{ backgroundColor: 'var(--overlay-bg)' }}>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className=" border border-white/5 p-2 rounded-xl">
                  <div className="text-[9px] text-slate-500  uppercase font-mono font-bold">Allocated Tasks</div>
                  <div className="text-base font-black text-slate-200 font-mono mt-0.5">{metrics.total}</div>
                </div>
                <div className=" border border-white/5 p-2 rounded-xl">
                  <div className="text-[9px] text-slate-500 uppercase font-mono font-bold">Avg Progress</div>
                  <div className="text-base font-black text-cyan-400 font-mono mt-0.5">{metrics.avgProgress}%</div>
                </div>
                <div className=" border border-white/5 p-2 rounded-xl">
                  <div className="text-[9px] text-slate-500 uppercase font-mono font-bold">Critical Blocked</div>
                  <div className="text-sm font-black text-rose-400 font-mono mt-0.5 flex items-center justify-center gap-1">
                    <span>{metrics.blocked}</span>
                    {metrics.blocked > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />}
                  </div>
                </div>
                <div className="dark:bg-black border border-white/5 p-2 rounded-xl">
                  <div className="text-[9px] text-slate-500 uppercase font-mono font-bold">Fully Completed</div>
                  <div className="text-base font-black text-emerald-400 font-mono mt-0.5">{metrics.completed}</div>
                </div>
              </div>

              {/* Box جستجو و لیست کشویی نقش‌ها */}
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <input type="text" placeholder="Search assigned activities..." value={taskQuery} onChange={e => setTaskQuery(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl pl-3 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60" />
                  {taskQuery && (
                      <button onClick={() => setTaskQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-200 bg-white/5 border border-white/10 rounded px-1.5 py-0.2 transition-colors">Clear</button>
                  )}
                </div>

                {availableRoles.length > 0 && (
                    <select
                        value={selectedRoleFilter}
                        onChange={(e) => setSelectedRoleFilter(e.target.value)}
                        className="bg-black/40 border border-white/5 rounded-xl px-2 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400/60 font-mono outline-none cursor-pointer hover:bg-black/60 transition-colors"
                    >
                      <option value="all">All Roles</option>
                      {availableRoles.map(role => (
                          <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
              {filteredTasks.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Compass className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-spin duration-1000" />
                    <h4 className="text-xs font-bold text-slate-400">No Assigned Tasks Found</h4>
                    <p className="text-[10px] max-w-[200px] mx-auto mt-1 leading-relaxed">Ensure task roles are assigned, or search another coworker descriptor.</p>
                  </div>
              ) : (
                  filteredTasks.map(t => {
                    const isSelected = selectedTaskObj?.task.id === t.task.id;
                    const progress = t.task.progress || 0;
                    let statusBadge = <span className="bg-cyan-500/5 border border-cyan-500/20 text-cyan-300 font-mono font-bold text-[8px] uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0">ON-TRACK</span>;

                    if (progress === 100) {
                      statusBadge = <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-[8px] uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0">DONE</span>;
                    }

                    return (
                        <button key={t.task.id} onClick={() => setSelectedTaskObj(t)} type="button" className={`w-full text-left p-4 rounded-2xl border transition-all relative group flex flex-col ${isSelected ? 'bg-white/10 border-cyan-500/40 shadow-xl' : 'bg-white/5 border-white/5 hover:border-white/15 hover:bg-white/10'}`}>
                          {t.task.metrics?.isCritical && (
                              <div className="absolute top-0 right-12 translate-y-[-50%] bg-rose-500 text-white font-mono font-bold text-[7px] tracking-widest uppercase px-2 py-0.5 rounded-full shadow border border-white/10">Critical</div>
                          )}
                          <div className="flex items-start justify-between gap-3 mb-2 w-full">
                            <h3 className={`text-xs font-bold leading-tight truncate pr-1 flex-1 ${isSelected ? 'text-cyan-300' : 'text-slate-200 group-hover:text-cyan-400 duration-100'}`}>{t.task.name}</h3>
                            {statusBadge}
                          </div>
                          <div className="space-y-1 sm:space-y-1.5 text-[10px] text-slate-400">
                            <div className="flex items-center gap-1.5 truncate">
                              <Briefcase className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="truncate">{t.proj?.name || 'Project'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
                                <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span>{gregorianToJalaliString(t.task.startDate)} to {gregorianToJalaliString(t.task.endDate)}</span>
                              </div>
                              <span className="text-[9px] font-mono text-cyan-300 font-medium tracking-tight bg-white/5 border border-white/10 rounded px-1">{t.task.code}</span>
                            </div>
                          </div>

                          {/* نمایش تگ نقش‌ها و میزان پیشرفت */}
                          <div className="mt-3 w-full">
                            <div className="flex flex-wrap gap-1.5 mb-2.5">
                              {t.roles.map((r: any, idx: number) => {
                                const roleName = r.role || r.name || r.roleName || r.title || 'Assigned';
                                return (
                                    <span key={idx} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono font-bold text-[8px] uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0">
                                    {roleName}
                                  </span>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mb-1">
                              <span>Progress Level</span>
                              <span className="font-bold text-slate-300">{progress}%</span>
                            </div>
                            <div className="relative w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                              <div className={`absolute h-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </button>
                    )
                  })
              )}
            </div>
          </div>

          {/* --- RIGHT COLUMN: WORKSPACE --- */}
          <div className="flex-1 flex flex-col overflow-hidden relative" style={{ backgroundColor: 'var(--bg-primary)' }}>

            {!selectedTaskObj ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-5">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500/5 to-indigo-500/5 flex items-center justify-center border border-white/10 shadow-lg relative">
                    <CheckCircle className="w-12 h-12 text-cyan-400/40" />
                    <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-cyan-400 border border-[#0a0f1d] rounded-full animate-ping" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] text-cyan-400 font-mono font-bold tracking-widest uppercase bg-cyan-400/10 px-2.5 py-1 rounded-full border border-cyan-400/20">Operational Dashboard</span>
                    <h2 className="text-lg font-black text-slate-200 tracking-tight">Select Assigned Activity to Log Progress</h2>
                    <p className="text-xs max-w-sm text-slate-400 leading-normal">Click on any task in your current work roster to file formal progress summaries, submit hours logged, post active communication notes, and report critical blockers.</p>
                  </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden animate-fade-in duration-200" key={selectedTaskObj.task.id}>

                  <div className="px-6 py-5 border-b border-white/10" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 leading-tight">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">Active Task Node</span>
                          <span className="h-3 w-px bg-white/15" />
                          <span className="text-[10px] font-mono text-slate-400">{selectedTaskObj.proj?.name || 'Project'} // Rev {selectedTaskObj.rev?.number || 1}</span>
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2.5 capitalize leading-normal">
                          {selectedTaskObj.task.name}
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-black/40 rounded border border-white/10 text-cyan-300">{selectedTaskObj.task.code || 'CODE'}</span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-3 self-start sm:self-auto">
                        <div className="text-right leading-none sm:text-right">
                          <span className="text-[9px] text-slate-500 block uppercase font-mono mb-1">Duration Scheduled</span>
                          <span className="text-xs font-bold text-slate-300 font-mono bg-black/20 border border-white/5 px-2.5 py-1 rounded-lg">{selectedTaskObj.task.duration} working days</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-white/10 px-6 py-2 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTab('report')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-sans transition-all border ${activeTab === 'report' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'}`}>
                        <FileText className="w-4 h-4 text-cyan-400" /><span>Submit Report (ثبت عملکرد)</span>
                      </button>
                      <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-sans transition-all border ${activeTab === 'chat' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'}`}>
                        <MessageSquare className="w-4 h-4 text-cyan-400" /><span>Collaborate Thread (چت)</span>
                      </button>
                      <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-sans transition-all border relative ${activeTab === 'history' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'}`}>
                        <Clock className="w-4 h-4 text-[#818cf8]" /><span>Report Archive (گزارشات)</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">{reports.length}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden relative flex flex-col">
                    {isLoadingReports && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                          <Gauge className="w-8 h-8 text-cyan-500 animate-spin" />
                        </div>
                    )}

                    {/* --- REPORT TAB --- */}
                    {activeTab === 'report' && (
                        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-6 scrollbar-thin">
                          {formSuccess ? (
                              <div className="flex flex-col items-center justify-center text-center p-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4 max-w-xl mx-auto">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md animate-bounce"><Check className="w-8 h-8" /></div>
                                <div className="space-y-1">
                                  <h4 className="text-base font-extrabold text-white">Report Successfully Compiled!</h4>
                                  <p className="text-xs text-slate-400">Your logged progress percent, work done hours and blockers were synchronized to database state.</p>
                                </div>
                              </div>
                          ) : (
                              <form onSubmit={handleReportSubmit} className="max-w-3xl space-y-5">

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {/* Progress % Card */}
                                  <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-3 shadow-inner">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-300">ACTUAL WORK % COMPLETE</span>
                                      <span className="text-xs font-extrabold font-mono text-cyan-400">{reportProgress}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={reportProgress} onChange={e => setReportProgress(Number(e.target.value))} className="w-full accent-cyan-500 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                      <span>0% Idle</span>
                                      <button type="button" onClick={() => setReportProgress(100)} className="text-cyan-400 hover:underline hover:text-cyan-305">Jump to Completed</button>
                                    </div>
                                  </div>

                                  {/* Time Spent (Hour & Minute) Card */}
                                  <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-3 shadow-inner flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Hourglass className="w-3.5 h-3.5 text-cyan-400" /> TIME SPENT</span>
                                      <span className="text-xs font-bold font-mono text-indigo-400">{timeSpentHours}h {timeSpentMinutes}m</span>
                                    </div>

                                    <div className="flex items-center gap-2" dir="ltr">
                                      {/* بخش ساعت */}
                                      <div className="flex-1 flex items-center border border-white/15 focus-within:border-cyan-400 rounded-lg overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-input)' }}>
                                        <input
                                            type="number"
                                            min="0" max="99"
                                            value={timeSpentHours}
                                            onChange={e => setTimeSpentHours(Math.max(0, Number(e.target.value)))}
                                            className="w-full text-center bg-transparent py-1.5 text-xs text-white focus:outline-none font-mono placeholder-slate-600"
                                            placeholder="0"
                                        />
                                        <span className="text-[10px] text-slate-500 pr-2 font-mono">h</span>
                                      </div>
                                      <span className="text-slate-500 font-bold">:</span>
                                      {/* بخش دقیقه */}
                                      <div className="flex-1 flex items-center border border-white/15 focus-within:border-cyan-400 rounded-lg overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg-input)' }}>
                                        <input
                                            type="number"
                                            min="0" max="59"
                                            value={timeSpentMinutes}
                                            onChange={e => {
                                              const val = Number(e.target.value);
                                              if(val <= 59 && val >= 0) setTimeSpentMinutes(val);
                                            }}
                                            className="w-full text-center bg-transparent py-1.5 text-xs text-white focus:outline-none font-mono placeholder-slate-600"
                                            placeholder="0"
                                        />
                                        <span className="text-[10px] text-slate-500 pr-2 font-mono">m</span>
                                      </div>
                                    </div>
                                    <span className="text-[9px] text-slate-500 font-mono block">ساعت و دقیقه صرف شده برای این وظیفه</span>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-widest">TASK RUNTIME HEALTH STATUS</label>
                                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <button type="button" onClick={() => setReportStatus('on-track')} className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col items-start gap-1 justify-between ${reportStatus === 'on-track' ? 'bg-cyan-500/10 border-cyan-500/50 text-[#22d3ee] shadow-lg shadow-cyan-500/5' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/15 hover:bg-white/5'}`}>
                                      <div className="flex items-center justify-between w-full"><CheckCircle className={`w-4 h-4 ${reportStatus === 'on-track' ? 'text-cyan-400' : 'text-slate-500'}`} /><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /></div>
                                      <div><h5 className="text-[11px] font-bold tracking-tight text-white uppercase mt-2">On Track</h5><span className="text-[9px] text-slate-500 font-sans block mt-0.5">برنامه‌ریزی‌شده</span></div>
                                    </button>
                                    <button type="button" onClick={() => setReportStatus('at-risk')} className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col items-start gap-1 justify-between ${reportStatus === 'at-risk' ? 'bg-amber-500/10 border-amber-500/50 text-[#fbbf24] shadow-lg shadow-amber-500/5' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/15 hover:bg-white/5'}`}>
                                      <div className="flex items-center justify-between w-full"><AlertTriangle className={`w-4 h-4 ${reportStatus === 'at-risk' ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} /><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /></div>
                                      <div><h5 className="text-[11px] font-bold tracking-tight text-white uppercase mt-2">At Risk</h5><span className="text-[9px] text-slate-500 font-sans block mt-0.5">در معرض تاخیر/خطر</span></div>
                                    </button>
                                    <button type="button" onClick={() => setReportStatus('blocked')} className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col items-start gap-1 justify-between ${reportStatus === 'blocked' ? 'bg-rose-500/10 border-rose-500/50 text-[#f43f5e] shadow-lg shadow-rose-500/5' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/15 hover:bg-white/5'}`}>
                                      <div className="flex items-center justify-between w-full"><AlertOctagon className={`w-4 h-4 ${reportStatus === 'blocked' ? 'text-rose-400 animate-shake' : 'text-slate-500'}`} /><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /></div>
                                      <div><h5 className="text-[11px] font-bold tracking-tight text-white uppercase mt-2">Blocked</h5><span className="text-[9px] text-slate-500 font-sans block mt-0.5">متوقف / بلاک‌شده</span></div>
                                    </button>
                                    <button type="button" onClick={() => { setReportStatus('completed'); setReportProgress(100); }} className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col items-start gap-1 justify-between ${reportStatus === 'completed' ? 'bg-emerald-500/10 border-emerald-500/50 text-[#34d399] shadow-lg shadow-emerald-500/5' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/15 hover:bg-white/5'}`}>
                                      <div className="flex items-center justify-between w-full"><CheckCircle className={`w-4 h-4 ${reportStatus === 'completed' ? 'text-emerald-400' : 'text-slate-500'}`} /><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /></div>
                                      <div><h5 className="text-[11px] font-bold tracking-tight text-white uppercase mt-2">Completed</h5><span className="text-[9px] text-slate-500 font-sans block mt-0.5">کامل‌شده و تحویلی</span></div>
                                    </button>
                                  </div>
                                </div>

                                {(reportStatus === 'blocked' || reportStatus === 'at-risk') && (
                                    <div className="space-y-1 animate-fade-in duration-300">
                                      <label className="text-[11px] font-bold font-mono text-rose-400 uppercase tracking-widest flex items-center gap-1.5"><AlertOctagon className="w-3.5 h-3.5 text-rose-500" /> Obstacles & Critical Blockers (موانع عینی)</label>
                                      <textarea required value={blockersText} onChange={e => setBlockersText(e.target.value)} rows={3} placeholder="Describe the dependencies, material shortages, or code errors..." className="w-full bg-[#1b1115] border border-rose-505 border-rose-500/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 text-slate-200 placeholder-rose-900/60 rounded-xl px-4 py-3 text-xs focus:outline-none transition-all font-sans" />
                                    </div>
                                )}

                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-widest block">Progress Description & Notes (توضیحات پیشرفت کار)</label>
                                  <textarea required value={notesText} onChange={e => setNotesText(e.target.value)} rows={4} placeholder="Type a verbose log of kpi achievements, files edited..." className="w-full bg-black/40 border border-white/10 focus:border-cyan-400 text-slate-200 placeholder-slate-650 rounded-xl px-4 py-3 text-xs focus:outline-none transition-all font-sans" />
                                </div>

                                <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-cyan-500/10 flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 duration-155">
                                  <CheckCircle className="w-5 h-5 text-white" /><span>Submit Report to Project Board (ثبت گزارش)</span>
                                </button>
                              </form>
                          )}
                        </div>
                    )}

                    {/* --- CHAT TAB --- */}
                    {activeTab === 'chat' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                          <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-4 scrollbar-thin flex flex-col">
                            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><MessageSquare className="w-4 h-4 text-cyan-400 animate-pulse" /> Live Coordination Thread</h3>
                            <div className="flex-1 flex flex-col gap-4">
                              {(() => {
                                const msgs = chatMessages
                                    .filter(m => m.taskId === selectedTaskObj.task.id)
                                    .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                                if (msgs.length === 0) {
                                  return <div className="text-xs text-slate-500 italic py-4 bg-white/[0.02] px-4 rounded-xl border border-white/5 self-start max-w-sm">No previous coordination messages found. Any submitted formal report is automatically announced here!</div>;
                                }

                                return msgs.map(msg => {
                                  const sender = users?.find(u => u.id === msg.userId) || currentUser;
                                  const isMe = msg.userId === userId;
                                  const isReportNode = msg.text.includes('FORMAL TASK REPORT');
                                  const isImage = msg.fileType?.startsWith('image/');

                                  return (
                                      <div key={msg.id} className={`max-w-xl p-4 rounded-2xl shadow-md border ${isMe ? 'self-end bg-white/10 border-cyan-500/30' : isReportNode ? 'self-start bg-white/5 border-indigo-500/30 w-full' : 'self-start bg-white/5 border-white/10'}`}>
                                        <div className="flex items-center justify-between gap-6 mb-2">
                                          <div className="flex items-center gap-1.5">
                                            <div className={`w-4 h-4 text-[9px] font-black font-mono rounded flex items-center justify-center ${isMe ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700 text-slate-300'}`}>
                                              {sender?.username.substring(0,2).toUpperCase() || 'U'}
                                            </div>
                                            <span className={`text-xs font-bold ${isMe ? 'text-cyan-300' : 'text-slate-350'}`}>{sender?.username || 'System Pool'} {isMe && '(You)'}</span>
                                          </div>
                                          <span className="text-[10px] text-slate-500 font-mono">{gregorianToJalaliString(msg.timestamp)} {timeOnly(msg.timestamp)}</span>
                                        </div>

                                        {/* Text content */}
                                        {msg.text && (
                                            <div className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap selection:bg-cyan-500/30">{msg.text}</div>
                                        )}

                                        {/* File attachment display */}
                                        {msg.fileUrl && (
                                            <div className="mt-3">
                                              {isImage ? (
                                                  <div className="rounded-xl overflow-hidden border border-white/10 max-w-[280px]">
                                                    <img
                                                        src={msg.fileUrl}
                                                        alt={msg.fileName || 'Attached image'}
                                                        className="w-full h-auto max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => window.open(msg.fileUrl!, '_blank')}
                                                    />
                                                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/20 text-[10px] text-slate-400">
                                                      <span className="truncate max-w-[180px]">{msg.fileName}</span>
                                                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300"><Download className="w-3 h-3" /></a>
                                                    </div>
                                                  </div>
                                              ) : (
                                                  <a
                                                      href={msg.fileUrl}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/10 bg-black/20 hover:bg-white/5 transition-colors max-w-[280px]"
                                                  >
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                                                      <File className="w-4 h-4 text-indigo-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="text-xs text-slate-200 font-medium truncate">{msg.fileName || 'Attachment'}</div>
                                                      <div className="text-[10px] text-slate-500 font-mono">{msg.fileType || 'file'}</div>
                                                    </div>
                                                    <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                  </a>
                                              )}
                                            </div>
                                        )}
                                      </div>
                                  )
                                })
                              })()}
                            </div>
                          </div>

                          {/* File preview bar */}
                          {chatFile && (
                              <div className="px-6 py-2 border-t border-white/5 flex items-center gap-3" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                                {chatFilePreview ? (
                                    <img src={chatFilePreview} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                                      <File className="w-5 h-5 text-indigo-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-slate-200 font-medium truncate">{chatFile.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{(chatFile.size / 1024).toFixed(1)} KB</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setChatFile(null); setChatFilePreview(null); }}
                                    className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                          )}

                          {/* Chat input form with attach button */}
                          <form
                              onSubmit={e => {
                                e.preventDefault();
                                if (!chatInput.trim() && !chatFile) return;
                                onAddChatMessage(selectedTaskObj.task.id, userId, chatInput.trim(), chatFile);
                                setChatInput('');
                                setChatFile(null);
                                setChatFilePreview(null);
                              }}
                              className="p-4 sm:px-6 sm:py-4 border-t border-white/10 shrink-0 flex items-center gap-2"
                              style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            {/* Hidden file input */}
                            <input
                                ref={chatFileInputRef}
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setChatFile(file);
                                    if (file.type.startsWith('image/')) {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => setChatFilePreview(ev.target?.result as string);
                                      reader.readAsDataURL(file);
                                    } else {
                                      setChatFilePreview(null);
                                    }
                                  }
                                  e.target.value = '';
                                }}
                            />

                            {/* Attach button */}
                            <button
                                type="button"
                                onClick={() => chatFileInputRef.current?.click()}
                                className="p-2.5 hover:bg-white/5 text-slate-400 hover:text-cyan-400 rounded-xl border border-white/10 transition-colors shrink-0"
                                title="Attach file or image"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>

                            {/* Text input */}
                            <input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="Post a coordination update..."
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
                            />

                            {/* Send button */}
                            <button
                                type="submit"
                                disabled={!chatInput.trim() && !chatFile}
                                className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-650 text-white p-3 md:px-5 rounded-xl transition-colors shrink-0 flex items-center gap-2 font-bold text-xs shadow-lg shadow-cyan-500/10 active:scale-95 duration-100 cursor-pointer"
                            >
                              <Send className="w-4 h-4" /><span className="hidden md:inline">Send</span>
                            </button>
                          </form>
                        </div>
                    )}

                    {/* --- HISTORY TAB --- */}
                    {activeTab === 'history' && (
                        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-6 scrollbar-thin">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><FileText className="w-4 h-4 text-cyan-400" />Formal Task Reports Historical Archive</h3>
                            <span className="text-[10px] text-slate-500 font-mono">Durable State Logs</span>
                          </div>

                          {(() => {
                            if (reports.length === 0) {
                              return (
                                  <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl p-6 bg-white/[0.01]">
                                    <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <h4 className="text-xs font-bold text-slate-400">No Structured Reports Filed Yet</h4>
                                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">You have not logged any formalized progress shifts under this profile.</p>
                                  </div>
                              );
                            }

                            return (
                                <div className="relative border-l border-white/10 pl-6 space-y-6 ml-3 my-4">
                                  {reports.map(rep => {
                                    const reporter = users?.find(u => u.id === rep.userId) || currentUser;
                                    let statusColor = 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20';
                                    if (rep.status === 'blocked') statusColor = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
                                    if (rep.status === 'at-risk') statusColor = 'bg-amber-400/10 text-amber-300 border-amber-400/25';
                                    if (rep.status === 'completed') statusColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';

                                    return (
                                        <div key={rep.id} className="relative group animate-fade-in">
                                          <div className="absolute left-[-31px] top-1 w-2.5 h-2.5 border-2 border-cyan-400 rounded-full group-hover:bg-cyan-400 duration-150 shrink-0" style={{ backgroundColor: 'var(--bg-primary)' }} />
                                          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md hover:border-white/10 transition-colors">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2.5">
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-200">{reporter?.username || 'User'}</span>
                                                <span className="text-[9px] text-slate-500 font-mono">({reporter?.employeeCode || 'SYS-STAFF'})</span>
                                              </div>
                                              <div className="flex items-center gap-2.5 ml-0 sm:ml-auto">
                                                <span className="text-[10px] text-slate-500 font-mono">{gregorianToJalaliDateTime(rep.timestamp)}</span>
                                                <button onClick={() => handleDeleteReport(rep.id)} className="p-1 px-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/10 rounded-lg transition-all cursor-pointer" title="Delete this report log">
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wide border ${statusColor}`}>{rep.status}</span>
                                              <span className="text-[9px] font-mono text-slate-350 bg-black/40 border border-white/5 px-2 py-0.5 rounded">📈 Progress: <strong className="text-cyan-400 font-bold">{rep.progressPercent}%</strong></span>
                                              {/* نمایش زمان تبدیل شده به ساعت و دقیقه در تاریخچه */}
                                              <span className="text-[9px] font-mono text-slate-350 bg-black/40 border border-white/5 px-2 py-0.5 rounded">⏱️ Work Duration: <strong className="text-indigo-400 font-bold">{formatDecimalTime(rep.timeSpentHours)}</strong></span>
                                            </div>

                                            <div className="space-y-2">
                                              <div className="text-xs text-slate-300 leading-relaxed font-sans bg-black/25 p-3 rounded-xl border border-white/5 whitespace-pre-wrap">{rep.notes}</div>
                                              {rep.blockers && (
                                                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 space-y-1">
                                                    <span className="text-[9px] font-mono font-bold text-rose-450 text-rose-300 uppercase tracking-widest flex items-center gap-1.5"><AlertOctagon className="w-3.5 h-3.5 text-rose-500" /> Critical Blockers Filed:</span>
                                                    <p className="text-xs text-slate-400 font-sans italic pl-1 leading-normal">"{rep.blockers}"</p>
                                                  </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                    );
                                  })}
                                </div>
                            );
                          })()}
                        </div>
                    )}
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}