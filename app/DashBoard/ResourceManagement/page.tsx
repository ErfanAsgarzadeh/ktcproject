'use client';

import React, { useState, useEffect } from 'react';
import ResourceManagement from '@/components/ResourceManagement'; // آدرس ایمپورت را بررسی کنید
import { CustomUser, ProjectNode, TaskRole, Revision } from '@/types/types'; // آدرس تایپ‌ها را بررسی کنید
import { Loader2 } from 'lucide-react';

// ایمپورت apiClient برای ریکوئست‌های احراز هویت شده
import { apiClient } from '@/lib/api';

export default function ResourceManagementPage() {
    // ==========================================
    // ۱. استیت‌های مورد نیاز کامپوننت فرزند
    // ==========================================
    const [users, setUsers] = useState<CustomUser[]>([]);
    const [nodes, setNodes] = useState<ProjectNode[]>([]);
    const [taskRoles, setTaskRoles] = useState<TaskRole[]>([]);
    const [currentRevision, setCurrentRevision] = useState<Revision | null>(null);

    const [isLightMode, setIsLightMode] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // ==========================================
    // ۲. دریافت اطلاعات پایه پروژه از بک‌اند
    // ==========================================
    useEffect(() => {
        const fetchProjectBaseline = async () => {
            setIsLoading(true);
            try {
                // ۱. ابتدا لیست ریویژن‌ها را می‌گیریم تا نسخه فعال را پیدا کنیم
                const revRes = await apiClient.get('planning/revisions/');
                const revisions: Revision[] = revRes.data;

                // پیدا کردن نسخه‌ای که هنوز تایید/قفل نشده است (نسخه جاری)
                // اگر سیستم شما روش دیگری برای پیدا کردن نسخه فعال دارد، این بخش را تغییر دهید
                const activeRev = revisions.find(r => !r.approvedAt) || revisions[0];

                setCurrentRevision(activeRev || null);

                if (activeRev) {
                    // ۲. دریافت داده‌های مرتبط با این ریویژن به صورت موازی
                    const [usersRes, ganttRes, rolesRes] = await Promise.all([
                        apiClient.get('auth/users/'), // فرض بر این است که اندپوینت کاربران را دارید
                        apiClient.get(`planning/revisions/${activeRev.id}/gantt-data/`), // اندپوینتی که در views.py برای گانت‌چارت نوشته بودید
                        apiClient.get(`planning/task-roles/?revision_id=${activeRev.id}`)
                    ]);

                    setUsers(usersRes.data);
                    // در متد gantt-data بک‌اند، لیست گره‌ها داخل کلید nodes برمی‌گردد
                    setNodes(ganttRes.data.nodes || []);
                    setTaskRoles(rolesRes.data);
                } else {
                    // اگر ریویژنی نبود، حداقل کاربران را بگیریم
                    const usersRes = await apiClient.get('auth/users/');
                    setUsers(usersRes.data);
                }

            } catch (error) {
                console.error("Error fetching baseline data from backend:", error);
                alert("Error fetching baseline project data from server.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjectBaseline();
    }, []);

    // ==========================================
    // ۳. هندلرهای عمومی صفحه
    // ==========================================
    const handleUpdateNode = (id: string, updatedFields: Partial<ProjectNode>) => {
        // آپدیت کردن گره‌ها در حافظه (State)
        setNodes(prevNodes =>
            prevNodes.map(node =>
                node.id === id ? ({ ...node, ...updatedFields } as ProjectNode) : node
            )
        );
    };

    // ==========================================
    // ۴. رندر صفحه
    // ==========================================
    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center text-cyan-500" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="font-mono text-sm tracking-widest uppercase">Loading Project Workspace...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

            {/* هدر صفحه */}


            {/* ناحیه اصلی و تزریق کامپوننت مدیریت منابع */}
            <main className="flex-1 overflow-hidden relative">
                <ResourceManagement
                    users={users}
                    nodes={nodes}
                    taskRoles={taskRoles}
                    currentRevision={currentRevision}
                    handleUpdateNode={handleUpdateNode}
                    isLightMode={isLightMode}
                />
            </main>

        </div>
    );
}