'use client';

/**
 * Assign Executors Page
 * ----------------------
 * صفحه‌ای برای reviewer ها (مدیران واحد و project manager ها) که در یک نگاه
 * تمام تسک‌هایی که روی آن‌ها reviewer هستند را ببینند و راحت‌تر انجام‌دهنده انتخاب کنند.
 *
 * منطق:
 *   - فقط تسک‌هایی نمایش داده می‌شوند که کاربر روی آن‌ها reviewer/project manager است
 *   - executor فقط از اعضای واحدِ خودِ reviewer قابل انتخاب است (محدودیت بک‌اند)
 *   - چندین executor در یک تسک مجاز است
 */

import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
    UserCheck, Users, Search, Filter, Plus, X, Calendar,
    FolderOpen, Clock, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Executor {
    taskRoleId: number;
    userId: number;
    username: string;
    jobTitle: string;
}

interface ReviewerTask {
    taskId: string;
    revisionId: number;
    projectId: string;
    projectName: string;
    title: string;
    wbsCode: string;
    wbsTitle: string;
    plannedStart: string | null;
    plannedFinish: string | null;
    durationHours: number;
    description: string;
    executors: Executor[];
}

interface UnitMember {
    id: number;
    username: string;
    jobTitle: string;
    employeeCode: string;
}

interface ApiResponse {
    tasks: ReviewerTask[];
    unitMembers: UnitMember[];
    unitId: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dt: string | null): string => {
    if (!dt) return '—';
    const datePart = dt.split(' ')[0] || dt.split('T')[0] || '';
    return datePart;
};

