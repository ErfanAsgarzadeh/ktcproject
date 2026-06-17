"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import PersonalTasksPage from '@/components/PersonalTasksPage'; // مسیر کامپوننت را در صورت نیاز اصلاح کنید
import { apiClient } from '@/lib/api'; // مسیر فایل api.tsx را اصلاح کنید
import { CustomUser } from '@/types/types';

export default function PersonalTasksRoute() {
    const router = useRouter();
    const { theme, systemTheme } = useTheme();

    // تشخیص تم فعلی برای پاس دادن به کامپوننت
    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isLightMode = currentTheme === 'light';

    // استیت‌های مربوط به کاربران
    const [users, setUsers] = useState<CustomUser[]>([]);
    const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setIsLoading(true);

                // ۱. دریافت اطلاعات کاربر فعلی (لاگین شده)
                // فرض بر این است که اندپوینتی برای گرفتن پروفایل کاربر دارید
                const profileRes = await apiClient.get('auth/profile/');
                setCurrentUser(profileRes.data);

                // ۲. دریافت لیست کل کاربران برای دراپ‌داون فرم
                const usersRes = await apiClient.get('auth/users/');
                setUsers(usersRes.data);

            } catch (error) {
                console.error("Failed to fetch initial dependencies:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // تابع بازگشت به صفحه اصلی یا داشبورد
    const handleExit = () => {
        router.push('/');
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest">Initializing Environment...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <PersonalTasksPage
                users={users}
                currentUser={currentUser}
                isLightMode={isLightMode}
                onExit={handleExit}
                // این ۳ پراپ در نسخه جدید بک‌اندمحور استفاده نمی‌شوند، اما برای رفع خطای تایپ‌اسکریپت
                // در اینترفیس PersonalTasksPageProps مقادیر خالی پاس داده می‌شوند.
                // (بهتر است بعداً آن‌ها را از اینترفیس کامپوننت پاک کنید)
                projects={[]}
                revisions={[]}
                taskRoles={[]}
            />
        </div>
    );
}