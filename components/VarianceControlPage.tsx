import React, { useState, useMemo, useEffect } from 'react';
import { apiClient } from '@/lib/api'; // مسیر ایمپورت را بر اساس ساختار پوشه‌های خود تنظیم کنید
import { gregorianToJalali, JALALI_MONTHS } from '../utils/jalali';
import {
    Project, Revision, ProjectNode, CustomUser, VarianceReport
} from '@/types/types';
import {
    TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle2,
    ShieldAlert, DollarSign, Sliders, Plus, Trash2, Clock,
    BarChart2, Download, Activity, X, Gauge, Sparkles, RefreshCcw
} from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';

interface VarianceControlPageProps {
    users: CustomUser[];
    projects: Project[];
    revisions: Revision[];
    nodes: ProjectNode[];
    onExit: () => void;
    isLightMode: boolean;
    currentUser: CustomUser | null;
}

export default function VarianceControlPage({
                                                users, projects, revisions, nodes, onExit, isLightMode, currentUser
                                            }: VarianceControlPageProps) {

    const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
    const [selectedRevisionId, setSelectedRevisionId] = useState<string>('');

    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);

    // Available revisions for the selected project
    const projectRevisions = useMemo(() => {
        return revisions.filter(r => r.projectId === selectedProjectId).sort((a,b) => b.number - a.number);
    }, [revisions, selectedProjectId]);

    useEffect(() => {
        if (projectRevisions.length > 0) {
            setSelectedRevisionId(projectRevisions[0].id);
        } else {
            setSelectedRevisionId('');
            setReports([]);
        }
    }, [projectRevisions]);

    // Query activities in the selected revision for the Modal Dropdown
    const activeActivities = useMemo(() => {
        return nodes.filter(n => n.type === 'activity');
    }, [nodes]);

    // ----------------------------------------------------------------------
    // API CALLS: Fetch, Calculate, Save, Delete
    // ----------------------------------------------------------------------

    const fetchVarianceData = async () => {
        if (!selectedRevisionId) return;
        setIsLoading(true);
        try {
            const res = await apiClient.get(`planning/variance-reports/?revision_id=${selectedRevisionId}`);
            // تبدیل نام متغیرهای دیتابیس (اسنیک‌کیس) به مدل فرانت (کمل‌کیس)
            const mappedData = res.data.map((r: any) => ({
                id: r.id,
                taskId: r.task,
                revisionId: r.revision,
                reportDate: r.report_date,
                budgetAtCompletion: Number(r.budget_at_completion),
                plannedValue: Number(r.planned_value),
                earnedValue: Number(r.earned_value),
                actualCost: Number(r.actual_cost),
                spi: Number(r.spi),
                cpi: Number(r.cpi),
                scheduleVariance: Number(r.schedule_variance),
                costVariance: Number(r.cost_variance),
                estimateAtCompletion: Number(r.estimate_at_completion),
                estimateToComplete: Number(r.estimate_to_complete),
                varianceAtCompletion: Number(r.variance_at_completion),
                actionRequired: r.action_required,
                taskName: r.task_name,
                taskCode: r.task_code
            }));
            setReports(mappedData);
        } catch (error) {
            console.error("Error fetching EVM data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVarianceData();
    }, [selectedRevisionId]);

    const handleRecalculateEngine = async () => {
        if (!selectedProjectId) return;
        setIsCalculating(true);
        try {
            await apiClient.post('planning/variance-reports/calculate/', { project_id: selectedProjectId });
            await fetchVarianceData(); // Reload data after engine finishes
        } catch (error) {
            alert("خطا در اجرای موتور محاسباتی EVM.");
        } finally {
            setIsCalculating(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.taskId) return;

        const payload = {
            task: formState.taskId,
            revision: selectedRevisionId,
            budget_at_completion: formState.budgetAtCompletion,
            planned_value: formState.plannedValue,
            earned_value: formState.earnedValue,
            actual_cost: formState.actualCost,
            spi: computedFormMetrics.spi,
            cpi: computedFormMetrics.cpi,
            schedule_variance: computedFormMetrics.sv,
            cost_variance: computedFormMetrics.cv,
            estimate_at_completion: computedFormMetrics.eac,
            estimate_to_complete: computedFormMetrics.etc,
            variance_at_completion: computedFormMetrics.vac,
            action_required: computedFormMetrics.actionRequired
        };

        try {
            if (editingReportId) {
                await apiClient.put(`planning/variance-reports/${editingReportId}/`, payload);
            } else {
                await apiClient.post('planning/variance-reports/', payload);
            }
            await fetchVarianceData();
            setShowFormModal(false);
        } catch (error) {
            console.error("Error saving report", error);
            alert("ذخیره گزارش با خطا مواجه شد.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('آیا از حذف این رکورد انحراف اطمینان دارید؟')) {
            try {
                await apiClient.delete(`/variance-reports/${id}/`);
                await fetchVarianceData();
            } catch (error) {
                alert("حذف رکورد با خطا مواجه شد.");
            }
        }
    };

    // ----------------------------------------------------------------------
    // UI STATES & COMPUTATIONS
    // ----------------------------------------------------------------------

    const [filterActionRequiredOnly, setFilterActionRequiredOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [showFormModal, setShowFormModal] = useState(false);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [formState, setFormState] = useState({
        taskId: '',
        budgetAtCompletion: 0,
        plannedValue: 0,
        earnedValue: 0,
        actualCost: 0
    });

    const computedFormMetrics = useMemo(() => {
        const bac = formState.budgetAtCompletion;
        const pv = formState.plannedValue;
        const ev = formState.earnedValue;
        const ac = formState.actualCost;

        const sv = ev - pv;
        const cv = ev - ac;
        const spi = pv > 0 ? Number((ev / pv).toFixed(2)) : 1.0;
        const cpi = ac > 0 ? Number((ev / ac).toFixed(2)) : 1.0;
        const eac = cpi > 0 ? Number((bac / cpi).toFixed(2)) : bac;
        const etc = Math.max(0, eac - ac);
        const vac = bac - eac;
        const actionRequired = spi < 0.85 || cpi < 0.85 || sv < 0 || cv < 0;

        return { sv, cv, spi, cpi, eac, etc, vac, actionRequired };
    }, [formState]);

    const aggregates = useMemo(() => {
        if (reports.length === 0) {
            return { totalBAC: 0, totalPV: 0, totalEV: 0, totalAC: 0, overallSPI: 1.0, overallCPI: 1.0, totalSV: 0, totalCV: 0, criticalCount: 0 };
        }

        const totalBAC = reports.reduce((acc, r) => acc + r.budgetAtCompletion, 0);
        const totalPV = reports.reduce((acc, r) => acc + r.plannedValue, 0);
        const totalEV = reports.reduce((acc, r) => acc + r.earnedValue, 0);
        const totalAC = reports.reduce((acc, r) => acc + r.actualCost, 0);
        const criticalCount = reports.filter(r => r.actionRequired).length;

        const overallSPI = totalPV > 0 ? Number((totalEV / totalPV).toFixed(2)) : 1.0;
        const overallCPI = totalAC > 0 ? Number((totalEV / totalAC).toFixed(2)) : 1.0;
        const totalSV = totalEV - totalPV;
        const totalCV = totalEV - totalAC;

        return { totalBAC, totalPV, totalEV, totalAC, overallSPI, overallCPI, totalSV, totalCV, criticalCount };
    }, [reports]);

    const displayReports = useMemo(() => {
        return reports.filter(item => {
            const nameMatch = (item.taskName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const codeMatch = (item.taskCode || '').toLowerCase().includes(searchTerm.toLowerCase());
            const actionMatch = filterActionRequiredOnly ? item.actionRequired : true;
            return (nameMatch || codeMatch) && actionMatch;
        });
    }, [reports, searchTerm, filterActionRequiredOnly]);

    const sCurveData = useMemo(() => {
        // S-Curve logic based on loaded backend reports
        const datesSet = new Set<string>();
        reports.forEach(r => { if (r.reportDate) datesSet.add(r.reportDate); });
        const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));

        if (sortedDates.length === 0) return [];

        let cumPV = 0, cumEV = 0, cumAC = 0;
        return sortedDates.map(dateStr => {
            const dailyReports = reports.filter(r => r.reportDate === dateStr);
            dailyReports.forEach(r => {
                cumPV += r.plannedValue;
                cumEV += r.earnedValue;
                cumAC += r.actualCost;
            });

            let elegantLabel = dateStr;
            try {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const j = gregorianToJalali(+parts[0], +parts[1], +parts[2]);
                    elegantLabel = `${j.jd} ${JALALI_MONTHS[j.jm - 1]}`;
                }
            } catch (e) {}

            return {
                name: elegantLabel,
                'Planned Value (PV)': Math.round(cumPV),
                'Earned Value (EV)': Math.round(cumEV),
                'Actual Cost (AC)': Math.round(cumAC)
            };
        });
    }, [reports]);

    // ----------------------------------------------------------------------
    // HANDLERS
    // ----------------------------------------------------------------------

    const handleOpenAdd = () => {
        setEditingReportId(null);
        setFormState({ taskId: activeActivities[0]?.id || '', budgetAtCompletion: 0, plannedValue: 0, earnedValue: 0, actualCost: 0 });
        setShowFormModal(true);
    };

    const handleOpenEdit = (report: any) => {
        setEditingReportId(report.id);
        setFormState({
            taskId: report.taskId,
            budgetAtCompletion: report.budgetAtCompletion,
            plannedValue: report.plannedValue,
            earnedValue: report.earnedValue,
            actualCost: report.actualCost
        });
        setShowFormModal(true);
    };

    const handleExportCSV = () => {
        const headers = ['Task Code', 'Task Name', 'BAC', 'PV', 'EV', 'AC', 'SPI', 'CPI', 'SV', 'CV', 'EAC', 'ETC', 'VAC', 'Action Required'];
        const rows = displayReports.map(r => [
            r.taskCode, `"${r.taskName.replace(/"/g, '""')}"`, r.budgetAtCompletion, r.plannedValue, r.earnedValue, r.actualCost,
            r.spi, r.cpi, r.scheduleVariance, r.costVariance, r.estimateAtCompletion, r.estimateToComplete, r.varianceAtCompletion,
            r.actionRequired ? 'YES' : 'NO'
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `evm_report_rev_${selectedRevisionId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ----------------------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------------------

    return (
        <div className="h-full flex flex-col overflow-hidden relative" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

            {/* Overlay Loading State */}
    {(isLoading || isCalculating) && (
        <div className="absolute inset-0 z-50 bg-[#070b19]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-cyan-400 animate-spin" />
        <span className="font-mono text-sm text-cyan-400 uppercase tracking-widest font-bold">
            {isCalculating ? 'ENGINE IS RUNNING EVM COMPUTATIONS...' : 'SYNCING DATABASE...'}
            </span>
            </div>
    )}

    {/* Header */}
    <header className="bg-white/5 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shrink-0 z-20">
    <div className="flex items-center gap-4">
    <button onClick={onExit} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-[#131b31]/80 text-slate-300 hover:text-white rounded-xl transition-all text-xs font-semibold cursor-pointer">
    <Clock className="w-4 h-4 text-cyan-400" /> Hub Dashboard
    </button>

    <div className="h-5 w-px bg-white/10 hidden sm:block" />

    <div className="flex items-center gap-2.5">
    <div className="p-2 bg-[#22d3ee]/10 rounded-xl border border-white/10">
    <BarChart2 className="w-4 h-4 text-cyan-400" />
    </div>
    <div>
    <h1 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">EVM Variance Center</h1>
    <p className="text-[10px] text-slate-400 font-sans">Synced with backend Calendar Engine</p>
    </div>
    </div>
    </div>

    <div className="flex flex-wrap items-center gap-3">
    <button
        onClick={handleRecalculateEngine}
    disabled={!selectedProjectId || isCalculating}
    className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow disabled:opacity-50 transition-all cursor-pointer"
    >
    <RefreshCcw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} /> Run Engine
    </button>

    <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl shrink-0">
    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Project:</span>
    <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="bg-transparent text-xs text-white font-bold font-sans outline-none">
        {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-950">{p.name}</option>)}
                </select>
                </div>

                <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Revision:</span>
    <select value={selectedRevisionId} onChange={e => setSelectedRevisionId(e.target.value)} className="bg-transparent text-xs text-cyan-400 font-bold font-mono outline-none">
        {projectRevisions.map(r => <option key={r.id} value={r.id} className="bg-slate-950">REV {r.number} ({r.isBaseline ? 'Baseline' : 'Draft'})</option>)}
    </select>
    </div>
    </div>
    </header>

    {/* Main Content Area */}
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <div className="bg-[#0b1021]/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow">
    <div className="flex items-center justify-between">
    <span className="text-[10px] font-mono font-bold uppercase text-slate-400">CPI (Cost Index)</span>
    <Gauge className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
    <span className="text-2xl font-black font-mono text-white">{aggregates.overallCPI.toFixed(2)}</span>
        <span className={`text-xs font-bold flex items-center ${aggregates.overallCPI >= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
    {aggregates.overallCPI >= 1.0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
    {aggregates.overallCPI >= 1.0 ? 'Budget Safe' : 'Overrun'}
    </span>
    </div>
    </div>

    <div className="bg-[#0b1021]/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow">
    <div className="flex items-center justify-between">
    <span className="text-[10px] font-mono font-bold uppercase text-slate-400">SPI (Schedule Index)</span>
    <Activity className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
    <span className="text-2xl font-black font-mono text-white">{aggregates.overallSPI.toFixed(2)}</span>
        <span className={`text-xs font-bold flex items-center ${aggregates.overallSPI >= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
    {aggregates.overallSPI >= 1.0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
    {aggregates.overallSPI >= 1.0 ? 'On Time' : 'Delay'}
    </span>
    </div>
    </div>

    <div className="bg-[#0b1021]/80 border border-white/10 rounded-2xl p-4 shadow">
    <div className="flex items-center justify-between mb-2">
    <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Variances</span>
        <DollarSign className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex justify-between text-xs mb-1">
    <span className="text-slate-400">SV:</span>
    <span className={`font-mono font-bold {aggregates.totalSV >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
    {aggregates.totalSV >= 0 ? '+' : ''}{aggregates.totalSV.toLocaleString()}
    </span>
    </div>
    <div className="flex justify-between text-xs">
    <span className="text-slate-400">CV:</span>
    <span className={`font-mono font-bold {aggregates.totalCV >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
    {aggregates.totalCV >= 0 ? '+' : ''}{aggregates.totalCV.toLocaleString()}
    </span>
    </div>
    </div>

    <div className="bg-[#0b1021]/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow">
    <div className="flex items-center justify-between">
    <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Exceptions</span>
        <ShieldAlert className="w-4 h-4 text-rose-400" />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
    <span className="text-2xl font-black font-mono text-white">{aggregates.criticalCount}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${aggregates.criticalCount > 0 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
    {aggregates.criticalCount > 0 ? 'Action Needed' : 'Safe'}
    </span>
    </div>
    </div>
    </div>

    {/* S-Curve Chart */}
    <div className="bg-[#0b1021]/60 border border-white/5 rounded-2xl p-5 shadow-xl">
    <div className="flex items-center justify-between border-b border-white/5 pb-3">
    <h3 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-cyan-400" /> S-Curve Baseline</h3>
    </div>
    <div className="h-72 w-full mt-4">
    <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={sCurveData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontFamily="monospace" />
    <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" tickFormatter={(v) => `$${v}`} />
    <Tooltip contentStyle={{ backgroundColor: '#0b1021', border: '1px solid rgba(255,255,255,0.1)' }} />
    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
    <Area type="monotone" dataKey="Planned Value (PV)" fill="rgba(34,211,238,0.05)" stroke="#22d3ee" strokeWidth={2} />
    <Area type="monotone" dataKey="Earned Value (EV)" fill="rgba(52,211,153,0.05)" stroke="#34d399" strokeWidth={2} />
    <Line type="monotone" dataKey="Actual Cost (AC)" stroke="#f87171" strokeWidth={3} dot={{ r: 4 }} />
    </ComposedChart>
    </ResponsiveContainer>
    </div>
    </div>

    {/* Ledger Table */}
    <div className="space-y-4">
    <div className="flex flex-col md:flex-row justify-between gap-4">
    <h2 className="text-sm font-extrabold text-white uppercase font-mono mt-2">EVM Audits Ledger</h2>
    <div className="flex flex-wrap items-center gap-3">
    <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-2">
    <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent text-xs text-white outline-none" />
        </div>
        <button onClick={() => setFilterActionRequiredOnly(!filterActionRequiredOnly)} className={`px-4 py-1.5 border rounded-xl text-xs font-bold transition-all ${filterActionRequiredOnly ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-white/5 border-white/10 text-slate-300'}`}>
    {filterActionRequiredOnly ? 'Exceptions Only' : 'All Snaps'}
    </button>
    <button onClick={handleExportCSV} className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"><Download className="w-3.5 h-3.5 inline mr-1" /> CSV</button>
        <button onClick={handleOpenAdd} className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-1.5 rounded-xl text-xs font-bold transition-all"><Plus className="w-3.5 h-3.5 inline mr-1" /> Add</button>
        </div>
        </div>

        <div className="bg-[#0b1021]/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
    <div className="overflow-x-auto">
    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
    <thead>
        <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
    <th className="p-3">Code</th>
        <th className="p-3">Task Name</th>
    <th className="p-3 text-right">BAC(H)</th>
        <th className="p-3 text-right">PV(H)</th>
        <th className="p-3 text-right">EV(H)</th>
        <th className="p-3 text-right">AC(H)</th>
        <th className="p-3 text-center">SPI / CPI</th>
        <th className="p-3 text-right">SV(H) / CV(H)</th>
            <th className="p-3 text-right">EAC(H) / ETC(H)</th>
        <th className="p-3 text-center">Flag</th>

        </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
        {displayReports.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
            <td className="p-3 font-mono text-cyan-400">{item.taskCode}</td>
                <td className="p-3 text-white font-bold">{item.taskName}</td>
                <td className="p-3 text-right font-mono text-slate-300">{item.budgetAtCompletion.toLocaleString()}</td>
    <td className="p-3 text-right font-mono text-slate-400">{item.plannedValue.toLocaleString()}</td>
    <td className="p-3 text-right font-mono text-cyan-400">{item.earnedValue.toLocaleString()}</td>
    <td className="p-3 text-right font-mono text-rose-400">{item.actualCost.toLocaleString()}</td>
    <td className="p-3 text-center font-mono text-[11px]">
    <div className={`font-bold ${item.spi >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>SPI: {item.spi.toFixed(2)}</div>
    <div className={`font-bold ${item.cpi >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>CPI: {item.cpi.toFixed(2)}</div>
    </td>
    <td className="p-3 text-right font-mono text-[11px]">
    <div className={item.scheduleVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>SV: {item.scheduleVariance >= 0 ? '+' : ''}{item.scheduleVariance.toLocaleString()}</div>
    <div className={item.costVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>CV: {item.costVariance >= 0 ? '+' : ''}{item.costVariance.toLocaleString()}</div>
    </td>
                    <td className="p-3 text-right font-mono text-[11px]">
                        <div className={item.scheduleVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>EAC: {item.estimateAtCompletion }</div>
                        <div className={item.costVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>ETC: {item.estimateToComplete }</div>
                    </td>
    <td className="p-3 text-center">
        {item.actionRequired ?
                <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold">Critical</span> :
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">Safe</span>}
                    </td>

        </tr>
))}
    </tbody>
    </table>
    </div>
    </div>
    </div>
    </div>

    {/* Modal Form */}
    {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div className="bg-[#0b1021] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="bg-[#11162a] px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold uppercase text-white"><Sparkles className="w-4 h-4 inline mr-2 text-cyan-400" />{editingReportId ? 'Edit Record' : 'Manual Entry'}</h3>
            <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
    <div>
        <label className="text-[10px] font-mono text-slate-400 uppercase">Target Activity Node</label>
    <select disabled={!!editingReportId} value={formState.taskId} onChange={e => setFormState({ ...formState, taskId: e.target.value })} className="w-full bg-[#11162a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1">
        {activeActivities.map(act => <option key={act.id} value={act.id}>{act.code} - {act.name}</option>)}
                </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">BAC (H)</label>
                <input type="number" required value={formState.budgetAtCompletion} onChange={e => setFormState({ ...formState, budgetAtCompletion: +e.target.value })} className="w-full bg-[#11162a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1" />
    </div>
    <div>
    <label className="text-[10px] font-mono text-slate-400 uppercase">PV ($)</label>
        <input type="number" required value={formState.plannedValue} onChange={e => setFormState({ ...formState, plannedValue: +e.target.value })} className="w-full bg-[#11162a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1" />
        </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
    <div>
        <label className="text-[10px] font-mono text-slate-400 uppercase">EV ($)</label>
        <input type="number" required value={formState.earnedValue} onChange={e => setFormState({ ...formState, earnedValue: +e.target.value })} className="w-full bg-[#11162a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1" />
    </div>
    <div>
    <label className="text-[10px] font-mono text-slate-400 uppercase">AC ($)</label>
        <input type="number" required value={formState.actualCost} onChange={e => setFormState({ ...formState, actualCost: +e.target.value })} className="w-full bg-[#11162a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1" />
        </div>
        </div>
        <div className="pt-4 border-t border-white/5 flex gap-3">
    <button type="button" onClick={() => setShowFormModal(false)} className="flex-1 border border-white/10 text-white rounded-xl py-2 text-xs">Cancel</button>
        <button type="submit" className="flex-1 bg-cyan-500 text-black font-bold rounded-xl py-2 text-xs">Save Snapshot</button>
    </div>
    </form>
    </div>
    </div>
    )}
        </div>
    );
    }