import React, { useState, useMemo, useEffect } from 'react';
import {
    CustomUser,
    TaskRole,
    Project,
    Revision,
    ChatMessage,
    TaskReport
} from '../types/types'; // اطمینان حاصل کنید که مسیر types درست است
import { apiClient } from '../lib/api'; // اطمینان حاصل کنید که مسیر api درست است
import { gregorianToJalaliDateTime } from '../utils/jalali';
import {
    ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock,
    FileText, Compass, ClipboardCheck, Search, Briefcase,
    Hourglass, Check, X, Sparkles, Trash2, Edit, AlertOctagon
} from 'lucide-react';

interface ApprovalsPageProps {
    users?: CustomUser[];
    projects: Project[];
    revisions: Revision[];
    taskRoles: TaskRole[];
    tasks: any[]; // لیست تسک‌های دریافت شده از بک‌اند
    onExit: () => void;
    onAddChatMessage: (taskId: string, userId: string, text: string) => void;
    onGlobalProgressUpdate: (revisionId: string, taskId: string, progress: number) => void;
    isLightMode?: boolean;
    onToggleTheme?: () => void;
    currentUser?: CustomUser | null;
}

// === Helper برای نمایش زیباتر زمان ===
const formatDecimalTime = (decimalHours?: number) => {
    if (!decimalHours) return '0h';
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return `0h`;
};

