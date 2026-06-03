'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api'; // مسیر فایل api خود را تنظیم کنید
import { Project, Revision, CustomUser, TaskRole } from '@/types/types'; // مسیر تایپ‌ها

// ایمپورت کامپوننت اصلی
import ApprovalsPage from '@/components/ApprovalsPage';

export default function ApprovalsRoutePage() {
    const router = useRouter();

    // 1. استیت‌های مربوط به دیتای پایه
    const [projects, setProjects] = useState<Project[]>([]);
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [users, setUsers] = useState<CustomUser[]>([]);
    const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
    const [taskRoles, setTaskRoles] = useState<TaskRole[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);

    // 2. استیت‌های وضعیت صفحه (لودینگ و تم)
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLightMode, setIsLightMode] = useState(false);

    // 3. دریافت اطلاعات هنگام لود شدن مسیر
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setIsLoading(true);

                // الف) دریافت پروفایل کاربر لاگین شده
                const profileRes = await apiClient.get('/auth/profile/');
                const loggedInUser = profileRes.data.results ? profileRes.data.results[0] : profileRes.data;

                if (!loggedInUser || !loggedInUser.id) {
                    throw new Error("اطلاعات کاربری یافت نشد. لطفاً دوباره وارد شوید.");
                }

                setCurrentUser(loggedInUser);

                // ب) دریافت موازی تمام اطلاعات مورد نیاز داشبورد از API
                const [projRes, revRes, usersRes, rolesRes, tasksRes] = await Promise.all([
                    apiClient.get('/planning/projects/'),
                    apiClient.get('/planning/revisions/'),
                    apiClient.get('/auth/users/'), // اگر اندپوینت لیست کاربران دارید
                    apiClient.get('/planning/task-roles/'),
                    apiClient.get('/planning/activities/') // دریافت کل تسک‌ها
                ]);

                // ج) ذخیره در استیت‌ها
                setProjects(projRes.data.results || projRes.data);
                setRevisions(revRes.data.results || revRes.data);
                setUsers(usersRes.data.results || usersRes.data || [loggedInUser]);
                setTaskRoles(rolesRes.data.results || rolesRes.data);
                setTasks(tasksRes.data.results || tasksRes.data);

            } catch (err: any) {
                console.error("خطا در دریافت اطلاعات مسیر:", err);
                setError(err.message || "خطا در برقراری ارتباط با سرور");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // 4. توابع کمکی (چت و آپدیت سراسری)
    const handleAddChatMessage = async (taskId: string, userId: string, text: string) => {
        try {
            await apiClient.post('/planning/task-chats/', {
                task: taskId,
                text: text
            });
            // توجه: در ApprovalsPage ما چت‌ها را به صورت prop پاس ندادیم چون معمولا
            // در خود آن کامپوننت فچ نمیشوند، اما تابع ارسال را فراهم کردیم.
        } catch (error) {
            console.error("خطا در ارسال پیام سیستمی چت:", error);
        }
    };

    const handleGlobalProgressUpdate = (revisionId: string, taskId: string, progress: number) => {
        console.log(`سیستم: پیشرفت تسک ${taskId} در نسخه ${revisionId} به ${progress}% تغییر یافت.`);
        // در صورت نیاز به آپدیت گانت چارت در پس‌زمینه، کد مربوطه اینجا قرار می‌گیرد
    };

    // 5. هندل کردن وضعیت‌های لودینگ و خطا پیش از رندر کامپوننت اصلی
    if (isLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0f1d] text-cyan-400 font-mono space-y-4">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">در حال بارگذاری سیستم مدیریت گزارشات...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0f1d] text-rose-400 space-y-4">
                <p>⚠️ {error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-rose-500/20 rounded-lg text-xs hover:bg-rose-500/30 transition"
                >
                    تلاش مجدد
                </button>
            </div>
        );
    }

    // 6. رندر کامپوننت اصلی و پاس دادن دیتای آماده شده
    return (
        <div className="h-screen w-screen overflow-hidden">
            <ApprovalsPage
                users={users}
                currentUser={currentUser}
                projects={projects}
                revisions={revisions}
                taskRoles={taskRoles}
                tasks={tasks}
                onExit={() => router.back()} // استفاده از روتر Next.js برای بازگشت
                onAddChatMessage={handleAddChatMessage}
                onGlobalProgressUpdate={handleGlobalProgressUpdate}
                isLightMode={isLightMode}
                onToggleTheme={() => setIsLightMode(!isLightMode)}
            />
        </div>
    );
}