const formatDuration = (hours: number): string => {
    if (!hours) return '—';
    const days = hours / 8;
    if (days >= 1) return `${days.toFixed(1)} روز`;
    return `${hours} ساعت`;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AssignExecutorsPage() {
    const [tasks, setTasks] = useState<ReviewerTask[]>([]);
    const [unitMembers, setUnitMembers] = useState<UnitMember[]>([]);
    const [unitId, setUnitId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // فیلترها
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState<string>('all');

    // وضعیت per-row dropdown selection
    const [selectedUserPerTask, setSelectedUserPerTask] = useState<Record<string, string>>({});
    const [savingTask, setSavingTask] = useState<string | null>(null);
    const [removingRole, setRemovingRole] = useState<number | null>(null);

    // اعلان موفقیت/خطا
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ── Fetch data ───────────────────────────────────────────────────────────
    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiClient.get<ApiResponse>('/planning/task-roles/my-reviewer-tasks/');
            setTasks(res.data.tasks || []);
            setUnitMembers(res.data.unitMembers || []);
            setUnitId(res.data.unitId);
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.detail || 'خطا در دریافت تسک‌ها.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // پاک کردن خودکار اعلان بعد از ۳ ثانیه
    useEffect(() => {
        if (notice) {
            const t = setTimeout(() => setNotice(null), 3000);
            return () => clearTimeout(t);
        }
    }, [notice]);

    // ── Derived ──────────────────────────────────────────────────────────────
    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach(t => map.set(t.projectId, t.projectName));
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const hay = `${t.title} ${t.wbsCode} ${t.projectName}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [tasks, projectFilter, searchQuery]);

    const stats = useMemo(() => ({
        total: tasks.length,
        withExecutor: tasks.filter(t => t.executors.length > 0).length,
        withoutExecutor: tasks.filter(t => t.executors.length === 0).length,
    }), [tasks]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleAddExecutor = async (task: ReviewerTask) => {
        const userId = selectedUserPerTask[task.taskId];
        if (!userId) {
            setNotice({ type: 'error', text: 'Please select a user first.' });
            return;
        }

        // جلوگیری از افزودن تکراری در سمت کلاینت
        if (task.executors.some(e => e.userId === Number(userId))) {
            setNotice({ type: 'error', text: 'This user is already assigned as executor.' });
            return;
        }

        setSavingTask(task.taskId);
        try {
            const res = await apiClient.post('/planning/task-roles/', {
                revisionId: task.revisionId,
                taskId: task.taskId,
                userId: Number(userId),
                role: 'executor',
            });

            // به‌روزرسانی state — executor جدید رو به این تسک اضافه کن
            const newExecutorUser = unitMembers.find(u => u.id === Number(userId));
            if (newExecutorUser) {
                setTasks(prev => prev.map(t =>
                    t.taskId === task.taskId
                        ? {
                            ...t,
                            executors: [
                                ...t.executors,
                                {
                                    taskRoleId: res.data.id,
                                    userId: newExecutorUser.id,
                                    username: newExecutorUser.username,
                                    jobTitle: newExecutorUser.jobTitle,
                                },
                            ],
                        }
                        : t
                ));
            }

            // پاک کردن انتخاب
            setSelectedUserPerTask(prev => {
                const next = { ...prev };
                delete next[task.taskId];
                return next;
            });

            setNotice({ type: 'success', text: `${newExecutorUser?.username} added as executor.` });
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.detail
                || 'Error adding executor. This user may already be assigned.';
            setNotice({ type: 'error', text: msg });
        } finally {
            setSavingTask(null);
        }
    };

    const handleRemoveExecutor = async (task: ReviewerTask, executor: Executor) => {
        if (!window.confirm(`Remove ${executor.username} from this task's executors?`)) return;

        setRemovingRole(executor.taskRoleId);
        try {
            await apiClient.delete(`/planning/task-roles/${executor.taskRoleId}/`);

            setTasks(prev => prev.map(t =>
                t.taskId === task.taskId
                    ? { ...t, executors: t.executors.filter(e => e.taskRoleId !== executor.taskRoleId) }
                    : t
            ));

            setNotice({ type: 'success', text: `${executor.username} removed from executors.` });
        } catch (err: any) {
            console.error(err);
            setNotice({ type: 'error', text: 'Error removing executor.' });
        } finally {
            setRemovingRole(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-auto" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="max-w-7xl mx-auto p-6 space-y-6">

                {/* ═══ Header ═══ */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center"
                                style={{
                                    backgroundColor: 'rgba(5, 150, 105, 0.12)',
                                    border: '1px solid rgba(5, 150, 105, 0.25)',
                                }}
                            >
                                <UserCheck className="w-5 h-5" style={{ color: '#059669' }} />
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold tracking-tight">انتخاب انجام‌دهنده تسک‌ها</h1>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                    تسک‌هایی که شما به عنوان بررسی‌کننده روی آن‌ها مسئولیت دارید
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={loadData}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50"
                        style={{
                            backgroundColor: 'var(--overlay-bg)',
                            borderColor: 'var(--border-medium)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'بازخوانی'}
                    </button>
                </div>

                {/* ═══ Stats Cards ═══ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <StatCard label="کل تسک‌ها" value={stats.total} color="#0d9488" icon={FolderOpen} />
                    <StatCard label="دارای مجری" value={stats.withExecutor} color="#059669" icon={CheckCircle2} />
                    <StatCard label="بدون مجری" value={stats.withoutExecutor} color="#d97706" icon={AlertCircle} />
                </div>

                {/* ═══ Notice ═══ */}
                {notice && (
                    <div
                        className="p-3 rounded-lg text-xs font-medium flex items-center gap-2 border"
                        style={{
                            backgroundColor: notice.type === 'success' ? 'rgba(5, 150, 105, 0.08)' : 'rgba(225, 29, 72, 0.08)',
                            borderColor: notice.type === 'success' ? 'rgba(5, 150, 105, 0.25)' : 'rgba(225, 29, 72, 0.25)',
                            color: notice.type === 'success' ? '#059669' : '#e11d48',
                        }}
                    >
                        {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span>{notice.text}</span>
                    </div>
                )}

                {/* ═══ Filters ═══ */}
                <div
                    className="rounded-xl border p-4 flex flex-col sm:flex-row gap-3"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
                >
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="جستجو در نام تسک، WBS، یا پروژه..."
                            className="w-full text-xs px-3 py-2.5 pr-10 rounded-lg border outline-none focus:border-cyan-400"
                            style={{
                                backgroundColor: 'var(--overlay-bg)',
                                borderColor: 'var(--border-medium)',
                                color: 'var(--text-primary)',
                            }}
                        />
                    </div>

                    <div className="relative">
                        <Filter className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                        <select
                            value={projectFilter}
                            onChange={e => setProjectFilter(e.target.value)}
                            className="text-xs px-3 py-2.5 pr-10 rounded-lg border outline-none focus:border-cyan-400 cursor-pointer min-w-[200px]"
                            style={{
                                backgroundColor: 'var(--overlay-bg)',
                                borderColor: 'var(--border-medium)',
                                color: 'var(--text-primary)',
                            }}
                        >
                            <option value="all">همه پروژه‌ها</option>
                            {projectOptions.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ═══ Content ═══ */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-accent)' }} />
                    </div>
                ) : error ? (
                    <div className="p-6 rounded-xl border text-center text-sm" style={{ backgroundColor: 'rgba(225, 29, 72, 0.05)', borderColor: 'rgba(225, 29, 72, 0.25)', color: '#e11d48' }}>
                        {error}
                    </div>
                ) : !unitId ? (
                    <div
                        className="p-6 rounded-xl border text-center text-sm"
                        style={{ backgroundColor: 'rgba(217, 119, 6, 0.05)', borderColor: 'rgba(217, 119, 6, 0.25)', color: '#d97706' }}
                    >
                        شما به هیچ واحد سازمانی منتسب نیستید — بنابراین نمی‌توانید مجری انتخاب کنید.
                        لطفاً با مدیر سیستم تماس بگیرید.
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div
                        className="p-12 rounded-xl border text-center"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
                    >
                        <UserCheck className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm font-medium mb-1">
                            {tasks.length === 0
                                ? 'شما در حال حاضر روی هیچ تسکی به‌عنوان بررسی‌کننده تعیین نشده‌اید.'
                                : 'با این فیلترها هیچ تسکی یافت نشد.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTasks.map(task => (
                            <TaskCard
                                key={`${task.revisionId}-${task.taskId}`}
                                task={task}
                                unitMembers={unitMembers}
                                selectedUserId={selectedUserPerTask[task.taskId] || ''}
                                onSelectUser={(userId) => setSelectedUserPerTask(prev => ({ ...prev, [task.taskId]: userId }))}
                                onAdd={() => handleAddExecutor(task)}
                                onRemove={(executor) => handleRemoveExecutor(task, executor)}
                                isSaving={savingTask === task.taskId}
                                removingRoleId={removingRole}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    color,
    icon: Icon,
}: {
    label: string;
    value: number;
    color: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
    return (
        <div
            className="rounded-xl border p-4 flex items-center justify-between"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
        >
            <div>
                <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </p>
                <p className="text-2xl font-extrabold" style={{ color }}>
                    {value}
                </p>
            </div>
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
            >
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
        </div>
    );
}

function TaskCard({
    task,
    unitMembers,
    selectedUserId,
    onSelectUser,
    onAdd,
    onRemove,
    isSaving,
    removingRoleId,
}: {
    task: ReviewerTask;
    unitMembers: UnitMember[];
    selectedUserId: string;
    onSelectUser: (userId: string) => void;
    onAdd: () => void;
    onRemove: (executor: Executor) => void;
    isSaving: boolean;
    removingRoleId: number | null;
}) {
    // اعضایی که هنوز executor این تسک نیستن
    const availableMembers = unitMembers.filter(
        m => !task.executors.some(e => e.userId === m.id)
    );

    return (
        <div
            className="rounded-xl border p-4 transition-all hover:border-cyan-500/40"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
        >
            {/* ── Top row: title + project + dates ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                            style={{ backgroundColor: 'rgba(13, 148, 136, 0.12)', color: '#0d9488' }}
                        >
                            {task.wbsCode || 'WBS'}
                        </span>
                        <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            {task.title}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="flex items-center gap-1">
                            <FolderOpen className="w-3 h-3" /> {task.projectName}
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(task.plannedStart)} → {formatDate(task.plannedFinish)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(task.durationHours)}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Executors list ── */}
            <div className="space-y-2.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        مجریان فعلی ({task.executors.length})
                    </span>
                </div>

                {task.executors.length === 0 ? (
                    <p className="text-xs italic py-1" style={{ color: 'var(--text-tertiary)' }}>
                        هنوز مجری انتخاب نشده است.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {task.executors.map(ex => (
                            <div
                                key={ex.taskRoleId}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border"
                                style={{
                                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                    borderColor: 'rgba(99, 102, 241, 0.25)',
                                    color: '#6366f1',
                                }}
                            >
                                <span className="font-semibold">{ex.username}</span>
                                {ex.jobTitle && (
                                    <span className="text-[10px] opacity-70">({ex.jobTitle})</span>
                                )}
                                <button
                                    onClick={() => onRemove(ex)}
                                    disabled={removingRoleId === ex.taskRoleId}
                                    className="hover:bg-red-500/20 rounded p-0.5 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="حذف مجری"
                                >
                                    {removingRoleId === ex.taskRoleId ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <X className="w-3 h-3" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Add executor row ── */}
                {availableMembers.length > 0 ? (
                    <div className="flex items-center gap-2 mt-3">
                        <select
                            value={selectedUserId}
                            onChange={e => onSelectUser(e.target.value)}
                            disabled={isSaving}
                            className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none focus:border-cyan-400 cursor-pointer disabled:opacity-50"
                            style={{
                                backgroundColor: 'var(--overlay-bg)',
                                borderColor: 'var(--border-medium)',
                                color: 'var(--text-primary)',
                            }}
                        >
                            <option value="">— انتخاب کاربر از واحد شما —</option>
                            {availableMembers.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.username} {m.jobTitle ? `(${m.jobTitle})` : ''}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={onAdd}
                            disabled={!selectedUserId || isSaving}
                            className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: '#0d9488',
                                color: '#ffffff',
                            }}
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>افزودن</span>
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <p className="text-[11px] italic mt-2" style={{ color: 'var(--text-tertiary)' }}>
                        تمام اعضای واحد شما به این تسک تخصیص داده شده‌اند.
                    </p>
                )}
            </div>
        </div>
    );
}
