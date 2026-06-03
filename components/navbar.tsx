'use client';

import Link from 'next/link';
import { ThemeToggle } from './themeChangeToggle';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api'; // کلاینت API که در مرحله قبل ساختیم
import { CustomUser } from '../types/types';
import { User,Settings,LayoutDashboard } from 'lucide-react';

export default function Navbar() {
    const [user, setUser] = useState<CustomUser | null>(null);

    useEffect(() => {
        // دریافت اطلاعات کاربر لاگین شده به محض لود شدن نوبار
        const fetchProfile = async () => {
            try {
                const response = await apiClient.get('/auth/profile/');
                setUser(response.data);
            } catch (error) {
                console.error("کاربر احراز هویت نشده است", error);
            }
        };

        // اگر توکن وجود داشت درخواست بزن
        if (typeof window !== 'undefined' && localStorage.getItem('access_token')) {
            fetchProfile();
        }
    }, []);

    return (
        <header className="sticky top-0 z-50 w-full  bg-[#0a0f1d] font-sans text-slate-200 transition-colors">
            <div className=" mx-auto w-full  flex items-center justify-between">
                <div className="p-4 flex items-center ">
                    <nav className="hidden md:flex gap-4 text-sm font-medium ">
                        <Link href="/DashBoard" className=""><LayoutDashboard/></Link>
                        <Link href="/settings" className=""><Settings/></Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <ThemeToggle />

                    {/* نمایش پروفایل کاربر با دیتای واقعی */}
                    <div className="flex items-center gap-2">

                        {user && (
                            <div className="hidden sm:flex flex-col text-xs">
                                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-amber-550/5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-xs">
                                    <div className="w-4 h-4 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center text-[8px] font-black font-mono">
                                        {user.username.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="text-slate-200 font-semibold text-xs leading-none">{user.username}</span>
                                        <span className="text-[9px] text-amber-400 block font-mono">{user.jobTitle || 'Manager'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}