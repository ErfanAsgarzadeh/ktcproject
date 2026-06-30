import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ChevronDown,
    DollarSign,
    FileText,
    Hash,
    Layers,
    Loader2,
    Receipt,
    RefreshCcw,
    Save,
    Search,
    User,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import JalaliDatePicker from '@/components/JalaliDatePicker';

interface BaseEntity {
    id: string;
    name: string;
}

interface TaskEntity extends BaseEntity {
    code?: string | [string, string];
}

interface AssignmentEntity {
    id: string;
    taskId: string;
    resourceId: string;
    revisionId: string;
    resource_name: string;
    resource_type: string;
}

interface ResourceRateEntity {
    id: string;
    resourceId: string;
    effectiveFrom: string;
    regularRate: string;
}

interface CostTransaction {
    id: string;
    project: string;
    task: string | null;
    assignment: string | null;
    expense_type: string | null;
    budget_allocation: string | null;
    transaction_type: TransactionType;
    transaction_date: string;
    quantity: string;
    unit_rate: string | null;
    expense_rate: string | null;
    amount: string;
    description: string;
    created_at: string;
    resource_name?: string | null;
    expense_type_name?: string | null;
    task_title?: string | null;
}

interface BudgetAllocation {
    id: string;
    funding_source: string;
    funding_source_title?: string;
    project: string;
    project_name?: string;
    scope_type: string;
    cost_type: string;
    allocated_amount: string;
    actual_amount: string;
    remaining_amount: string;
    description?: string;
}

type TransactionType = 'LABOR' | 'MATERIAL' | 'EQUIPMENT' | 'EXPENSE' | 'COST';

const transactionTypes: Array<{ value: TransactionType; label: string }> = [
    { value: 'LABOR', label: 'Labor' },
    { value: 'MATERIAL', label: 'Material' },
    { value: 'EQUIPMENT', label: 'Equipment' },
    { value: 'COST', label: 'Cost Resource' },
    { value: 'EXPENSE', label: 'Direct Expense' },
];

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-primary)',
};

const money = (value: number | string | null | undefined) => {
    const n = Number(value ?? 0);
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold font-mono text-slate-400 uppercase block">{label}</label>
            {children}
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">{label}</span>
                {icon}
            </div>
            <div className="mt-2 text-xl font-black font-mono text-cyan-400">{value}</div>
        </div>
    );
}

