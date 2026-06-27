'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
    CalendarDays, Plus, Trash2, Save, Loader2, CheckCircle2, AlertCircle, X, Clock, Edit2
} from 'lucide-react';
import JalaliDatePicker from '@/components/JalaliDatePicker';
import { gregorianToJalaliString } from '@/utils/jalali';

// WorkingInterval.weekday choices in backend: 0=Mon ... 6=Sun
const WEEKDAYS = [
    { idx: 5, label: 'Saturday' },
    { idx: 6, label: 'Sunday' },
    { idx: 0, label: 'Monday' },
    { idx: 1, label: 'Tuesday' },
    { idx: 2, label: 'Wednesday' },
    { idx: 3, label: 'Thursday' },
    { idx: 4, label: 'Friday' },
];

interface DayState {
    working: boolean;
    start: string; // HH:MM
    end: string;   // HH:MM
}

interface Holiday {
    date: string;        // YYYY-MM-DD (Gregorian)
    description: string;
    is_working: boolean;
}

const defaultDays = (): Record<number, DayState> => {
    const d: Record<number, DayState> = {};
    WEEKDAYS.forEach(w => {
        // Sat..Wed working by default (Iran), Thu/Fri off
        const off = w.idx === 4 || w.idx === 3;
        d[w.idx] = { working: !off, start: '08:00', end: '17:00' };
    });
    return d;
};