export default function ApprovalsPage({
                                          users = [],
                                          projects,
                                          revisions,
                                          taskRoles,
                                          tasks,
                                          onExit,
                                          onAddChatMessage,
                                          onGlobalProgressUpdate,
                                          isLightMode,
                                          onToggleTheme,
                                          currentUser
                                      }: ApprovalsPageProps) {

    // Tabs: pending, historic
    const [activeTab, setActiveTab] = useState<'pending' | 'historic'>('pending');
    const [searchQuery, setSearchQuery] = useState('');

    // Rejection Dialog states
    const [rejectingReportId, setRejectingReportId] = useState<string | null>(null);
    const [rejectionFeedback, setRejectionFeedback] = useState('');

    // Edit Local states
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editProgress, setEditProgress] = useState<number>(0);
    const [editHours, setEditHours] = useState<number>(0);
    const [editMinutes, setEditMinutes] = useState<number>(0);
    const [editNotes, setEditNotes] = useState<string>('');

    // API Data
    const [reports, setReports] = useState<TaskReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // === Helper Function ===
    const mapBackendToReport = (data: any): TaskReport => ({
        id: data.id,
        taskId: data.task,
        userId: data.user,
        timestamp: data.timestamp,
        status: data.status,
        timeSpentHours: parseFloat(data.time_spent_hours || 0),
        progressPercent: data.progress_percent,
        blockers: data.blockers,
        notes: data.notes,
        // workflow دو‌مرحله‌ای
        approvalStatus: data.approval_status || (data.is_approved ? 'final_approved' : 'pending'),
        reviewerApprovedBy: data.reviewer_approved_by,
        reviewerApprovedAt: data.reviewer_approved_at,
        finalApprovedBy: data.final_approved_by,
        finalApprovedAt: data.final_approved_at,
        // legacy
        isApproved: data.is_approved,
        approvedBy: data.approved_by,
        approvedAt: data.approved_at,
    });

    // === Fetch All Reports (Pending & Historic) ===
    const fetchAllReports = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/planning/task-reports/');
            const mapped = res.data.results ? res.data.results.map(mapBackendToReport) : res.data.map(mapBackendToReport);
            setReports(mapped);
        } catch (error) {
            console.error("خطا در دریافت گزارشات:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllReports();
    }, []);

    // Map reports to rich structures including Task & Project Data
    const richReports = useMemo(() => {
        return reports.map(rep => {
            const taskItem = tasks.find(t => String(t.id) === String(rep.taskId));
            let revItem: Revision | null = null;
            let projItem: Project | null = null;


            if (taskItem) {
                const roleMatch = taskRoles.find(r => String(r.taskId) === String(taskItem.id) && String(r.userId) === String(rep.userId));

                if (roleMatch) {
                    // استفاده از یک const محلی برای کمک به درک بهترِ تایپ‌اسکریپت
                    const foundRev = revisions.find(r => String(r.id) === String(roleMatch.revisionId));

                    if (foundRev) {
                        revItem = foundRev;
                        // استفاده از علامت سوال (؟) تا اگر به هر دلیلی خالی بود، ارور ندهد
                        // @ts-ignore - برای نادیده گرفتن خطای احتمالی نبودن projectId در تایپ
                        const foundProj = projects.find(p => String(p.id) === String(foundRev?.projectId || (foundRev as any)?.project));

                        if (foundProj) {
                            projItem = foundProj;
                        }
                    }
                }
            }

            const reporter = users.find(u => String(u.id) === String(rep.userId));

            // نگاشتِ وضعیتِ بک‌اند به وضعیتِ UI:
            //   pending           → 'pending'        (منتظر تاییدِ بررسی‌کننده)
            //   reviewer_approved → 'awaiting_final' (منتظر تاییدِ نهاییِ مدیر برنامه‌ریزی — فقط شرکتی)
            //   final_approved    → 'approved'
            //   rejected          → 'rejected'
            const backendStatus = rep.approvalStatus || 'pending';
            let uiStatus: 'pending' | 'awaiting_final' | 'approved' | 'rejected';
            if (backendStatus === 'final_approved') uiStatus = 'approved';
            else if (backendStatus === 'rejected') uiStatus = 'rejected';
            else if (backendStatus === 'reviewer_approved') uiStatus = 'awaiting_final';
            else uiStatus = 'pending';

            return {
                ...rep,
                node: taskItem || null,
                rev: revItem || null,
                proj: projItem || null,
                reporter: reporter || null,
                approvalStatus: uiStatus,
                isCompanyScope: (projItem as any)?.scope === 'company'
            };
        });
    }, [reports, tasks, taskRoles, revisions, projects, users]);

    // Filter reports
    const filteredReports = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        return richReports.filter(rep => {
            // Tab filter — «pending» شاملِ مواردِ منتظرِ اقدام است:
            // هم گزارش‌های pending (تاییدِ بررسی‌کننده) و هم awaiting_final (تاییدِ نهایی)
            const needsAction = rep.approvalStatus === 'pending' || rep.approvalStatus === 'awaiting_final';
            if (activeTab === 'pending' && !needsAction) return false;
            if (activeTab === 'historic' && needsAction) return false;

            // Text query filter
            if (!query) return true;
            return (
                rep.notes?.toLowerCase().includes(query) ||
                rep.node?.name?.toLowerCase().includes(query) ||
                rep.proj?.name?.toLowerCase().includes(query) ||
                rep.reporter?.username?.toLowerCase().includes(query) ||
                rep.status?.toLowerCase().includes(query)
            );
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [richReports, searchQuery, activeTab]);

    // Statistics
    const stats = useMemo(() => {
        const pending = richReports.filter(r => r.approvalStatus === 'pending' || r.approvalStatus === 'awaiting_final').length;
        const approved = richReports.filter(r => r.approvalStatus === 'approved').length;
        const rejected = richReports.filter(r => r.approvalStatus === 'rejected').length;
        const totalHours = richReports.reduce((acc, curr) => acc + (curr.timeSpentHours || 0), 0);

        return { pending, approved, rejected, totalHours };
    }, [richReports]);

    // === Handlers ===

    // Approve via API (stage-aware)
    const handleApproveReport = async (reportId: string) => {
        const rep = richReports.find(r => r.id === reportId);
        if (!rep) return;

        try {
            const res = await apiClient.post(`/planning/task-reports/${reportId}/approve/`);
            // بک‌اند وضعیتِ جدید را برمی‌گرداند: reviewer_approved یا final_approved
            const newStatus: string = res.data?.approvalStatus || 'final_approved';
            const isFinal = newStatus === 'final_approved';

            setReports(prev => prev.map(r =>
                r.id === reportId
                    ? {
                        ...r,
                        approvalStatus: newStatus as any,
                        isApproved: isFinal,
                        ...(isFinal
                            ? { finalApprovedBy: currentUser?.id, finalApprovedAt: new Date().toISOString() }
                            : { reviewerApprovedBy: currentUser?.id, reviewerApprovedAt: new Date().toISOString() }),
                    }
                    : r
            ));

            // پیشرفت فقط هنگامِ تاییدِ نهایی روی گانت اعمال می‌شود
            if (isFinal && rep.rev && rep.node) {
                onGlobalProgressUpdate(rep.rev.id, rep.node.id, rep.progressPercent);
            }

            const actorName = currentUser?.username || 'Reviewer';
            const post = isFinal
                ? `✅ **Final Report Approval**\nBy: **${actorName}** (${currentUser?.jobTitle || 'Planning Manager'})\nRecorded Progress: **${rep.progressPercent}%**\nWork Duration: **${formatDecimalTime(rep.timeSpentHours)}**\n\n*The main schedule has been updated with these values.*`
                : `🔎 **Reviewer Approval Completed**\nBy: **${actorName}**\nProposed Progress: **${rep.progressPercent}%**\n\n*This report is awaiting final approval by the planning manager. Progress has not yet been applied to the Gantt chart.*`;

            onAddChatMessage(rep.taskId, currentUser?.id || 'pm_system', post);

        } catch (error: any) {
            console.error("خطا در تایید گزارش:", error);
            alert(error.response?.data?.detail || "Error connecting to server");
        }
    };

    // Rejection Flow
    const startRejectionFlow = (reportId: string) => {
        setRejectingReportId(reportId);
        setRejectionFeedback('');
    };

    const handleRejectReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectingReportId) return;

        const rep = richReports.find(r => r.id === rejectingReportId);
        if (!rep) return;

        const feedback = rejectionFeedback.trim() || 'Please revise the progress value. Notes lack detailing.';

        try {
            // استفاده از endpointِ واقعیِ reject (به‌جای هکِ نوشتن در notes)
            await apiClient.post(`/planning/task-reports/${rejectingReportId}/reject/`, {
                reason: feedback
            });

            setReports(prev => prev.map(r =>
                r.id === rejectingReportId
                    ? { ...r, approvalStatus: 'rejected' as any, isApproved: false }
                    : r
            ));

            const pmName = currentUser?.username || 'Reviewer';
            const rejectionPost = `⚠️ **Report Rejected / Needs Revision**\nBy: **${pmName}** (${currentUser?.jobTitle || 'Reviewer'})\nFeedback: "${feedback}"\n\n*Progress change to ${rep.progressPercent}% was not applied. The executor must review the feedback and submit a revised report.*`;

            onAddChatMessage(rep.taskId, currentUser?.id || 'pm_system', rejectionPost);

            setRejectingReportId(null);
            setRejectionFeedback('');
        } catch (error: any) {
            console.error("خطا در رد گزارش:", error);
            alert(error.response?.data?.detail || "Error rejecting report.");
        }
    };

    // Edit Values before approval
    const handleSaveEdit = async (reportId: string) => {
        const rep = reports.find(r => r.id === reportId);
        if (!rep) return;

        const totalDecimalHours = Number(editHours) + (Number(editMinutes) / 60);

        try {
            const res = await apiClient.patch(`/planning/task-reports/${reportId}/`, {
                progress_percent: editProgress,
                time_spent_hours: totalDecimalHours,
                notes: editNotes.trim()
            });

            const updatedReport = mapBackendToReport(res.data);

            setReports(prev => prev.map(r => r.id === reportId ? updatedReport : r));
            setEditingReportId(null);
        } catch (error) {
            console.error("خطا در ویرایش:", error);
            alert("Error editing report.");
        }
    };

    const handleDeleteReportLog = async (reportId: string) => {
        if (confirm("Are you sure you want to delete this historical log entry permanently?")) {
            try {
                await apiClient.delete(`/planning/task-reports/${reportId}/`);
                setReports(prev => prev.filter(r => r.id !== reportId));
            } catch (error) {
                console.error("Delete error:", error);
            }
        }
    };

    return (
        <div className="h-full flex flex-col font-sans overflow-hidden relative" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>


            {/* BODY CONTEXT ROWS */}
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-6 scrollbar-thin">

                {/* METADATA SUMMARY COUNTERS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl relative shadow-inner">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Pending Review</span>
                        <div className="text-2xl font-black font-mono text-amber-400 mt-1 flex items-center gap-2">
                            <span>{stats.pending}</span>
                            {stats.pending > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                        </div>
                    </div>
                    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl shadow-inner">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Approved Archive</span>
                        <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">{stats.approved}</span>
                    </div>
                    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl shadow-inner">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Returned for Rev</span>
                        <span className="text-2xl font-black font-mono text-rose-400 mt-1 block">{stats.rejected}</span>
                    </div>
                    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl shadow-inner">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Logged Work</span>
                        <span className="text-2xl font-black font-mono text-cyan-400 mt-1 block">{formatDecimalTime(stats.totalHours)}</span>
                    </div>
                </div>

                {/* LIST FILTERS & CONTROL PANEL */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2 border border-white/10 p-1 rounded-xl bg-black/20 shrink-0">
                        <button
                            onClick={() => { setActiveTab('pending'); setSearchQuery(''); }}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'pending' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Review ({stats.pending})</span>
                        </button>

                        <button
                            onClick={() => { setActiveTab('historic'); setSearchQuery(''); }}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeTab === 'historic' ? 'bg-slate-750 bg-white/10 text-white font-extrabold' : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Review History ({stats.approved + stats.rejected})</span>
                        </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Filter backlog queue by text..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/70"
                        />
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                    </div>
                </div>

                {/* QUEUE RECORDS */}
                {isLoading ? (
                    <div className="text-center py-24 border border-dashed border-white/5 rounded-3xl p-8 bg-black/20">
                        <Hourglass className="w-12 h-12 text-cyan-500 mx-auto mb-4 animate-spin" />
                        <h3 className="text-sm font-bold text-slate-400 capitalize">Loading data from server...</h3>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="text-center py-24 border border-dashed border-white/5 rounded-3xl p-8 bg-black/20">
                        <Compass className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-spin" style={{ animationDuration: '6s' }} />
                        <h3 className="text-sm font-bold text-slate-400 capitalize">
                            {searchQuery ? `No reports matched your search criteria` : `Authorization backlog is clean`}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                            {searchQuery
                                ? "Refine or clear your active search string query values."
                                : activeTab === 'pending'
                                    ? "All assignee submission sheets have been processed! No pending items await your planner review state."
                                    : "Your reviewed history is empty. Go approve or reject pending logs to fill this compliance grid."
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {filteredReports.map(rep => {
                            let statusBadge = null;
                            if (rep.status === 'blocked') {
                                statusBadge = <span className="bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono font-bold text-[8px] uppercase px-2 py-0.5 rounded shrink-0">BLOCKER</span>;
                            } else if (rep.status === 'at-risk') {
                                statusBadge = <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono font-bold text-[8px] uppercase px-2 py-0.5 rounded shrink-0">AT RISK</span>;
                            } else if (rep.status === 'completed') {
                                statusBadge = <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-[8px] uppercase px-2 py-0.5 rounded shrink-0">COMPLETED</span>;
                            } else {
                                statusBadge = <span className="bg-cyan-500/5 border border-cyan-500/20 text-cyan-300 font-mono font-bold text-[8px] uppercase px-2 py-0.5 rounded shrink-0">ON-TRACK</span>;
                            }

                            const initialEditHours = Math.floor(rep.timeSpentHours || 0);
                            const initialEditMins = Math.round(((rep.timeSpentHours || 0) - initialEditHours) * 60);

                            return (
                                <div
                                    key={rep.id}
                                    className={`bg-[#11192e]/80 border rounded-2xl p-5 md:p-6 transition-all relative group flex flex-col justify-between gap-5 ${
                                        rep.approvalStatus === 'approved'
                                            ? 'border-emerald-500/10 hover:border-emerald-500/20'
                                            : rep.approvalStatus === 'rejected'
                                                ? 'border-rose-500/10 hover:border-rose-500/20'
                                                : rep.approvalStatus === 'awaiting_final'
                                                    ? 'border-indigo-500/20 hover:border-indigo-500/30 shadow-md'
                                                    : 'border-white/5 hover:border-amber-500/20 shadow-md'
                                    }`}
                                >
                                    {/* Submitter Info */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-bold text-white shadow font-mono text-sm shrink-0">
                                                {rep.reporter?.username?.substring(0, 2).toUpperCase() || 'USR'}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <strong className="text-white text-sm font-black">{rep.reporter?.username || 'Assignee Specialist'}</strong>
                                                    <span className="text-[10px] text-slate-500 font-mono">({rep.reporter?.employeeCode || 'RESOURCES-ID'})</span>
                                                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                                                    <span className="text-[10px] text-cyan-400 font-semibold">{rep.reporter?.jobTitle || 'Employee'}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-450 text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                                                    <Clock className="w-3 h-3 text-slate-500" /> Logged {gregorianToJalaliDateTime(rep.timestamp)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right leading-relaxed shrink-0 self-start md:self-auto font-mono text-[11px] text-slate-400 bg-black/25 px-3 py-1.5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-1.5 justify-start md:justify-end text-[10px]">
                                                <Briefcase className="w-3 w-3 text-indigo-400" />
                                                <span className="text-slate-300 font-semibold">{rep.proj?.name || 'Unknown Project'}</span>
                                                <span className="text-slate-600">//</span>
                                                <span className="text-cyan-400 font-bold">Rev {rep.rev?.number || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 justify-start md:justify-end mt-0.5">
                                                <span className="text-white font-extrabold">{rep.node?.name || 'Task Details'}</span>
                                                <span className="bg-white/5 border border-white/10 text-[9px] text-cyan-300 px-1 py-0.2 rounded font-bold">{rep.node?.code || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* EDIT Mode */}
                                    {editingReportId === rep.id ? (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 w-full">
                                            <div className="md:col-span-4 bg-black/40 border border-amber-500/30 p-4 rounded-xl space-y-4">
                                                <h5 className="text-[10px] text-amber-400 font-mono font-bold tracking-widest uppercase flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} /> ADJUST SPRINT VALUES
                                                </h5>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-slate-300">Proposed Progress</span>
                                                        <strong className="text-cyan-300 font-mono text-sm">{editProgress}%</strong>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="100"
                                                        value={editProgress}
                                                        onChange={e => setEditProgress(Number(e.target.value))}
                                                        className="w-full accent-amber-500 bg-slate-900 rounded-lg appearance-none h-1.5 cursor-pointer focus:outline-none"
                                                    />
                                                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                                                        <span>0%</span><span>Current: {rep.node?.progress || 0}%</span><span>100%</span>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-white/5" />

                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-slate-300 flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-indigo-400" /> Logged Work Hours
                                                    </label>
                                                    <div className="flex items-center gap-2" dir="ltr">
                                                        <div className="flex-1 flex items-center bg-[#070b15] border border-white/10 focus-within:border-amber-400 rounded-lg overflow-hidden">
                                                            <input type="number" min="0" value={editHours} onChange={e => setEditHours(Math.max(0, Number(e.target.value)))} className="w-full bg-transparent text-center py-1.5 text-xs text-white focus:outline-none font-mono"/>
                                                            <span className="text-[10px] text-slate-500 pr-2">h</span>
                                                        </div>
                                                        <span className="text-slate-500">:</span>
                                                        <div className="flex-1 flex items-center bg-[#070b15] border border-white/10 focus-within:border-amber-400 rounded-lg overflow-hidden">
                                                            <input type="number" min="0" max="59" value={editMinutes} onChange={e => { const val = Number(e.target.value); if(val<=59 && val>=0) setEditMinutes(val); }} className="w-full bg-transparent text-center py-1.5 text-xs text-white focus:outline-none font-mono"/>
                                                            <span className="text-[10px] text-slate-500 pr-2">m</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="md:col-span-8 flex flex-col justify-between h-full space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase block">
                                                        PROGRESS ACCOMPLISHMENTS LOG:
                                                    </label>
                                                    <textarea
                                                        value={editNotes}
                                                        onChange={e => setEditNotes(e.target.value)}
                                                        rows={3}
                                                        className="w-full bg-[#070b15] border border-white/10 focus:border-amber-400 rounded-lg p-3 text-xs text-slate-200 focus:outline-none leading-relaxed"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-3 pt-2">
                                                    <button onClick={() => handleSaveEdit(rep.id)} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs">
                                                        <Check className="w-4 h-4" /><span>Save Adjustments</span>
                                                    </button>
                                                    <button onClick={() => setEditingReportId(null)} className="bg-black/30 hover:bg-white/5 border border-white/10 text-slate-300 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1 text-xs">
                                                        <X className="w-4 h-4" /><span>Cancel</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                                            <div className="md:col-span-4 bg-black/30 border border-white/5 p-4 rounded-xl space-y-3.5">
                                                <h5 className="text-[9px] text-slate-500 font-mono font-bold tracking-widest uppercase mb-1">PROPOSED SPRINT VALUES</h5>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-slate-400">Proposed Progress</span>
                                                        <strong className="text-cyan-300 font-mono text-sm">{rep.progressPercent}%</strong>
                                                    </div>
                                                    <div className="relative w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                                                        <div className="absolute top-0 left-0 bg-slate-600 h-full" style={{ width: `${rep.node?.progress || 0}%` }} />
                                                        <div className="absolute top-0 left-0 bg-cyan-400 h-full opacity-80" style={{ width: `${rep.progressPercent}%` }} />
                                                    </div>
                                                    <span className="text-[9px] text-slate-500 font-mono block leading-none">
                                  Current Board Level: <strong>{rep.node?.progress || 0}%</strong>
                                </span>
                                                </div>
                                                <div className="h-px bg-white/5" />
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400 flex items-center gap-1"><Hourglass className="w-3 h-3 text-indigo-400" /> Active Time Log</span>
                                                    <strong className="text-indigo-300 font-mono">{formatDecimalTime(rep.timeSpentHours)}</strong>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-455 text-slate-400">Assigned Node Health</span>
                                                    {statusBadge}
                                                </div>
                                            </div>

                                            <div className="md:col-span-8 flex flex-col justify-between h-full space-y-3">
                                                <div className="space-y-2.5">
                                                    <div className="text-xs text-slate-300 bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed select-all">
                                                        <strong className="text-[10px] text-slate-500 font-mono uppercase block mb-1">PROGRESS ACCOMPLISHMENTS LOG:</strong>
                                                        {rep.notes}
                                                    </div>
                                                    {rep.blockers && (
                                                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5 space-y-1">
                                                            <strong className="text-[10px] text-rose-350 text-rose-300 font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 justify-start">
                                                                <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse shrink-0" /> CRITICAL CONSTRAINTS & BLOCKERS DECLARED:
                                                            </strong>
                                                            <p className="text-xs text-rose-200 italic font-sans pl-1 leading-normal">"{rep.blockers}"</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {(rep.approvalStatus === 'approved' || rep.approvalStatus === 'rejected') && (
                                                    <div className={`mt-3 p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono leading-none ${
                                                        rep.approvalStatus === 'approved'
                                                            ? 'bg-emerald-500/5 text-emerald-300 border-emerald-500/10'
                                                            : 'bg-rose-500/5 text-rose-300 border-rose-500/10'
                                                    }`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span>Supervisor: <strong>{rep.finalApprovedBy || rep.approvedBy || 'Project Manager'}</strong></span>
                                                            <span>//</span>
                                                            <span>Reviewed {rep.finalApprovedAt || rep.approvedAt ? gregorianToJalaliDateTime(rep.finalApprovedAt || rep.approvedAt!) : 'Recently'}</span>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <div className="font-bold flex items-center gap-1">
                                                                {rep.approvalStatus === 'approved'
                                                                    ? <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded text-[10px] uppercase font-black">Consolidated</span>
                                                                    : <span className="bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded text-[10px] uppercase font-black">Returned & Withheld</span>
                                                                }
                                                            </div>
                                                            <button onClick={() => handleDeleteReportLog(rep.id)} className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 border border-transparent hover:border-rose-500/20 rounded cursor-pointer transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* مرحلهٔ دوم: تاییدِ بررسی‌کننده انجام شده، منتظرِ تاییدِ نهاییِ مدیر برنامه‌ریزی (پروژهٔ شرکتی) */}
                                                {rep.approvalStatus === 'awaiting_final' && (
                                                    <div className="space-y-3 pt-2">
                                                        <div className="p-3 rounded-xl border bg-indigo-500/5 text-indigo-300 border-indigo-500/20 text-[11px] font-mono flex items-center gap-2">
                                                            <ClipboardCheck className="w-4 h-4 shrink-0" />
                                                            <span>Reviewer approval completed{rep.reviewerApprovedBy ? ` (${rep.reviewerApprovedBy})` : ''} — awaiting <strong>final approval by planning manager</strong>. Progress not yet applied to Gantt chart.</span>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                            <button onClick={() => handleApproveReport(rep.id)} className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:to-indigo-400 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs">
                                                                <CheckCircle className="w-4 h-4" /><span>Final Approve</span>
                                                            </button>
                                                            <button onClick={() => startRejectionFlow(rep.id)} className="bg-black/30 hover:bg-rose-500/10 border border-white/10 text-slate-350 hover:text-rose-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs">
                                                                <X className="w-4 h-4" /><span>Reject Report</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {rep.approvalStatus === 'pending' && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                                                        <button onClick={() => handleApproveReport(rep.id)} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:to-emerald-400 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs">
                                                            <Check className="w-4 h-4" /><span>{rep.isCompanyScope ? 'Reviewer Approval' : 'Approve Report'}</span>
                                                        </button>
                                                        <button onClick={() => { setEditingReportId(rep.id); setEditProgress(rep.progressPercent); setEditHours(initialEditHours); setEditMinutes(initialEditMins); setEditNotes(rep.notes || ''); }} className="bg-black/30 hover:bg-amber-500/10 border border-white/10 text-slate-350 hover:text-amber-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs">
                                                            <Edit className="w-4 h-4 text-amber-400" /><span>Edit (Partial)</span>
                                                        </button>
                                                        <button onClick={() => startRejectionFlow(rep.id)} className="bg-black/30 hover:bg-rose-500/10 border border-white/10 text-slate-350 hover:text-rose-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs">
                                                            <X className="w-4 h-4" /><span>Reject Report</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

            </div>

            {/* REJECTION MODAL */}
            {rejectingReportId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <form onSubmit={handleRejectReportSubmit} className="bg-[#0f1629] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-slate-200">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-rose-500" />
                                <h4 className="text-sm font-extrabold text-white">Rework Feedback required</h4>
                            </div>
                            <button type="button" onClick={() => setRejectingReportId(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="space-y-1.5 text-right sm:text-left">
                            <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">REACTION REMARKS & INSTRUCTIONS (Rejection reason)</label>
                            <textarea required value={rejectionFeedback} onChange={e => setRejectionFeedback(e.target.value)} rows={4} placeholder="Describe what needs to be reviewed or corrected..." className="w-full bg-[#1b1115] border border-rose-500/30 focus:border-rose-550 focus:border-rose-500 py-3 px-4 rounded-xl text-xs placeholder-rose-900/40 select-all font-sans text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500/20 transition-all text-right sm:text-left" />
                            <span className="text-[9px] text-rose-400 font-mono block mt-1">This feedback is permanently recorded in the task's historic archive logs.</span>
                        </div>

                        <div className="flex items-center gap-2 border-t border-white/5 pt-3.5">
                            <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs">Reject Update</button>
                            <button type="button" onClick={() => setRejectingReportId(null)} className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

        </div>
    );
}