export default function CostTransactionManager() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);

    const [projects, setProjects] = useState<BaseEntity[]>([]);
    const [expenseTypes, setExpenseTypes] = useState<BaseEntity[]>([]);
    const [transactions, setTransactions] = useState<CostTransaction[]>([]);
    const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
    const [tasks, setTasks] = useState<TaskEntity[]>([]);
    const [assignments, setAssignments] = useState<AssignmentEntity[]>([]);
    const [selectedRate, setSelectedRate] = useState<ResourceRateEntity | null>(null);

    const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const taskDropdownRef = useRef<HTMLDivElement>(null);

    const [ledgerFilters, setLedgerFilters] = useState({
        project: '',
        transactionType: '',
        search: '',
    });

    const [form, setForm] = useState({
        project: '',
        transaction_type: 'LABOR' as TransactionType,
        expense_type: '',
        transaction_date: new Date().toISOString().split('T')[0],
        quantity: 1,
        unit_rate: 0,
        expense_rate: 0,
        description: '',
        budget_allocation: '',
    });
    const [selectedTask, setSelectedTask] = useState('');
    const [selectedAssignment, setSelectedAssignment] = useState('');

    const isExpense = form.transaction_type === 'EXPENSE';
    const liveAmount = form.quantity * (isExpense ? form.expense_rate : form.unit_rate);

    const projectNameById = useMemo(() => {
        return new Map(projects.map((project) => [String(project.id), project.name]));
    }, [projects]);

    const filteredLedger = useMemo(() => {
        const q = ledgerFilters.search.trim().toLowerCase();
        return transactions.filter((item) => {
            if (ledgerFilters.project && String(item.project) !== String(ledgerFilters.project)) {
                return false;
            }
            if (ledgerFilters.transactionType && item.transaction_type !== ledgerFilters.transactionType) {
                return false;
            }
            if (!q) return true;
            const haystack = [
                projectNameById.get(String(item.project)),
                item.task_title,
                item.resource_name,
                item.expense_type_name,
                item.description,
                item.transaction_type,
            ].join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [ledgerFilters.project, ledgerFilters.search, ledgerFilters.transactionType, projectNameById, transactions]);

    const ledgerTotals = useMemo(() => {
        const total = filteredLedger.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const taskLinked = filteredLedger.filter((tx) => tx.task).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const direct = filteredLedger.filter((tx) => !tx.task).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        return { total, taskLinked, direct, count: filteredLedger.length };
    }, [filteredLedger]);

    const allocationOptions = useMemo(() => {
        if (!form.project) return [];
        return budgetAllocations.filter((item) => String(item.project) === String(form.project));
    }, [budgetAllocations, form.project]);

    const selectedTaskLabel = useMemo(() => {
        const task = tasks.find((item) => item.id === selectedTask);
        if (!task) return form.project ? 'Select task...' : 'Select a project first...';
        const code = Array.isArray(task.code) ? task.code[0] : task.code;
        return `${code ? `[${code}] ` : ''}${task.name}`;
    }, [form.project, selectedTask, tasks]);

    const filteredTasks = useMemo(() => {
        if (!taskSearchQuery.trim()) return tasks;
        const q = taskSearchQuery.toLowerCase();
        return tasks.filter((task) => {
            const code = Array.isArray(task.code) ? task.code.join(' ') : task.code;
            return `${task.name} ${code ?? ''}`.toLowerCase().includes(q);
        });
    }, [taskSearchQuery, tasks]);

    const loadLedger = async (filters = ledgerFilters) => {
        setIsLedgerLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.project) params.set('project_id', filters.project);
            if (filters.transactionType) params.set('transaction_type', filters.transactionType);
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const response = await apiClient.get(`planning/cost-transactions/${suffix}`);
            setTransactions(response.data.results ?? response.data);
        } finally {
            setIsLedgerLoading(false);
        }
    };

    const loadBudgetData = async () => {
        const allocationResponse = await apiClient.get('planning/budget-allocations/');
        setBudgetAllocations(allocationResponse.data.results ?? allocationResponse.data);
    };

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (taskDropdownRef.current && !taskDropdownRef.current.contains(event.target as Node)) {
                setIsTaskDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const [projectResponse, expenseResponse, ledgerResponse, allocationResponse] = await Promise.all([
                    apiClient.get('planning/projects/'),
                    apiClient.get('planning/expense-types/'),
                    apiClient.get('planning/cost-transactions/'),
                    apiClient.get('planning/budget-allocations/'),
                ]);
                setProjects(projectResponse.data.results ?? projectResponse.data);
                setExpenseTypes(expenseResponse.data.results ?? expenseResponse.data);
                setTransactions(ledgerResponse.data.results ?? ledgerResponse.data);
                setBudgetAllocations(allocationResponse.data.results ?? allocationResponse.data);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!form.project || isExpense) {
            return;
        }

        apiClient.get(`planning/tasks/?project_id=${form.project}`)
            .then((response) => setTasks(response.data.results ?? response.data))
            .catch(() => setTasks([]));
    }, [form.project, isExpense]);

    useEffect(() => {
        if (!selectedTask || isExpense) return;

        apiClient.get(`planning/assignments/?task_id=${selectedTask}`)
            .then((response) => {
                const all: AssignmentEntity[] = response.data.results ?? response.data;
                setAssignments(all.filter((assignment) => assignment.resource_type === form.transaction_type));
            })
            .catch(() => setAssignments([]));
    }, [form.transaction_type, isExpense, selectedTask]);

    useEffect(() => {
        if (!selectedAssignment || isExpense) return;

        const assignment = assignments.find((item) => String(item.id) === String(selectedAssignment));
        if (!assignment) return;

        apiClient.get(`planning/resource-rates/?resource_id=${assignment.resourceId}`)
            .then((response) => {
                const rates: ResourceRateEntity[] = response.data.results ?? response.data;
                const txDate = new Date(form.transaction_date);
                const selected = rates
                    .filter((rate) => new Date(rate.effectiveFrom) <= txDate)
                    .sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime())
                    .at(-1);
                if (selected) {
                    setSelectedRate(selected);
                    setForm((prev) => ({ ...prev, unit_rate: Number(selected.regularRate) }));
                }
            });
    }, [assignments, form.transaction_date, isExpense, selectedAssignment]);

    const resetForm = () => {
        setSelectedTask('');
        setSelectedAssignment('');
        setSelectedRate(null);
        setAssignments([]);
        setForm((prev) => ({
            ...prev,
            quantity: 1,
            unit_rate: 0,
            expense_rate: 0,
            description: '',
            expense_type: '',
            budget_allocation: '',
        }));
    };

    const handleLedgerFilterChange = (next: Partial<typeof ledgerFilters>) => {
        const merged = { ...ledgerFilters, ...next };
        setLedgerFilters(merged);
        loadLedger(merged);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!form.project) {
            alert('Select a project.');
            return;
        }
        if (isExpense && !form.expense_type) {
            alert('Select an expense type.');
            return;
        }
        if (!isExpense && (!selectedTask || !selectedAssignment || !selectedRate)) {
            alert('Select task, assigned resource, and a valid resource rate.');
            return;
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
            if (form.budget_allocation) {
                payload.budget_allocation = form.budget_allocation;
            }

            if (isExpense) {
                payload.expense_type = form.expense_type;
                payload.expense_rate = form.expense_rate;
            } else {
                payload.task = selectedTask;
                payload.assignment = selectedAssignment;
                payload.resource_rate = selectedRate!.id;
                payload.unit_rate = form.unit_rate;
            }

            await apiClient.post('planning/cost-transactions/', payload);
            resetForm();
            await loadLedger();
            await loadBudgetData();
        } catch (error) {
            console.error('Submit error:', error);
            alert('Could not save transaction. Check the financial fields.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[500px] flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                <span className="font-mono text-sm tracking-widest uppercase mt-4 text-cyan-500">Loading ledger...</span>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen p-5 space-y-5" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                    <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-cyan-400" />
                        Cost Ledger
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Actual cost entry, task linkage, and transaction review.</p>
                </div>
                <button
                    type="button"
                    onClick={() => loadLedger()}
                    className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-2"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                >
                    <RefreshCcw className={`w-4 h-4 ${isLedgerLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <StatCard label="Visible Total" value={`$${money(ledgerTotals.total)}`} icon={<DollarSign className="w-4 h-4 text-cyan-400" />} />
                <StatCard label="Task Linked" value={`$${money(ledgerTotals.taskLinked)}`} icon={<Layers className="w-4 h-4 text-emerald-400" />} />
                <StatCard label="Direct Expense" value={`$${money(ledgerTotals.direct)}`} icon={<Receipt className="w-4 h-4 text-amber-400" />} />
                <StatCard label="Records" value={String(ledgerTotals.count)} icon={<Hash className="w-4 h-4 text-indigo-400" />} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,480px)_1fr] gap-5 items-start">
                <form onSubmit={handleSubmit} className="rounded-lg p-5 space-y-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Save className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-mono font-bold uppercase">New Transaction</span>
                        </div>
                        <span className="text-sm font-black font-mono text-cyan-400">${money(liveAmount)}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                        <Field label="Project">
                            <select
                                required
                                value={form.project}
                                onChange={(event) => {
                                    setForm((prev) => ({ ...prev, project: event.target.value }));
                                    setTasks([]);
                                    setSelectedTask('');
                                    setAssignments([]);
                                    setSelectedAssignment('');
                                    setSelectedRate(null);
                                }}
                                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                                style={inputStyle}
                            >
                                <option value="">Select project...</option>
                                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                            </select>
                        </Field>

                        <Field label="Type">
                            <select
                                required
                                value={form.transaction_type}
                                onChange={(event) => {
                                    const nextType = event.target.value as TransactionType;
                                    setForm((prev) => ({ ...prev, transaction_type: nextType, expense_type: '', unit_rate: 0 }));
                                    setTasks([]);
                                    setSelectedTask('');
                                    setAssignments([]);
                                    setSelectedAssignment('');
                                    setSelectedRate(null);
                                }}
                                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                                style={inputStyle}
                            >
                                {transactionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                        </Field>

                        <Field label="Budget Allocation">
                            <select
                                value={form.budget_allocation}
                                onChange={(event) => setForm((prev) => ({ ...prev, budget_allocation: event.target.value }))}
                                disabled={!form.project}
                                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                                style={inputStyle}
                            >
                                <option value="">No allocation link</option>
                                {allocationOptions.map((allocation) => (
                                    <option key={allocation.id} value={allocation.id}>
                                        {(allocation.funding_source_title ?? 'Source')} / {allocation.cost_type} / {money(allocation.remaining_amount)} left
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {!isExpense && (
                        <div className="space-y-4 rounded-lg p-3" style={{ backgroundColor: 'var(--overlay-bg)', border: '1px solid var(--border-subtle)' }}>
                            <div className="space-y-1.5 relative" ref={taskDropdownRef}>
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Target Task</label>
                                <button
                                    type="button"
                                    disabled={!form.project}
                                    onClick={() => setIsTaskDropdownOpen((open) => !open)}
                                    className="w-full rounded-lg px-3 py-2 text-xs flex items-center justify-between"
                                    style={inputStyle}
                                >
                                    <span className="truncate">{selectedTaskLabel}</span>
                                    <ChevronDown className="w-4 h-4 opacity-50" />
                                </button>

                                {isTaskDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 rounded-lg shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-medium)' }}>
                                        <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                            <div className="relative">
                                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                                <input
                                                    value={taskSearchQuery}
                                                    onChange={(event) => setTaskSearchQuery(event.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none"
                                                    style={inputStyle}
                                                    placeholder="Search task..."
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto p-1.5">
                                            {filteredTasks.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-slate-500">No task found.</div>
                                            ) : filteredTasks.map((task) => {
                                                const code = Array.isArray(task.code) ? task.code[0] : task.code;
                                                return (
                                                    <button
                                                        key={task.id}
                                                        type="button"
                                        onClick={() => {
                                                            setSelectedTask(task.id);
                                                            setAssignments([]);
                                                            setSelectedAssignment('');
                                                            setSelectedRate(null);
                                                            setIsTaskDropdownOpen(false);
                                                            setTaskSearchQuery('');
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5"
                                                    >
                                                        <span className="text-xs font-bold">{code ? `[${code}] ` : ''}{task.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Field label="Assigned Resource">
                                <select
                                    required
                                    disabled={!selectedTask}
                                    value={selectedAssignment}
                                    onChange={(event) => {
                                        setSelectedAssignment(event.target.value);
                                        setSelectedRate(null);
                                        setForm((prev) => ({ ...prev, unit_rate: 0 }));
                                    }}
                                    className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                                    style={inputStyle}
                                >
                                    <option value="">Select resource...</option>
                                    {assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.resource_name}</option>)}
                                </select>
                            </Field>

                            {selectedAssignment && (
                                <div className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                                    <User className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <span className="text-[10px] font-mono text-slate-400 uppercase block">Resource Rate</span>
                                        {selectedRate ? <span className="text-sm font-black font-mono text-emerald-400">${selectedRate.regularRate}</span> : <span className="text-xs text-amber-500">No valid rate for date.</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                        {isExpense ? (
                            <>
                                <Field label="Expense Type">
                                    <select
                                        required
                                        value={form.expense_type}
                                        onChange={(event) => setForm((prev) => ({ ...prev, expense_type: event.target.value }))}
                                        className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                                        style={inputStyle}
                                    >
                                        <option value="">Select expense type...</option>
                                        {expenseTypes.map((expense) => <option key={expense.id} value={expense.id}>{expense.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Expense Rate">
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={form.expense_rate}
                                        onChange={(event) => setForm((prev) => ({ ...prev, expense_rate: Number(event.target.value) }))}
                                        className="w-full rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-cyan-500"
                                        style={inputStyle}
                                    />
                                </Field>
                            </>
                        ) : (
                            <Field label="Unit Rate">
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={form.unit_rate}
                                    onChange={(event) => setForm((prev) => ({ ...prev, unit_rate: Number(event.target.value) }))}
                                    className="w-full rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-cyan-500"
                                    style={inputStyle}
                                />
                            </Field>
                        )}

                        <Field label="Transaction Date">
                            <JalaliDatePicker
                                value={form.transaction_date}
                                onChange={(date) => {
                                    setForm((prev) => ({ ...prev, transaction_date: date, unit_rate: isExpense ? prev.unit_rate : 0 }));
                                    if (!isExpense) setSelectedRate(null);
                                }}
                            />
                        </Field>

                        <Field label="Quantity / Hours">
                            <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                value={form.quantity}
                                onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
                                className="w-full rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-cyan-500"
                                style={inputStyle}
                            />
                        </Field>
                    </div>

                    <Field label={<span className="flex items-center gap-1"><FileText className="w-3 h-3" />Description</span>}>
                        <textarea
                            rows={2}
                            value={form.description}
                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                            className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                            style={inputStyle}
                            placeholder="Transaction notes..."
                        />
                    </Field>

                    <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                            Reset
                        </button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Commit
                        </button>
                    </div>
                </form>

                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-mono font-bold uppercase">Transaction Ledger</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full md:w-auto">
                            <select value={ledgerFilters.project} onChange={(event) => handleLedgerFilterChange({ project: event.target.value })} className="rounded-lg px-3 py-2 text-xs" style={inputStyle}>
                                <option value="">All projects</option>
                                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                            </select>
                            <select value={ledgerFilters.transactionType} onChange={(event) => handleLedgerFilterChange({ transactionType: event.target.value })} className="rounded-lg px-3 py-2 text-xs" style={inputStyle}>
                                <option value="">All types</option>
                                {transactionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    value={ledgerFilters.search}
                                    onChange={(event) => setLedgerFilters((prev) => ({ ...prev, search: event.target.value }))}
                                    placeholder="Search ledger..."
                                    className="w-full rounded-lg pl-9 pr-3 py-2 text-xs"
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                            <tr className="text-[10px] uppercase font-mono text-slate-400" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                                <th className="text-left p-3">Date</th>
                                <th className="text-left p-3">Project</th>
                                <th className="text-left p-3">Type</th>
                                <th className="text-left p-3">Cost Object</th>
                                <th className="text-right p-3">Qty</th>
                                <th className="text-right p-3">Rate</th>
                                <th className="text-right p-3">Amount</th>
                            </tr>
                            </thead>
                            <tbody>
                            {isLedgerLoading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading ledger...</td></tr>
                            ) : filteredLedger.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No transactions found.</td></tr>
                            ) : filteredLedger.map((tx) => {
                                const rate = tx.transaction_type === 'EXPENSE' ? tx.expense_rate : tx.unit_rate;
                                return (
                                    <tr key={tx.id} className="border-t hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <td className="p-3 font-mono text-slate-300">{tx.transaction_date}</td>
                                        <td className="p-3 font-bold">{projectNameById.get(String(tx.project)) ?? tx.project}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400">{tx.transaction_type}</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold">{tx.task_title || tx.expense_type_name || 'Project level'}</div>
                                            <div className="text-[10px] text-slate-400">{tx.resource_name || tx.description || 'Direct cost'}</div>
                                        </td>
                                        <td className="p-3 text-right font-mono">{money(tx.quantity)}</td>
                                        <td className="p-3 text-right font-mono">{money(rate)}</td>
                                        <td className="p-3 text-right font-black font-mono text-cyan-400">${money(tx.amount)}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>

                    {filteredLedger.some((tx) => !tx.task) && (
                        <div className="p-3 text-xs text-amber-400 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <AlertCircle className="w-4 h-4" />
                            Direct project-level expenses are tracked in this ledger but do not affect task-level EVM until assigned to a task.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