export default function CalendarsPage() {
    const [calendars, setCalendars] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [name, setName] = useState('');
    const [days, setDays] = useState<Record<number, DayState>>(defaultDays());
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newHolidayDesc, setNewHolidayDesc] = useState('');

    const fetchCalendars = async () => {
        try {
            setIsLoading(true);
            const res = await apiClient.get('/planning/calendars/?templates=true');
            setCalendars(res.data.results || res.data);
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error loading calendars.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchCalendars(); }, []);

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setDays(defaultDays());
        setHolidays([]);
        setNewHolidayDate('');
        setNewHolidayDesc('');
    };

    const loadForEdit = (cal: any) => {
        setEditingId(cal.id);
        setName(cal.name || '');
        const d = defaultDays();
        // reset all to non-working, then apply intervals
        WEEKDAYS.forEach(w => { d[w.idx] = { working: false, start: '08:00', end: '17:00' }; });
        (cal.intervals || []).forEach((iv: any) => {
            d[iv.weekday] = {
                working: true,
                start: (iv.start_time || '08:00:00').slice(0, 5),
                end: (iv.end_time || '17:00:00').slice(0, 5),
            };
        });
        setDays(d);
        setHolidays((cal.exceptions || []).map((ex: any) => ({
            date: ex.date, description: ex.description || '', is_working: ex.is_working,
        })));
        setMessage(null);
    };

    const toggleDay = (idx: number) => {
        setDays(prev => ({ ...prev, [idx]: { ...prev[idx], working: !prev[idx].working } }));
    };
    const setDayTime = (idx: number, field: 'start' | 'end', val: string) => {
        setDays(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: val } }));
    };

    const addHoliday = () => {
        if (!newHolidayDate) return;
        if (holidays.some(h => h.date === newHolidayDate)) return;
        setHolidays(prev => [...prev, { date: newHolidayDate, description: newHolidayDesc.trim(), is_working: false }]);
        setNewHolidayDate('');
        setNewHolidayDesc('');
    };
    const removeHoliday = (date: string) => setHolidays(prev => prev.filter(h => h.date !== date));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (!name.trim()) {
            setMessage({ type: 'error', text: 'Calendar name is required.' });
            return;
        }

        const intervals = WEEKDAYS
            .filter(w => days[w.idx].working)
            .map(w => ({ weekday: w.idx, start_time: days[w.idx].start, end_time: days[w.idx].end }));

        const payload = {
            name: name.trim(),
            project: null,
            intervals,
            exceptions: holidays.map(h => ({ date: h.date, is_working: h.is_working, description: h.description })),
        };

        try {
            setIsSaving(true);
            if (editingId) {
                await apiClient.put(`/planning/calendars/${editingId}/`, payload);
            } else {
                await apiClient.post('/planning/calendars/', payload);
            }
            setMessage({ type: 'success', text: 'Calendar saved successfully.' });
            resetForm();
            fetchCalendars();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error saving calendar.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        if (!window.confirm('Delete this calendar?')) return;
        try {
            await apiClient.delete(`/planning/calendars/${id}/`);
            if (editingId === id) resetForm();
            fetchCalendars();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error deleting calendar.' });
        }
    };

    const inputClass = "bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400";

    return (
        <div className="h-full w-full overflow-y-auto p-2 md:p-10" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(13,148,136,0.12)', color: 'var(--text-accent)', border: '1px solid var(--border-medium)' }}>
                        <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Work Calendar Management</h1>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Define calendars independently and attach them when creating/editing projects</p>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ─── Form ─── */}
                    <form onSubmit={handleSave} className="rounded-2xl p-5 space-y-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-accent)' }}>
                                {editingId ? 'Edit Calendar' : 'New Calendar'}
                            </h2>
                            {editingId && (
                                <button type="button" onClick={resetForm} className="text-[11px] px-2 py-1 rounded-lg" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--overlay-bg)' }}>
                                    Cancel Edit
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Calendar Name</label>
                            <input className={`w-full ${inputClass}`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Iran Official Calendar 1405" />
                        </div>

                        {/* Working days */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Working Days & Hours</label>
                            <div className="space-y-1.5">
                                {WEEKDAYS.map(w => (
                                    <div key={w.idx} className="flex items-center gap-2">
                                        <button type="button" onClick={() => toggleDay(w.idx)} className="flex items-center gap-2 w-24 shrink-0">
                                            <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{
                                                backgroundColor: days[w.idx].working ? 'var(--text-accent)' : 'transparent',
                                                border: `1px solid ${days[w.idx].working ? 'var(--text-accent)' : 'var(--border-medium)'}`,
                                            }}>
                                                {days[w.idx].working && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </span>
                                            <span className="text-xs">{w.label}</span>
                                        </button>
                                        <input type="time" disabled={!days[w.idx].working} value={days[w.idx].start} onChange={e => setDayTime(w.idx, 'start', e.target.value)} className={`${inputClass} disabled:opacity-40 flex-1`} />
                                        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                                        <input type="time" disabled={!days[w.idx].working} value={days[w.idx].end} onChange={e => setDayTime(w.idx, 'end', e.target.value)} className={`${inputClass} disabled:opacity-40 flex-1`} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Holidays */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Holidays / Exceptions</label>
                            <div className="flex items-end gap-2 mb-2">
                                <div className="flex-1">
                                    <JalaliDatePicker value={newHolidayDate} onChange={(iso) => setNewHolidayDate(iso)} className={`w-full ${inputClass} flex items-center justify-between gap-2`} />
                                </div>
                                <input className={`flex-1 ${inputClass}`} value={newHolidayDesc} onChange={e => setNewHolidayDesc(e.target.value)} placeholder="Description (optional)" />
                                <button type="button" onClick={addHoliday} disabled={!newHolidayDate} className="px-3 py-2 rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--text-accent)', color: '#fff' }}>
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {holidays.length === 0 && <div className="text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>No holidays registered.</div>}
                                {holidays.map(h => (
                                    <div key={h.date} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--overlay-bg)' }}>
                                        <span className="font-mono">{gregorianToJalaliString(h.date)} {h.description && <span style={{ color: 'var(--text-tertiary)' }}>— {h.description}</span>}</span>
                                        <button type="button" onClick={() => removeHoliday(h.date)} className="text-rose-400 hover:text-rose-300"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button type="submit" disabled={isSaving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: 'var(--text-accent)', color: '#fff' }}>
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>{editingId ? 'Save Changes' : 'Create Calendar'}</span>
                        </button>
                    </form>

                    {/* ─── List ─── */}
                    <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-accent)' }}>Defined Calendars</h2>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10" style={{ color: 'var(--text-accent)' }}><Loader2 className="w-6 h-6 animate-spin" /></div>
                        ) : calendars.length === 0 ? (
                            <div className="text-center py-10 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No calendars defined yet.</div>
                        ) : (
                            calendars.map(cal => (
                                <div key={cal.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--overlay-bg)', border: '1px solid var(--border-subtle)' }}>
                                    <div>
                                        <div className="text-sm font-bold">{cal.name}</div>
                                        <div className="text-[10px] font-mono flex items-center gap-2 mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                            <Clock className="w-3 h-3" />
                                            <span>{(cal.intervals || []).length} working days</span>
                                            <span>•</span>
                                            <span>{(cal.exceptions || []).length} holidays</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => loadForEdit(cal)} className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-accent)' }}><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDelete(cal.id)} className="p-2 rounded-lg hover:bg-white/10 text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
