import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Receipt, DollarSign, Layers, Activity,
    Hash, FileText, ToggleLeft, ToggleRight, Loader2, Save, AlertCircle,
    Search, ChevronDown, User
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import JalaliDatePicker from "@/components/JalaliDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BaseEntity { id: string; name: string; }

interface TaskEntity extends BaseEntity {
    code?: string;
    wbs_title?: string;
}

interface AssignmentEntity {
    id: string;
    taskId: string;
    resourceId: string;
    revisionId: number;
    resource_name: string;      // از serializer patch
    resource_type: string;      // از serializer patch — برای فیلتر بر اساس transaction_type
}

interface ResourceRateEntity {
    id: string;
    resourceId: string;
    effectiveFrom: string;
    regularRate: string;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-primary)',
};

function SectionHeader({ icon, color, label }: { icon: React.ReactNode; color: string; label: string }) {
    return (
        <h3
            className={`text-xs font-bold uppercase tracking-widest ${color} flex items-center gap-2 pb-2`}
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
            {icon} {label}
        </h3>
    );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase block">{label}</label>
            {children}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CostTransactionManager() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [projects, setProjects] = useState<BaseEntity[]>([]);
    const [expenseTypes, setExpenseTypes] = useState<BaseEntity[]>([]);
    const [tasks, setTasks] = useState<TaskEntity[]>([]);
    const [assignments, setAssignments] = useState<AssignmentEntity[]>([]);
    const [selectedRate, setSelectedRate] = useState<ResourceRateEntity | null>(null);

    const [loadingTasks, setLoadingTasks] = useState(false);
    const [loadingAssignments, setLoadingAssignments] = useState(false);

    const [form, setForm] = useState({
        project: '',
        transaction_type: 'LABOR',
        expense_type: '',
        transaction_date: new Date().toISOString().split('T')[0],
        quantity: 1,
        unit_rate: 0,
        expense_rate: 0,
        description: '',
    });

    const [enableTask, setEnableTask] = useState(false);
    const [selectedTask, setSelectedTask] = useState('');
    const [selectedAssignment, setSelectedAssignment] = useState('');

    const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const taskDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (taskDropdownRef.current && !taskDropdownRef.current.contains(e.target as Node))
                setIsTaskDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Initial fetch ──────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const [projRes, expRes] = await Promise.all([
                    apiClient.get('planning/projects/'),
                    apiClient.get('planning/expense-types/'),
                ]);
                setProjects(projRes.data.results ?? projRes.data);
                setExpenseTypes(expRes.data.results ?? expRes.data);
            } catch (err) {
                console.error('Initial fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    // ── Fetch tasks وقتی پروژه یا حالت Task فعال شد ──────────────────────
    useEffect(() => {
        if (!form.project || !enableTask || form.transaction_type === 'EXPENSE') {
            setTasks([]);
            setSelectedTask('');
            setAssignments([]);
            setSelectedAssignment('');
            setSelectedRate(null);
            return;
        }
        setLoadingTasks(true);
        apiClient.get(`planning/tasks/?project_id=${form.project}`)
            .then(r => setTasks(r.data.results ?? r.data))
            .catch(() => setTasks([]))
            .finally(() => setLoadingTasks(false));
    }, [form.project, enableTask, form.transaction_type]);

    // ── Fetch assignments وقتی تسک انتخاب شد ─────────────────────────────
    useEffect(() => {
        setAssignments([]);
        setSelectedAssignment('');
        setSelectedRate(null);
        setForm(prev => ({ ...prev, unit_rate: 0 }));
        if (!selectedTask) return;

        setLoadingAssignments(true);
        // task_id فیلتر می‌کند — patch بکند لازمه (views.py)
        apiClient.get(`planning/assignments/?task_id=${selectedTask}`)
            .then(r => {
                const all: AssignmentEntity[] = r.data.results ?? r.data;
                // فقط assignment‌هایی که resource_type با نوع تراکنش انتخاب‌شده مطابقت دارد
                const filtered = all.filter(a => a.resource_type === form.transaction_type);
                setAssignments(filtered);
            })
            .catch(() => setAssignments([]))
            .finally(() => setLoadingAssignments(false));
    }, [selectedTask]);

    // ── وقتی assignment انتخاب شد → آخرین resource_rate آن را بخوان ──────
    console.log("COMPONENT MOUNTED");
    useEffect(() => {
        setSelectedRate(null);
        setForm(prev => ({ ...prev, unit_rate: 0 }));

        if (!selectedAssignment) return;

        const assignment = assignments.find(
            a => String(a.id) === String(selectedAssignment)
        );
        if (!assignment) return;

        apiClient
            .get(`planning/resource-rates/?resource_id=${assignment.resourceId}`)
            .then(r => {
                const rates: ResourceRateEntity[] = r.data.results ?? r.data;

                const txDate = new Date(form.transaction_date);

                // فیلتر نرخ‌هایی که قبل یا مساوی این تاریخ هستند
                const validRates = rates
                    .filter(rate => new Date(rate.effectiveFrom) <= txDate)
                    .sort((a, b) =>
                        new Date(a.effectiveFrom).getTime() -
                        new Date(b.effectiveFrom).getTime()
                    );

                const selected = validRates.length
                    ? validRates[validRates.length - 1]
                    : null;

                if (selected) {
                    setSelectedRate(selected);
                    setForm(prev => ({
                        ...prev,
                        unit_rate: parseFloat(selected.regularRate),
                    }));
                }
            })
            .catch(console.error);
    }, [selectedAssignment, assignments, form.transaction_date]);

    // ── Derived ───────────────────────────────────────────────────────────
    const isExpense = form.transaction_type === 'EXPENSE';
    const activeRate = isExpense ? form.expense_rate : form.unit_rate;
    const totalAmount = useMemo(() => (form.quantity * activeRate).toLocaleString(), [form.quantity, activeRate]);

    const filteredTasks = useMemo(() => {
        if (!taskSearchQuery.trim()) return tasks;
        const q = taskSearchQuery.toLowerCase();
        return tasks.filter(t =>
            String(t.name).toLowerCase().includes(q) ||
            String(t.code ?? '').toLowerCase().includes(q) ||
            String(t.wbs_title ?? '').toLowerCase().includes(q)
        );
    }, [tasks, taskSearchQuery]);

    const selectedTaskLabel = useMemo(() => {
        const t = tasks.find(x => x.id === selectedTask);
        if (t) return `${t.code ? `[${t.code}] ` : ''}${t.name}`;
        return !form.project ? 'ابتدا یک پروژه انتخاب کنید...' : 'انتخاب تسک از ساختار WBS...';
    }, [tasks, selectedTask, form.project]);

    const resetForm = () => {
        setSelectedTask('');
        setSelectedAssignment('');
        setSelectedRate(null);
        setAssignments([]);
        setForm(prev => ({ ...prev, quantity: 1, unit_rate: 0, expense_rate: 0, description: '', expense_type: '' }));
    };

    // ── Submit ────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isExpense) {
            if (!form.expense_type) { alert('لطفاً نوع هزینه را مشخص کنید.'); return; }
        } else {
            if (enableTask && !selectedTask) { alert('لطفاً یک تسک انتخاب کنید.'); return; }
            if (enableTask && !selectedAssignment) { alert('لطفاً منبع تخصیص‌یافته را انتخاب کنید.'); return; }
            if (!selectedRate) { alert('نرخ معتبری برای این منبع یافت نشد.'); return; }
        }

        setIsSaving(true);
        try {
            const payload: Record<string, unknown> = {
                project: form.project,
                transaction_type: form.transaction_type,
                transaction_date: form.transaction_date,
                quantity: form.quantity,
                description: form.description,
            };

            if (isExpense) {
                payload.expense_type = form.expense_type;
                payload.expense_rate = form.expense_rate;
            } else {
                payload.resource_rate = selectedRate!.id;
                payload.unit_rate = form.unit_rate;
                if (enableTask && selectedTask) {
                    payload.task = selectedTask;
                    payload.assignment = selectedAssignment;
                }
            }

            await apiClient.post('planning/cost-transactions/', payload);
            alert('تراکنش با موفقیت ثبت شد!');
            resetForm();
        } catch (err) {
            console.error('Submit error:', err);
            alert('خطا در ثبت تراکنش. لطفاً اطلاعات را بررسی کنید.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[500px] flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                <span className="font-mono text-sm tracking-widest uppercase mt-4 text-cyan-500">Loading Ledgers...</span>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col p-6 space-y-6" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                    <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-cyan-400" />
                        Cost Transaction Ledger
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Record actual costs for labor, materials, equipment, and direct expenses.</p>
                </div>
            </div>

            <div
                className="max-w-4xl mx-auto w-full rounded-2xl shadow-xl max-h-[calc(110vh-300px)] overflow-y-auto"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
            >
                {/* Live total bar */}
                <div className="p-4 flex justify-between items-center" style={{ backgroundColor: 'var(--overlay-bg)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-mono font-bold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                            New Transaction Entry
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Amount (Live)</span>
                        <span className="text-lg font-black font-mono text-cyan-400">${totalAmount}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-8">

                    {/* ── SECTION 1: Project & Type ── */}
                    <div className="space-y-5">
                        <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} color="text-cyan-500" label="Project & Transaction Type" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field label="Project Target">
                                <select
                                    required
                                    value={form.project}
                                    onChange={e => {
                                        setForm(prev => ({ ...prev, project: e.target.value }));
                                        setSelectedTask(''); setSelectedAssignment(''); setSelectedRate(null);
                                    }}
                                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                                    style={inputStyle}
                                >
                                    <option value="">Select a Project...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </Field>

                            <Field label="Transaction Category">
                                <select
                                    required
                                    value={form.transaction_type}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setForm(prev => ({ ...prev, transaction_type: val, expense_type: '', unit_rate: 0 }));
                                        if (val === 'EXPENSE') {
                                            setEnableTask(false);
                                            setSelectedTask(''); setSelectedAssignment(''); setSelectedRate(null);
                                        }
                                    }}
                                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                                    style={inputStyle}
                                >
                                    <option value="LABOR">Labor</option>
                                    <option value="MATERIAL">Material</option>
                                    <option value="EQUIPMENT">Equipment</option>
                                    <option value="COST">Cost</option>
                                    <option value="SUBCONTRACT">Subcontract</option>
                                    <option value="EXPENSE" disabled={enableTask}>
                                        Expense (هزینه متفرقه){enableTask ? ' — قفل در حالت تسک' : ''}
                                    </option>
                                </select>
                            </Field>
                        </div>
                    </div>

                    {/* ── SECTION 2: Task → Resource → Rate chain ── */}
                    <div
                        className="space-y-5 rounded-xl p-5 transition-opacity"
                        style={{ backgroundColor: 'var(--overlay-bg)', border: '1px solid var(--border-medium)', opacity: isExpense ? 0.5 : 1 }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} color="text-indigo-400" label="Task → Resource Allocation" />
                                {isExpense && (
                                    <span className="text-[9px] text-amber-500 flex items-center gap-1 font-mono">
                                        <AlertCircle className="w-3 h-3" />
                                        هزینه‌های متفرقه در سطح کل پروژه ثبت می‌شوند.
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                disabled={isExpense}
                                onClick={() => setEnableTask(!enableTask)}
                                className={`flex items-center gap-2 transition-colors ${isExpense ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                            >
                                <span className={`text-[10px] font-mono font-bold uppercase ${enableTask ? 'text-cyan-400' : 'text-slate-500'}`}>
                                    {enableTask ? 'Task Specific' : 'Project Level'}
                                </span>
                                {enableTask
                                    ? <ToggleRight className="w-6 h-6 text-cyan-400" />
                                    : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                            </button>
                        </div>

                        {enableTask && !isExpense && (
                            <div className="space-y-4 pt-1">

                                {/* Step ①: تسک */}
                                <div className="space-y-1.5 relative" ref={taskDropdownRef}>
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase flex items-center gap-1">
                                        <span className="text-indigo-400 font-black">①</span> Target Task
                                    </label>
                                    <button
                                        type="button"
                                        disabled={!form.project}
                                        onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
                                        className={`w-full rounded-xl px-3 py-2 text-xs flex items-center justify-between transition-all focus:outline-none ${!form.project ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        style={{ ...inputStyle, border: '1px solid var(--border-strong)' }}
                                    >
                                        {loadingTasks
                                            ? <span className="flex items-center gap-2 text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />بارگذاری تسک‌ها...</span>
                                            : <span className="truncate">{selectedTaskLabel}</span>
                                        }
                                        <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                                    </button>

                                    {isTaskDropdownOpen && !loadingTasks && (
                                        <div
                                            className="absolute z-50 w-full mt-1.5 rounded-xl shadow-2xl overflow-hidden"
                                            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-medium)' }}
                                        >
                                            <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                <div className="relative flex items-center">
                                                    <Search className="w-4 h-4 absolute left-3 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="جستجو (نام، کد یا WBS)..."
                                                        value={taskSearchQuery}
                                                        onChange={e => setTaskSearchQuery(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none"
                                                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-56 overflow-y-auto p-1.5" dir="rtl">
                                                {filteredTasks.length === 0
                                                    ? <div className="p-4 text-center text-xs text-slate-500 italic">هیچ تسکی یافت نشد.</div>
                                                    : filteredTasks.map(t => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedTask(t.id);
                                                                setSelectedAssignment('');
                                                                setSelectedRate(null);
                                                                setIsTaskDropdownOpen(false);
                                                                setTaskSearchQuery('');
                                                            }}
                                                            className={`w-full text-right px-3 py-2.5 rounded-lg mb-1 hover:bg-white/5 transition-colors flex flex-col gap-1 ${selectedTask === t.id ? 'bg-indigo-500/10' : ''}`}
                                                        >
                                                            <span
                                                                className="text-xs font-bold flex items-center gap-2"
                                                                style={{ color: selectedTask === t.id ? 'var(--text-accent)' : 'var(--text-primary)' }}
                                                            >
                                                                {t.code && (
                                                                    <span
                                                                        className="text-[9px] px-1.5 py-0.5 rounded-md border font-mono"
                                                                        style={{ backgroundColor: 'var(--overlay-bg)', borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
                                                                    >
                                                                        {t.code}
                                                                    </span>
                                                                )}
                                                                {t.name}
                                                            </span>
                                                            {t.wbs_title && (
                                                                <span className="text-[10px] font-mono pr-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                                                                    <Layers className="w-3 h-3 opacity-60" />
                                                                    {t.wbs_title}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Step ②: منبع از assignment‌های تسک */}
                                <div className={`space-y-1.5 transition-opacity ${!selectedTask ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase flex items-center gap-1">
                                        <span className="text-indigo-400 font-black">②</span> Assigned Resource
                                        {!selectedTask && <span className="text-amber-500 normal-case font-normal mr-1"> — ابتدا تسک را انتخاب کنید</span>}
                                    </label>

                                    {loadingAssignments ? (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />بارگذاری منابع...
                                        </div>
                                    ) : assignments.length === 0 && selectedTask ? (
                                        <div className="text-xs text-amber-500 flex items-center gap-1.5 py-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            هیچ منبعی با نوع «{form.transaction_type}» به این تسک تخصیص داده نشده.
                                        </div>
                                    ) : (
                                        <select
                                            required={enableTask && !!selectedTask}
                                            value={selectedAssignment}
                                            onChange={e => setSelectedAssignment(e.target.value)}
                                            className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                                            style={inputStyle}
                                        >
                                            <option value="">انتخاب منبع...</option>
                                            {assignments.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    {a.resource_name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Step ③: نرخ خوانده‌شده اتوماتیک */}
                                {selectedAssignment && (
                                    <div
                                        className="rounded-xl px-4 py-3 flex items-center gap-3"
                                        style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
                                    >
                                        <User className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-mono text-slate-400 uppercase block">نرخ منبع (Resource Rate)</span>
                                            {selectedRate ? (
                                                <span className="text-sm font-black font-mono text-emerald-400">
                                                    ${selectedRate.regularRate}
                                                    <span className="text-[10px] text-slate-400 font-normal mr-2">از {selectedRate.effectiveFrom}</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-amber-500 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    نرخی برای این منبع تعریف نشده است.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── SECTION 3: Financial Details ── */}
                    <div className="space-y-5">
                        <SectionHeader icon={<Hash className="w-3.5 h-3.5" />} color="text-amber-400" label="Financial Details" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {isExpense ? (
                                <>
                                    <Field label="Expense Type">
                                        <select
                                            required
                                            value={form.expense_type}
                                            onChange={e => setForm(prev => ({ ...prev, expense_type: e.target.value }))}
                                            className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                                            style={inputStyle}
                                        >
                                            <option value="">Select Expense Type...</option>
                                            {expenseTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Expense Rate ($)">
                                        <input
                                            type="number" required min="0" step="0.01"
                                            value={form.expense_rate}
                                            onChange={e => setForm(prev => ({ ...prev, expense_rate: Number(e.target.value) }))}
                                            className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold"
                                            style={inputStyle}
                                        />
                                    </Field>
                                </>
                            ) : (
                                <Field label={<>Unit Rate ($) {selectedRate && <span className="text-cyan-500 normal-case font-normal mr-1">(از نرخ منبع)</span>}</>}>
                                    <input
                                        type="number" required min="0" step="0.01"
                                        value={form.unit_rate}
                                        onChange={e => setForm(prev => ({ ...prev, unit_rate: Number(e.target.value) }))}
                                        className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold"
                                        style={inputStyle}
                                    />
                                </Field>
                            )}

                            <Field label="Transaction Date">

                                <JalaliDatePicker
                                    value={form.transaction_date}
                                    onChange={(date) =>
                                        setForm(prev => ({ ...prev, transaction_date: date }))
                                    }
                                />
                            </Field>

                            <Field label="Quantity / Hours">
                                <input
                                    type="number" required min="0.01" step="0.01"
                                    value={form.quantity}
                                    onChange={e => setForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                    className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold"
                                    style={inputStyle}
                                />
                            </Field>
                        </div>

                        <div className="space-y-1.5 pt-3">
                            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase flex items-center gap-1.5">
                                <FileText className="w-3 h-3" /> Description / Notes
                            </label>
                            <textarea
                                rows={2}
                                value={form.description}
                                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Details about this transaction..."
                                className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-6 mt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                            type="button"
                            onClick={resetForm}
                            className="font-bold py-2 px-5 rounded-xl text-xs cursor-pointer select-none transition-all hover:bg-white/5"
                            style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
                        >
                            Reset Form
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-6 rounded-xl text-xs cursor-pointer shadow-lg active:scale-95 transition-all ${isSaving ? 'opacity-70 pointer-events-none' : ''}`}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Commit Transaction
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}