// app/management/page.tsx (یا مسیر دلخواه شما)

'use client'

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api'; // مسیر را بر اساس ساختار پوشه‌های خود تنظیم کنید
import { Project, CustomUser } from '@/types/types';
import ManagementDashboard from '@/components/ManagementDashboard'; // ایمپورت کامپوننتی که ساختیم

export default function DedicatedManagementPage() {
    // State های مورد نیاز برای تغذیه کامپوننت داشبورد
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // دریافت اطلاعات پایه به محض لود شدن این صفحه اختصاصی
        const fetchInitialData = async () => {
            try {
                setIsLoading(true);

                // ۱. دریافت پروفایل کاربر
                const userRes = await apiClient.get('/auth/profile/');
                setCurrentUser(userRes.data);

                // ۲. دریافت لیست پروژه‌ها
                const projRes = await apiClient.get('/planning/projects/');
                setProjects(projRes.data.results || projRes.data);

            } catch (error) {
                console.error('Failed to fetch data for management page:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // صفحه لودینگ اولیه تا زمانی که دیتا از سرور برسد
    if (isLoading) {
        return (
            <div className="h-full min-h-0 w-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">
                    Initializing Executive Environment...
                </p>
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 w-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>



            {/* فراخوانی کامپوننت اصلی با پاس دادن Props */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
                <ManagementDashboard
                    projects={projects}
                    currentUser={currentUser}
                />
            </div>

        </div>
    );
}
