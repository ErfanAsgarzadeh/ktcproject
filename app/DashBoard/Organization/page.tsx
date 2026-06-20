'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
    Building2, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, X, Users, UserCog, Edit2, Save
} from 'lucide-react';

const ORG_ROLES = [
    { value: 'company_admin', label: 'مدیر سیستم' },
    { value: 'company_pm', label: 'مدیر پروژه شرکت' },
    { value: 'unit_manager', label: 'مدیر واحد' },
    { value: 'member', label: 'عضو' },
];

const roleLabel = (v: string) => ORG_ROLES.find(r => r.value === v)?.label || v;
const roleColor = (v: string) => ({
    company_admin: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    company_pm: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
    unit_manager: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    member: 'bg-slate-500/10 text-slate-300 border-slate-500/25',
}[v] || 'bg-slate-500/10 text-slate-300 border-slate-500/25');

export default function OrganizationPage() {
    const [units, setUnits] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // New unit form
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitManager, setNewUnitManager] = useState('');

    const flash = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [unitsRes, usersRes] = await Promise.all([
                apiClient.get('/auth/org-units/'),
                apiClient.get('/auth/manage-users/'),
            ]);
            setUnits(unitsRes.data.results || unitsRes.data);
            setUsers(usersRes.data.results || usersRes.data);
        } catch (err) {
            console.error(err);
            flash('error', 'خطا در بارگذاری اطلاعات سازمانی.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const createUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnitName.trim()) return;
        try {
            await apiClient.post('/auth/org-units/', {
                name: newUnitName.trim(),
                managerId: newUnitManager || null,
            });
            setNewUnitName('');
            setNewUnitManager('');
            flash('success', 'واحد ساخته شد.');
            fetchAll();
        } catch (err) { console.error(err); flash('error', 'خطا در ساخت واحد.'); }
    };

    const updateUnitManager = async (unitId: string, managerId: string) => {
        try {
            await apiClient.patch(`/auth/org-units/${unitId}/`, { managerId: managerId || null });
            fetchAll();
        } catch (err) { console.error(err); flash('error', 'خطا در تغییر مدیر واحد.'); }
    };

    const deleteUnit = async (unitId: string) => {
        if (!window.confirm('این واحد حذف شود؟ نیروهای آن بدون واحد می‌شوند.')) return;
        try {
            await apiClient.delete(`/auth/org-units/${unitId}/`);
            flash('success', 'واحد حذف شد.');
            fetchAll();
        } catch (err) { console.error(err); flash('error', 'خطا در حذف واحد.'); }
    };

    const updateUser = async (userId: string, fields: { unitId?: string | null; orgRole?: string }) => {
        try {
            const payload: any = {};
            if ('unitId' in fields) payload.unitId = fields.unitId || null;
            if ('orgRole' in fields) payload.orgRole = fields.orgRole;
            await apiClient.patch(`/auth/manage-users/${userId}/`, payload);
            // local update
            setUsers(prev => prev.map(u => u.id === userId ? {
                ...u,
                ...(payload.unitId !== undefined ? { unitId: payload.unitId, unitName: units.find(x => String(x.id) === String(payload.unitId))?.name || null } : {}),
                ...(payload.orgRole !== undefined ? { orgRole: payload.orgRole } : {}),
            } : u));
            flash('success', 'نیرو به‌روزرسانی شد.');
        } catch (err) { console.error(err); flash('error', 'خطا در به‌روزرسانی نیرو.'); }
    };

    const inputClass = "bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400";

    return (
        <div className="h-full w-full overflow-y-auto p-6 md:p-10" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(13,148,136,0.12)', color: 'var(--text-accent)', border: '1px solid var(--border-medium)' }}>
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">واحدها و نیروها</h1>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>واحدهای سازمانی را تعریف و نقش/واحد هر نیرو را تعیین کنید</p>
                    </div>
                </div>

                {message && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm" style={{
                        backgroundColor: message.type === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(225,29,72,0.1)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(225,29,72,0.3)'}`,
                        color: message.type === 'success' ? '#059669' : '#e11d48',
                    }}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span>{message.text}</span>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-accent)' }}><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                    {/* ─── Units column ─── */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
                            <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
                                <Building2 className="w-4 h-4" /> واحد جدید
                            </h2>
                            <form onSubmit={createUnit} className="space-y-2.5">
                                <input className={`w-full ${inputClass}`} value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="نام واحد (مثلاً واحد فنی)" />
                                <select className={`w-full ${inputClass}`} value={newUnitManager} onChange={e => setNewUnitManager(e.target.value)}>
                                    <option value="" className="bg-slate-950">— انتخاب مدیر واحد (اختیاری) —</option>
                                    {users.map(u => <option key={u.id} value={u.id} className="bg-slate-950">{u.username}</option>)}
                                </select>
                                <button type="submit" className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--text-accent)', color: '#fff' }}>
                                    <Plus className="w-4 h-4" /> ساخت واحد
                                </button>
                            </form>
                        </div>

                        <div className="rounded-2xl p-5 space-y-2" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
                            <h2 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-accent)' }}>واحدهای تعریف‌شده</h2>
                            {units.length === 0 && <div className="text-xs italic py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>واحدی تعریف نشده.</div>}
                            {units.map(unit => (
                                <div key={unit.id} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--overlay-bg)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold flex items-center gap-2"><Building2 className="w-3.5 h-3.5" style={{ color: 'var(--text-accent)' }} />{unit.name}</span>
                                        <button onClick={() => deleteUnit(unit.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                        <Users className="w-3 h-3" /><span>{unit.membersCount} نیرو</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <UserCog className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                                        <select value={unit.managerId ?? ''} onChange={e => updateUnitManager(unit.id, e.target.value)} className={`flex-1 ${inputClass} text-[11px]`} title="مدیر واحد">
                                            <option value="" className="bg-slate-950">— مدیر واحد —</option>
                                            {users.map(u => <option key={u.id} value={u.id} className="bg-slate-950">{u.username}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ─── Users column ─── */}
                    <div className="lg:col-span-3 rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
                            <Users className="w-4 h-4" /> نیروها ({users.length})
                        </h2>
                        <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                            {users.map(u => (
                                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--overlay-bg)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black font-mono shrink-0" style={{ backgroundColor: 'rgba(13,148,136,0.12)', color: 'var(--text-accent)' }}>
                                            {(u.username || 'U').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold truncate">{u.username}</div>
                                            <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{u.jobTitle || '—'}</div>
                                        </div>
                                    </div>

                                    {/* org role */}
                                    <select value={u.orgRole || 'member'} onChange={e => updateUser(u.id, { orgRole: e.target.value })} className={`${inputClass} text-[11px]`} title="نقش سازمانی">
                                        {ORG_ROLES.map(r => <option key={r.value} value={r.value} className="bg-slate-950">{r.label}</option>)}
                                    </select>

                                    {/* unit */}
                                    <select value={u.unitId ?? ''} onChange={e => updateUser(u.id, { unitId: e.target.value })} className={`${inputClass} text-[11px]`} title="واحد سازمانی">
                                        <option value="" className="bg-slate-950">— بدون واحد —</option>
                                        {units.map(unit => <option key={unit.id} value={unit.id} className="bg-slate-950">{unit.name}</option>)}
                                    </select>

                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border shrink-0 ${roleColor(u.orgRole || 'member')}`}>{roleLabel(u.orgRole || 'member')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
