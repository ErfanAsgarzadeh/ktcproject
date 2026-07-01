// components/ManagementDashboard.tsx

import React, { useCallback, useState, useEffect } from 'react';
import {
    BarChart, CheckCircle, Save, Send, Plus,
    Trash2, Briefcase, Activity, AlertOctagon,
    Clock, Building, Edit2, FolderOpen, ChevronDown
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { gregorianToJalaliDateTime } from '../utils/jalali';
import { Project, CustomUser } from '../types/types';

interface ManagementDashboardProps {
    projects: Project[];
    currentUser: CustomUser | null;
}

interface Bottleneck {
    id?: string;
    task_id?: string | null;
    task_name?: string;
    wbs_node_name?: string;
    issue_type: string;
    description: string;
    severity: 'high' | 'medium' | 'low' | string;
    is_manual?: boolean;
    planner_remark?: string;
}

interface ExecutiveReport {
    id: string;
    project_name: string;
    updated_at: string;
    created_by_username: string;
    overall_progress: number;
    planner_summary?: string;
    bottlenecks?: Bottleneck[];
}

interface PlannerDraft {
    project_id: string;
    project_name: string;
    suggested_overall_progress: number | string;
    planner_summary: string;
    suggested_bottlenecks: Bottleneck[];
    available_highlights: Bottleneck[];
}

export default function ManagementDashboard({ projects, currentUser }: ManagementDashboardProps) {
    const [viewMode, setViewMode] = useState<'executive' | 'planner'>('executive');

    const [executiveReports, setExecutiveReports] = useState<ExecutiveReport[]>([]);
    const [isLoadingExecutive, setIsLoadingExecutive] = useState(false);
    const [expandedExecutiveReports, setExpandedExecutiveReports] = useState<Set<string>>(new Set());

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [plannerDraft, setPlannerDraft] = useState<PlannerDraft | null>(null);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const loadExecutiveReports = useCallback(async () => {
        setIsLoadingExecutive(true);
        try {
            const res = await apiClient.get('/reports/executive/dashboard/');
            const reports: ExecutiveReport[] = res.data.executive_dashboard || [];
            setExecutiveReports(reports);
            setExpandedExecutiveReports(new Set(reports.map(report => report.id)));
        } catch (err) {
            console.error("Error fetching executive dashboard", err);
        } finally {
            setIsLoadingExecutive(false);
        }
    }, []);

    const loadPlannerDraft = useCallback(async (projectId: string) => {
        setIsLoadingDraft(true);
        try {
            const res = await apiClient.get(`/reports/planner/draft/${projectId}/`);
            setPlannerDraft({
                ...res.data,
                planner_summary: '',
            });
        } catch (err) {
            console.error("Error fetching draft", err);
        } finally {
            setIsLoadingDraft(false);
        }
    }, []);

    useEffect(() => {
        if (viewMode === 'executive') {
            const timeoutId = window.setTimeout(() => {
                void loadExecutiveReports();
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [loadExecutiveReports, viewMode]);

    useEffect(() => {
        if (viewMode === 'planner' && selectedProjectId) {
            const timeoutId = window.setTimeout(() => {
                void loadPlannerDraft(selectedProjectId);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [loadPlannerDraft, selectedProjectId, viewMode]);

    const handleAddBottleneck = () => {
        if (!plannerDraft) return;
        setPlannerDraft({
            ...plannerDraft,
            suggested_bottlenecks: [
                ...plannerDraft.suggested_bottlenecks,
                {
                    task_id: null,
                    task_name: '',
                    wbs_node_name: '',
                    issue_type: 'گزارش مشکل دستی',
                    description: '',
                    severity: 'medium',
                    is_manual: true,
                    planner_remark: ''
                }
            ]
        });
    };

    const handleUpdateBottleneck = (index: number, field: keyof Bottleneck, value: string) => {
        if (!plannerDraft) return;
        const updated = [...plannerDraft.suggested_bottlenecks];
        updated[index] = { ...updated[index], [field]: value };
        setPlannerDraft({ ...plannerDraft, suggested_bottlenecks: updated });
    };

    const toggleExecutiveReport = (reportId: string) => {
        setExpandedExecutiveReports(prev => {
            const next = new Set(prev);
            if (next.has(reportId)) {
                next.delete(reportId);
            } else {
                next.add(reportId);
            }
            return next;
        });
    };

    const handleRemoveBottleneck = (index: number) => {
        if (!plannerDraft) return;
        const updated = plannerDraft.suggested_bottlenecks.filter((_, i: number) => i !== index);
        setPlannerDraft({ ...plannerDraft, suggested_bottlenecks: updated });
    };

    const handleAddHighlight = (highlight: Bottleneck, index: number) => {
        if (!plannerDraft) return;
        setPlannerDraft({
            ...plannerDraft,
            suggested_bottlenecks: [...plannerDraft.suggested_bottlenecks, highlight],
            available_highlights: plannerDraft.available_highlights.filter((_, i: number) => i !== index)
        });
    };

    const handleSaveReport = async (isPublished: boolean) => {
        if (!plannerDraft) return;
        setIsSaving(true);

        const payload = {
            project_id: plannerDraft.project_id,
            overall_progress: plannerDraft.suggested_overall_progress,
            planner_summary: plannerDraft.planner_summary,
            is_published: isPublished,
            bottlenecks: plannerDraft.suggested_bottlenecks,
        };

        try {
            await apiClient.post('/reports/planner/save/', payload);
            alert(isPublished ? 'Report successfully published to Executive Dashboard!' : 'Draft saved successfully.');
            if (isPublished) {
                setSelectedProjectId(null);
                setPlannerDraft(null);
                setViewMode('executive');
            }
        } catch (err) {
            console.error("Error saving report", err);
            alert("Failed to save the report.");
        } finally {
            setIsSaving(false);
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch(severity) {
            case 'high': return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
            case 'medium': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
            case 'low': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
            default: return 'bg-white/10 border-white/20 text-slate-300';
        }
    };

    const panelStyle: React.CSSProperties = {
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
    };

    const inputStyle: React.CSSProperties = {
        backgroundColor: 'var(--bg-input)',
        border: '1px solid var(--border-medium)',
        color: 'var(--text-primary)',
    };

    return (
        <div className="h-full min-h-0 flex flex-col font-sans relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

            {/* HEADER & VIEW TOGGLE */}
            <header className="px-4 md:px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shrink-0 z-10" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                        <BarChart className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-sm font-extrabold uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>
                            Management Intelligence
                        </h1>
                        <p className="text-[10px] text-slate-400">Curated project health & bottleneck reports{currentUser?.username ? ` for ${currentUser.username}` : ''}.</p>
                    </div>
                </div>

                <div className="flex items-center rounded-lg p-1 w-full sm:w-auto overflow-x-auto" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-medium)' }}>
                    <button
                        onClick={() => setViewMode('executive')}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                            viewMode === 'executive' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Activity className="w-4 h-4" /> Executive Dashboard
                    </button>
                    <button
                        onClick={() => setViewMode('planner')}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                            viewMode === 'planner' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Edit2 className="w-4 h-4" /> Planner Curation
                    </button>
                </div>
            </header>

            {/* ========================================================= */}
            {/* EXECUTIVE VIEW */}
            {/* ========================================================= */}
            {viewMode === 'executive' && (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5 scrollbar-thin">
                    {isLoadingExecutive ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                            Loading Executive Summaries...
                        </div>
                    ) : executiveReports.length === 0 ? (
                        <div className="text-center py-16 border rounded-lg max-w-2xl mx-auto shadow-inner" style={panelStyle}>
                            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No active bottlenecks reported</h3>
                            <p className="text-xs text-slate-400 mt-2">Planners have not published any critical reports for management review.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {executiveReports.map(report => {
                                const isExpanded = expandedExecutiveReports.has(report.id);

                                return (
                                <div key={report.id} className="border rounded-lg overflow-hidden flex flex-col shadow-xl" style={panelStyle}>
                                    <button
                                        type="button"
                                        onClick={() => toggleExecutiveReport(report.id)}
                                        className="p-5 flex items-start justify-between gap-4 text-left hover:bg-white/5 transition-colors"
                                        style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: isExpanded ? '1px solid var(--border-subtle)' : '0' }}
                                        aria-expanded={isExpanded}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Building className="w-4 h-4 text-indigo-400" />
                                                <h2 className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>{report.project_name}</h2>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                                <Clock className="w-3 h-3" /> Updated: {gregorianToJalaliDateTime(report.updated_at)}
                                                <span className="text-slate-600">|</span>
                                                By: {report.created_by_username}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="relative w-14 h-14 flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
                                                <svg className="w-12 h-12 transform -rotate-90">
                                                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-600 opacity-30" />
                                                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent"
                                                            strokeDasharray={125} strokeDashoffset={125 - (125 * report.overall_progress) / 100}
                                                            className="text-cyan-400 transition-all duration-1000" />
                                                </svg>
                                                <span className="absolute text-[10px] font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{Math.round(report.overall_progress)}%</span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                    <div className="p-5 flex-1 space-y-5 max-h-[420px] overflow-y-auto scrollbar-thin">
                                        {report.planner_summary && (
                                            <div className="rounded-lg p-4 text-xs text-slate-300 leading-relaxed italic border-l-2 border-indigo-500" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                                                {report.planner_summary}
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-3">Critical Action Items ({report.bottlenecks?.length || 0})</h4>
                                            <div className="space-y-3">
                                                {report.bottlenecks?.length === 0 ? (
                                                    <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg flex items-center gap-2 border border-emerald-500/20">
                                                        <CheckCircle className="w-4 h-4" /> All systems functioning nominally.
                                                    </div>
                                                ) : (
                                                    report.bottlenecks.map((btn) => (
                                                        <div key={btn.id ?? `${btn.issue_type}-${btn.description}`} className="border p-3.5 rounded-lg flex items-start gap-3" style={{ backgroundColor: 'var(--overlay-bg)', borderColor: 'var(--border-subtle)' }}>
                                                            <AlertOctagon className={`w-5 h-5 shrink-0 mt-1 ${btn.severity === 'high' ? 'text-rose-500 animate-pulse' : btn.severity === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`} />

                                                            <div className="space-y-2 w-full">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold text-slate-200">{btn.issue_type}</span>
                                                                    <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${getSeverityStyles(btn.severity)}`}>
                                    {btn.severity} Risk
                                  </span>
                                                                </div>

                                                                {(btn.task_name || btn.wbs_node_name) && (
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-1 rounded w-fit">
                                                                        <FolderOpen className="w-3 h-3" />
                                                                        <span>{btn.wbs_node_name}</span>
                                                                        <span className="text-indigo-500/50 font-bold">/</span>
                                                                        <span className="font-bold text-indigo-200">{btn.task_name}</span>
                                                                    </div>
                                                                )}

                                                                <p className="text-[11px] text-slate-400 leading-normal">{btn.description}</p>

                                                                {btn.planner_remark && (
                                                                    <div className="bg-cyan-950/20 border-l-2 border-cyan-500 text-[10px] text-cyan-300 p-2 mt-1 rounded-r">
                                                                        <span className="font-bold block mb-0.5">اقدام/تحلیل برنامه‌ریز:</span>
                                                                        {btn.planner_remark}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================= */}
            {/* PLANNER VIEW */}
            {/* ========================================================= */}
            {viewMode === 'planner' && (
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                    <aside className="lg:w-72 shrink-0 lg:border-r overflow-y-auto scrollbar-thin max-h-56 lg:max-h-none" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="p-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Select Project</h3>
                        </div>
                        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
                            {projects.map(proj => (
                                <button
                                    key={proj.id}
                                    onClick={() => setSelectedProjectId(proj.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                                        selectedProjectId === proj.id
                                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                                            : 'border-transparent text-slate-300 hover:bg-white/5 hover:border-white/10'
                                    }`}
                                >
                                    <div className="text-xs font-bold truncate">{proj.name}</div>
                                    <div className="text-[9px] text-slate-500 font-mono mt-1">ID: {proj.id.substring(0,8)}</div>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 scrollbar-thin relative">
                        {!selectedProjectId ? (
                            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                👈 Select a project from the left to start drafting a report.
                            </div>
                        ) : isLoadingDraft ? (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-3" />
                                Aggregating system data...
                            </div>
                        ) : plannerDraft ? (
                            <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">

                                <div className="border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-inner" style={panelStyle}>
                                    <div>
                                        <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                            <Briefcase className="w-5 h-5 text-cyan-400" />
                                            {plannerDraft.project_name}
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-1">Review AI-suggested metrics and curate the final report.</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] font-mono text-slate-500 uppercase">System Calculated Progress</span>
                                        <span className="text-2xl font-black text-cyan-400 font-mono">{plannerDraft.suggested_overall_progress}%</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold font-mono text-slate-300 uppercase">Curated Overall Progress (%)</label>
                                    <input
                                        type="number" min="0" max="100"
                                        value={plannerDraft.suggested_overall_progress}
                                        onChange={(e) => setPlannerDraft({...plannerDraft, suggested_overall_progress: e.target.value})}
                                        className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                                        style={inputStyle}
                                    />
                                    <p className="text-[10px] text-slate-500">You can override the calculated system average if external factors dictate otherwise.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold font-mono text-slate-300 uppercase">Executive Summary Notes</label>
                                    <textarea
                                        rows={4}
                                        value={plannerDraft.planner_summary}
                                        onChange={(e) => setPlannerDraft({...plannerDraft, planner_summary: e.target.value})}
                                        placeholder="Provide a high-level overview of the project's health for management..."
                                        className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400 transition-colors leading-relaxed"
                                        style={inputStyle}
                                    />
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>Curated Bottlenecks</h3>
                                            <p className="text-[10px] text-slate-400">System-detected issues are locked for integrity. Add remarks or new manual issues.</p>
                                        </div>
                                        <button
                                            onClick={handleAddBottleneck}
                                            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 px-3 py-2 rounded-lg transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Manual Issue
                                        </button>
                                    </div>

                                    {plannerDraft.suggested_bottlenecks.length === 0 ? (
                                        <div className="text-center py-10 bg-white/5 border border-dashed border-white/10 rounded-xl text-slate-400 text-xs">
                                            No system bottlenecks detected. You can add one manually.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {plannerDraft.suggested_bottlenecks.map((btn, idx: number) => (
                                                <div key={`${btn.issue_type}-${idx}`} className="border p-4 rounded-lg relative group flex flex-col gap-4" style={panelStyle}>

                                                    <button onClick={() => handleRemoveBottleneck(idx)} className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 transition-colors z-10">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>

                                                    <div className="pr-6">
                                                        {!btn.is_manual ? (
                                                            <div className="border rounded-lg p-3" style={{ backgroundColor: 'var(--overlay-bg)', borderColor: 'var(--border-subtle)' }}>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <AlertOctagon className={`w-4 h-4 ${btn.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`} />
                                                                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{btn.issue_type}</span>
                                                                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono border border-indigo-500/20">System Generated</span>
                                                                    </div>
                                                                    <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${getSeverityStyles(btn.severity)}`}>
                                    {btn.severity} Risk
                                  </span>
                                                                </div>

                                                                <div className="flex flex-col gap-2 mb-2">
                                                                    {(btn.task_name || btn.wbs_node_name) && (
                                                                        <div className="flex items-center gap-2 text-[10px] rounded-md px-2 py-1.5 w-fit" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-medium)' }}>
                                                                            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                                                                            <span className="text-slate-400 font-mono">{btn.wbs_node_name}</span>
                                                                            <span className="text-slate-600 font-bold">/</span>
                                                                            <span className="font-bold font-sans" style={{ color: 'var(--text-primary)' }}>{btn.task_name}</span>
                                                                        </div>
                                                                    )}

                                                                    <div className="text-xs text-slate-400 font-mono p-2 rounded border" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}>
                                                                        {btn.description}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[9px] uppercase text-slate-500 font-bold">Issue Type / Category</label>
                                                                    <input
                                                                        value={btn.issue_type}
                                                                        onChange={(e) => handleUpdateBottleneck(idx, 'issue_type', e.target.value)}
                                                                        className="w-full rounded-lg px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
                                                                        style={inputStyle}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[9px] uppercase text-slate-500 font-bold">Severity Level</label>
                                                                    <select
                                                                        value={btn.severity}
                                                                        onChange={(e) => handleUpdateBottleneck(idx, 'severity', e.target.value)}
                                                                        className="w-full rounded-lg px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer"
                                                                        style={inputStyle}
                                                                    >
                                                                        <option value="high">High / Critical</option>
                                                                        <option value="medium">Medium / At Risk</option>
                                                                        <option value="low">Low / Note</option>
                                                                    </select>
                                                                </div>
                                                                <div className="md:col-span-2 space-y-1.5">
                                                                    <label className="text-[9px] uppercase text-slate-500 font-bold">Manual Issue Description</label>
                                                                    <textarea
                                                                        value={btn.description}
                                                                        onChange={(e) => handleUpdateBottleneck(idx, 'description', e.target.value)}
                                                                        rows={2}
                                                                        className="w-full rounded-lg px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
                                                                        style={inputStyle}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5 pt-3 border-t border-white/5">
                                                        <label className="text-[10px] uppercase text-cyan-400 font-bold font-mono flex items-center gap-1.5">
                                                            <Edit2 className="w-3 h-3" /> Planner Remarks & Action Plan
                                                        </label>
                                                        <textarea
                                                            value={btn.planner_remark || ''}
                                                            onChange={(e) => handleUpdateBottleneck(idx, 'planner_remark', e.target.value)}
                                                            placeholder="What is the context of this issue? What is the plan to resolve it?"
                                                            rows={2}
                                                            className="w-full rounded-lg px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none transition-colors"
                                                            style={inputStyle}
                                                        />
                                                    </div>

                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* === بخش جدید: گزارشات عادی و تکمیل شده === */}
                                {plannerDraft.available_highlights && plannerDraft.available_highlights.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-white/10 animate-fade-in">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                                            Available Normal / Completed Reports
                                        </h4>
                                        <p className="text-[10px] text-slate-500 mb-4">
                                            Select noteworthy on-track or completed tasks to include them in the management report.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {plannerDraft.available_highlights.map((hl, idx: number) => (
                                                <div key={`${hl.task_name}-${idx}`} className="bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-lg flex items-start justify-between gap-3 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mb-1 truncate">
                                                            <FolderOpen className="w-3 h-3 shrink-0" />
                                                            <span className="truncate">{hl.wbs_node_name}</span>
                                                            <span className="text-emerald-400/50">/</span>
                                                            <span className="font-bold truncate">{hl.task_name}</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                                            {hl.description}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddHighlight(hl, idx)}
                                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 p-2 rounded-lg transition-colors shrink-0"
                                                        title="Add to Report"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sticky Action Buttons */}
                                <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 z-20 backdrop-blur-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-primary) 88%, transparent)', borderTop: '1px solid var(--border-subtle)' }}>
                                    <button
                                        onClick={() => handleSaveReport(false)}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        <Save className="w-4 h-4" /> Save as Draft
                                    </button>
                                    <button
                                        onClick={() => handleSaveReport(true)}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-white transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20 cursor-pointer"
                                    >
                                        <Send className="w-4 h-4" /> Publish to Executive Dashboard
                                    </button>
                                </div>

                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
