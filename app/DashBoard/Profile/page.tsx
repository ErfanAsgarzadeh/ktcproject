'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
    User, Mail, Briefcase, Hash, IdCard, Lock, Save, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';

interface ProfileForm {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    jobTitle: string;
    employeeCode: string;
}

export default function ProfilePage() {
    const [form, setForm] = useState<ProfileForm>({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        jobTitle: '',
        employeeCode: '',
    });

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                const res = await apiClient.get('/auth/profile/');
                const d = res.data;
                setForm({
                    username: d.username || '',
                    email: d.email || '',
                    first_name: d.first_name || '',
                    last_name: d.last_name || '',
                    jobTitle: d.jobTitle || '',
                    employeeCode: d.employeeCode || '',
                });
            } catch (err) {
                console.error('Failed to load profile', err);
                setMessage({ type: 'error', text: 'Error loading user profile.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (field: keyof ProfileForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (password && password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Password and confirmation do not match.' });
            return;
        }

        const payload: any = {
            username: form.username,
            email: form.email,
            first_name: form.first_name,
            last_name: form.last_name,
            jobTitle: form.jobTitle,
            employeeCode: form.employeeCode,
        };
        if (password) payload.password = password;

        try {
            setIsSaving(true);
            await apiClient.patch('/auth/profile/', payload);
            setMessage({ type: 'success', text: 'Profile saved successfully.' });
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Failed to update profile', err);
            const detail = err?.response?.data
                ? Object.values(err.response.data).flat().join(' ')
                : 'Error saving profile.';
            setMessage({ type: 'error', text: detail });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-3" style={{ color: 'var(--text-accent)' }}>
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="font-mono text-xs uppercase tracking-widest">Loading Profile...</span>
                </div>
            </div>
        );
    }

    const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all";
    const labelClass = "block text-[11px] font-bold uppercase tracking-wider mb-1.5";

    return (
        <div className="h-full w-full overflow-y-auto p-6 md:p-10" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="max-w-2xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black font-mono shrink-0"
                        style={{ backgroundColor: 'rgba(13,148,136,0.12)', color: 'var(--text-accent)', border: '1px solid var(--border-medium)' }}
                    >
                        {(form.username || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            Edit Profile
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            Update your account information and password
                        </p>
                    </div>
                </div>

                {/* Alert message */}
                {message && (
                    <div
                        className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm"
                        style={{
                            backgroundColor: message.type === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(225,29,72,0.1)',
                            border: `1px solid ${message.type === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(225,29,72,0.3)'}`,
                            color: message.type === 'success' ? '#059669' : '#e11d48',
                        }}
                    >
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span>{message.text}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Account info card */}
                    <div
                        className="rounded-2xl p-5 md:p-6 space-y-5"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}
                    >
                        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
                            <User className="w-4 h-4" /> Account Information
                        </h2>

                        <div>
                            <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Username</label>
                            <div className="relative">
                                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                <input className={inputClass} value={form.username} onChange={e => handleChange('username', e.target.value)} placeholder="username" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>First Name</label>
                                <div className="relative">
                                    <IdCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                    <input className={inputClass} value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} placeholder="First name" />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Last Name</label>
                                <div className="relative">
                                    <IdCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                    <input className={inputClass} value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} placeholder="Last name" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Email</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                <input type="email" className={inputClass} value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="email@example.com" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Job Title</label>
                                <div className="relative">
                                    <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                    <input className={inputClass} value={form.jobTitle} onChange={e => handleChange('jobTitle', e.target.value)} placeholder="e.g. Project Manager" />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Employee Code</label>
                                <div className="relative">
                                    <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                    <input className={inputClass} value={form.employeeCode} onChange={e => handleChange('employeeCode', e.target.value)} placeholder="Employee code" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Password card */}
                    <div
                        className="rounded-2xl p-5 md:p-6 space-y-5"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}
                    >
                        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
                            <Lock className="w-4 h-4" /> Change Password
                        </h2>
                        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            Leave these fields empty if you do not wish to change your password.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>New Password</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                    <input type="password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Confirm Password</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                                    <input type="password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save button */}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{ backgroundColor: 'var(--text-accent)', color: '#ffffff' }}
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
