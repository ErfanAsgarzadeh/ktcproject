'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { navPages } from '@/components/navbar';
import {
    ShieldCheck, Loader2, CheckCircle2, AlertCircle, Search, Save, Globe, Lock
} from 'lucide-react';

// صفحاتی که همیشه در دسترس‌اند و قابلِ محدودسازی نیستند
const ALWAYS_ALLOWED = ['/DashBoard/Home'];
const MANAGEABLE_PAGES = navPages.filter(p => !ALWAYS_ALLOWED.includes(p.href));

export default function AccessControlPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deniedAccess, setDeniedAccess] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [search, setSearch] = useState('');

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [fullAccess, setFullAccess] = useState(true);
    const [selectedPages, setSelectedPages] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const flash = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const res = await apiClient.get('/auth/manage-users/');
            setUsers(res.data.results || res.data);
        } catch (err: any) {
            if (err?.response?.status === 403) setDeniedAccess(true);
            else flash('error', 'Error loading users.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const selectedUser = useMemo(
        () => users.find(u => String(u.id) === String(selectedUserId)) || null,
        [users, selectedUserId]
    );

    // وقتی کاربری انتخاب می‌شود، وضعیتِ دسترسی‌اش را بارگذاری کن
    const selectUser = (u: any) => {
        setSelectedUserId(String(u.id));
        const allowed = u.allowedPages;
        if (allowed == null) {
            setFullAccess(true);
            setSelectedPages(MANAGEABLE_PAGES.map(p => p.href));
        } else {
            setFullAccess(false);
            setSelectedPages(allowed);
        }
    };

    const togglePage = (href: string) => {
        setSelectedPages(prev => prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]);
    };

    const handleSave = async () => {
        if (!selectedUserId) return;
        try {
            setSaving(true);
            // دسترسیِ کامل → null؛ در غیر این صورت لیستِ انتخاب‌شده (+ صفحاتِ همیشه‌مجاز)
            const payload = fullAccess
                ? { allowedPages: null }
                : { allowedPages: Array.from(new Set([...ALWAYS_ALLOWED, ...selectedPages])) };
            await apiClient.patch(`/auth/manage-users/${selectedUserId}/`, payload);
            setUsers(prev => prev.map(u => String(u.id) === String(selectedUserId)
                ? { ...u, allowedPages: payload.allowedPages } : u));
            flash('success', 'User access saved.');
        } catch (err: any) {
            flash('error', err?.response?.data?.detail || 'Error saving access permissions.');
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return users;
        return users.filter(u =>
            u.username?.toLowerCase().includes(q) || u.jobTitle?.toLowerCase().includes(q)
        );
    }, [users, search]);

    const inputClass = "bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400";

    if (deniedAccess) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <Lock className="w-10 h-10 text-rose-400" />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>This page is only accessible to system administrators.</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto p-6 md:p-10" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#f43f5e', border: '1px solid var(--border-medium)' }}>
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Page Access Control</h1>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Define which pages each user can access</p>
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

                    {/* ─── Users column ─── */}
                    <div className="lg:col-span-2 rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                        <div className="relative mb-3">
                            <input className={`w-full ${inputClass} pl-8`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." />
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                            {filteredUsers.map(u => {
                                const isSel = String(u.id) === String(selectedUserId);
                                const full = u.allowedPages == null;
                                return (
                                    <button key={u.id} onClick={() => selectUser(u)}
                                        className="w-full flex items-center gap-2 p-2.5 rounded-xl text-right transition-all"
                                        style={{ backgroundColor: isSel ? 'rgba(13,148,136,0.12)' : 'var(--overlay-bg)', border: `1px solid ${isSel ? 'var(--text-accent)' : 'var(--border-subtle)'}` }}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black font-mono shrink-0" style={{ backgroundColor: 'rgba(13,148,136,0.12)', color: 'var(--text-accent)' }}>
                                            {(u.username || 'U').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold truncate">{u.username}</div>
                                            <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{u.jobTitle || '—'}</div>
                                        </div>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded border shrink-0" style={{
                                            color: full ? '#059669' : '#f59e0b',
                                            borderColor: full ? 'rgba(5,150,105,0.3)' : 'rgba(245,158,11,0.3)',
                                            backgroundColor: full ? 'rgba(5,150,105,0.08)' : 'rgba(245,158,11,0.08)',
                                        }}>{full ? 'Full' : 'Limited'}</span>
                                    </button>
                                );
                            })}
                            {filteredUsers.length === 0 && <div className="text-xs italic py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>No users found.</div>}
                        </div>
                    </div>

                    {/* ─── Pages column ─── */}
                    <div className="lg:col-span-3 rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                        {!selectedUser ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-center">
                                <ShieldCheck className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select a user from the list</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-bold">Access for: <span style={{ color: 'var(--text-accent)' }}>{selectedUser.username}</span></h2>
                                    <button onClick={handleSave} disabled={saving}
                                        className="py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                                        style={{ backgroundColor: 'var(--text-accent)', color: '#fff' }}>
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        <span>Save</span>
                                    </button>
                                </div>

                                {/* Full access toggle */}
                                <label className="flex items-center gap-3 p-3 rounded-xl mb-3 cursor-pointer" style={{ backgroundColor: 'var(--overlay-bg)', border: '1px solid var(--border-subtle)' }}>
                                    <input type="checkbox" checked={fullAccess} onChange={e => setFullAccess(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                                    <Globe className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <div className="text-xs font-bold">Full access to all pages</div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>When enabled, the user can see all pages (even future ones)</div>
                                    </div>
                                </label>

                                {/* Per-page checkboxes */}
                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 transition-opacity ${fullAccess ? 'opacity-40 pointer-events-none' : ''}`}>
                                    {MANAGEABLE_PAGES.map(p => {
                                        const Icon = p.icon;
                                        const checked = selectedPages.includes(p.href);
                                        return (
                                            <label key={p.href} className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--overlay-bg)', border: `1px solid ${checked ? p.color + '40' : 'var(--border-subtle)'}` }}>
                                                <input type="checkbox" checked={checked} onChange={() => togglePage(p.href)} className="w-4 h-4" style={{ accentColor: p.color }} />
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.color}18`, border: `1px solid ${p.color}30` }}>
                                                    <Icon size={14} style={{ color: p.color }} />
                                                </div>
                                                <span className="text-xs font-medium">{p.title}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] mt-3" style={{ color: 'var(--text-tertiary)' }}>
                                    * Home and Profile pages are always accessible. This control determines menu and route access; API security permissions are still enforced based on role.
                                </p>
                            </>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
