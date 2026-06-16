'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './themeChangeToggle';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { CustomUser } from '../types/types';
import { User, Settings, LayoutDashboard, Users, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar() {
    const [user, setUser] = useState<CustomUser | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await apiClient.get('/auth/profile/');
                setUser(response.data);
            } catch (error) {
                console.error("User not authenticated", error);
            }
        };

        fetchProfile();
    }, []);

    const handleLogout = async () => {
        try {
            await apiClient.post('/auth/logout/',{
                refresh: localStorage.getItem('refresh_token')
            });
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setUser(null);
            router.push('/Login');
        }
    };

    return (
        <header
            className="relative z-[60] w-full font-sans transition-colors shrink-0 border-b"
            style={{
                backgroundColor: 'var(--bg-header)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-medium)',
            }}
        >
            <div className="mx-auto w-full flex items-center justify-between">
                <div className="p-4 flex items-center">
                    <nav className="hidden md:flex gap-4 text-sm font-medium">
                        <Link
                            href="/DashBoard"
                            className="transition-colors hover:opacity-70"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <LayoutDashboard size={20} />
                        </Link>
                        <Link
                            href="/DashBoard/ResourcePlan"
                            className="transition-colors hover:opacity-70"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Resource Plan"
                        >
                            <Users size={20} />
                        </Link>
                        <Link
                            href="/settings"
                            className="transition-colors hover:opacity-70"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <Settings size={20} />
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4 px-4">
                    <ThemeToggle />

                    <div className="flex items-center gap-2">
                        {user ? (
                            <div className="relative">
                                {isDropdownOpen && (
                                    <div
                                        className="fixed inset-0 z-40 cursor-default"
                                        onClick={() => setIsDropdownOpen(false)}
                                    ></div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="relative z-50 flex flex-col text-xs cursor-pointer hover:opacity-80 transition-opacity outline-none text-right"
                                >
                                    <div
                                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs border"
                                        style={{
                                            backgroundColor: 'var(--overlay-bg)',
                                            borderColor: 'var(--border-medium)',
                                        }}
                                    >
                                        <div
                                            className="w-7 h-7 rounded flex items-center justify-center text-[14px] font-black font-mono"
                                            style={{
                                                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                                                color: '#d97706',
                                            }}
                                        >
                                            {user.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-left flex flex-col justify-center">
                                            <span
                                                className="font-semibold text-xs leading-none flex items-center gap-1"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {user.username.toUpperCase()}
                                                <ChevronDown
                                                    className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                />
                                            </span>
                                            <span className="text-[9px] block font-mono mt-1" style={{ color: '#d97706' }}>
                                                {user.jobTitle?.toUpperCase() || 'MANAGER'}
                                            </span>
                                        </div>
                                    </div>
                                </button>

                                {isDropdownOpen && (
                                    <div
                                        className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-48 rounded-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderColor: 'var(--border-medium)',
                                            border: '1px solid var(--border-medium)',
                                            boxShadow: 'var(--shadow-lg)',
                                        }}
                                    >
                                        <div className="px-4 py-2 text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                                            حساب کاربری
                                        </div>

                                        <div className="h-px mx-2 mb-1" style={{ backgroundColor: 'var(--border-subtle)' }}></div>

                                        <Link
                                            href="/Profile"
                                            onClick={() => setIsDropdownOpen(false)}
                                            className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            <User className="mr-2 h-4 w-4" />
                                            <span className="mr-2">پروفایل من</span>
                                        </Link>

                                        <Link
                                            href="/settings"
                                            onClick={() => setIsDropdownOpen(false)}
                                            className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            <Settings className="mr-2 h-4 w-4" />
                                            <span className="mr-2">تنظیمات</span>
                                        </Link>

                                        <div className="h-px mx-2 my-1" style={{ backgroundColor: 'var(--border-subtle)' }}></div>

                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-red-500 hover:text-red-400 transition-colors text-left"
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(225, 29, 72, 0.06)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span className="mr-2">خروج</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                className="hidden sm:block w-32 h-10 rounded-xl animate-pulse"
                                style={{ backgroundColor: 'var(--overlay-bg)' }}
                            ></div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
