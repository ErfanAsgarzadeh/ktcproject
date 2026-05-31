'use client';

import Link from 'next/link';
import { ThemeToggle } from './themeChangeToggle';
import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api'; // کلاینت API که در مرحله قبل ساختیم
import { CustomUser } from '../types/types';
import { User } from 'lucide-react';

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
        <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 transition-colors">
            <div className="container mx-auto px-4  flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="font-bold text-xl text-gray-900 dark:text-white">
                        Apex WBS
                    </Link>
                    <nav className="hidden md:flex gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                        <Link href="/dashboard" className="hover:text-cyan-600 dark:hover:text-cyan-400">داشبورد</Link>
                        <Link href="/settings" className="hover:text-cyan-600 dark:hover:text-cyan-400">تنظیمات</Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <ThemeToggle />

                    {/* نمایش پروفایل کاربر با دیتای واقعی */}
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                            <User className="w-5 h-5" />
                        </div>
                        {user && (
                            <div className="hidden sm:flex flex-col text-xs">
                                <span className="font-bold text-gray-800 dark:text-gray-200">{user.username}</span>
                                <span className="text-gray-500 dark:text-gray-400">{user.jobTitle || 'کاربر سیستم'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}