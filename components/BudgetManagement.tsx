import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Loader2, RefreshCcw, Save, WalletCards } from 'lucide-react';
import { apiClient } from '@/lib/api';
import JalaliDatePicker from '@/components/JalaliDatePicker';

interface BaseEntity {
    id: string;
    name: string;
}

interface OrgUnit extends BaseEntity {
    description?: string;
}

interface WbsEntity extends BaseEntity {
    versionId: number;
    code?: string;
    parentId?: string | null;
}

interface TaskEntity extends BaseEntity {
    code?: string | [string, string];
    wbsNodeId?: string | null;
    wbsVersionId?: number | null;
}

interface FundingSource {
    id: string;
    title: string;
    source_type: string;
    source_party?: string | null;
    received_date: string;
    total_amount: string;
    allocated_amount: string;
    unallocated_amount: string;
    currency: string;
}

interface BudgetAllocation {
    id: string;
    funding_source: string;
    funding_source_title?: string;
    project: string | null;
    project_name?: string;
    org_unit?: string | null;
    org_unit_name?: string | null;
    scope_type: string;
    cost_type: string;
    allocated_amount: string;
    actual_amount: string;
    remaining_amount: string;
    description?: string;
}

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

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">{label}</span>
            <div className={`mt-2 text-xl font-black font-mono ${tone}`}>{value}</div>
        </div>
    );
}

