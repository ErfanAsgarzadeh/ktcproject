/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
    Layers,
    Plus,
    Trash2,
    PlayCircle,
    Sparkles,
    Database,
    Building,
    Copy,
    Lock,
    Edit2,
    CalendarDays
} from 'lucide-react';
import { Project, Revision } from '../types/types';
import JalaliDatePicker from './JalaliDatePicker';
import { gregorianToJalaliString } from '../utils/jalali';
import { apiClient } from '../lib/api';

interface ProjectHubProps {
    projects: Project[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
    onAddProject: (name: string, description: string, startDate: string, endDate: string, calendarId?: string | null, approverId?: string | null) => void;
    onDeleteProject: (id: string) => void;

    revisions: Revision[];
    activeRevisionId: string | null;
    onSelectRevision: (id: string) => void;
    onAddRevision: (projectId: string, description: string, projectStart: string) => void;
    onDuplicateRevision: (revisionId: string, description: string) => void;
    onDeleteRevision: (id: string) => void;
    onUpdateRevisionDates: (revisionId: string, newStart: string, newEnd: string) => void;

    onEnterWorkspace: () => void;
    nodesCountByRevision: Record<string, number>;
    onAttachCalendar?: (projectId: string, calendarId: string | null) => void;
}

export default function ProjectHub({
                                       projects,
                                       activeProjectId,
                                       onSelectProject,
                                       onAddProject,
                                       onDeleteProject,
                                       revisions,
                                       activeRevisionId,
                                       onSelectRevision,
                                       onAddRevision,
                                       onDuplicateRevision,
                                       onDeleteRevision,
                                       onUpdateRevisionDates,
                                       onEnterWorkspace,
                                       nodesCountByRevision,
                                       onAttachCalendar,
                                   }: ProjectHubProps) {
    const [activeTab, setActiveTab] = useState<'projects' | 'create'>('projects');

    // States for new project form
    const [newProjName, setNewProjName] = useState('');
    const [newProjDesc, setNewProjDesc] = useState('');
    const [newProjStart, setNewProjStart] = useState(new Date().toISOString().split('T')[0]);
    const [newProjEnd, setNewProjEnd] = useState('');
    const [newProjCalendarId, setNewProjCalendarId] = useState('');
    const [newProjApproverId, setNewProjApproverId] = useState('');

    // Available calendars (standalone templates)
    const [calendars, setCalendars] = useState<any[]>([]);
    useEffect(() => {
        apiClient.get('/planning/calendars/?templates=true')
            .then(res => setCalendars(res.data.results || res.data))
            .catch(err => console.error('Failed to load calendars', err));
    }, []);

    // Available users for Approver dropdown — فقط افراد واحد کاربر فعلی
    const [allUsers, setAllUsers] = useState<any[]>([]);
    useEffect(() => {
        apiClient.get('/auth/users/in-my-unit/')
            .then(res => setAllUsers(res.data.results || res.data))
            .catch(err => {
                console.error('Failed to load users in my unit, falling back to all', err);
                // fallback به همه کاربران اگر endpoint جدید موجود نبود
                apiClient.get('/auth/users/')
                    .then(r => setAllUsers(r.data.results || r.data))
                    .catch(e => console.error(e));
            });
    }, []);

    // Handler برای تغییر Approver یک Revision موجود
    const handleChangeApprover = async (revisionId: string, approverId: string | null) => {
        try {
            const res = await apiClient.patch(`/planning/revisions/${revisionId}/`, {
                designatedApproverId: approverId,
            });
            // اعلام به والد که این revision آپدیت شده — ساده‌تر: reload مستقیم state
            // (revisions از prop می‌آد، پس از onUpdateRevisionDates مشابه نیست — اینجا فقط
            //  state داخلی را رفرش نمی‌کنیم؛ بهترین کار: reload کامل از parent)
            // برای تجربه روان، خود کارت پس از موفقیت به‌روز می‌شود وقتی parent fetch شود.
            return res.data;
        } catch (err: any) {
            console.error('Failed to change approver', err);
            const msg = err?.response?.data?.detail || 'خطا در تغییر تاییدکننده.';
            alert(msg);
        }
    };

    // نقش سازمانی کاربر فعلی — برای کنترل دسترسی ساخت پروژه
    const [currentRole, setCurrentRole] = useState<string>('member');
    useEffect(() => {
        apiClient.get('/auth/profile/')
            .then(res => setCurrentRole(res.data.orgRole || 'member'))
            .catch(() => setCurrentRole('member'));
    }, []);
    const canCreateProject = ['company_admin', 'company_pm', 'unit_manager'].includes(currentRole);

    // States for new revision form
    const [newRevDesc, setNewRevDesc] = useState('');
    const [newRevStart, setNewRevStart] = useState(new Date().toISOString().split('T')[0]);

    // States for duplicate revision description
    const [duplicateModeId, setDuplicateModeId] = useState<string | null>(null);
    const [dupDesc, setDupDesc] = useState('Safety & Overtime Acceleration Run');

    const selectedProject = projects.find(p => p.id === activeProjectId);
    const selectedProjectRevisions = revisions.filter(r => r.projectId === activeProjectId);

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjName.trim()) return;
        if (!canCreateProject) {
            alert('شما اجازه‌ی ساخت پروژه را ندارید (فقط مدیر شرکت یا مدیر واحد).');
            return;
        }
        onAddProject(
            newProjName.trim(),
            newProjDesc.trim(),
            newProjStart,
            newProjEnd,
            newProjCalendarId || null,
            newProjApproverId || null,
        );
        setNewProjName('');
        setNewProjDesc('');
        setNewProjCalendarId('');
        setNewProjApproverId('');
        setActiveTab('projects');
    };

    const handleCreateRevision = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeProjectId) return;
        if (!newRevDesc.trim()) {
            alert("وارد کردن توضیحات (دلیل ساخت نسخه جدید) الزامی است.");
            return;
        }
        onAddRevision(activeProjectId, newRevDesc.trim(), newRevStart);
        setNewRevDesc('');
    };

    const handleDuplicateClick = (revId: string, currentNum: number) => {
        setDuplicateModeId(revId);
        setDupDesc(`Replanned revision cloned from Rev ${currentNum}`);
    };

    const handleConfirmDuplicate = (revId: string) => {
        onDuplicateRevision(revId, dupDesc.trim());
        setDuplicateModeId(null);
    };

    return (
        <div className="h-full w-full flex flex-col font-sans relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {/* Background radial glowing gradients */}
            <div className="absolute top-0 left-1/4 w-full h-[600px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="absolute bottom-12 right-1/4 w-full h-[500px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none z-0" />

            <div className="w-full mx-auto space-y-8 z-10 p-6 md:p-8 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

                {/* Hub Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="bg-cyan-500 rounded-xl w-10 h-10 flex items-center justify-center font-bold text-white shadow-xl shadow-cyan-500/20 text-lg">
                                N
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                                    NOVIRA Project & Revision Hub
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Select and replicate scheduled revisions aligned with critical path calculations.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="inline-flex rounded-xl p-1 bg-black/40 border border-white/5 backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('projects')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                                activeTab === 'projects'
                                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Database className="w-4 h-4" />
                            <span>Projects & Revisions</span>
                        </button>
                        {canCreateProject && (
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                                activeTab === 'create'
                                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create New Project</span>
                        </button>
                        )}
                    </div>
                </div>

                {/* CONTROLS AREA BY ACTIVE TAB */}
                {activeTab === 'projects' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">

                        {/* COLUMN 1: Projects Selector (Left 5 Cols) */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-cyan-400" />
                                    Projects Directory
                                </h2>
                                <span className="text-xs text-slate-500 py-0.5 px-2 bg-white/5 rounded-full border border-white/5">
                  {projects.length} Total
                </span>
                            </div>

                            {/* Projects cards container */}
                            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                                {projects.map(proj => {
                                    const isProjSelected = proj.id === activeProjectId;
                                    const revsCount = revisions.filter(r => r.projectId === proj.id).length;
                                    return (
                                        <div
                                            key={proj.id}
                                            onClick={() => onSelectProject(proj.id)}
                                            className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                                                isProjSelected
                                                    ? 'bg-white/10 border-cyan-500 shadow-xl shadow-cyan-500/5 backdrop-blur-lg'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1 pr-6">
                                                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                                                        {proj.name}
                                                    </h3>
                                                    <p className="text-[11px] text-slate-400 line-clamp-2">
                                                        {proj.description || 'No project description added.'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteProject(proj.id);
                                                    }}
                                                    className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-all self-start ml-2"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
                                                <span>Revs: <strong className="text-cyan-400">{revsCount}</strong></span>
                                                <span>Created: {gregorianToJalaliString(proj.createdAt)}</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {projects.length === 0 && (
                                    <div className="p-8 text-center text-slate-500 italic bg-white/5 rounded-xl border border-white/10">
                                        No projects exist in database. Switch to "Create New Project" tab to start!
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 2: Selected Project's Revisions Directory (Right 7 Cols) */}
                        <div className="lg:col-span-7 space-y-6">
                            {selectedProject ? (
                                <>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                        Selected Project Context
                      </span>
                                            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                                <Building className="w-5 h-5 text-indigo-400" />
                                                {selectedProject.name}
                                            </h2>
                                            {/* الصاق/تغییر تقویم پروژه */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <CalendarDays className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <select
                                                    value={(selectedProject as any).calendarId ?? ''}
                                                    onChange={(e) => onAttachCalendar?.(selectedProject.id, e.target.value || null)}
                                                    className="bg-black/40 border border-white/10 hover:border-cyan-500/50 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
                                                    title="تقویم کاری این پروژه"
                                                >
                                                    <option value="" className="bg-slate-950">— بدون تقویم —</option>
                                                    {calendars.map(c => (
                                                        <option key={c.id} value={c.id} className="bg-slate-950">{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full font-mono">
                      {selectedProjectRevisions.length} Relational Revisions
                    </span>
                                    </div>

                                    {/* Revisions Stack list */}
                                    <div className="space-y-3.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                                        {selectedProjectRevisions.slice().sort((a,b) => b.number - a.number).map(rev => {
                                            const isRevSelected = rev.id === activeRevisionId;
                                            const hasDuplicateMode = duplicateModeId === rev.id;
                                            const taskCount = nodesCountByRevision[rev.id] || 0;
                                            const isLocked = Boolean(rev.approvedAt);

                                            return (
                                                <div
                                                    key={rev.id}
                                                    className={`p-5 rounded-xl border transition-all flex flex-col gap-3 relative ${
                                                        isRevSelected
                                                            ? 'bg-gradient-to-r from-cyan-950/20 via-indigo-950/10 to-transparent border-cyan-500 shadow-md'
                                                            : 'bg-white/5 border-white/5 hover:border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                                    isRevSelected
                                        ? 'bg-cyan-500 text-white'
                                        : 'bg-white/10 text-slate-300'
                                }`}>
                                  REVISION {rev.number}
                                </span>

                                                                {isLocked ? (
                                                                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono font-bold uppercase flex items-center gap-1" title={`Locked at: ${gregorianToJalaliString(rev.approvedAt!)}`}>
                                    <Lock className="w-2.5 h-2.5" /> Locked
                                  </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                                    <Edit2 className="w-2.5 h-2.5" /> Open Draft
                                  </span>
                                                                )}

                                                                {rev.isBaseline && (
                                                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase">
                                    Baseline Active
                                  </span>
                                                                )}
                                                            </div>

                                                            <p className="text-xs text-slate-300 pt-1 font-medium italic">
                                                                "{rev.description || 'No description supplied.'}"
                                                            </p>

                                                            {/* Editable/Read-Only Revision Dates */}
                                                            <div className="flex flex-wrap items-center gap-3 bg-black/20 p-2 rounded-lg border border-white/5 mt-2 w-fit">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Start:</span>
                                                                    {isLocked ? (
                                                                        <span className="text-xs text-white font-mono bg-transparent border-none py-0.5">
                                      {gregorianToJalaliString(rev.projectStart) || 'N/A'}
                                    </span>
                                                                    ) : (
                                                                        <JalaliDatePicker
                                                                            value={rev.projectStart?.split('T')[0] || ''}
                                                                            onChange={(iso) => onUpdateRevisionDates(rev.id, iso, (rev as any).projectEnd || '')}
                                                                            className="bg-black/50 border border-white/10 hover:border-cyan-500/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono cursor-pointer transition-colors flex items-center justify-between gap-2"
                                                                        />
                                                                    )}
                                                                </div>

                                                                <span className="text-slate-600">/</span>

                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">End:</span>
                                                                    {isLocked ? (
                                                                        <span className="text-xs text-white font-mono bg-transparent border-none py-0.5">
                                      {gregorianToJalaliString((rev as any).projectEnd) || 'Unset'}
                                    </span>
                                                                    ) : (
                                                                        <JalaliDatePicker
                                                                            value={(rev as any).projectEnd?.split('T')[0] || ''}
                                                                            onChange={(iso) => onUpdateRevisionDates(rev.id, rev.projectStart || '', iso)}
                                                                            className="bg-black/50 border border-white/10 hover:border-cyan-500/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono cursor-pointer transition-colors flex items-center justify-between gap-2"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3 pt-2 flex-wrap">
                                                                <span>Tasks Stacked: <strong className="text-white">{taskCount} Node elements</strong></span>
                                                                <span>•</span>
                                                                <span>Created: {gregorianToJalaliString(rev.createdAt)}</span>
                                                            </div>

                                                            {/* تاییدکننده‌ی این Revision (قابل تغییر اگر قفل نشده) */}
                                                            <div className="flex items-center gap-2 mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                                                                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                                                                <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider shrink-0">Approver:</span>
                                                                {isLocked ? (
                                                                    <span className="text-xs text-white font-mono">
                                                                        {(rev as any).designatedApproverName || '—'}
                                                                    </span>
                                                                ) : (
                                                                    <select
                                                                        value={(rev as any).designatedApproverId ?? ''}
                                                                        onChange={async (e) => {
                                                                            const newId = e.target.value || null;
                                                                            await handleChangeApprover(rev.id, newId);
                                                                            // به‌روزرسانی محلی نمایش — مقدار را در state مصرف‌شده تغییر بدهیم
                                                                            (rev as any).designatedApproverId = newId;
                                                                            const u = allUsers.find(x => String(x.id) === String(newId));
                                                                            (rev as any).designatedApproverName = u?.username || null;
                                                                            // فورس re-render با تغییر کوچک state
                                                                            setDuplicateModeId(prev => prev);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="bg-black/40 border border-white/10 hover:border-amber-500/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono cursor-pointer transition-colors"
                                                                    >
                                                                        <option value="" className="bg-slate-950">— بدون تاییدکننده —</option>
                                                                        {allUsers.map(u => (
                                                                            <option key={u.id} value={u.id} className="bg-slate-950">{u.username}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Revision operations */}
                                                        <div className="flex items-center gap-1.5 shrink-0 self-start">
                                                            <button
                                                                onClick={() => handleDuplicateClick(rev.id, rev.number)}
                                                                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-all"
                                                                title="CPM: Copy Revision model to new Replanned version"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => onDeleteRevision(rev.id)}
                                                                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-all"
                                                                title="Delete Revision"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Inline copy duplicator interface if active */}
                                                    {hasDuplicateMode && (
                                                        <div className="bg-black/40 p-3.5 rounded-lg border border-cyan-500/30 mt-1 space-y-3 font-sans">
                                                            <div className="space-y-1.5">
                                                                <label className="block text-[10px] text-cyan-300 uppercase font-mono font-bold">
                                                                    Branch and Replanning Cycle Description
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={dupDesc}
                                                                    onChange={(e) => setDupDesc(e.target.value)}
                                                                    className="w-full bg-black/60 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                                                                    placeholder="Specify notes for copy cycle, e.g. Acceleration Plan"
                                                                />
                                                            </div>
                                                            <div className="flex items-center justify-end gap-2 text-[11px]">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDuplicateModeId(null)}
                                                                    className="px-3 py-1.5 text-slate-400 hover:text-white rounded"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleConfirmDuplicate(rev.id)}
                                                                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded font-medium cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <Sparkles className="w-3 h-3" />
                                                                    <span>Duplicate & Commit</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Big Load / Enter Workspace buttons */}
                                                    <div className="flex justify-between items-center bg-white/[0.02] -mx-5 -mb-5 p-3 px-5 rounded-b-xl border-t border-white/5 mt-2">
                            <span className="text-[10px] font-mono text-slate-500">
                              Revision Identifier: <code className="text-slate-400 font-bold">{String(rev.id).split('-').pop()?.substring(0, 8) || String(rev.id)}</code>
                            </span>

                                                        <button
                                                            onClick={() => {
                                                                onSelectRevision(rev.id);
                                                                onEnterWorkspace();
                                                            }}
                                                            className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer ${
                                                                isRevSelected
                                                                    ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/10'
                                                                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                                                            }`}
                                                        >
                                                            <PlayCircle className="w-4 h-4" />
                                                            <span>{isRevSelected ? 'Enter Selected Workspace' : 'Select & Open Workspace'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {selectedProjectRevisions.length === 0 && (
                                            <div className="p-8 text-center text-slate-500 italic bg-white/5 rounded-xl border border-white/10">
                                                No revisions configured for this project. Setup a revision level below.
                                            </div>
                                        )}
                                    </div>

                                    {/* Create New Revision Form */}

                                </>
                            ) : (
                                <div className="h-full bg-white/5 rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
                                    <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 border border-white/10">
                                        <Database className="w-8 h-8 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-300">No Active Project Selected</h3>
                                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                                            Choose a project card from the directory list on the left to review its versioned revisions and open the active WBS workspace.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CREATE NEW PROJECT TAB */}
                {activeTab === 'create' && (
                    <div className="flex flex-col items-center justify-start pt-4 pb-12">
                        <div className="bg-white/5 p-8 md:p-10 rounded-3xl border border-white/10 space-y-8 backdrop-blur-md w-full max-w-xl shadow-2xl relative overflow-hidden">

                            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />

                            <div className="space-y-3 text-center relative z-10">
                                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-cyan-500/30 shadow-inner">
                                    <Database className="w-7 h-7" />
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">Initialize New Project</h2>
                                <p className="text-sm text-slate-400 max-w-md mx-auto">
                                    Provision a new workspace and database entry for your planning network. Revision 0 will be generated automatically.
                                </p>
                            </div>

                            <form onSubmit={handleCreateProject} className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                                        Project Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Mars Cargo Substructure"
                                        value={newProjName}
                                        onChange={(e) => setNewProjName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-sans"
                                    />
                                </div>

                                {/* اضافه شدن فیلدهای تاریخ شروع و پایان به فرم */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                                            Project Start Date
                                        </label>
                                        <JalaliDatePicker
                                            required
                                            value={newProjStart}
                                            onChange={(iso) => setNewProjStart(iso)}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-400 transition-all font-sans flex items-center justify-between gap-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                                            Project End Date
                                        </label>
                                        <JalaliDatePicker
                                            required
                                            value={newProjEnd}
                                            onChange={(iso) => setNewProjEnd(iso)}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-400 transition-all font-sans flex items-center justify-between gap-2"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                                        Project Scope / Description
                                    </label>
                                    <textarea
                                        placeholder="Describe the main objectives and scope of the project..."
                                        value={newProjDesc}
                                        onChange={(e) => setNewProjDesc(e.target.value)}
                                        rows={3}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-sans resize-none"
                                    />
                                </div>

                                {/* انتخاب تقویم کاری */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5 text-cyan-400" /> Work Calendar (تقویم کاری)
                                    </label>
                                    <select
                                        value={newProjCalendarId}
                                        onChange={(e) => setNewProjCalendarId(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-400 transition-all font-sans"
                                    >
                                        <option value="" className="bg-slate-950">— بدون تقویم (پیش‌فرض) —</option>
                                        {calendars.map(c => (
                                            <option key={c.id} value={c.id} className="bg-slate-950">{c.name}</option>
                                        ))}
                                    </select>
                                    {calendars.length === 0 && (
                                        <p className="text-[10px] text-amber-400/80 ml-1">
                                            هنوز تقویمی تعریف نشده — از صفحه «مدیریت تقویم‌ها» یک تقویم بسازید.
                                        </p>
                                    )}
                                </div>

                                {/* انتخاب تاییدکننده (Approver) برای Revision اولیه */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-amber-400" /> Designated Approver (تاییدکننده)
                                    </label>
                                    <select
                                        value={newProjApproverId}
                                        onChange={(e) => setNewProjApproverId(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-amber-400 transition-all font-sans"
                                    >
                                        <option value="" className="bg-slate-950">— بدون تاییدکننده تعیین‌شده —</option>
                                        {allUsers.map(u => (
                                            <option key={u.id} value={u.id} className="bg-slate-950">{u.username} {u.jobTitle ? `(${u.jobTitle})` : ''}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 ml-1">
                                        فقط این فرد می‌تواند نسخه‌ی پایه (Rev 0) را تایید/قفل کند.
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span>Provision Project Workspace</span>
                                    </button>
                                </div>
                            </form>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}