'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from './themeChangeToggle';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { CustomUser } from '../types/types';
import {
    User, Settings, LogOut, ChevronDown, Menu,
    LayoutDashboard, ListTodo, ClipboardCheck, UserCheck,
    CalendarRange, BarChart3, Users, TrendingUp, Home
} from 'lucide-react';

const navPages = [
    { title: 'Home', href: '/DashBoard/Home', icon: Home, color: '#0d9488' },
    { title: 'Project Workspace', href: '/DashBoard', icon: LayoutDashboard, color: '#0d9488' },
    { title: 'My Tasks', href: '/DashBoard/MyTask', icon: ListTodo, color: '#6366f1' },
    { title: 'Approve Tasks', href: '/DashBoard/ApproveTask', icon: ClipboardCheck, color: '#059669' },
    { title: 'Personal Tasks', href: '/DashBoard/PersonalTask', icon: UserCheck, color: '#d97706' },
    { title: 'Resource Plan', href: '/DashBoard/ResourcePlan', icon: CalendarRange, color: '#0ea5e9' },
    { title: 'Resource Load Map', href: '/DashBoard/ResourceLoadMap', icon: BarChart3, color: '#ec4899' },
    { title: 'Resource Management', href: '/DashBoard/ResourceManagement', icon: Users, color: '#8b5cf6' },
    { title: 'Variance Control', href: '/DashBoard/Variance', icon: TrendingUp, color: '#ef4444' },
];

export default function Navbar() {
    const [user, setUser] = useState<CustomUser | null>(null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

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
            await apiClient.post('/auth/logout/', {
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

    // Find current page title for the nav button label
    const currentPage = navPages.find(p => p.href === pathname) || navPages[0];

    return (
        <header
            className="relative z-[60] w-full font-sans transition-colors shrink-0 border-b"
            style={{
                backgroundColor: 'var(--bg-header)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-medium)',
            }}
        >
            <div className="mx-auto w-full flex items-center justify-between px-4 py-2.5">

                {/* ═══ Left: Navigation Dropdown ═══ */}
                <div className="flex items-center gap-3">
                    {/* Nav Dropdown */}
                    <div className="relative">
                        {isNavMenuOpen && (
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsNavMenuOpen(false)}
                            />
                        )}

                        <button
                            type="button"
                            onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                            className="relative z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                            style={{
                                backgroundColor: isNavMenuOpen ? 'var(--bg-hover)' : 'var(--overlay-bg)',
                                borderColor: isNavMenuOpen ? 'var(--border-strong)' : 'var(--border-medium)',
                                color: 'var(--text-primary)',
                            }}
                        >
                            <Menu size={16} style={{ color: 'var(--text-accent)' }} />
                            <span className="hidden sm:inline">{currentPage.title}</span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${isNavMenuOpen ? 'rotate-180' : ''}`}
                                style={{ color: 'var(--text-tertiary)' }}
                            />
                        </button>

                        {isNavMenuOpen && (
                            <div
                                className="absolute left-0 top-full mt-2 w-64 rounded-xl py-2 z-50"
                                style={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-medium)',
                                    boxShadow: 'var(--shadow-lg)',
                                }}
                            >
                                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Navigation
                                </div>
                                <div className="h-px mx-2 mb-1" style={{ backgroundColor: 'var(--border-subtle)' }} />

                                {navPages.map((page) => {
                                    const Icon = page.icon;
                                    const isActive = pathname === page.href;
                                    return (
                                        <Link
                                            key={page.href}
                                            href={page.href}
                                            onClick={() => setIsNavMenuOpen(false)}
                                            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-all rounded-lg mx-1"
                                            style={{
                                                color: isActive ? page.color : 'var(--text-secondary)',
                                                backgroundColor: isActive ? `${page.color}10` : 'transparent',
                                                width: 'calc(100% - 8px)',
                                            }}
                                            onMouseEnter={e => {
                                                if (!isActive) {
                                                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                                    e.currentTarget.style.color = 'var(--text-primary)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isActive) {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                                }
                                            }}
                                        >
                                            <div
                                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    backgroundColor: isActive ? `${page.color}18` : 'var(--overlay-bg)',
                                                    border: `1px solid ${isActive ? `${page.color}30` : 'var(--border-subtle)'}`,
                                                }}
                                            >
                                                <Icon size={14} style={{ color: page.color }} />
                                            </div>
                                            <span className="font-medium text-xs">{page.title}</span>
                                            {isActive && (
                                                <div
                                                    className="ml-auto w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: page.color }}
                                                />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ Right: Theme Toggle + User Menu ═══ */}
                <div className="flex items-center gap-3">
                    <ThemeToggle />

                    {/* User Menu */}
                    <div className="flex items-center gap-2">
                        {user ? (
                            <div className="relative">
                                {isUserMenuOpen && (
                                    <div
                                        className="fixed inset-0 z-40 cursor-default"
                                        onClick={() => setIsUserMenuOpen(false)}
                                    />
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="relative z-50 flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs border cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{
                                        backgroundColor: 'var(--overlay-bg)',
                                        borderColor: 'var(--border-medium)',
                                    }}
                                >
                                    <div
                                        className="w-7 h-7 rounded flex items-center justify-center text-[12px] font-black font-mono"
                                        style={{
                                            backgroundColor: 'rgba(217, 119, 6, 0.12)',
                                            color: '#d97706',
                                        }}
                                    >
                                        {user.username.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="text-left hidden sm:flex flex-col justify-center">
                                        <span
                                            className="font-semibold text-xs leading-none flex items-center gap-1"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {user.username.toUpperCase()}
                                            <ChevronDown
                                                size={12}
                                                className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                                                style={{ color: 'var(--text-tertiary)' }}
                                            />
                                        </span>
                                        <span className="text-[9px] block font-mono mt-0.5" style={{ color: '#d97706' }}>
                                            {user.jobTitle?.toUpperCase() || 'MANAGER'}
                                        </span>
                                    </div>
                                </button>

                                {isUserMenuOpen && (
                                    <div
                                        className="absolute right-0 top-full mt-2 w-48 rounded-xl py-2 z-50"
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-medium)',
                                            boxShadow: 'var(--shadow-lg)',
                                        }}
                                    >
                                        <div className="px-4 py-2 text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                                            حساب کاربری
                                        </div>
                                        <div className="h-px mx-2 mb-1" style={{ backgroundColor: 'var(--border-subtle)' }} />

                                        <Link
                                            href="/DashBoard/Profile"
                                            onClick={() => setIsUserMenuOpen(false)}
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
                                            onClick={() => setIsUserMenuOpen(false)}
                                            className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                                            style={{ color: 'var(--text-secondary)' }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            <Settings className="mr-2 h-4 w-4" />
                                            <span className="mr-2">تنظیمات</span>
                                        </Link>

                                        <div className="h-px mx-2 my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />

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
                                className="hidden sm:block w-28 h-9 rounded-xl animate-pulse"
                                style={{ backgroundColor: 'var(--overlay-bg)' }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
