"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VarianceControlPage from '@/components/VarianceControlPage'; // مسیر را بر اساس ساختار پوشه خود تنظیم کنید
import { apiClient } from '@/lib/api'; // مسیر فایل api.tsx

export default function EVMDashboardPage() {
    const router = useRouter();

    // استیت‌های لودینگ و داده‌های پایه
    const [isLoading, setIsLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [nodes, setNodes] = useState([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // واکشی همزمان (Parallel Fetching) برای سرعت بیشتر
                const [projectsRes, revisionsRes, activitiesRes] = await Promise.all([
                    apiClient.get('planning/projects/'),
                    apiClient.get('planning/revisions/'),
                    apiClient.get('planning/activities/') // دریافت تسک‌ها از ActivityNodeViewSet
                ]);

                setProjects(projectsRes.data);
                setRevisions(revisionsRes.data);

                // مپ کردن داده‌های بک‌اند به تایپ ProjectNode مورد نیاز فرانت‌اند
                const mappedNodes = activitiesRes.data.map((act: any) => ({
                    id: act.task, // آیدی اصلی تسک
                    type: 'activity',
                    name: act.title,
                    code: act.wbs_code || act.sequence?.toString() || 'TSK', // کد WBS یا ترتیب
                    startDate: act.planned_start,
                    endDate: act.planned_finish,
                    duration: parseFloat(act.duration_hours),
                }));

                setNodes(mappedNodes);
            } catch (error) {
                console.error("خطا در بارگذاری داده‌های پایه EVM:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // هندلر خروج از داشبورد
    const handleExit = () => {
        router.push('/'); // مسیر برگشت به داشبورد اصلی پروژه‌ها را اینجا تنظیم کنید
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-cyan-400 font-mono text-sm tracking-widest font-bold uppercase">
            Loading EVM Workspace...
          </span>
                </div>
            </div>
        );
    }

    return (
        <main className="h-full w-full overflow-hidden">
            <VarianceControlPage
                projects={projects}
                revisions={revisions}
                nodes={nodes}
                users={[]} // اگر در کامپوننت به لیست کاربران نیاز دارید، از یک API دیگر واکشی کنید
                currentUser={null} // کانتکست کاربر لاگین شده (در صورت استفاده از Context API اینجا پاس دهید)
                isLightMode={false} // تم تاریک دیفالت
                onExit={handleExit}
            />
        </main>
    );
}