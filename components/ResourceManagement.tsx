import React, { useState, useMemo, useEffect } from 'react';
import {
    ProjectNode,
    CustomUser,
    TaskRole,
    Revision,
    ResourcePool,
    ResourceRole,
    ResourceSkill,
    ResourceItem,
    ResourceSkillMapping,
    ResourceException,
    ResourceRate,
    Assignment,
    ResourceType
} from '@/types/types';
import {
    Users, Layers, DollarSign, Calendar, Clock, Award, Plus, Trash2, Edit3, X, Briefcase, Loader2
} from 'lucide-react';

// ایمپورت کردن apiClient از فایل api.tsx (آدرس را در صورت نیاز اصلاح کنید)
import { apiClient } from '@/lib/api';
import JalaliDatePicker from './JalaliDatePicker';

interface ResourceManagementProps {
    users: CustomUser[];
    nodes: ProjectNode[];
    taskRoles: TaskRole[];
    currentRevision: Revision | null;
    handleUpdateNode: (id: string, updatedFields: Partial<ProjectNode>) => void;
    isLightMode: boolean;
}

export default function ResourceManagement({
                                               users,
                                               nodes,
                                               taskRoles,
                                               currentRevision,
                                               handleUpdateNode,
                                               isLightMode
                                           }: ResourceManagementProps) {
    const [managerSubModule, setManagerSubModule] = useState<'resources' | 'pools' | 'rates' | 'assignments'>('resources');
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Core lists driven by Backend API
    const [pools, setPools] = useState<ResourcePool[]>([]);
    const [roles, setRoles] = useState<ResourceRole[]>([]);
    const [skills, setSkills] = useState<ResourceSkill[]>([]);
    const [resources, setResources] = useState<ResourceItem[]>([]);
    const [skillMappings, setSkillMappings] = useState<ResourceSkillMapping[]>([]);
    const [exceptions, setExceptions] = useState<ResourceException[]>([]);
    const [rates, setRates] = useState<ResourceRate[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);

    // Form states
    const [showResourceModal, setShowResourceModal] = useState(false);
    const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
    const [resForm, setResForm] = useState({
        code: '', name: '', resourceType: 'LABOR' as ResourceType, poolId: '', roleId: '', maxUnits: 100, priority: 100, isActive: true
    });

    const [showSkillModal, setShowSkillModal] = useState(false);
    const [skillForm, setSkillForm] = useState({ resourceId: '', skillId: '', level: 5 });

    const [newPoolName, setNewPoolName] = useState('');
    const [newPoolDesc, setNewPoolDesc] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');
    const [newSkillName, setNewSkillName] = useState('');

    const [showRateModal, setShowRateModal] = useState(false);
    const [rateForm, setRateForm] = useState({ resourceId: '', effectiveFrom: '', regularRate: 0, overtimeRate: 0 });

    const [showExceptionModal, setShowExceptionModal] = useState(false);
    const [excForm, setExcForm] = useState({ resourceId: '', startDatetime: '', finishDatetime: '', reason: '', isAvailable: false });

    const [showAsgModal, setShowAsgModal] = useState(false);
    const [asgForm, setAsgForm] = useState({ taskId: '', resourceId: '', unitsPercent: 100, plannedHours: 40, actualHours: 0 });

    const activities = useMemo(() => nodes.filter(n => n.type === 'activity'), [nodes]);

    // =========================================================================
    // 1. Fetch All Data on Component Mount
    // =========================================================================
    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                const [
                    resPools, resRoles, resSkills, resItems, resMappings, resExceptions, resRates
                ] = await Promise.all([
                    apiClient.get('planning/resource-pools/'),
                    apiClient.get('planning/resource-roles/'),
                    apiClient.get('planning/resource-skills/'),
                    apiClient.get('planning/resources/'),
                    apiClient.get('planning/resource-skill-mappings/'),
                    apiClient.get('planning/resource-exceptions/'),
                    apiClient.get('planning/resource-rates/')
                ]);

                setPools(resPools.data);
                setRoles(resRoles.data);
                setSkills(resSkills.data);
                setResources(resItems.data);
                setSkillMappings(resMappings.data);
                setExceptions(resExceptions.data);
                setRates(resRates.data);

                // Fetch assignments based on active revision
                if (currentRevision?.id) {
                    const resAssignments = await apiClient.get(`planning/assignments/?revision_id=${currentRevision.id}`);
                    setAssignments(resAssignments.data);
                }

            } catch (error) {
                console.error("Error fetching resource data:", error);
                alert("خطا در دریافت اطلاعات از سرور.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [currentRevision]);

    // =========================================================================
    // 2. Resource Management Handlers
    // =========================================================================
    const handleOpenAddResource = () => {
        setEditingResource(null);
        setResForm({ code: `RES-${Date.now().toString().slice(-4)}`, name: '', resourceType: 'LABOR', poolId: pools[0]?.id || '', roleId: roles[0]?.id || '', maxUnits: 100, priority: 100, isActive: true });
        setShowResourceModal(true);
    };

    const handleOpenEditResource = (item: ResourceItem) => {
        setEditingResource(item);
        setResForm({ code: item.code, name: item.name, resourceType: item.resourceType, poolId: item.poolId || '', roleId: item.roleId || '', maxUnits: item.maxUnits, priority: item.priority, isActive: item.isActive });
        setShowResourceModal(true);
    };

    const handleSaveResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resForm.name.trim() || !resForm.code.trim()) return;

        const payload = {
            code: resForm.code,
            name: resForm.name,
            resource_type: resForm.resourceType,
            pool: resForm.poolId || null,
            role: resForm.roleId || null,
            max_units: resForm.maxUnits,
            priority: resForm.priority,
            is_active: resForm.isActive
        };

        try {
            if (editingResource) {
                const response = await apiClient.put(`planning/resources/${editingResource.id}/`, payload);
                setResources(resources.map(r => r.id === editingResource.id ? response.data : r));
            } else {
                const response = await apiClient.post('planning/resources/', payload);
                setResources([...resources, response.data]);
            }
            setShowResourceModal(false);
        } catch (error) {
            console.error(error);
            alert('خطا در ذخیره منبع.');
        }
    };

    const handleDeleteResource = async (id: string) => {
        if (confirm('آیا از حذف این منبع و تمامی رکوردهای متصل به آن اطمینان دارید؟')) {
            try {
                await apiClient.delete(`/resources/${id}/`);
                setResources(resources.filter(r => r.id !== id));
                setSkillMappings(skillMappings.filter(m => m.resourceId !== id));
                setExceptions(exceptions.filter(e => e.resourceId !== id));
                setRates(rates.filter(r => r.resourceId !== id));
                setAssignments(assignments.filter(a => a.resourceId !== id));
            } catch (error) {
                alert('خطا در حذف منبع.');
            }
        }
    };

    // =========================================================================
    // 3. Category Handlers (Pools, Roles, Skills)
    // =========================================================================
    const handleCreatePool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPoolName.trim()) return;
        try {
            const response = await apiClient.post('planning/resource-pools/', { name: newPoolName, description: newPoolDesc });
            setPools([...pools, response.data]);
            setNewPoolName(''); setNewPoolDesc('');
        } catch (error) { alert('خطا در ساخت Pool.'); }
    };

    const handleDeletePool = async (id: string) => {
        if (confirm('آیا از حذف این Pool اطمینان دارید؟')) {
            try {
                await apiClient.delete(`planning/resource-pools/${id}/`);
                setPools(pools.filter(p => p.id !== id));
                setResources(resources.map(r => r.poolId === id ? { ...r, poolId: null } : r));
            } catch (error) { alert('خطا در حذف.'); }
        }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        try {
            const response = await apiClient.post('planning/resource-roles/', { name: newRoleName, description: newRoleDesc });
            setRoles([...roles, response.data]);
            setNewRoleName(''); setNewRoleDesc('');
        } catch (error) { alert('خطا در ساخت Role.'); }
    };

    const handleDeleteRole = async (id: string) => {
        if (confirm('آیا از حذف این نقش اطمینان دارید؟')) {
            try {
                await apiClient.delete(`/resource-roles/${id}/`);
                setRoles(roles.filter(r => r.id !== id));
                setResources(resources.map(r => r.roleId === id ? { ...r, roleId: null } : r));
            } catch (error) { alert('خطا در حذف.'); }
        }
    };

    const handleCreateSkill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSkillName.trim()) return;
        try {
            const response = await apiClient.post('planning/resource-skills/', { name: newSkillName });
            setSkills([...skills, response.data]);
            setNewSkillName('');
        } catch (error) { alert('خطا در ساخت Skill.'); }
    };

    const handleDeleteSkill = async (id: string) => {
        if (confirm('آیا از حذف این مهارت اطمینان دارید؟')) {
            try {
                await apiClient.delete(`planning/resource-skills/${id}/`);
                setSkills(skills.filter(s => s.id !== id));
                setSkillMappings(skillMappings.filter(m => m.skillId !== id));
            } catch (error) { alert('خطا در حذف.'); }
        }
    };

    const handleAddSkillMapping = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!skillForm.resourceId || !skillForm.skillId) return;
        try {
            const payload = { resource: skillForm.resourceId, skill: skillForm.skillId, level: skillForm.level };
            const response = await apiClient.post('planning/resource-skill-mappings/', payload);
            setSkillMappings([...skillMappings, response.data]);
            setShowSkillModal(false);
        } catch (error) { alert('خطا در تخصیص مهارت (ممکن است تکراری باشد).'); }
    };

    // =========================================================================
    // 4. Rates & Exceptions Handlers
    // =========================================================================
    const handleAddRate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rateForm.resourceId || !rateForm.effectiveFrom) return;
        try {
            const payload = {
                resource: rateForm.resourceId,
                effective_from: rateForm.effectiveFrom,
                regular_rate: Number(rateForm.regularRate),
                overtime_rate: Number(rateForm.overtimeRate)
            };
            const response = await apiClient.post('planning/resource-rates/', payload);
            setRates([...rates, response.data]);
            setShowRateModal(false);
        } catch (error) { alert('خطا در ثبت نرخ.'); }
    };

    const handleAddException = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!excForm.resourceId || !excForm.startDatetime || !excForm.finishDatetime || !excForm.reason.trim()) return;
        try {
            const payload = {
                resource: excForm.resourceId,
                start_datetime: excForm.startDatetime.replace('T', ' '),
                finish_datetime: excForm.finishDatetime.replace('T', ' '),
                reason: excForm.reason,
                is_available: excForm.isAvailable
            };
            const response = await apiClient.post('planning/resource-exceptions/', payload);
            setExceptions([...exceptions, response.data]);
            setShowExceptionModal(false);
        } catch (error) { alert('خطا در ثبت استثنا.'); }
    };

    // =========================================================================
    // 5. Assignments Handlers
    // =========================================================================
    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!asgForm.taskId || !asgForm.resourceId || !currentRevision?.id) return;
        try {
            const payload = {
                revision: currentRevision.id,
                task: asgForm.taskId,
                resource: asgForm.resourceId,
                units_percent: Number(asgForm.unitsPercent),
                planned_hours: Number(asgForm.plannedHours),
                actual_hours: Number(asgForm.actualHours)
            };
            const response = await apiClient.post('planning/assignments/', payload);
            setAssignments([...assignments, response.data]);
            setShowAsgModal(false);
        } catch (error) { alert('خطا در تخصیص (احتمالاً این منبع قبلاً به این تسک تخصیص یافته است).'); }
    };

    const handleUpdateActualHours = async (asgId: string, actualHours: number) => {
        try {
            const response = await apiClient.patch(`planning/assignments/${asgId}/`, { actual_hours: actualHours });
            setAssignments(assignments.map(a => a.id === asgId ? response.data : a));
        } catch (error) {
            alert('خطا در بروزرسانی ساعت کارکرد.');
        }
    };


    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-4 text-cyan-500">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <span className="font-mono text-sm tracking-widest uppercase">Syncing with Django Backend...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {/* Dynamic Tab Switcher bar */}
            <div className="bg-white/5 px-6 py-3 border-b border-white/5 shrink-0 flex items-center justify-between select-none">
                <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <div>
                        <h1 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Resource Control & Governance Terminal</h1>
                        <p className="text-[10px] text-slate-400 font-sans">Multi-Scale Workload heatmaps, structural pools and detailed ledger rates accounts.</p>
                    </div>
                </div>
            </div>

            <div className="flex-grow flex overflow-hidden">
                {/* Sub-navigation inside accounts view */}
                <div className="w-[200px] sm:w-[240px] shrink-0 border-r border-white/5 flex flex-col py-4 p-3 gap-1" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                    <span className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase px-3 select-none mb-2">LEDGER SUB-MODULES</span>

                    <button
                        onClick={() => setManagerSubModule('resources')}
                        className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-2.5 text-xs font-bold leading-none cursor-pointer ${
                            managerSubModule === 'resources'
                                ? 'bg-cyan-500/10 border border-cyan-500/15 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                        }`}
                    >
                        <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Resources Index</span>
                    </button>

                    <button
                        onClick={() => setManagerSubModule('pools')}
                        className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-2.5 text-xs font-bold leading-none cursor-pointer ${
                            managerSubModule === 'pools'
                                ? 'bg-cyan-500/10 border border-cyan-500/15 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                        }`}
                    >
                        <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Pools, Roles & Skills</span>
                    </button>

                    <button
                        onClick={() => setManagerSubModule('rates')}
                        className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-2.5 text-xs font-bold leading-none cursor-pointer ${
                            managerSubModule === 'rates'
                                ? 'bg-cyan-500/10 border border-cyan-500/15 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                        }`}
                    >
                        <DollarSign className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Rates & Exceptions</span>
                    </button>

                    <button
                        onClick={() => setManagerSubModule('assignments')}
                        className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-2.5 text-xs font-bold leading-none cursor-pointer ${
                            managerSubModule === 'assignments'
                                ? 'bg-cyan-500/10 border border-cyan-500/15 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                        }`}
                    >
                        <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Task Assignments</span>
                    </button>

                    <div className="mt-auto p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] space-y-1 text-slate-400 shadow-sm leading-relaxed select-none">
                        <span className="text-white block font-bold font-mono">💡 MODEL SCHEMA RULE</span>
                        <span>Labor rates and exceptions validate timeline schedules, preventing over-allocation conflicts during revisions.</span>
                    </div>
                </div>

                {/* Right workspace core */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">

                    {/* SUB-MODULE A: RESOURCES INDEX (THE CORE RESOURCE DIRECTORY) */}
                    {managerSubModule === 'resources' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-extrabold text-white tracking-tight">Enterprise Resources Directory</h2>
                                    <p className="text-[11px] text-slate-400 mt-1">Deploy, inspect and delete project-wide assets, labor personnel, and manufacturing resources.</p>
                                </div>
                                <button
                                    onClick={handleOpenAddResource}
                                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4" /> Add New Resource
                                </button>
                            </div>

                            {/* Display list as table */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono tracking-wider text-[10px] uppercase">
                                        <th className="p-3 pl-4">Code</th>
                                        <th className="p-3">Resource Name</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Associated Pool</th>
                                        <th className="p-3">Assigned Role</th>
                                        <th className="p-3 text-center">Max Units (%)</th>
                                        <th className="p-3 text-center">Priority</th>
                                        <th className="p-3 text-center">Status</th>
                                        <th className="p-3 pr-4 text-center">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                    {resources.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-12 text-center text-slate-500 italic">No resources defined inside pools. Click Add New Resource to start.</td>
                                        </tr>
                                    ) : (
                                        resources.map(item => {
                                            const pool = pools.find(p => p.id === item.poolId);
                                            const role = roles.find(r => r.id === item.roleId);

                                            return (
                                                <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="p-3 pl-4 font-mono font-bold text-cyan-400 whitespace-nowrap">{item.code}</td>
                                                    <td className="p-3 font-bold text-white whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded bg-indigo-500 shrink-0" />
                                                            <span>{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wide ${
                                  item.resourceType === 'LABOR' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      item.resourceType === 'EQUIPMENT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                          item.resourceType === 'MATERIAL' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {item.resourceType}
                              </span>
                                                    </td>
                                                    <td className="p-3 text-slate-300 font-medium whitespace-nowrap">{pool?.name || 'Unassigned Pool'}</td>
                                                    <td className="p-3 text-slate-300 whitespace-nowrap">{role?.name || <span className="text-slate-500 italic">No Role Type</span>}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-slate-200">{item.maxUnits}%</td>
                                                    <td className="p-3 text-center font-mono text-slate-300">{item.priority}</td>
                                                    <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] leading-tight font-extrabold ${item.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-500'}`}>
                                {item.isActive ? 'ACTIVE' : 'STANDBY'}
                              </span>
                                                    </td>
                                                    <td className="p-3 pr-4 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handleOpenEditResource(item)}
                                                                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                                title="Edit Resource Core Parameters"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteResource(item.id)}
                                                                className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                                                title="Delete Resource Record"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Sub-section: Resource Skills Qualification mapping */}
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 shadow-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4 text-cyan-400" />
                                        <h3 className="text-sm font-bold text-white">Specific Performance Skills Mapping</h3>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSkillForm({
                                                resourceId: resources.filter(r => r.resourceType === 'LABOR')[0]?.id || '',
                                                skillId: skills[0]?.id || '',
                                                level: 5
                                            });
                                            setShowSkillModal(true);
                                        }}
                                        className="bg-white/5 hover:bg-white/10 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-1.5 cursor-pointer border border-white/10"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Map Specialist Qualification
                                    </button>
                                </div>

                                {/* Skills lists display */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {skillMappings.length === 0 ? (
                                        <div className="col-span-full py-8 text-center text-xs text-slate-500 italic">No specialist skill qualifiers mapped yet.</div>
                                    ) : (
                                        skillMappings.map(mapping => {
                                            const resource = resources.find(r => r.id === mapping.resourceId);
                                            const skill = skills.find(s => s.id === mapping.skillId);

                                            if (!resource || !skill) return null;

                                            return (
                                                <div key={mapping.id} className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow group hover:border-cyan-500/20 transition-all">
                                                    <div className="min-w-0">
                                                        <span className="text-[10px] font-bold text-cyan-400 block truncate">{resource.name}</span>
                                                        <p className="text-[11px] text-white mt-1 leading-normal font-sans group-hover:text-cyan-100 transition-colors">{skill.name}</p>
                                                        <div className="flex items-center gap-1 mt-2.5">
                                                            <span className="text-[8px] tracking-wider font-mono text-slate-400 uppercase font-bold">PROFICIENCY LEVEL:</span>
                                                            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-1.5 rounded pr-2">{mapping.level} / 5</span>
                                                            <div className="flex gap-0.5 ml-1">
                                                                {Array.from({ length: 5 }).map((_, idx) => (
                                                                    <span key={idx} className={`w-1 h-1.5 rounded-full ${idx < mapping.level ? 'bg-cyan-400 shadow-[0_0_4px_#22d3ee]' : 'bg-slate-700'}`} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('Remove this skill qualification mapping?')) {
                                                                try {
                                                                    await apiClient.delete(`/resource-skill-mappings/${mapping.id}/`);
                                                                    setSkillMappings(skillMappings.filter(sm => sm.id !== mapping.id));
                                                                } catch (e) {
                                                                    alert('خطا در حذف این مورد.');
                                                                }
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-rose-500/10 hover:text-rose-400 rounded transition-colors text-slate-500 cursor-pointer shrink-0"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUB-MODULE B: POOLS, ROLES & SKILLS SETUP */}
                    {managerSubModule === 'pools' && (
                        <div className="space-y-8 animate-fade-in duration-200">
                            {/* 1. Resource Pools Section */}
                            <div className="space-y-4">
                                <div className="bg-[#0b1021]/60 border border-white/5 rounded-2xl p-5 space-y-4">
                                    <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-2 border-b border-white/5 pb-3">
                                        <Layers className="w-4.5 h-4.5 text-cyan-400" />
                                        <span>Configure Resource Pool Definitions</span>
                                    </h2>

                                    <form onSubmit={handleCreatePool} className="bg-black/30 p-4 border border-white/5 rounded-xl flex flex-col md:flex-row items-end gap-3.5">
                                        <div className="flex-1 space-y-1 w-full">
                                            <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Pool Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Mechanical Equipment and Rental Division"
                                                value={newPoolName}
                                                onChange={e => setNewPoolName(e.target.value)}
                                                className="w-full bg-[#11162a]/90 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                        <div className="flex-2 space-y-1 w-full">
                                            <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Description / Details</label>
                                            <input
                                                type="text"
                                                placeholder="Resource categories, allocation capacity rules, subcontracts..."
                                                value={newPoolDesc}
                                                onChange={e => setNewPoolDesc(e.target.value)}
                                                className="w-full bg-[#11162a]/90 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer select-none whitespace-nowrap active:scale-95 transition-all"
                                        >
                                            Create Pool
                                        </button>
                                    </form>

                                    {/* Listing Pools */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {pools.map(p => {
                                            const count = resources.filter(res => res.poolId === p.id).length;
                                            return (
                                                <div key={p.id} className="bg-[#11162a]/40 border border-white/15 p-4 rounded-xl flex flex-col justify-between hover:border-cyan-500/20 transition-all shadow shadow-inner">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-white block truncate">{p.name}</span>
                                                            <span className="text-[10px] bg-cyan-400/10 text-cyan-400 px-2 rounded-full font-mono font-bold capitalize select-none shrink-0 border border-cyan-400/20">
                                {count} assigned
                              </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 leading-normal mt-2.5 font-sans h-10 overflow-y-auto">{p.description || "No description provided."}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between border-t border-white/5 mt-4 pt-3 text-[10px] font-mono text-slate-400">
                                                        <span>Created on: {p.createdAt ? p.createdAt.split('T')[0] : '-'}</span>
                                                        <button
                                                            onClick={() => handleDeletePool(p.id)}
                                                            className="text-rose-400 hover:text-rose-400 cursor-pointer hover:underline hover:font-bold py-0.5 px-1.5 bg-rose-500/10 rounded border border-rose-500/15"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Side-by-side Roles and Skills structure setup */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Roles setup */}
                                <div className="bg-[#0b1021]/60 border border-white/5 rounded-2xl p-5 space-y-4">
                                    <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                                        <Briefcase className="w-4 h-4 text-cyan-400" />
                                        <span>Resource Roles Definition</span>
                                    </h3>
                                    <form onSubmit={handleCreateRole} className="space-y-3 bg-black/20 p-3.5 border border-white/5 rounded-xl">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Role Name</label>
                                                <input
                                                    type="text" required placeholder="e.g. Excavator Lead Operator"
                                                    value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                                                    className="w-full bg-[#11162a]/90 border border-white/10 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Role Description</label>
                                                <input
                                                    type="text" placeholder="Competencies & bounds..."
                                                    value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)}
                                                    className="w-full bg-[#11162a]/90 border border-white/10 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                                                />
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-1.5 rounded-lg text-[10px] cursor-pointer">
                                            Add Resource Role Category
                                        </button>
                                    </form>

                                    <div className="divide-y divide-white/5 bg-black/10 border border-white/5 rounded-xl overflow-hidden h-60 overflow-y-auto scrollbar-thin">
                                        {roles.length === 0 ? (
                                            <div className="p-8 text-center text-xs italic text-slate-500">No organizational roles set.</div>
                                        ) : (
                                            roles.map(r => (
                                                <div key={r.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-white/[0.01]">
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-white block">{r.name}</span>
                                                        <span className="text-[10px] text-slate-400 leading-normal block mt-1">{r.description || 'No description provided.'}</span>
                                                    </div>
                                                    <button onClick={() => handleDeleteRole(r.id)} className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded cursor-pointer transition-colors shrink-0">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Skills definition setup */}
                                <div className="bg-[#0b1021]/60 border border-white/5 rounded-2xl p-5 space-y-4">
                                    <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                                        <Award className="w-4 h-4 text-cyan-400" />
                                        <span>Strategic Resource Skills</span>
                                    </h3>
                                    <form onSubmit={handleCreateSkill} className="space-y-3 bg-black/20 p-3.5 border border-white/5 rounded-xl">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Skill Name / Standard Qualifier</label>
                                            <input
                                                type="text" required placeholder="e.g. Reinforced Masonry & Steel Gutter Assembly"
                                                value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                                                className="w-full bg-[#11162a]/90 border border-white/10 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                                            />
                                        </div>
                                        <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-1.5 rounded-lg text-[10px] cursor-pointer">
                                            Add Unique Skill Category
                                        </button>
                                    </form>

                                    <div className="divide-y divide-white/5 bg-black/10 border border-white/5 rounded-xl overflow-hidden h-60 overflow-y-auto scrollbar-thin">
                                        {skills.length === 0 ? (
                                            <div className="p-8 text-center text-xs italic text-slate-500">No skill categories configured.</div>
                                        ) : (
                                            skills.map(s => (
                                                <div key={s.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.01]">
                                                    <span className="text-xs font-bold text-white truncate max-w-[80%]">{s.name}</span>
                                                    <button onClick={() => handleDeleteSkill(s.id)} className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded cursor-pointer transition-colors shrink-0">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUB-MODULE C: RATES & LEAVE EXCEPTIONS */}
                    {managerSubModule === 'rates' && (
                        <div className="space-y-6 animate-fade-in duration-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                {/* Rates List */}
                                <div className="bg-[#0b1021]/60 border border-white/5 rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center gap-1.5">
                                            <DollarSign className="w-4 h-4 text-cyan-400" />
                                            <span>Workforce Regular & Overtime Rates</span>
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setRateForm({
                                                    resourceId: resources[0]?.id || '',
                                                    effectiveFrom: new Date().toISOString().split('T')[0],
                                                    regularRate: 85,
                                                    overtimeRate: 125
                                                });
                                                setShowRateModal(true);
                                            }}
                                            className="bg-white/5 hover:bg-white/10 text-white font-bold px-3 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer border border-white/10"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Standard Rate
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                            <tr className="bg-black/30 border-b border-white/5 text-slate-400 pb-2 text-[10px] font-mono tracking-wide uppercase">
                                                <th className="p-2.5">Resource Target</th>
                                                <th className="p-2.5">Effective Date</th>
                                                <th className="p-2.5 text-right">Regular Rate</th>
                                                <th className="p-2.5 text-right">Overtime Rate</th>
                                                <th className="p-2.5 text-center">Delete</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                            {rates.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-6 text-center text-slate-500 italic">No resource rates assigned.</td>
                                                </tr>
                                            ) : (
                                                rates.map(r => {
                                                    const target = resources.find(res => res.id === r.resourceId);
                                                    return (
                                                        <tr key={r.id} className="hover:bg-white/[0.01]">
                                                            <td className="p-2.5 text-white font-bold">{target?.name || 'Unknown resource'}</td>
                                                            <td className="p-2.5 font-mono text-slate-400">{r.effectiveFrom}</td>
                                                            <td className="p-2.5 text-right font-mono font-extrabold text-cyan-400">${r.regularRate}/hr</td>
                                                            <td className="p-2.5 text-right font-mono text-indigo-400">${r.overtimeRate}/hr</td>
                                                            <td className="p-2.5 text-center">
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm('Delete this rate tier?')) {
                                                                            try {
                                                                                await apiClient.delete(`/resource-rates/${r.id}/`);
                                                                                setRates(rates.filter(rt => rt.id !== r.id));
                                                                            } catch (e) { alert("خطا در حذف این مورد."); }
                                                                        }
                                                                    }}
                                                                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Exception Calendars */}
                                <div className="bg-[#0b1021]/60 border border-white/5 rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                        <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-cyan-400" />
                                            <span>Lockouts & Exception Calendars</span>
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setExcForm({
                                                    resourceId: resources[0]?.id || '',
                                                    startDatetime: '',
                                                    finishDatetime: '',
                                                    reason: '',
                                                    isAvailable: false
                                                });
                                                setShowExceptionModal(true);
                                            }}
                                            className="bg-white/5 hover:bg-white/10 text-white font-bold px-3 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer border border-white/10"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Log Absence / Rule
                                        </button>
                                    </div>

                                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                                        Defines times when resources are strictly blocked (unavailability exceptions, plant breakdowns, conferences).
                                    </p>

                                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                                        {exceptions.length === 0 ? (
                                            <div className="p-8 text-center text-xs text-slate-500 italic">No exceptions calendars configured.</div>
                                        ) : (
                                            exceptions.map(exc => {
                                                const res = resources.find(r => r.id === exc.resourceId);
                                                return (
                                                    <div key={exc.id} className="bg-black/30 border border-white/5 p-3.5 rounded-xl flex items-start justify-between shadow-sm hover:border-cyan-500/15 group">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-cyan-400">{res?.name || 'Unknown resource'}</span>
                                                                <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono ${exc.isAvailable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {exc.isAvailable ? 'AVAILABLE AS EXCEPTION' : 'LOCKED - SHUTDOWN'}
                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-200 mt-2 font-semibold">Reason: "{exc.reason}"</p>
                                                            <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-400 font-mono">
                                                                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                                                <span>From {exc.startDatetime.replace('T', ' ')} to {exc.finishDatetime.replace('T', ' ')}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Delete calendar lockout exemption?')) {
                                                                    try {
                                                                        await apiClient.delete(`/resource-exceptions/${exc.id}/`);
                                                                        setExceptions(exceptions.filter(e => e.id !== exc.id));
                                                                    } catch (e) { alert("خطا در حذف این مورد."); }
                                                                }
                                                            }}
                                                            className="p-1 rounded text-slate-500 hover:text-rose-400 group-hover:bg-rose-500/10 opacity-70 hover:opacity-100 cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUB-MODULE D: TASK ASSIGNMENTS CONTROL */}
                    {managerSubModule === 'assignments' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-extrabold text-white tracking-tight">Active Schedule Task Assignments</h2>
                                    <p className="text-[11px] text-slate-400 mt-1">Allocate specific workforce pools or equipment to active tasks in current revision workspace.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAsgModal(true);
                                        setAsgForm({
                                            taskId: activities[0]?.id || '',
                                            resourceId: resources[0]?.id || '',
                                            unitsPercent: 100,
                                            plannedHours: 40,
                                            actualHours: 0
                                        });
                                    }}
                                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4" /> Create Resource Assignment
                                </button>
                            </div>

                            <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono tracking-wider text-[10px] uppercase">
                                        <th className="p-3 pl-4">Schedule Task Target</th>
                                        <th className="p-3">Assigned Resource Item</th>
                                        <th className="p-3">Resource Type</th>
                                        <th className="p-3 text-center">Allocated Units (%)</th>
                                        <th className="p-3 text-center">Planned Hours</th>
                                        <th className="p-3 text-center">Actual Hours</th>
                                        <th className="p-3 text-center">Utilization</th>
                                        <th className="p-3 pr-4 text-center">Remove</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                    {assignments.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-500 italic">No manual resource assignments registered. Allocation rules default to task roles executor.</td>
                                        </tr>
                                    ) : (
                                        assignments.map(asg => {
                                            const taskObj = activities.find(n => n.id === asg.taskId);
                                            const resourceObj = resources.find(r => r.id === asg.resourceId);

                                            if (!taskObj || !resourceObj) return null;

                                            const burnedRatio = asg.plannedHours > 0 ? Math.round((asg.actualHours / asg.plannedHours) * 100) : 0;

                                            return (
                                                <tr key={asg.id} className="hover:bg-white/[0.01]">
                                                    <td className="p-3 pl-4">
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-mono text-cyan-400 font-bold block">{taskObj.code}</span>
                                                            <span className="text-white font-bold leading-none mt-1 select-none block max-w-sm truncate" title={taskObj.name}>{taskObj.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-slate-200 font-bold block">{resourceObj.name}</span>
                                                        <span className="text-[9px] font-mono text-slate-400 uppercase mt-0.5 block">{resourceObj.code}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="text-[10px] border border-white/10 bg-white/5 px-2 py-0.5 rounded font-mono font-bold leading-normal text-slate-300">{resourceObj.resourceType}</span>
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-extrabold text-slate-300">{asg.unitsPercent}%</td>
                                                    <td className="p-3 text-center font-mono text-slate-300">{asg.plannedHours} hrs</td>
                                                    <td className="p-3 text-center font-mono text-slate-300">
                                                        <input
                                                            type="number"
                                                            value={asg.actualHours}
                                                            onBlur={(e) => handleUpdateActualHours(asg.id, Number(e.target.value))}
                                                            onChange={(e) => {
                                                                const nextValue = Number(e.target.value);
                                                                setAssignments(assignments.map(a => a.id === asg.id ? { ...a, actualHours: nextValue } : a));
                                                            }}
                                                            className="w-16 bg-black/40 border border-white/10 rounded px-2.5 py-1 font-mono text-right text-xs text-white outline-none focus:border-cyan-500 font-bold text-cyan-400"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center min-w-[120px]">
                                                        <div className="space-y-1 max-w-[130px] mx-auto">
                                                            <div className="flex justify-between text-[9px] font-mono text-slate-400">
                                                                <span>Spent</span>
                                                                <span className="text-white font-bold">{burnedRatio}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${burnedRatio > 100 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                                                                    style={{ width: `${Math.min(burnedRatio, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 pr-4 text-center">
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Delete this active resource allocation plan?')) {
                                                                    try {
                                                                        await apiClient.delete(`/assignments/${asg.id}/`);
                                                                        setAssignments(assignments.filter(a => a.id !== asg.id));
                                                                    } catch (e) { alert("خطا در حذف این مورد."); }
                                                                }
                                                            }}
                                                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ======================================================== */}
            {/* GLOBAL RESOURCE CREATION / EDITING DIALOG MODAL */}
            {/* ======================================================== */}
            {showResourceModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0b1021] border border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowResourceModal(false)}
                            className="absolute right-4 top-4 p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white cursor-pointer select-none"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-sm font-extrabold font-mono text-white tracking-wider uppercase border-b border-white/5 pb-3">
                            {editingResource ? 'Edit Resource ledger Parameters' : 'Add New Pool Resource Asset'}
                        </h3>

                        <form onSubmit={handleSaveResource} className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono uppercase tracking-wide text-slate-400">Resource Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={resForm.code}
                                        onChange={e => setResForm({ ...resForm, code: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500 font-mono font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Resource Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Excavation Crane operator / Rebar Mix"
                                        value={resForm.name}
                                        onChange={e => setResForm({ ...resForm, name: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500 font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono uppercase text-slate-400">Resource Type</label>
                                    <select
                                        value={resForm.resourceType}
                                        onChange={e => setResForm({ ...resForm, resourceType: e.target.value as ResourceType })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value="LABOR">Labor</option>
                                        <option value="EQUIPMENT">Equipment</option>
                                        <option value="MATERIAL">Material</option>
                                        <option value="COST">Cost</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono uppercase text-slate-400">Resource Pool</label>
                                    <select
                                        value={resForm.poolId}
                                        onChange={e => setResForm({ ...resForm, poolId: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value="">No Active Pool</option>
                                        {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-bold font-mono uppercase text-slate-400">Assigned Skill/Role Class</label>
                                    <select
                                        value={resForm.roleId}
                                        onChange={e => setResForm({ ...resForm, roleId: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                                        disabled={resForm.resourceType !== 'LABOR'}
                                    >
                                        <option value="">No Specified Role Unit</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono uppercase text-slate-400">Max Units (%)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max="1000"
                                        value={resForm.maxUnits}
                                        onChange={e => setResForm({ ...resForm, maxUnits: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Priority Rating</label>
                                    <input
                                        type="number"
                                        value={resForm.priority}
                                        onChange={e => setResForm({ ...resForm, priority: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 mt-3.5">
                                    <span className="text-[10px] font-bold font-mono uppercase text-slate-300">Active status</span>
                                    <input
                                        type="checkbox"
                                        checked={resForm.isActive}
                                        onChange={e => setResForm({ ...resForm, isActive: e.target.checked })}
                                        className="w-4 h-4 accent-cyan-500"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setShowResourceModal(false)}
                                    className="bg-black/30 border border-white/10 text-slate-300 hover:text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer select-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer shadow active:scale-95 duration-100"
                                >
                                    Save Resource Details
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* PERFORMANCE SKILL QUALIFICATION MAP DIALOG MODAL */}
            {/* ======================================================== */}
            {showSkillModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
                    <div className="bg-[#0b1021] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-scale-up">
                        <button onClick={() => setShowSkillModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer select-none">
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-sm font-extrabold font-mono text-white tracking-wider uppercase border-b border-white/5 pb-3">
                            Map Labor Skill Qualification
                        </h3>

                        <form onSubmit={handleAddSkillMapping} className="mt-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Specialist Resource Target</label>
                                <select
                                    value={skillForm.resourceId}
                                    onChange={e => setSkillForm({ ...skillForm, resourceId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    {resources.filter(r => r.resourceType === 'LABOR').map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Skill Matrix Level Category</label>
                                <select
                                    value={skillForm.skillId}
                                    onChange={e => setSkillForm({ ...skillForm, skillId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    {skills.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase flex justify-between">
                                    <span>Standard Proficiency (1-5 Level)</span>
                                    <span className="text-cyan-400 font-extrabold font-mono text-xs">{skillForm.level} / 5</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={skillForm.level}
                                    onChange={e => setSkillForm({ ...skillForm, level: Number(e.target.value) })}
                                    className="w-full bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                                <button
                                    type="button" onClick={() => setShowSkillModal(false)}
                                    className="bg-black/30 border border-white/10 text-slate-300 py-2 px-4 rounded-xl text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer shadow active:scale-95 duration-100"
                                >
                                    Confirm Mapping
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* WORKFORCE RATES CREATION MODAL */}
            {/* ======================================================== */}
            {showRateModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
                    <div className="bg-[#0b1021] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button onClick={() => setShowRateModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-sm font-extrabold font-mono text-white tracking-wider uppercase border-b border-white/5 pb-3">Add Custom Standard Rate</h3>

                        <form onSubmit={handleAddRate} className="mt-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Target Resource</label>
                                <select
                                    value={rateForm.resourceId}
                                    onChange={e => setRateForm({ ...rateForm, resourceId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                                >
                                    {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Effective From Date</label>
                                <JalaliDatePicker
                                    required
                                    value={rateForm.effectiveFrom}
                                    onChange={(iso) => setRateForm({ ...rateForm, effectiveFrom: iso })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono flex items-center justify-between gap-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Regular Hourly ($/hr)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={rateForm.regularRate}
                                        onChange={e => setRateForm({ ...rateForm, regularRate: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Overtime Rate ($/hr)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={rateForm.overtimeRate}
                                        onChange={e => setRateForm({ ...rateForm, overtimeRate: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowRateModal(false)} className="bg-black/30 border border-white/10 text-slate-300 py-2 px-4 rounded-xl text-xs cursor-pointer">Cancel</button>
                                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer shadow">Save Standard Rate</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* CALENDAR EXCEPTION LOCKOUTS MODAL */}
            {/* ======================================================== */}
            {showExceptionModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0b1021] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button onClick={() => setShowExceptionModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer select-none">
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-sm font-extrabold font-mono text-white tracking-wider uppercase border-b border-white/5 pb-3">Log Calendar Unavailability</h3>

                        <form onSubmit={handleAddException} className="mt-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Target Resource</label>
                                <select
                                    value={excForm.resourceId}
                                    onChange={e => setExcForm({ ...excForm, resourceId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Blocked Start Date</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={excForm.startDatetime}
                                        onChange={e => setExcForm({ ...excForm, startDatetime: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Blocked Finish Date</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={excForm.finishDatetime}
                                        onChange={e => setExcForm({ ...excForm, finishDatetime: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Unavailability Reason</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Mandatory Annual Crane Safety Certification"
                                    value={excForm.reason}
                                    onChange={e => setExcForm({ ...excForm, reason: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-slate-500"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowExceptionModal(false)} className="bg-black/30 border border-white/10 text-slate-300 py-2 px-4 rounded-xl text-xs cursor-pointer">Cancel</button>
                                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer shadow">Confirm Exception</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* TASK WORKFORCE RESOURCE ALLOCATION PLAN MODAL */}
            {/* ======================================================== */}
            {showAsgModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0b1021] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button onClick={() => setShowAsgModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer select-none">
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-sm font-extrabold font-mono text-white tracking-wider uppercase border-b border-white/5 pb-3">Create Schedule Resource Assignment</h3>

                        <form onSubmit={handleCreateAssignment} className="mt-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Active Schedule Task Target</label>
                                <select
                                    value={asgForm.taskId}
                                    onChange={e => setAsgForm({ ...asgForm, taskId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    {activities.map(act => (
                                        <option key={act.id} value={act.id}>[{act.code}] {act.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Allocated Resource Asset</label>
                                <select
                                    value={asgForm.resourceId}
                                    onChange={e => setAsgForm({ ...asgForm, resourceId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    {resources.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.code}) — {r.resourceType}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Units allocation (%)</label>
                                    <input
                                        type="number"
                                        required
                                        min="10"
                                        max="1000"
                                        value={asgForm.unitsPercent}
                                        onChange={e => setAsgForm({ ...asgForm, unitsPercent: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white text-right font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Planned Hours</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={asgForm.plannedHours}
                                        onChange={e => setAsgForm({ ...asgForm, plannedHours: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white text-right font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase">Actual Hours</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={asgForm.actualHours}
                                        onChange={e => setAsgForm({ ...asgForm, actualHours: Number(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white text-right font-mono"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowAsgModal(false)} className="bg-black/30 border border-white/10 text-slate-300 py-2 px-4 rounded-xl text-xs cursor-pointer">Cancel</button>
                                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer shadow">Assign Resource Target</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}