export default function BudgetManagement() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingSource, setIsSavingSource] = useState(false);
    const [isSavingAllocation, setIsSavingAllocation] = useState(false);
    const [projects, setProjects] = useState<BaseEntity[]>([]);
    const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
    const [wbsNodes, setWbsNodes] = useState<WbsEntity[]>([]);
    const [tasks, setTasks] = useState<TaskEntity[]>([]);
    const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
    const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);

    const [fundingForm, setFundingForm] = useState({
        title: '',
        source_type: 'CLIENT_PAYMENT',
        source_party: '',
        reference_no: '',
        received_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        currency: 'IRR',
        description: '',
    });
    const [allocationForm, setAllocationForm] = useState({
        funding_source: '',
        project: '',
        wbs_node: '',
        task: '',
        org_unit: '',
        scope_type: 'PROJECT',
        cost_type: 'EXPENSE',
        allocated_amount: 0,
        description: '',
    });

    const projectNameById = useMemo(() => {
        return new Map(projects.map((project) => [String(project.id), project.name]));
    }, [projects]);

    const orgUnitNameById = useMemo(() => {
        return new Map(orgUnits.map((unit) => [String(unit.id), unit.name]));
    }, [orgUnits]);

    const requiresProject = ['PROJECT', 'WBS', 'TASK'].includes(allocationForm.scope_type);
    const requiresWbs = ['WBS', 'TASK'].includes(allocationForm.scope_type);
    const requiresTask = allocationForm.scope_type === 'TASK';
    const requiresOrgUnit = allocationForm.scope_type === 'ORG_UNIT';

    const filteredTasks = useMemo(() => {
        if (!allocationForm.wbs_node) return [];
        const selectedWbs = wbsNodes.find((node) => String(node.versionId) === String(allocationForm.wbs_node));
        if (!selectedWbs) return [];
        return tasks.filter((task) => String(task.wbsNodeId) === String(selectedWbs.id));
    }, [allocationForm.wbs_node, tasks, wbsNodes]);

    const fundingTotals = useMemo(() => {
        const received = fundingSources.reduce((sum, source) => sum + Number(source.total_amount || 0), 0);
        const allocated = fundingSources.reduce((sum, source) => sum + Number(source.allocated_amount || 0), 0);
        const remaining = fundingSources.reduce((sum, source) => sum + Number(source.unallocated_amount || 0), 0);
        const actual = budgetAllocations.reduce((sum, item) => sum + Number(item.actual_amount || 0), 0);
        return { received, allocated, remaining, actual };
    }, [budgetAllocations, fundingSources]);

    const loadBudgetData = async () => {
        const [projectResponse, orgUnitResponse, sourceResponse, allocationResponse] = await Promise.all([
            apiClient.get('planning/projects/'),
            apiClient.get('auth/org-units/'),
            apiClient.get('planning/funding-sources/'),
            apiClient.get('planning/budget-allocations/'),
        ]);
        setProjects(projectResponse.data.results ?? projectResponse.data);
        setOrgUnits(orgUnitResponse.data.results ?? orgUnitResponse.data);
        setFundingSources(sourceResponse.data.results ?? sourceResponse.data);
        setBudgetAllocations(allocationResponse.data.results ?? allocationResponse.data);
    };

    useEffect(() => {
        (async () => {
            try {
                await loadBudgetData();
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!allocationForm.project || !requiresWbs) {
            return;
        }

        (async () => {
            const [wbsResponse, taskResponse] = await Promise.all([
                apiClient.get(`planning/wbs-nodes/?project_id=${allocationForm.project}`),
                apiClient.get(`planning/tasks/?project_id=${allocationForm.project}`),
            ]);
            setWbsNodes(wbsResponse.data.results ?? wbsResponse.data);
            setTasks(taskResponse.data.results ?? taskResponse.data);
        })().catch(() => {
            setWbsNodes([]);
            setTasks([]);
        });
    }, [allocationForm.project, requiresWbs]);

    const handleFundingSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!fundingForm.title || fundingForm.total_amount <= 0) {
            alert('Enter source title and amount.');
            return;
        }
        setIsSavingSource(true);
        try {
            await apiClient.post('planning/funding-sources/', fundingForm);
            setFundingForm((prev) => ({ ...prev, title: '', source_party: '', reference_no: '', total_amount: 0, description: '' }));
            await loadBudgetData();
        } finally {
            setIsSavingSource(false);
        }
    };

    const handleAllocationSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!allocationForm.funding_source || allocationForm.allocated_amount <= 0) {
            alert('Select funding source and allocation amount.');
            return;
        }
        if (requiresProject && !allocationForm.project) {
            alert('Project is required for project, WBS, and task allocations.');
            return;
        }
        if (requiresWbs && !allocationForm.wbs_node) {
            alert('Select a WBS node.');
            return;
        }
        if (requiresTask && !allocationForm.task) {
            alert('Select a task.');
            return;
        }
        if (requiresOrgUnit && !allocationForm.org_unit) {
            alert('Org unit is required for org unit allocations.');
            return;
        }
        setIsSavingAllocation(true);
        try {
            const payload = {
                ...allocationForm,
                project: requiresProject ? allocationForm.project : null,
                wbs_node: requiresWbs ? allocationForm.wbs_node : null,
                task: requiresTask ? allocationForm.task : null,
                org_unit: requiresOrgUnit ? allocationForm.org_unit : null,
            };
            await apiClient.post('planning/budget-allocations/', payload);
            setAllocationForm((prev) => ({ ...prev, wbs_node: '', task: '', allocated_amount: 0, description: '' }));
            await loadBudgetData();
        } finally {
            setIsSavingAllocation(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[500px] flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                <span className="font-mono text-sm tracking-widest uppercase mt-4 text-cyan-500">Loading budget...</span>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen p-5 space-y-5" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                    <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                        <WalletCards className="w-5 h-5 text-emerald-400" />
                        Budget Control
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Funding sources, budget allocations, actual usage, and remaining budget.</p>
                </div>
                <button type="button" onClick={loadBudgetData} className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-2" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <RefreshCcw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <StatCard label="Received" value={money(fundingTotals.received)} tone="text-cyan-400" />
                <StatCard label="Allocated" value={money(fundingTotals.allocated)} tone="text-emerald-400" />
                <StatCard label="Actual Used" value={money(fundingTotals.actual)} tone="text-indigo-400" />
                <StatCard label="Free" value={money(fundingTotals.remaining)} tone="text-amber-400" />
            </div>

            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-xs font-mono font-bold uppercase">Funding Sources</span>
                    <span className="text-[10px] font-mono text-slate-400">{fundingSources.length} funds</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
                    {fundingSources.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 md:col-span-2 xl:col-span-4">No funding source yet.</div>
                    ) : fundingSources.map((source) => (
                        <div key={source.id} className="p-4 border-b md:border-r last:border-r-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold">{source.title}</div>
                                    <div className="text-[10px] text-slate-400">{source.source_type}{source.source_party ? ` / ${source.source_party}` : ''}</div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">{source.currency}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] font-mono">
                                <div>
                                    <div className="text-slate-500 uppercase">Total</div>
                                    <div className="text-cyan-400 font-black">{money(source.total_amount)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 uppercase">Used</div>
                                    <div className="text-emerald-400 font-black">{money(source.allocated_amount)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 uppercase">Left</div>
                                    <div className="text-amber-400 font-black">{money(source.unallocated_amount)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,460px)_minmax(360px,460px)_1fr] gap-5 items-start">
                <form onSubmit={handleFundingSubmit} className="rounded-lg p-5 space-y-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-mono font-bold uppercase">New Funding Source</span>
                    </div>
                    <Field label="Title">
                        <input required value={fundingForm.title} onChange={(event) => setFundingForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle} placeholder="Client payment..." />
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Type">
                            <select value={fundingForm.source_type} onChange={(event) => setFundingForm((prev) => ({ ...prev, source_type: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle}>
                                <option value="CLIENT_PAYMENT">Client Payment</option>
                                <option value="INTERNAL_CAPITAL">Internal Capital</option>
                                <option value="LOAN">Loan</option>
                                <option value="CONTRACT">Contract</option>
                                <option value="GRANT">Grant</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </Field>
                        <Field label="Amount">
                            <input type="number" required min="0.01" step="0.01" value={fundingForm.total_amount} onChange={(event) => setFundingForm((prev) => ({ ...prev, total_amount: Number(event.target.value) }))} className="w-full rounded-lg px-3 py-2 text-xs font-mono font-bold" style={inputStyle} />
                        </Field>
                        <Field label="Party">
                            <input value={fundingForm.source_party} onChange={(event) => setFundingForm((prev) => ({ ...prev, source_party: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle} placeholder="Customer / bank..." />
                        </Field>
                        <Field label="Reference">
                            <input value={fundingForm.reference_no} onChange={(event) => setFundingForm((prev) => ({ ...prev, reference_no: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle} placeholder="Receipt / contract no." />
                        </Field>
                    </div>
                    <Field label="Received Date">
                        <JalaliDatePicker value={fundingForm.received_date} onChange={(date) => setFundingForm((prev) => ({ ...prev, received_date: date }))} />
                    </Field>
                    <button type="submit" disabled={isSavingSource} className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-2">
                        {isSavingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Add Source
                    </button>
                </form>

                <form onSubmit={handleAllocationSubmit} className="rounded-lg p-5 space-y-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                        <WalletCards className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-bold uppercase">New Allocation</span>
                    </div>
                    <Field label="Funding Source">
                        <select required value={allocationForm.funding_source} onChange={(event) => setAllocationForm((prev) => ({ ...prev, funding_source: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle}>
                            <option value="">Select source...</option>
                            {fundingSources.map((source) => <option key={source.id} value={source.id}>{source.title} - {money(source.unallocated_amount)} free</option>)}
                        </select>
                    </Field>
                    <Field label={requiresProject ? 'Project' : 'Project (optional)'}>
                        <select
                            required={requiresProject}
                            value={allocationForm.project}
                            onChange={(event) => setAllocationForm((prev) => ({
                                ...prev,
                                project: event.target.value,
                                wbs_node: '',
                                task: '',
                            }))}
                            className="w-full rounded-lg px-3 py-2 text-xs"
                            style={inputStyle}
                        >
                            <option value="">Select project...</option>
                            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                        </select>
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Scope">
                            <select
                                value={allocationForm.scope_type}
                                onChange={(event) => setAllocationForm((prev) => ({
                                    ...prev,
                                    scope_type: event.target.value,
                                    project: ['PROJECT', 'WBS', 'TASK'].includes(event.target.value) ? prev.project : '',
                                    wbs_node: '',
                                    task: '',
                                    org_unit: event.target.value === 'ORG_UNIT' ? prev.org_unit : '',
                                }))}
                                className="w-full rounded-lg px-3 py-2 text-xs"
                                style={inputStyle}
                            >
                                <option value="PROJECT">Project</option>
                                <option value="WBS">WBS</option>
                                <option value="TASK">Task</option>
                                <option value="RESERVE">Reserve</option>
                                <option value="ORG_UNIT">Org Unit / Company Expense</option>
                            </select>
                        </Field>
                        <Field label="Cost Type">
                            <select value={allocationForm.cost_type} onChange={(event) => setAllocationForm((prev) => ({ ...prev, cost_type: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle}>
                                <option value="LABOR">Labor</option>
                                <option value="MATERIAL">Material</option>
                                <option value="EQUIPMENT">Equipment</option>
                                <option value="EXPENSE">Expense</option>
                                <option value="COST">Cost</option>
                                <option value="OVERHEAD">Overhead</option>
                                <option value="RESERVE">Reserve</option>
                            </select>
                        </Field>
                    </div>
                    {requiresWbs && (
                        <Field label="WBS">
                            <select
                                required
                                disabled={!allocationForm.project}
                                value={allocationForm.wbs_node}
                                onChange={(event) => setAllocationForm((prev) => ({ ...prev, wbs_node: event.target.value, task: '' }))}
                                className="w-full rounded-lg px-3 py-2 text-xs"
                                style={inputStyle}
                            >
                                <option value="">{allocationForm.project ? 'Select WBS...' : 'Select project first...'}</option>
                                {wbsNodes.map((node) => (
                                    <option key={node.versionId} value={node.versionId}>
                                        {node.code ? `${node.code} - ` : ''}{node.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                    {requiresTask && (
                        <Field label="Task">
                            <select
                                required
                                disabled={!allocationForm.wbs_node}
                                value={allocationForm.task}
                                onChange={(event) => setAllocationForm((prev) => ({ ...prev, task: event.target.value }))}
                                className="w-full rounded-lg px-3 py-2 text-xs"
                                style={inputStyle}
                            >
                                <option value="">{allocationForm.wbs_node ? 'Select task...' : 'Select WBS first...'}</option>
                                {filteredTasks.map((task) => {
                                    const code = Array.isArray(task.code) ? task.code[0] : task.code;
                                    return <option key={task.id} value={task.id}>{code ? `${code} - ` : ''}{task.name}</option>;
                                })}
                            </select>
                        </Field>
                    )}
                    {requiresOrgUnit && (
                        <Field label="Org Unit">
                            <select required value={allocationForm.org_unit} onChange={(event) => setAllocationForm((prev) => ({ ...prev, org_unit: event.target.value }))} className="w-full rounded-lg px-3 py-2 text-xs" style={inputStyle}>
                                <option value="">Select org unit...</option>
                                {orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                            </select>
                        </Field>
                    )}
                    <Field label="Amount">
                        <input type="number" required min="0.01" step="0.01" value={allocationForm.allocated_amount} onChange={(event) => setAllocationForm((prev) => ({ ...prev, allocated_amount: Number(event.target.value) }))} className="w-full rounded-lg px-3 py-2 text-xs font-mono font-bold" style={inputStyle} />
                    </Field>
                    <button type="submit" disabled={isSavingAllocation} className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2">
                        {isSavingAllocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Allocate Budget
                    </button>
                </form>

                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <span className="text-xs font-mono font-bold uppercase">Allocation Ledger</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                            <tr className="text-[10px] uppercase font-mono text-slate-400" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                                <th className="text-left p-3">Project</th>
                                <th className="text-left p-3">Source</th>
                                <th className="text-left p-3">Scope</th>
                                <th className="text-right p-3">Allocated</th>
                                <th className="text-right p-3">Actual</th>
                                <th className="text-right p-3">Remaining</th>
                            </tr>
                            </thead>
                            <tbody>
                            {budgetAllocations.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No budget allocation yet.</td></tr>
                            ) : budgetAllocations.map((allocation) => (
                                <tr key={allocation.id} className="border-t hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <td className="p-3 font-bold">{allocation.project_name ?? projectNameById.get(String(allocation.project)) ?? allocation.org_unit_name ?? orgUnitNameById.get(String(allocation.org_unit)) ?? 'Company'}</td>
                                    <td className="p-3 text-slate-300">{allocation.funding_source_title ?? allocation.funding_source}</td>
                                    <td className="p-3"><span className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400">{allocation.scope_type} / {allocation.cost_type}</span></td>
                                    <td className="p-3 text-right font-mono">{money(allocation.allocated_amount)}</td>
                                    <td className="p-3 text-right font-mono text-indigo-400">{money(allocation.actual_amount)}</td>
                                    <td className="p-3 text-right font-black font-mono text-cyan-400">{money(allocation.remaining_amount)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
