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
                console.error("کاربر احراز هویت نشده است", error);
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
            console.error("خطا در هنگام خروج:", error);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setUser(null);
            router.push('/Login');
        }
    };

    return (
        <header className="relative z-[60] w-full bg-[#0a0f1d] font-sans text-slate-200 transition-colors shrink-0">
            <div className="mx-auto w-full flex items-center justify-between">
                <div className="p-4 flex items-center">
                    <nav className="hidden md:flex gap-4 text-sm font-medium">
                        <Link href="/DashBoard" className="hover:text-white transition-colors"><LayoutDashboard size={20} /></Link>
                        <Link href="/DashBoard/ResourcePlan" className="hover:text-white transition-colors" title="Resource Plan"><Users size={20} /></Link>
                        <Link href="/settings" className="hover:text-white transition-colors"><Settings size={20} /></Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4 px-4">
                    <ThemeToggle />

                    <div className="flex items-center gap-2">
                        {user ? (
                            <div className="relative">
                                {/* لایه نامرئی برای بستن منو با کلیک روی هر جای صفحه */}
                                {isDropdownOpen && (
                                    <div
                                        className="fixed inset-0 z-40 cursor-default"
                                        onClick={() => setIsDropdownOpen(false)}
                                    ></div>
                                )}

                                {/* دکمه باز کردن منو (z-50 بالاتر از لایه نامرئی است تا قابل کلیک بماند) */}
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="relative z-50 flex flex-col text-xs cursor-pointer hover:opacity-80 transition-opacity outline-none text-right"
                                >
                                    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-xs">
                                        <div className="w-7 h-7 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center text-[14px] font-black font-mono">
                                            {user.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="text-left flex flex-col justify-center">
                                            <span className="text-slate-200 font-semibold text-xs leading-none flex items-center gap-1">
                                                {user.username.toUpperCase()}
                                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                            </span>
                                            <span className="text-[9px] text-amber-400 block font-mono mt-1">
                                                {user.jobTitle?.toUpperCase() || 'MANAGER'}
                                            </span>
                                        </div>
                                    </div>
                                </button>

                                {/* محتوای منوی کشویی */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-48 rounded-xl border border-slate-800 bg-[#111827] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-2 text-xs text-slate-400 mb-1">
                                            حساب کاربری
                                        </div>

                                        <div className="h-px bg-slate-800 mb-1"></div>

                                        <Link
                                            href="/Profile"
                                            onClick={() => setIsDropdownOpen(false)}
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            <User className="mr-2 h-4 w-4" />
                                            <span className="mr-2">پروفایل من</span>
                                        </Link>

                                        <Link
                                            href="/settings"
                                            onClick={() => setIsDropdownOpen(false)}
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            <Settings className="mr-2 h-4 w-4" />
                                            <span className="mr-2">تنظیمات</span>
                                        </Link>

                                        <div className="h-px bg-slate-800 my-1"></div>

                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors text-left"
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span className="mr-2">خروج</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="hidden sm:block w-32 h-10 bg-slate-800/50 rounded-xl animate-pulse"></div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}